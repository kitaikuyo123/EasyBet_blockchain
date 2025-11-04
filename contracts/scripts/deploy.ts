import { ethers } from "hardhat";

async function main() {
  const EasyToken = await ethers.getContractFactory("EasyToken");
  const easyToken = await EasyToken.deploy();
  await easyToken.deployed();
  const easyTokenAddress = easyToken.address;
  console.log(`EasyToken deployed to ${easyTokenAddress}`);

  const EasyBet = await ethers.getContractFactory("EasyBet");
  const easyBet = await EasyBet.deploy();
  await easyBet.deployed();

  const initTx = await easyBet.initialize(easyTokenAddress);
  await initTx.wait();
  console.log(`EasyBet deployed to ${easyBet.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});