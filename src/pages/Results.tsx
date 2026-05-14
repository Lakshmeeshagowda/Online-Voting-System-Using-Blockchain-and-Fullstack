import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { Trophy, Users, ShieldCheck, PieChart as PieIcon, Award, Medal, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { blockchain } from '../lib/blockchain';

export default function Results() {
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'elections'), where('status', '==', 'ended'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((e: any) => e.resultsVisible === true);
      
      setElections(items);
      if (items.length > 0 && !selectedElection) {
        setSelectedElection(items[0]);
      } else if (items.length > 0 && selectedElection) {
        const current = items.find(i => i.id === selectedElection.id);
        if (current) setSelectedElection(current);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [selectedElection?.id]);

  useEffect(() => {
    if (selectedElection && selectedElection.blockchainId) {
      const syncBlockchainData = async () => {
        try {
          const contract = await blockchain.getContract(false);

          const firestoreCandidates = selectedElection.candidates || [];
          let updated = false;

          const syncedCandidates = await Promise.all(firestoreCandidates.map(async (c: any) => {
            const blockchainData = await contract.getCandidate(selectedElection.blockchainId, parseInt(c.id));
            const onChainVotes = parseInt(blockchainData.voteCount.toString());
            if (onChainVotes !== (c.votes || 0)) {
              updated = true;
              return { ...c, votes: onChainVotes };
            }
            return c;
          }));

          if (updated) {
            await updateDoc(doc(db, 'elections', selectedElection.id), { candidates: syncedCandidates });
          }
        } catch (err) {
          console.error("Blockchain results sync error:", err);
        }
      };
      syncBlockchainData();
    }
  }, [selectedElection?.id]);

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-500 font-bold uppercase tracking-widest text-[10px]">Verifying Ledger Consenus...</div>;

  if (elections.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-32 text-center space-y-6">
         <div className="w-20 h-20 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto text-slate-600">
            <PieIcon size={40} />
         </div>
         <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Public results pending</h2>
            <p className="text-slate-500 text-sm">Completed election results will appear here once verified by the board.</p>
         </div>
      </div>
    );
  }

  const results = selectedElection?.candidates || [];
  const totalVotes = results.reduce((acc: number, curr: any) => acc + (curr.votes || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-12 pb-20"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#1e293b]">
        <div className="space-y-1">
          <p className="text-[#38bdf8] font-bold tracking-widest text-[10px] uppercase">Official Record • {selectedElection?.title}</p>
          <h1 className="text-4xl font-bold tracking-tight text-white uppercase italic">Consensus Results</h1>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
             <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Verified Votes</p>
             <p className="text-4xl font-black text-white">{totalVotes}</p>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Select Election</h3>
              <div className="space-y-2">
                 {elections.map((election) => (
                   <button 
                     key={election.id}
                     onClick={() => setSelectedElection(election)}
                     className={`w-full p-6 text-left rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
                       selectedElection?.id === election.id 
                       ? 'bg-[#1e293b] border-[#38bdf8] text-white' 
                       : 'bg-[#0f172a]/50 border-white/5 text-slate-500 hover:border-white/10'
                     }`}
                   >
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-2 opacity-50">Verified Consensus</p>
                      <h4 className="font-bold text-sm leading-tight uppercase tracking-tight">{election.title}</h4>
                      {selectedElection?.id === election.id && (
                        <div className="absolute top-0 right-0 p-2">
                          <ShieldCheck size={14} className="text-[#38bdf8]" />
                        </div>
                      )}
                   </button>
                 ))}
              </div>
           </div>
        </aside>

        <section className="lg:col-span-3 space-y-6">
           {(selectedElection?.posts || []).map((post: string) => {
             const postCandidates = results
                .filter((c: any) => c.post === post)
                .sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
             
             const winner = postCandidates[0];

             return (
               <div key={post} className="bg-[#0f172a] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#1e293b]/40 to-transparent">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#020617] rounded-xl flex items-center justify-center border border-white/5">
                           <Award size={20} className="text-[#38bdf8]" />
                        </div>
                        <div>
                           <h3 className="text-base font-black text-white uppercase tracking-tight">{post}</h3>
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Election Summary</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">Finalized</span>
                     </div>
                  </div>

                  <div className="p-8">
                     {winner && (
                       <div className="mb-10 relative">
                          <div className="absolute inset-0 bg-[#38bdf8]/5 blur-3xl rounded-full"></div>
                          <div className="relative p-8 bg-[#38bdf8]/10 border border-[#38bdf8]/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                             <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-[#38bdf8] rounded-2xl flex items-center justify-center text-[#020617] shadow-[0_0_30px_rgba(56,189,248,0.3)]">
                                   <Trophy size={32} />
                                </div>
                                <div className="text-center md:text-left">
                                   <p className="text-[10px] font-black text-[#38bdf8] uppercase tracking-[0.3em] mb-1">Elected Official</p>
                                   <h2 className="text-3xl font-black text-white uppercase tracking-tight italic">{winner.name}</h2>
                                   <p className="text-xs text-slate-400 font-bold uppercase">{winner.department || 'Consensus Winner'}</p>
                                </div>
                             </div>
                             <div className="px-8 py-4 bg-[#020617] rounded-2xl border border-white/5 text-center min-w-[120px]">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Final Count</p>
                                <p className="text-3xl font-black text-[#38bdf8]">{winner.votes || 0}</p>
                             </div>
                          </div>
                       </div>
                     )}

                     <div className="space-y-3">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Complete Tally</p>
                        {postCandidates.map((c: any, i: number) => (
                           <div 
                             key={c.id} 
                             className={`p-6 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                                i === 0 
                                ? 'bg-[#38bdf8]/5 border-[#38bdf8]/20' 
                                : 'bg-[#020617] border-white/5 hover:border-white/10'
                             }`}
                           >
                              <div className="flex items-center gap-4">
                                 <div className={`w-8 h-8 rounded-lg text-xs font-black flex items-center justify-center border ${
                                    i === 0 
                                    ? 'bg-[#38bdf8] border-[#38bdf8] text-[#020617]' 
                                    : 'bg-[#0f172a] border-white/5 text-slate-500'
                                 }`}>
                                    {i === 0 ? <Medal size={16} /> : i + 1}
                                 </div>
                                 <div>
                                    <h4 className="text-sm font-bold text-white uppercase tracking-tight">{c.name}</h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{c.department || 'Candidate'}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="h-1 w-24 bg-[#1e293b] rounded-full overflow-hidden hidden md:block">
                                    <motion.div 
                                       initial={{ width: 0 }}
                                       animate={{ width: `${(c.votes / winner?.votes) * 100}%` }}
                                       className={`h-full ${i === 0 ? 'bg-[#38bdf8]' : 'bg-slate-600'}`}
                                    />
                                 </div>
                                 <span className={`text-sm font-mono font-black ${i === 0 ? 'text-[#38bdf8]' : 'text-slate-400'}`}>
                                    {c.votes || 0}
                                 </span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
             );
           })}
        </section>
      </div>
    </motion.div>
  );
}
