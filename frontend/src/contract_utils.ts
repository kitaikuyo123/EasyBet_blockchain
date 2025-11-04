import { ethers, Contract } from 'ethers';
import EasyBetArtifact from './abi/EasyBet.json';
import EasyTokenArtifact from './abi/EasyToken.json';

const EASY_TOKEN_ADDRESS = '0x2c5f3c004878923f55A2a255F89Fe29393177509';
const EASY_BET_ADDRESS = '0x2f3efA6bbDC5fAf4dC1a600765c7B7829e47bE10';

let easyBetContract: Contract | null = null;
let easyTokenContract: Contract | null = null;
let provider: ethers.providers.Web3Provider | null = null;
let signer: ethers.Signer | null = null;

const GANACHE_CHAIN_ID = "0x539"; // 1337 的十六进制表示（必须用十六进制）
const GANACHE_RPC_URL = "http://127.0.0.1:2853";

export const initContracts = async () => {
  if (typeof window.ethereum === 'undefined') {
    alert('Please install MetaMask to use this DApp');
    return false;
  }

  try {
    // 1. 检查并切换到 Ganache 网络
    const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
    if (currentChainId !== GANACHE_CHAIN_ID) {
      // 强制切换到 Ganache 网络
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: GANACHE_CHAIN_ID }], // 必须用十六进制链 ID
      });
    }

    // 2. 初始化 provider（此时已确保是 Ganache 网络）
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []); // 请求授权账户
    signer = provider.getSigner();

    // 3. 验证合约地址是否在当前网络有效（可选但推荐）
    const tokenCode = await provider.getCode(EASY_TOKEN_ADDRESS);
    if (tokenCode === "0x") {
      alert(`EasyToken 合约在当前网络不存在，请检查地址: ${EASY_TOKEN_ADDRESS}`);
      return false;
    }
    const betCode = await provider.getCode(EASY_BET_ADDRESS);
    if (betCode === "0x") {
      alert(`EasyBet 合约在当前网络不存在，请检查地址: ${EASY_BET_ADDRESS}`);
      return false;
    }

    // 4. 初始化合约实例
    easyTokenContract = new ethers.Contract(
      EASY_TOKEN_ADDRESS,
      EasyTokenArtifact.abi,
      signer
    );
    easyBetContract = new ethers.Contract(
      EASY_BET_ADDRESS,
      EasyBetArtifact.abi,
      signer
    );

    return true;
  } catch (error) {
    console.error("初始化合约失败:", error);
    // 若用户未添加 Ganache 网络，提示添加
    if ((error as any).code === 4902) {
      alert("请先添加 Ganache 本地网络到 MetaMask");
      // 可选：自动添加网络
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: GANACHE_CHAIN_ID,
          chainName: "Ganache Local",
          rpcUrls: [GANACHE_RPC_URL],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        }],
      });
    }
    return false;
  }
};

export const setupAccountChangeListener = (callback: (newAccount: string) => void) => {
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length > 0) {
        // 更新 signer
        if (provider) {
          signer = provider.getSigner();
          
          // 重新初始化合约实例以使用新的 signer
          if (easyTokenContract && easyBetContract) {
            easyTokenContract = new ethers.Contract(
              EASY_TOKEN_ADDRESS,
              EasyTokenArtifact.abi,
              signer
            );
            easyBetContract = new ethers.Contract(
              EASY_BET_ADDRESS,
              EasyBetArtifact.abi,
              signer
            );
          }
          
          callback(accounts[0]);
        }
      }
    });
  }
};

export const getAccount = async () => {
  if (provider) {
    const accounts = await provider.listAccounts();
    return accounts[0];
  }
  return null;
};

export const getBalance = async () => {
  if (easyTokenContract && signer) {
    const account = await getAccount();
    if (account) {
      const balance = await easyTokenContract.balanceOf(account);
      return ethers.utils.formatEther(balance);
    }
  }
  return '0';
};

export const faucet = async () => {
  if (easyTokenContract) {
    try {
      const tx = await easyTokenContract.faucet();
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Faucet error:', error);
      return false;
    }
  }
  return false;
};

