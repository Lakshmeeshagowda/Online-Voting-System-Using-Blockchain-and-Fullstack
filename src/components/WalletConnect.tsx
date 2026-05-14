import { useWallet } from '../hooks/useWallet';
import { Wallet, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// MetaMask fox SVG icon (simplified inline)
function MetaMaskIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 284.65 284.65" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="241.19,9.5 155.32,73.48 171.34,35.75" fill="#e2761b" stroke="#e2761b" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="43.37,9.5 128.54,74.06 113.31,35.75" fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="206.84,194.24 183.63,231.44 236.13,245.97 251.34,195.07" fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="33.41,195.07 48.52,245.97 101.02,231.44 77.81,194.24" fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="98.1,124.13 83.38,146.3 135.49,148.6 133.67,92.35" fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="186.46,124.13 150.57,91.77 149.16,148.6 201.17,146.3" fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="101.02,231.44 132.25,216.43 105.07,195.46" fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="152.4,216.43 183.63,231.44 179.49,195.46" fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletConnect() {
  const { account, balance, isCorrectNetwork, isConnecting, isMetaMaskInstalled, connectWallet, switchToGanache, error } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  // Not installed
  if (!isMetaMaskInstalled) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-orange-500/20 transition-all"
      >
        <AlertTriangle size={13} />
        Install MetaMask
      </a>
    );
  }

  // Wrong network
  if (account && !isCorrectNetwork) {
    return (
      <button
        onClick={switchToGanache}
        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all animate-pulse"
      >
        <AlertTriangle size={13} />
        Wrong Network — Switch to Ganache
      </button>
    );
  }

  // Connected
  if (account) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(p => !p)}
          className="flex items-center gap-2.5 px-4 py-2 bg-[#0f172a] border border-emerald-500/30 rounded-xl hover:border-emerald-400/50 transition-all group"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
          <MetaMaskIcon size={16} />
          <span className="text-[11px] font-mono font-bold text-emerald-400">{shortAddr(account)}</span>
          {balance && (
            <span className="text-[10px] text-slate-500 font-bold hidden sm:block">{balance} ETH</span>
          )}
          <ChevronDown size={12} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-64 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-4 space-y-3 shadow-2xl z-50"
              onMouseLeave={() => setShowDropdown(false)}
            >
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Connected Wallet</p>
              <div className="bg-[#020617] rounded-xl p-3 border border-[#1e293b] space-y-2">
                <div className="flex items-center gap-2">
                  <MetaMaskIcon size={18} />
                  <span className="text-xs font-mono text-white font-bold">{shortAddr(account)}</span>
                </div>
                <div className="h-px bg-[#1e293b]" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">Balance</span>
                  <span className="text-[11px] font-mono font-bold text-[#38bdf8]">{balance || '...'} ETH</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">Network</span>
                  <span className="text-[10px] font-bold text-emerald-400">Ganache Local</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-600 text-center">Switch accounts in MetaMask directly</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Not connected
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        id="wallet-connect-btn"
        className="flex items-center gap-2.5 px-4 py-2.5 bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8] rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-[#38bdf8]/20 hover:border-[#38bdf8]/60 transition-all disabled:opacity-50 active:scale-95"
      >
        {isConnecting ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <MetaMaskIcon size={16} />
            Connect MetaMask
          </>
        )}
      </button>
      {error && (
        <p className="text-[9px] text-red-400 font-bold max-w-[220px] text-right leading-relaxed">{error}</p>
      )}
    </div>
  );
}
