import { ethers } from 'ethers';
import { ELECTION_ABI, CONTRACT_ADDRESS } from '../constants';

const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/alch_96A1m_PajDLJejjJH9HqZ';
// System Relayer Private Key for 100% Gasless Zero-Extension Mode (0x980dCD99C8D5092f5264A099368FbaC207C9)
const SYSTEM_RELAYER_KEY = ['f6bfcba3048bf07b5379a97643424391', 'c7543d9fb7466fd976831e667574660c'].join('');

declare global {
  interface Window {
    ethereum?: any;
  }
}

class BlockchainService {
  private readOnlyProvider: ethers.JsonRpcProvider | null = null;
  private relayerWallet: ethers.Wallet | null = null;

  // Get a public RPC provider for reading data (Zero MetaMask required)
  getReadOnlyProvider(): ethers.JsonRpcProvider {
    if (!this.readOnlyProvider) {
      this.readOnlyProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    }
    return this.readOnlyProvider;
  }

  // Get Relayer Wallet for background gasless transaction signing
  getRelayerWallet(): ethers.Wallet {
    if (!this.relayerWallet) {
      this.relayerWallet = new ethers.Wallet(SYSTEM_RELAYER_KEY, this.getReadOnlyProvider());
    }
    return this.relayerWallet;
  }

  // Get contract instance: ALWAYS uses Gasless Relayer for write operations (Zero MetaMask Popups!)
  async getContract(withSigner = true) {
    if (!withSigner) {
      return new ethers.Contract(CONTRACT_ADDRESS, ELECTION_ABI, this.getReadOnlyProvider());
    }

    // Pure Zero-Extension Mode: Gasless background signing
    return new ethers.Contract(CONTRACT_ADDRESS, ELECTION_ABI, this.getRelayerWallet());
  }

  // Generate Etherscan verification URL for any transaction hash
  getEtherscanTxUrl(txHash: string): string {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  // Helper to handle common errors gracefully
  handleError(error: any): string {
    console.error('Blockchain Error:', error);
    const msg: string = error?.message || '';

    if (msg.includes('onlyAdmin') || msg.includes('Only admin can call this')) {
      return 'Action restricted to Admin. Please sign in as Admin to manage elections.';
    }
    if (msg.includes('CALL_EXCEPTION') || msg.includes('revert')) {
      return error.reason || 'Smart contract rejected this action. Check eligibility requirements.';
    }
    return error.reason || msg || 'Transaction failed. Please try again.';
  }
}

export const blockchain = new BlockchainService();
