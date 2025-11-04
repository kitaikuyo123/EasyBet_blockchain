import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EasyBet", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, player1, player2, player3] = await ethers.getSigners();

    // 部署 EasyToken 合约
    const EasyToken = await ethers.getContractFactory("EasyToken");
    const easyToken = await EasyToken.deploy();
    await easyToken.deployed();

    // 部署 EasyBet 合约
    const EasyBet = await ethers.getContractFactory("EasyBet");
    const easyBet = await EasyBet.deploy();
    await easyBet.deployed();

    await easyBet.initialize(easyToken.address);

    return { easyToken, easyBet, owner, player1, player2, player3 };
  }

  describe("Full Gamble Process", function () {
    it("Should complete a full gamble process correctly", async function () {
      const { easyToken, easyBet, owner, player1, player2, player3 } = await loadFixture(deployFixture);
      
      // 所有玩家从水龙头获取代币
      await easyToken.connect(owner).faucet();
      await easyToken.connect(player1).faucet();
      await easyToken.connect(player2).faucet();
      await easyToken.connect(player3).faucet();

      const initialOwnerBalance = await easyToken.balanceOf(owner.address);
      const initialPlayer1Balance = await easyToken.balanceOf(player1.address);
      const initialPlayer2Balance = await easyToken.balanceOf(player2.address);
      const initialPlayer3Balance = await easyToken.balanceOf(player3.address);

      // 授权EasyBet合约可以使用玩家的代币
      const betAmount = ethers.utils.parseEther("10");
      await easyToken.connect(player1).approve(easyBet.address, betAmount);
      await easyToken.connect(player2).approve(easyBet.address, betAmount);
      await easyToken.connect(player3).approve(easyBet.address, betAmount);

      // 1. 创建竞猜 (选项: "Team A wins", "Team B wins")
      const choices = ["Team A wins", "Team B wins"];
      const totalPrize = ethers.utils.parseEther("20"); // 总奖金
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600; // 1小时后截止
      await expect(easyBet.connect(owner).createAGamble(choices, totalPrize, deadline))
        .to.emit(easyBet, "GambleCreated")
        .withArgs(0, choices, owner.address);

      // 2. 玩家下注
      // 玩家1下注Team A wins
      await expect(easyBet.connect(player1).placeABet(0, betAmount, 0))
        .to.emit(easyBet, "BetPlaced");

      // 玩家2下注Team B wins
      await expect(easyBet.connect(player2).placeABet(0, betAmount, 1))
        .to.emit(easyBet, "BetPlaced");

      // 玩家3下注Team A wins
      await expect(easyBet.connect(player3).placeABet(0, betAmount, 0))
        .to.emit(easyBet, "BetPlaced");

      // 检查投注是否成功
      expect(await easyBet.betCount()).to.equal(3);
      expect(await easyBet.gambleCount()).to.equal(1);

      // 3. 玩家将下注挂牌出售
      // 玩家1将其下注挂牌，售价为5个代币
      const sellPrice = ethers.utils.parseEther("5");
      await expect(easyBet.connect(player1).listABet(0, sellPrice))
        .to.emit(easyBet, "BetListed")
        .withArgs(0, sellPrice, player1.address);

      // 4. 其他玩家购买挂牌的下注
      // 玩家2购买玩家1挂牌的下注
      await easyToken.connect(player2).approve(easyBet.address, sellPrice);
      await expect(easyBet.connect(player2).buyABet(0))
        .to.emit(easyBet, "BetSold")
        .withArgs(0, sellPrice, player2.address);

      // 5. 推进时间到竞猜截止时间之后
      await ethers.provider.send("evm_increaseTime", [3601]); // 增加1小时1秒
      await ethers.provider.send("evm_mine", []); // 挖掘新区块

      // 6. 竞猜创建者宣布结果 (假设Team A wins)
      await expect(easyBet.connect(owner).declareAGambleResult(0, 0))
        .to.emit(easyBet, "GambleResultDeclared")
        .withArgs(0, 0);

      // 7. 竞猜创建者完成竞猜并分配奖金
      await expect(easyBet.connect(owner).finishAGamble(0))
        .to.emit(easyBet, "GambleFinished")
        .withArgs(0);

      // 8. 验证结果
      // 玩家1和玩家3下注了Team A wins (获胜方)
      // 玩家2下注了Team B wins (失败方)
      // 玩家2还购买了玩家1的下注，所以现在拥有那个NFT
      const finalOwnerBalance = await easyToken.balanceOf(owner.address);
      const finalPlayer1Balance = await easyToken.balanceOf(player1.address);
      const finalPlayer2Balance = await easyToken.balanceOf(player2.address);
      const finalPlayer3Balance = await easyToken.balanceOf(player3.address);

      // 检查余额变化
      // 玩家1出售了下注，获得了sellPrice的代币，但最初也投入了betAmount
      // 净变化 = sellPrice - betAmount
      expect(finalPlayer1Balance.sub(initialPlayer1Balance)).to.equal(sellPrice.sub(betAmount));
      
      // 玩家2是获胜者之一，应该获得一部分奖金
      // 总奖金20个代币，2个获胜者，每人10个代币
      // 但玩家2也花了10个代币下注，花了5个代币购买下注
      // 所以净变化 = 10 (奖金) - 10 (下注) - 5 (购买下注) = -5
      expect(finalPlayer2Balance.sub(initialPlayer2Balance)).to.equal(ethers.BigNumber.from("-5").mul(ethers.BigNumber.from("10").pow(18)));

      // 玩家3是获胜者之一，应该获得一部分奖金
      // 玩家3获得10个代币奖金，但也投入了10个代币下注
      // 所以净变化为0
      expect(finalPlayer3Balance.sub(initialPlayer3Balance)).to.equal(0);

      // 验证竞猜状态
      const gamble = await easyBet.gambles(0);
      expect(gamble.finished).to.be.true;
      expect(gamble.winningChoice).to.equal(0);
    });
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { easyBet } = await loadFixture(deployFixture);
      expect(easyBet.address).to.properAddress;
    });

    it("Should have initial bet count of 0", async function () {
      const { easyBet } = await loadFixture(deployFixture);
      expect(await easyBet.betCount()).to.equal(0);
    });
  });

  describe("EasyToken", function () {
    it("Should allow users to get tokens from faucet", async function () {
      const { easyToken, owner } = await loadFixture(deployFixture);
      const initialBalance = await easyToken.balanceOf(owner.address);
      
      await easyToken.faucet();
      
      const finalBalance = await easyToken.balanceOf(owner.address);
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.BigNumber.from("100").mul(ethers.BigNumber.from("10").pow(18)));
    });
  });
});