export const placeBet = async (gambleId: number, amount: string, choice: number) => {
  if (easyBetContract && easyTokenContract && provider) {
    try {
          
      const amountWei = ethers.utils.parseEther(amount);
      const approveTx = await easyTokenContract.approve(easyBetContract.address, amountWei);
      await approveTx.wait();
    
      // Place the bet
      console.log("Placing bet...");
      const tx = await easyBetContract.placeABet(gambleId, amountWei, choice);
      console.log("Bet transaction sent:", tx.hash);
      
      return false;
    }
    catch (error) {
      console.error('Contracts not initialized');
      alert('Contracts not initialized');
      return false;
    }
  }
  return false;
};
export const createGamble = async (choices: string[], totalPrize: string, deadline: number) => {
  if (easyBetContract && easyTokenContract) {
    try {
      const totalPrizeWei = ethers.utils.parseEther(totalPrize);
      console.log("Creating gamble with parameters:", { choices, totalPrizeWei: totalPrizeWei.toString(), deadline });
      
      const approveTx = await easyTokenContract.approve(easyBetContract.address, totalPrizeWei);
      await approveTx.wait();

      const tx = await easyBetContract.createAGamble(choices, totalPrizeWei, deadline);
      console.log("Create gamble transaction sent:", tx.hash);
      await tx.wait();
      console.log("Gamble created successfully");
      return true;
    } catch (error) {
      console.error('Create gamble error:', error);
      
      if ((error as any).reason) {
        console.error('Error reason:', (error as any).reason);
      }
      
      if ((error as any).message) {
        console.error('Error message:', (error as any).message);
        alert('Create gamble error: ' + (error as any).message);
      } else {
        alert('Failed to create gamble. Check console for details.');
      }
      
      return false;
    }
  }
  console.error('EasyBet contract not initialized');
  alert('EasyBet contract not initialized');
  return false;
};

export const listBet = async (betId: number, price: string) => {
  if (easyBetContract) {
    try {
      const priceWei = ethers.utils.parseEther(price);
      console.log("Listing bet with parameters:", { betId, priceWei: priceWei.toString() });
      
      const tx = await easyBetContract.listABet(betId, priceWei);
      console.log("List bet transaction sent:", tx.hash);
      await tx.wait();
      console.log("Bet listed successfully");
      return true;
    } catch (error) {
      console.error('List bet error:', error);
      
      if ((error as any).reason) {
        console.error('Error reason:', (error as any).reason);
      }
      
      if ((error as any).message) {
        console.error('Error message:', (error as any).message);
        alert('List bet error: ' + (error as any).message);
      } else {
        alert('Failed to list bet. Check console for details.');
      }
      
      return false;
    }
  }
  console.error('EasyBet contract not initialized');
  alert('EasyBet contract not initialized');
  return false;
};

export const buyBet = async (betId: number) => {
  if (easyBetContract && easyTokenContract) {
    try {
      console.log("Buying bet...");
      console.log("Bet ID:", betId);

      const listing = await easyBetContract.betListings(betId); 
      const price = listing.price; 

      const approveTx = await easyTokenContract.approve(easyBetContract.address, price);
      await approveTx.wait(); // 等待授权交易确认
      console.log("授权成功，交易哈希:", approveTx.hash);

      const tx = await easyBetContract.buyABet(betId);
      console.log("Buy bet transaction sent:", tx.hash);
      await tx.wait();
      console.log("Bet bought successfully");
      return true;
    } catch (error) {
      console.error('Buy bet error:', error);
      
      if ((error as any).reason) {
        console.error('Error reason:', (error as any).reason);
      }
      
      if ((error as any).message) {
        console.error('Error message:', (error as any).message);
        alert('Buy bet error: ' + (error as any).message);
      } else {
        alert('Failed to buy bet. Check console for details.');
      }
      
      return false;
    }
  }
  console.error('Contracts not initialized');
  alert('Contracts not initialized');
  return false;
};

export const getGamblesNum = async () => { 
  if (easyBetContract) {
    try {
      const gamblesNum = await easyBetContract.gambleCount();
      return gamblesNum;
    } catch (error) {
      console.error('Get gambleNum error:', error);
      return [];
    }
  }
  return [];
};

