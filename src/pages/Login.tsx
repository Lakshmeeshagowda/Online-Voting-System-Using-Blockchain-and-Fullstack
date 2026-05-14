import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { LogIn, ShieldCheck, Vote } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { login, user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4 text-white overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[160px] animate-pulse delay-1000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[32px] p-8 md:p-12 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center text-blue-500 mb-2 border border-blue-500/20">
            <Vote size={48} />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Votereum</h1>
            <p className="text-neutral-400 text-sm tracking-wide">DECENTRALIZED GOVERNANCE</p>
          </div>

          <p className="text-neutral-400 leading-relaxed">
            Secure, transparent, and tamper-proof voting powered by Ethereum blockchain and zero-trust security.
          </p>

          <button
            onClick={login}
            className="w-full py-4 bg-white text-black rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-white/90 transition-all active:scale-[0.98] mt-8 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>

          <div className="flex items-center gap-2 text-neutral-500 text-sm mt-4">
            <ShieldCheck size={14} />
            <span>End-to-end encrypted session</span>
          </div>
        </div>
      </motion.div>
      
      <footer className="absolute bottom-8 text-neutral-600 text-xs tracking-widest uppercase">
        Built for the future of democracy
      </footer>
    </div>
  );
}
