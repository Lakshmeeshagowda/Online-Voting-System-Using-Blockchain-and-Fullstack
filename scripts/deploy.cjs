/**
 * Votereum — Smart Contract Deploy Script
 * ----------------------------------------
 * Usage: node scripts/deploy.cjs
 *
 * Prerequisites:
 *   1. Ganache GUI is running on http://127.0.0.1:7545
 *   2. npm install has been run (Hardhat + toolbox installed)
 *
 * What this does:
 *   1. Compiles ElectionSystem.sol via Hardhat
 *   2. Deploys it to local Ganache
 *   3. Automatically writes the new contract address to src/constants.ts
 */

const { execSync } = require('child_process');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const GANACHE_URL = 'http://127.0.0.1:7545';
const CONSTANTS_PATH = path.join(__dirname, '..', 'src', 'constants.ts');

async function main() {
  console.log('\n🔨  Step 1: Compiling ElectionSystem.sol...\n');
  try {
    execSync('npx hardhat compile --config hardhat.config.cjs', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('❌  Compilation failed. Fix the errors above and retry.');
    process.exit(1);
  }

  console.log('\n🚀  Step 2: Connecting to Ganache at', GANACHE_URL, '...\n');
  let provider;
  try {
    provider = new ethers.JsonRpcProvider(GANACHE_URL);
    await provider.getNetwork(); // will throw if Ganache not running
  } catch (err) {
    console.error('❌  Cannot connect to Ganache!');
    console.error('    Please start Ganache GUI and make sure it\'s running on http://127.0.0.1:7545');
    process.exit(1);
  }

  // Use the first account from Ganache as deployer (admin)
  const accounts = await provider.listAccounts();
  if (accounts.length === 0) {
    console.error('❌  No accounts found in Ganache. Please open Ganache and ensure it has accounts.');
    process.exit(1);
  }

  const deployer = await provider.getSigner(0);
  const deployerAddress = await deployer.getAddress();
  const balance = await provider.getBalance(deployerAddress);

  console.log('✅  Connected to Ganache');
  console.log('    Deployer (Admin):', deployerAddress);
  console.log('    Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load compiled artifact
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'ElectionSystem.sol', 'ElectionSystem.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('❌  Artifact not found at:', artifactPath);
    console.error('    Something went wrong during compilation.');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  console.log('📦  Step 3: Deploying ElectionSystem contract...\n');
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log('✅  Contract deployed successfully!');
  console.log('    Contract Address:', contractAddress);
  console.log('    Transaction Hash:', contract.deploymentTransaction()?.hash, '\n');

  // Auto-update src/constants.ts with the new address
  console.log('✍️   Step 4: Updating src/constants.ts with new address...\n');
  if (!fs.existsSync(CONSTANTS_PATH)) {
    console.error('❌  constants.ts not found at:', CONSTANTS_PATH);
    process.exit(1);
  }

  let constantsContent = fs.readFileSync(CONSTANTS_PATH, 'utf8');
  // Replace the CONTRACT_ADDRESS line
  constantsContent = constantsContent.replace(
    /export const CONTRACT_ADDRESS\s*=\s*".*?";/,
    `export const CONTRACT_ADDRESS = "${contractAddress}";`
  );
  fs.writeFileSync(CONSTANTS_PATH, constantsContent);

  console.log('✅  src/constants.ts updated with:', contractAddress);

  console.log('\n' + '='.repeat(60));
  console.log('🎉  DEPLOYMENT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('  1. Import this Ganache account into MetaMask:');
  console.log('     Address:', deployerAddress);
  console.log('     (Copy the private key from Ganache GUI → Key icon)');
  console.log('');
  console.log('  2. Add Ganache network to MetaMask:');
  console.log('     RPC URL: http://127.0.0.1:7545');
  console.log('     Chain ID: 1337');
  console.log('     Symbol: ETH');
  console.log('');
  console.log('  3. Run the app:');
  console.log('     npm run dev');
  console.log('');
}

main().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
