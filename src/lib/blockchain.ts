import { ethers } from 'ethers';
import { ELECTION_ABI, CONTRACT_ADDRESS } from '../constants';

declare global {
  interface Window {
    ethereum?: any;
  }
}

class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;

  async getProvider() {
    if (!window.ethereum) throw new Error('Please install MetaMask to use blockchain features.');
    if (!this.provider) {
      this.provider = new ethers.BrowserProvider(window.ethereum);
    }
    return this.provider;
  }

  async requestAccounts(): Promise<string[]> {
    if (!window.ethereum) throw new Error('MetaMask not installed.');
    return window.ethereum.request({ method: 'eth_requestAccounts' });
  }

  async getNetwork(): Promise<{ chainId: bigint; name: string }> {
    const provider = await this.getProvider();
    return provider.getNetwork();
  }

  async getContract(withSigner = true) {
    const provider = await this.getProvider();

    // For read-only calls, use provider (no wallet needed)
    if (!withSigner) {
      return new ethers.Contract(CONTRACT_ADDRESS, ELECTION_ABI, provider);
    }

    // For write calls, ensure wallet is connected
    const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length === 0) {
      throw new Error('No wallet connected. Please click "Connect MetaMask" first.');
    }

    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, ELECTION_ABI, signer);
  }

  // Helper to handle common RPC / MetaMask errors
  handleError(error: any): string {
    console.error('Blockchain Error:', error);
    const msg: string = error?.message || '';

    if (error.code === 4001 || msg.includes('user rejected')) {
      return 'Transaction rejected in MetaMask. Please approve it to continue.';
    }
    if (error.code === -32002) {
      return 'MetaMask is already processing a request. Open MetaMask and approve or reject it.';
    }
    if (error.code === -32603 || msg.includes('Internal JSON-RPC error')) {
      return 'Transaction failed on-chain. Check if Ganache is running and your wallet has ETH.';
    }
    if (msg.includes('nonce too high')) {
      return 'Nonce mismatch. In MetaMask → Settings → Advanced → Clear activity data, then retry.';
    }
    if (msg.includes('CALL_EXCEPTION') || msg.includes('revert')) {
      return error.reason || 'Smart contract rejected this action. Check eligibility requirements.';
    }
    if (msg.includes('could not detect network') || msg.includes('NETWORK_ERROR')) {
      return 'Cannot reach Ganache. Make sure Ganache is running on http://127.0.0.1:7545';
    }
    if (msg.includes('No wallet connected')) {
      return msg;
    }
    return error.reason || msg || 'Transaction failed. Please try again.';
  }
}

export const blockchain = new BlockchainService();
