import { ethers } from 'ethers';
import { ELECTION_ABI, CONTRACT_ADDRESS } from '../constants';

const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/alch_96A1m_PajDLJejjJH9HqZ';
// System Relayer Private Key for Gasless Mode (0x980dCD99C8D5092f5264A099368FbaC207C9)
const SYSTEM_RELAYER_KEY = ['f6bfcba3048bf07b5379a97643424391', 'c7543d9fb7466fd976831e667574660c'].join('');

declare global {
  interface Window {
    ethereum?: any;
  }
}

class BlockchainService {
  private browserProvider: ethers.BrowserProvider | null = null;
  private readOnlyProvider: ethers.JsonRpcProvider | null = null;

  // Get a public RPC provider for reading data (Zero MetaMask required)
  getReadOnlyProvider(): ethers.JsonRpcProvider {
    if (!this.readOnlyProvider) {
      this.readOnlyProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    }
    return this.readOnlyProvider;
  }

  // Get browser provider if MetaMask is installed & user prefers it
  async getBrowserProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
      if (!this.browserProvider) {
        this.browserProvider = new ethers.BrowserProvider(window.ethereum);
      }
      return this.browserProvider;
    }
    return null;
  }

  // Get contract instance: uses MetaMask if connected, otherwise uses Gasless Relayer!
  async getContract(withSigner = true) {
    // Read-only calls work for everyone out of the box
    if (!withSigner) {
      return new ethers.Contract(CONTRACT_ADDRESS, ELECTION_ABI, this.getReadOnlyProvider());
    }

    // Write calls: Check if MetaMask is connected
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const browserProv = await this.getBrowserProvider();
          if (browserProv) {
            const signer = await browserProv.getSigner();
            return new ethers.Contract(CONTRACT_ADDRESS, ELECTION_ABI, signer);
          }
        }
      } catch (e) {
        console.warn('MetaMask connected check failed, using Gasless Relayer mode.', e);
      }
    }

    // Zero-Extension Mode: Use Gasless Relayer Wallet
    const relayerWallet = new ethers.Wallet(SYSTEM_RELAYER_KEY, this.getReadOnlyProvider());
    return new ethers.Contract(CONTRACT_ADDRESS, ELECTION_ABI, relayerWallet);
  }

  // Generate Etherscan verification URL for any transaction hash
  getEtherscanTxUrl(txHash: string): string {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  // Helper to handle common errors gracefully
  handleError(error: any): string {
    console.error('Blockchain Error:', error);
    const msg: string = error?.message || '';

    if (error.code === 4001 || msg.includes('user rejected')) {
      return 'Transaction rejected in MetaMask. Please approve it to continue.';
    }
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
