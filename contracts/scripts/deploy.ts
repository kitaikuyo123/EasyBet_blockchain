import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.1"))) {
    throw new Error("Insufficient balance for deployment");
  }

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

  // 自动复制ABI文件到前端目录
  copyAbiFiles(easyTokenAddress, easyBet.address);
}

function copyAbiFiles(easyTokenAddress: string, easyBetAddress: string) {
  const sourceDir = path.join(__dirname, "..", "artifacts", "contracts");
  const targetDir = path.join(__dirname, "..", "..", "frontend", "src", "abi");

  // 确保目标目录存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 复制EasyToken ABI
  const easyTokenSource = path.join(sourceDir, "EasyBet.sol", "EasyToken.json");
  const easyTokenTarget = path.join(targetDir, "EasyToken.json");
  
  if (fs.existsSync(easyTokenSource)) {
    fs.copyFileSync(easyTokenSource, easyTokenTarget);
    console.log("EasyToken ABI copied to frontend");
  }

  // 复制EasyBet ABI
  const easyBetSource = path.join(sourceDir, "EasyBet.sol", "EasyBet.json");
  const easyBetTarget = path.join(targetDir, "EasyBet.json");
  
  if (fs.existsSync(easyBetSource)) {
    fs.copyFileSync(easyBetSource, easyBetTarget);
    console.log("EasyBet ABI copied to frontend");
  }

  // 更新合约地址（可选）
  updateContractAddresses(easyTokenAddress, easyBetAddress);
}

function updateContractAddresses(easyTokenAddress: string, easyBetAddress: string) {
  const addressesFile = path.join(__dirname, "..", "..", "frontend", "src", "contract_addresses.json");
  
  const addresses = {
    EasyToken: easyTokenAddress,
    EasyBet: easyBetAddress
  };
  
  fs.writeFileSync(addressesFile, JSON.stringify(addresses, null, 2));
  console.log("Contract addresses saved to frontend");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});