export const getGamble = async (gambleId: number) => {
  if (easyBetContract) {
    try {
      const gamble = await easyBetContract.gambles(gambleId);
      
      // 使用新的 getter 函数获取 choices 数组
      let choicesArray = [];
      choicesArray = await easyBetContract.getGambleChoices(gambleId);
      
      return {
        owner: gamble.owner,
        deadline: new Date(gamble.deadline.toNumber() * 1000),
        totalPrize: ethers.utils.formatEther(gamble.totalPrize),
        choices: choicesArray,
        winningChoice: gamble.winningChoice.toString(),
        finished: gamble.finished
      };
    } catch (error) {
      console.error('Get gamble error:', error);
      return null;
    }
  }
  return null;
};

export const getBet = async (betId: number) => {
  if (easyBetContract) {
    try {
      const bet = await easyBetContract.bets(betId);
      return {
        owner: bet.owner,
        gambleId: bet.gambleId.toString(),
        betAmount: ethers.utils.formatEther(bet.betAmount),
        betChoice: bet.betChoice.toString(),
        isListed: bet.isListed
      };
    } catch (error) {
      console.error('Get bet error:', error);
      return null;
    }
  }
  return null;
};

export const declareWinner = async (gambleId: number, choice: number) => { 
  if (easyBetContract) {
    try {
      const tx = await easyBetContract.declareAGambleResult(gambleId, choice);
      console.log("Declare winner transaction sent:", tx.hash);
      await tx.wait();
      console.log("Winner declared successfully");
      return true;
    }
    catch (error) {
      console.error('Declare winner error:', error);
    }
  }
};

export const finishGamble = async (gambleId: number) => { 
  if (easyBetContract) {
    try {
      const tx = await easyBetContract.finishAGamble(gambleId);
      console.log("Finish gamble transaction sent:", tx.hash);
      await tx.wait();
      console.log("Gamble finished successfully");
      return true;
    } catch (error) {
      console.error('Finish gamble error:', error);
    }
  }
};

export const getOrderBook = async (gambleId: number) => {
  if (easyBetContract) {
    try {
      // 检查合约是否有 getOrderBookForGamble 方法
      if (typeof easyBetContract.getOrderBookForGamble === 'function') {
        console.log("GambleId:", gambleId);

        const orderBookData = await easyBetContract.getOrderBookForGamble(gambleId);
        console.log("订单簿数据:", orderBookData);
        
        // 处理数据格式
        const prices = orderBookData.prices || [];
        const choiceIds = orderBookData.choiceIds || [];
        const betIds = orderBookData.betIds || [];
        
        const formattedData = [];
        for (let i = 0; i < prices.length; i++) {
          formattedData.push({
            price: ethers.utils.formatEther(prices[i]),
            choiceId: choiceIds[i].toString(),
            betId: betIds[i].toString()
          });
        }
        
        return formattedData;
      } else {
        console.warn("合约不支持 getOrderBookForGamble 方法");
        return [];
      }
    } catch (error) {
      console.error('获取订单簿信息失败:', error);
      return [];
    }
  }
  console.error('合约未初始化');
  return [];
};

export const getBetsForGamble = async (gambleId: number) => {
  if (easyBetContract) {
    try {
      // 获取 gamble 信息以获得 betIds
      const gamble = await easyBetContract.gambles(gambleId);
      
      // 使用新的 getter 函数获取 betIds 数组
      let betIdsArray = [];
      try {
        betIdsArray = await easyBetContract.getGambleBetIds(gambleId);
      } catch (error) {
        console.log("getGambleBetIds not available, using fallback");
        // 如果新函数不可用，使用回退方法
        if (gamble.betIds && Array.isArray(gamble.betIds)) {
          betIdsArray = gamble.betIds;
        }
      }
      
      // 获取每个 bet 的详细信息
      const bets = [];
      for (let i = 0; i < betIdsArray.length; i++) {
        const betId = betIdsArray[i];
        try {
          const bet = await easyBetContract.bets(betId);
          // 只添加有效的 bet（owner 不为 0 地址）
          if (bet.owner && bet.owner !== ethers.constants.AddressZero) {
            bets.push({
              id: betId.toNumber(),
              owner: bet.owner,
              gambleId: bet.gambleId.toString(),
              betAmount: ethers.utils.formatEther(bet.betAmount),
              betChoice: bet.betChoice.toString(),
              isListed: bet.isListed
            });
          }
        } catch (error) {
          console.log(`Error fetching bet ${betId}:`, error);
        }
      }
      
      return bets;
    } catch (error) {
      console.error('Get bets for gamble error:', error);
      return [];
    }
  }
  return [];
};