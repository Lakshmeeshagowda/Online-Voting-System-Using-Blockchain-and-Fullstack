/**
 * Votereum — Smart Contract Deploy Script (Multi-Network Supported)
 * -----------------------------------------------------------------
 * Usage:
 *   Local Ganache:   npx hardhat run scripts/deploy.cjs --network ganache
 *   Sepolia Testnet: npx hardhat run scripts/deploy.cjs --network sepolia
 *   Polygon Amoy:    npx hardhat run scripts/deploy.cjs --network amoy
 *
 * What this does:
 *   1. Compiles ElectionSystem.sol
 *   2. Deploys it to the specified network (Ganache, Sepolia, or Amoy)
 *   3. Automatically updates src/constants.ts with the new contract address
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  console.log(`\n🔨 Step 1: Compiling smart contracts for network: [${networkName}]...\n`);
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    console.error("❌ No deployer account found!");
    console.error("   For Sepolia/Amoy, ensure PRIVATE_KEY is set in your .env file.");
    console.error("   For Ganache, ensure your local Ganache GUI is running on http://127.0.0.1:7545.");
    process.exit(1);
  }

  const deployerAddress = await deployer.getAddress();
  const balance = await hre.ethers.provider.getBalance(deployerAddress);

  console.log(`✅ Connected to Network: ${networkName}`);
  console.log(`   Deployer (Admin): ${deployerAddress}`);
  console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH / MATIC\n`);

  if (balance === 0n && networkName !== "ganache" && networkName !== "hardhat") {
    console.error(`❌ Insufficient testnet funds in deployer wallet!`);
    console.error(`   Wallet Address: ${deployerAddress}`);
    console.error(`   Current Balance: 0.0 ETH`);
    console.error(`\n   To get free Sepolia ETH:`);
    console.error(`   1. Open: https://cloud.google.com/application/web3/faucet/ethereum/sepolia`);
    console.error(`   2. Paste your address: ${deployerAddress}`);
    console.error(`   3. Click "Receive 0.05 Sepolia ETH", then run "npm run deploy:sepolia" again!\n`);
    process.exit(1);
  }

  console.log("📦 Step 2: Deploying ElectionSystem contract...\n");
  const ElectionSystem = await hre.ethers.getContractFactory("ElectionSystem");
  const contract = await ElectionSystem.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ Contract deployed successfully!");
  console.log(`   Contract Address: ${contractAddress}`);
  if (contract.deploymentTransaction()?.hash) {
    console.log(`   Tx Hash: ${contract.deploymentTransaction()?.hash}`);
  }

  // Auto-update src/constants.ts with the new address
  console.log("\n✍️  Step 3: Updating src/constants.ts with new address...\n");
  const CONSTANTS_PATH = path.join(__dirname, "..", "src", "constants.ts");
  if (!fs.existsSync(CONSTANTS_PATH)) {
    console.error(`❌ constants.ts not found at: ${CONSTANTS_PATH}`);
    process.exit(1);
  }

  let constantsContent = fs.readFileSync(CONSTANTS_PATH, "utf8");
  constantsContent = constantsContent.replace(
    /export const CONTRACT_ADDRESS\s*=\s*".*?";/,
    `export const CONTRACT_ADDRESS = "${contractAddress}";`
  );
  fs.writeFileSync(CONSTANTS_PATH, constantsContent);

  console.log(`✅ src/constants.ts updated with: ${contractAddress}`);
  console.log("\n" + "=".repeat(60));
  console.log(`🎉 DEPLOYMENT TO [${networkName.toUpperCase()}] COMPLETE!`);
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Unexpected error during deployment:", err);
  process.exit(1);
});
