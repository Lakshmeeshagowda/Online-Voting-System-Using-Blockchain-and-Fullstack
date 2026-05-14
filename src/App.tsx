import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { WalletProvider } from './hooks/useWallet';
import { LayoutDashboard, Vote, PieChart, Users, LogOut, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WalletConnect from './components/WalletConnect';

// Pages
import Dashboard from './pages/Dashboard';
import ElectionPage from './pages/Election';
import Results from './pages/Results';
import LoginPage from './pages/Login';
import AdminPanel from './pages/AdminPanel';

function Sidebar() {
  const { role, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Active Elections', path: '/elections', icon: Vote },
    { name: 'Finalized Results', path: '/results', icon: PieChart },
  ];

  if (role === 'admin') {
    menuItems.push({ name: 'Create Election', path: '/admin', icon: ShieldCheck });
  }

  return (
    <div className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] text-slate-50 transition-all duration-500 border-r border-[#1e293b] ${isOpen ? 'w-72' : 'w-20'}`}>
      <div className="flex items-center gap-4 p-8 h-24">
        <div className="w-10 h-10 bg-[#38bdf8] flex-shrink-0 flex items-center justify-center font-black text-[#020617] text-xl rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.2)]">V</div>
        {isOpen && (
          <div className="flex flex-col leading-none">
            <span className="text-xl font-black tracking-tight text-white italic">VOTEREUM</span>
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#38bdf8] uppercase">College Network</span>
          </div>
        )}
      </div>
      
      <nav className="mt-12 space-y-2 px-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all group font-bold text-xs uppercase tracking-widest ${
              item.path === window.location.pathname ? 'bg-[#1e293b] text-[#38bdf8] shadow-inner' : 'text-slate-500 hover:text-white hover:bg-[#1e293b]/50'
            }`}
          >
            <item.icon size={18} className={item.path === window.location.pathname ? 'text-[#38bdf8]' : 'text-slate-600 group-hover:text-slate-400'} />
            {isOpen && <span>{item.name}</span>}
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-12 left-0 w-full px-6">
        <div className="mb-4 px-2">
           {isOpen && <span className="text-[9px] uppercase tracking-[0.3em] text-[#475569] font-black">Authentication</span>}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-4 w-full px-4 py-4 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-400/5 transition-all font-bold text-xs uppercase tracking-widest"
        >
          <LogOut size={18} />
          {isOpen && <span>Terminate Session</span>}
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, role, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#38bdf8]"></div>
    </div>
  );

  if (!user) return <Navigate to="/login" />;
  if (adminOnly && role !== 'admin') return <Navigate to="/" />;

  return children as React.ReactElement;
}

export default function App() {
  return (
    <WalletProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen bg-[#020617] font-sans selection:bg-[#38bdf8]/30 selection:text-white">
                    <Sidebar />
                    <div className="flex-1 ml-72 flex flex-col min-h-screen transition-all duration-500">
                      <header className="h-24 px-12 flex items-center justify-between border-b border-[#1e293b] bg-[#020617]/50 backdrop-blur-sm sticky top-0 z-40">
                         <div className="font-black text-xs uppercase tracking-[0.4em] text-slate-600 flex items-center gap-4">
                            <div className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full animate-pulse"></div>
                            Ganache Local
                         </div>
                         <div className="flex items-center gap-4">
                            <WalletConnect />
                         </div>
                      </header>
                      <main className="flex-1 p-12">
                        <AnimatePresence mode="wait">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/elections" element={<ElectionPage />} />
                            <Route path="/results" element={<Results />} />
                            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
                          </Routes>
                        </AnimatePresence>
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </WalletProvider>
  );
}
