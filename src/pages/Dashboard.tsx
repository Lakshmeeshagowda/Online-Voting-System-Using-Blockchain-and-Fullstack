import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Vote, Users, PieChart, TrendingUp, ShieldCheck, BarChart3, ChevronRight, Hash } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, role, collegeData } = useAuth();
  const [stats, setStats] = useState({
    activeElections: 0,
    totalUsers: 0,
    votesCast: 1240, // Simulated
  });

  useEffect(() => {
    const fetchStats = async () => {
      const q = query(collection(db, 'elections'));
      const snapshot = await getDocs(q);
      setStats(prev => ({ ...prev, activeElections: snapshot.size }));
      
      const userQ = query(collection(db, 'users'));
      const userSnapshot = await getDocs(userQ);
      setStats(prev => ({ ...prev, totalUsers: userSnapshot.size }));
    };
    fetchStats();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-12"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#1e293b]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 bg-[#38bdf8] rounded-full"></div>
            <h1 className="text-4xl font-bold tracking-tight text-white line-height-none">Votereum Hub</h1>
          </div>
          <p className="text-slate-400 font-medium tracking-tight">
            Greetings, {user?.displayName || 'Student'}. Batch '{collegeData?.admissionYear || '??'}' | {collegeData?.department || 'CMRIT'}
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-[#0f172a] border border-[#1e293b] rounded-xl ring-1 ring-[#38bdf8]/20">
           <div className={`w-2 h-2 rounded-full ${collegeData?.admissionYear ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`}></div>
           <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              {collegeData?.admissionYear ? `Batch ${collegeData.admissionYear} Verified` : 'Guest Network Access'}
           </span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Proposals', value: stats.activeElections, trend: 'Network Live', icon: BarChart3 },
          { label: 'User Role', value: role?.toUpperCase() || 'VOTER', trend: 'Verified Account', icon: ShieldCheck },
          { label: 'Network Hub', value: 'MAINNET', trend: 'v2.0 Active', icon: Hash },
          { label: 'Verified Tally', value: stats.votesCast, trend: 'Consensus Count', icon: Vote },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-[#0f172a] border border-[#1e293b] rounded-2xl hover:border-[#38bdf8]/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-6">
               <div className="w-10 h-10 bg-[#38bdf8]/10 rounded-lg flex items-center justify-center text-[#38bdf8] border border-[#38bdf8]/20">
                  <stat.icon size={20} />
               </div>
               <span className="text-[9px] font-bold text-[#38bdf8] uppercase tracking-widest px-2 py-0.5 bg-[#38bdf8]/5 rounded">{stat.trend}</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1 tracking-tight">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-8">
          {role === 'admin' ? (
             <div className="bg-[#38bdf8]/5 border border-[#38bdf8]/20 p-8 rounded-2xl space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-[#38bdf8] text-[#020617] rounded-lg flex items-center justify-center">
                      <ShieldCheck size={20} />
                   </div>
                   <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">Administrative Control</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Node Permissions Active</p>
                   </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <Link to="/admin" className="p-4 bg-[#0f172a] border border-[#1e293b] rounded-xl hover:border-[#38bdf8] transition-all group">
                      <p className="text-xs font-bold text-white mb-1">Election Manager</p>
                      <p className="text-[10px] text-slate-500 uppercase">Create & finalize proposals</p>
                   </Link>
                   <Link to="/elections" className="p-4 bg-[#0f172a] border border-[#1e293b] rounded-xl hover:border-[#38bdf8] transition-all group">
                      <p className="text-xs font-bold text-white mb-1">Election Hub</p>
                      <p className="text-[10px] text-slate-500 uppercase">Monitor active voting</p>
                   </Link>
                </div>
             </div>
          ) : (
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-sm">
              <div className="p-8 border-b border-[#1e293b] flex items-center justify-between bg-[#020617]/40">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                   <TrendingUp size={14} className="text-[#38bdf8]" />
                   Active Governance Hub
                </h3>
              </div>
              <div className="p-8 space-y-6 text-center">
                 <div className="max-w-sm mx-auto space-y-4">
                    <p className="text-slate-400 text-sm leading-relaxed">
                       You are currently logged in as a verified student of CMRIT. You can participate in active elections or apply for governance positions.
                    </p>
                    <Link to="/elections" className="inline-flex items-center justify-center px-8 py-3 bg-[#38bdf8] text-[#020617] rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all">
                       Enter Voting Portal
                    </Link>
                 </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-8">
          <div className="bg-[#38bdf8] p-10 rounded-2xl relative overflow-hidden group shadow-[0_20px_50px_rgba(56,189,248,0.15)]">
            <ShieldCheck size={160} className="absolute -right-12 -bottom-12 opacity-10 group-hover:scale-110 transition-transform duration-700" />
            <div className="relative z-10 space-y-6 text-[#020617]">
               <h3 className="text-2xl font-black tracking-tight uppercase line-height-none">Secure Ledger</h3>
               <p className="text-sm font-bold opacity-80 leading-relaxed">
                 All CMRIT governance interactions are verified via decentralized nodes. Identity hash used for privacy.
               </p>
               <button className="w-full py-4 bg-[#020617] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-2xl active:scale-[0.98] transition-all">
                  Audit Mainnet
               </button>
            </div>
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] p-8 rounded-2xl space-y-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Profile Metrics</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
                <span className="text-xs text-slate-500 font-medium">Admission Batch</span>
                <span className="text-xs font-bold text-white uppercase">{collegeData?.admissionYear || 'Guest'}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
                <span className="text-xs text-slate-500 font-medium">Department</span>
                <span className="text-xs font-bold text-white uppercase">{collegeData?.department || 'External'}</span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
                <span className="text-xs text-slate-500 font-medium">Identity Status</span>
                <span className={`text-[10px] font-bold uppercase ${collegeData?.admissionYear ? 'text-emerald-400' : 'text-slate-500'}`}>
                   {collegeData?.admissionYear ? 'Verified CMRIT' : 'Unverified'}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed font-medium uppercase tracking-tight">
                * View active elections to check specific eligibility status.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
