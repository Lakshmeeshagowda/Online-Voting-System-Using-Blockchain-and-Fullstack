import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const GANACHE_CHAIN_ID = '0x539'; // 1337 in hex

interface WalletContextType {
  account: string | null;
  chainId: string | null;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  isMetaMaskInstalled: boolean;
  balance: string | null;
  connectWallet: () => Promise<void>;
  switchToGanache: () => Promise<void>;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMetaMaskInstalled = typeof window !== 'undefined' && Boolean(window.ethereum);
  const isCorrectNetwork = chainId === GANACHE_CHAIN_ID;

  const fetchBalance = useCallback(async (addr: string) => {
    if (!window.ethereum) return;
    try {
      const balHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [addr, 'latest'],
      });
      // Convert hex wei to ETH
      const balWei = parseInt(balHex, 16);
      const balEth = (balWei / 1e18).toFixed(4);
      setBalance(balEth);
    } catch {
      setBalance(null);
    }
  }, []);

  // Restore previously connected account on mount
  useEffect(() => {
    if (!window.ethereum) return;

    const init = async () => {
      try {
        const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
        const chain: string = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(chain);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          await fetchBalance(accounts[0]);
        }
      } catch (err) {
        console.error('Wallet init error:', err);
      }
    };

    init();

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null);
        setBalance(null);
      } else {
        setAccount(accounts[0]);
        await fetchBalance(accounts[0]);
      }
    };

    const handleChainChanged = (chainId: string) => {
      setChainId(chainId);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [fetchBalance]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install it from metamask.io');
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      const chain: string = await window.ethereum.request({ method: 'eth_chainId' });
      setAccount(accounts[0]);
      setChainId(chain);
      await fetchBalance(accounts[0]);
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Connection rejected. Please approve in MetaMask.');
      } else if (err.code === -32002) {
        setError('MetaMask is already processing a request. Open MetaMask to approve.');
      } else {
        setError(err.message || 'Failed to connect wallet.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToGanache = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: GANACHE_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // Chain not added yet, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: GANACHE_CHAIN_ID,
              chainName: 'Ganache Local',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['http://127.0.0.1:7545'],
            }],
          });
        } catch (addError: any) {
          setError('Failed to add Ganache network: ' + addError.message);
        }
      } else {
        setError('Failed to switch network: ' + switchError.message);
      }
    }
  };

  return (
    <WalletContext.Provider value={{
      account,
      chainId,
      isCorrectNetwork,
      isConnecting,
      isMetaMaskInstalled,
      balance,
      connectWallet,
      switchToGanache,
      error,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
