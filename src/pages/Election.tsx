import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import { Vote, ChevronRight, CheckCircle2, Lock, Clock, Info, Users, PieChart, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, doc, updateDoc, getDoc, setDoc, runTransaction, onSnapshot, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { db } from '../firebase';
import { blockchain } from '../lib/blockchain';

interface Candidate {
  id: number;
  name: string;
}

interface Election {
  id: string;
  title: string;
  description: string;
  candidates: Candidate[];
  status: 'upcoming' | 'ongoing' | 'ended';
  contractAddress?: string;
}

export default function ElectionPage() {
  const { user, role, collegeData } = useAuth();
  const { account, isCorrectNetwork, connectWallet, isConnecting } = useWallet();
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState<any | null>(null);
  const [votedPosts, setVotedPosts] = useState<string[]>([]);
  const [isCasting, setIsCasting] = useState(false);
  const [nominationStatement, setNominationStatement] = useState('');
  const [nominationPost, setNominationPost] = useState('');
  const [nominating, setNominating] = useState(false);
  const [userNomination, setUserNomination] = useState<any | null>(null);

  // Dynamic eligibility checks - Admins bypass restrictions
  const isVoterEligible = role === 'admin' || (selectedElection && collegeData?.admissionYear 
    ? (selectedElection.voterBatches || [22, 23, 24, 25]).includes(collegeData.admissionYear)
    : false);
    
  const isCandidateEligible = role === 'admin' || (selectedElection && collegeData?.admissionYear
    ? (selectedElection.candidateBatches || [22, 23]).includes(collegeData.admissionYear)
    : false);

  const isNominationExpired = selectedElection?.nominationEndDate 
    ? new Date() > new Date(selectedElection.nominationEndDate)
    : false;

  useEffect(() => {
    const q = query(collection(db, 'elections'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setElections(items);
      
      if (selectedElection) {
        const updatedSelected = items.find(i => i.id === selectedElection.id);
        if (updatedSelected) {
          setSelectedElection(updatedSelected);
        }
      }
    });
    return () => unsubscribe();
  }, [selectedElection?.id]);

  useEffect(() => {
    if (selectedElection && user) {
        const fetchVotes = async () => {
            const voteDoc = await getDoc(doc(db, `elections/${selectedElection.id}/votes`, user.uid));
            if (voteDoc.exists()) {
                setVotedPosts(voteDoc.data().votedPosts || []);
            } else {
                setVotedPosts([]);
            }
        };
        fetchVotes();
        
        // Also sync votes from blockchain for transparent results
        const syncVotes = async () => {
          try {
              const contract = await blockchain.getContract(false);
              const electionRef = doc(db, 'elections', selectedElection.id);
              const elDoc = await getDoc(electionRef);
              if (!elDoc.exists()) return;
              
              const firestoreCandidates = elDoc.data().candidates || [];
              let updated = false;

              const newCandidates = await Promise.all(firestoreCandidates.map(async (c: any) => {
                  const blockchainData = await contract.getCandidate(selectedElection.blockchainId, parseInt(c.id));
                  const onChainVotes = parseInt(blockchainData.voteCount.toString());
                  if (onChainVotes !== (c.votes || 0)) {
                      updated = true;
                      return { ...c, votes: onChainVotes };
                  }
                  return c;
              }));

              if (updated) {
                  await updateDoc(electionRef, { candidates: newCandidates });
              }
          } catch (err) {
              console.warn("Blockchain sync skipped:", err);
          }
      };
      syncVotes();
    }
  }, [selectedElection?.id, user]);

  useEffect(() => {
    if (selectedElection && user && role) {
      const q = query(
        collection(db, `elections/${selectedElection.id}/nominations`),
        where('candidateUid', '==', user.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Since we filter by candidateUid, there should only be one or zero docs
        const doc = snapshot.docs[0];
        setUserNomination(doc ? { id: doc.id, ...doc.data() } : null);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `elections/${selectedElection.id}/nominations`);
      });
      return () => unsubscribe();
    }
  }, [selectedElection, user, role]);

  const handleNominate = async () => {
    if (!selectedElection || !user) return;

    // Wallet check
    if (!account) {
      alert('Please connect your MetaMask wallet first (click "Connect MetaMask" in the top header).');
      return;
    }
    if (!isCorrectNetwork) {
      alert('Wrong network. Please switch MetaMask to Ganache Local (Chain ID: 1337).');
      return;
    }
    
    const canNominate = role === 'admin' || isCandidateEligible;
    if (!canNominate) {
      alert("You are not eligible to nominate for this election.");
      return;
    }

    if (!nominationPost) {
      alert("Please select a position to nominate for.");
      return;
    }

    if (userNomination) {
      alert("You have already submitted a nomination for this election.");
      return;
    }

    setNominating(true);
    try {
      // 1. Transaction on Blockchain
      const contract = await blockchain.getContract();
      const tx = await contract.nominate(
        selectedElection.blockchainId,
        user.displayName || user.email?.split('@')[0] || "Candidate",
        nominationStatement,
        nominationPost
      );
      
      const receipt = await tx.wait();
      
      // Get candidate ID from event
      const event = receipt.logs.find((log: any) => {
          try {
              return contract.interface.parseLog(log)?.name === 'Nominated';
          } catch (e) { return false; }
      });
      const parsedLog = contract.interface.parseLog(event);
      const blockchainCandidateId = parseInt(parsedLog?.args.candidateId.toString());

      // 2. Mirror to Firestore
      await addDoc(collection(db, `elections/${selectedElection.id}/nominations`), {
        candidateName: user.displayName || user.email?.split('@')[0] || "Candidate",
        candidateUid: user.uid,
        status: 'pending',
        postTitle: nominationPost,
        statement: nominationStatement,
        blockchainCandidateId,
        blockchainElectionId: selectedElection.blockchainId,
        collegeData: collegeData || { admissionYear: 'N/A', department: 'Blockchain User' },
        createdAt: new Date().toISOString()
      });

      alert("Nomination successfully mined on blockchain and pending review.");
      setNominationStatement('');
      setNominationPost('');
    } catch (error) {
      const msg = blockchain.handleError(error);
      alert(msg);
    } finally {
      setNominating(false);
    }
  };

  const handleVote = async (blockchainCandidateId: string, postTitle: string) => {
    if (!selectedElection || !isVoterEligible || !user) {
      alert('You are not eligible to vote in this election.');
      return;
    }

    // Wallet check
    if (!account) {
      alert('Please connect your MetaMask wallet first (click "Connect MetaMask" in the top header).');
      return;
    }
    if (!isCorrectNetwork) {
      alert('Wrong network. Please switch MetaMask to Ganache Local (Chain ID: 1337).');
      return;
    }

    if (votedPosts.includes(postTitle)) {
      alert(`You have already cast your vote for ${postTitle}.`);
      return;
    }
    
    setIsCasting(true);
    try {
      // 1. Transaction on Blockchain
      const contract = await blockchain.getContract();
      const tx = await contract.vote(selectedElection.blockchainId, parseInt(blockchainCandidateId));
      await tx.wait();

      // 2. Mirror status to Firestore to prevent double vote check skipping
      const voteRef = doc(db, `elections/${selectedElection.id}/votes`, user.uid);
      const newVotedPosts = [...votedPosts, postTitle];
      await setDoc(voteRef, { 
        voterUid: user.uid,
        votedPosts: newVotedPosts,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setVotedPosts(newVotedPosts);
      alert("Vote confirmed on the blockchain!");
    } catch (error: any) {
      const msg = blockchain.handleError(error);
      alert(msg);
    } finally {
      setIsCasting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-10"
    >
      {!selectedElection && (
        <header className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
             <div className="px-2 py-0.5 bg-[#38bdf8]/10 text-[#38bdf8] text-[10px] font-bold rounded uppercase tracking-widest border border-[#38bdf8]/20">CMRIT Governance</div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white line-height-none">Active Proposals</h1>
          <p className="text-slate-400">Restricted to authorized college batches (e.g., Batch 23 to 35).</p>
        </header>
      )}

      {!selectedElection ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections.map((election) => (
            <button
              key={election.id}
              onClick={() => setSelectedElection(election)}
              className="flex flex-col p-8 bg-[#0f172a] border border-[#1e293b] rounded-2xl hover:border-[#38bdf8] transition-all text-left group gap-6"
            >
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-full ${
                  election.status === 'ongoing' ? 'bg-[#14532d] text-[#4ade80]' : 
                  election.status === 'nomination' ? 'bg-[#1e1b4b] text-[#818cf8]' : 'bg-[#1e293b] text-slate-400'
                }`}>
                  {election.status === 'ongoing' ? 'Voting Live' : 
                   election.status === 'nomination' ? 'Nominations Open' : 'Closed'}
                </span>
                <ChevronRight size={18} className="text-slate-600 group-hover:text-[#38bdf8] transition-colors" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white line-height-tight">{election.title}</h3>
                <p className="text-slate-400 text-sm line-clamp-2">{election.description}</p>
              </div>
              <div className="mt-auto pt-4 border-t border-[#1e293b] flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Phase: {election.status.toUpperCase()}</span>
                {election.status === 'nomination' && (
                  <span className="text-[#38bdf8] animate-pulse">Apply Now</span>
                )}
              </div>
            </button>
          ))}
          {elections.length === 0 && (
            <div className="col-span-full py-24 text-center space-y-4 bg-[#0f172a] rounded-2xl border border-dashed border-[#1e293b]">
              <div className="w-16 h-16 bg-[#1e293b] rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                <Clock size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-white font-bold">No active proposals found</p>
                <p className="text-slate-500 text-sm">Create a new election from the admin panel to begin.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <button 
            onClick={() => { setSelectedElection(null); }}
            className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-[#38bdf8] flex items-center gap-2 transition-colors"
          >
            ← Back to election hub
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2 space-y-6">
               <div className="bg-[#0f172a] p-10 rounded-2xl border border-[#1e293b] space-y-8">
                  <div className="space-y-4">
                    <div className="bg-[#38bdf8]/10 text-[#38bdf8] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block">
                      PHASE: {selectedElection.status}
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">{selectedElection.title}</h2>
                    <p className="text-slate-400 leading-relaxed text-sm">{selectedElection.description}</p>
                  </div>

                  {selectedElection.status === 'nomination' ? (
                    <div className="p-8 bg-[#020617] border border-[#1e293b] rounded-2xl space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Users size={20} className="text-[#38bdf8]" />
                           <h3 className="text-lg font-bold text-white">Nomination Portal</h3>
                        </div>
                        {isNominationExpired && (
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full">
                              <Lock size={12} />
                              <span className="text-[9px] font-black uppercase tracking-widest">Closed</span>
                           </div>
                        )}
                      </div>
                      
                      {isCandidateEligible ? (
                        <div className="space-y-4">
                           {userNomination ? (
                             <div className="p-6 bg-[#0f172a] border border-[#1e293b] rounded-xl space-y-6">
                               <div className="flex items-center justify-between">
                                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Application Status</p>
                                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                   userNomination.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                   userNomination.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                   'bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 animate-pulse'
                                 }`}>
                                   {userNomination.status}
                                 </span>
                               </div>

                               <div className="relative h-1.5 w-full bg-[#1e293b] rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: userNomination.status === 'approved' ? '100%' : userNomination.status === 'rejected' ? '100%' : '50%' }}
                                    className={`h-full transition-all ${
                                      userNomination.status === 'approved' ? 'bg-emerald-500' :
                                      userNomination.status === 'rejected' ? 'bg-red-500' :
                                      'bg-[#38bdf8]'
                                    }`}
                                  />
                               </div>

                               <div className="space-y-4">
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="text-slate-500">Position Applied:</span>
                                     <span className="text-white font-bold">{userNomination.postTitle}</span>
                                  </div>
                                  <div className="p-4 bg-[#020617] rounded-lg border border-[#1e293b]">
                                     <p className="text-[10px] text-slate-500 uppercase font-black mb-2">My Statement</p>
                                     <p className="text-xs text-slate-400 italic line-clamp-3">{userNomination.statement}</p>
                                  </div>
                                  <p className="text-[10px] text-center text-slate-600 font-medium">
                                    {userNomination.status === 'pending' 
                                      ? "Governance board is currently auditing your credentials. Your nomination eligibility is now locked."
                                      : "Application process finalized. Nomination eligibility remains locked for this cycle."}
                                  </p>
                               </div>
                             </div>
                           ) : isNominationExpired ? (
                              <div className="p-10 border border-dashed border-[#1e293b] rounded-2xl text-center space-y-4">
                                 <div className="w-12 h-12 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto text-slate-600">
                                    <Lock size={20} />
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-white font-bold uppercase tracking-tight">Nomination Phase Expired</p>
                                    <p className="text-xs text-slate-500">The application deadline was {new Date(selectedElection.nominationEndDate).toLocaleString()}.</p>
                                 </div>
                              </div>
                           ) : (
                             <div className="space-y-4">
                               <p className="text-sm text-slate-400">You are eligible to nominate yourself as a candidate for this election.</p>
                               
                               <div className="space-y-2">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Position</label>
                                 <select 
                                   value={nominationPost}
                                   onChange={(e) => setNominationPost(e.target.value)}
                                   className="w-full bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-white text-sm outline-none"
                                 >
                                   <option value="">Choose a post...</option>
                                   {(selectedElection.posts || ['President', 'Vice President', 'Secretary']).map((p: string) => (
                                     <option key={p} value={p}>{p}</option>
                                   ))}
                                 </select>
                               </div>

                               <textarea 
                                  value={nominationStatement}
                                  onChange={(e) => setNominationStatement(e.target.value)}
                                  placeholder="Describe your vision and why students should vote for you..."
                                  className="w-full bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 text-white text-sm min-h-[120px] outline-none"
                               />
                               <button 
                                disabled={nominating}
                                onClick={handleNominate}
                                className="w-full py-4 bg-[#38bdf8] text-[#020617] rounded-xl font-bold hover:bg-[#38bdf8]/90 transition-all disabled:opacity-50"
                               >
                                {nominating ? "Submitting..." : "Submit Nomination"}
                               </button>
                             </div>
                           )}
                        </div>
                      ) : (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
                          Ineligible for Nomination. Only batches ({selectedElection.candidateBatches?.join(', ') || '22, 23'}) can nominate.
                        </div>
                      )}
                    </div>
                  ) : selectedElection.status === 'ended' && selectedElection.resultsVisible ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-8"
                    >
                       <div className="flex items-center gap-3 py-6 border-b border-[#1e293b]">
                          <div className="w-10 h-10 bg-[#38bdf8]/10 rounded-lg flex items-center justify-center text-[#38bdf8]">
                             <PieChart size={20} />
                          </div>
                          <div>
                             <h3 className="text-xl font-bold text-white tracking-tight">Consensus Results</h3>
                             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Election Tally Finalized</p>
                          </div>
                       </div>
                       <div className="grid gap-6">
                         {(selectedElection.posts || []).map((post: string) => (
                           <div key={post} className="bg-[#020617] border border-[#1e293b] rounded-2xl overflow-hidden">
                              <div className="bg-[#1e293b]/30 px-6 py-4 border-b border-[#1e293b]">
                                 <h4 className="text-sm font-black text-[#38bdf8] uppercase tracking-widest">{post}</h4>
                              </div>
                              <div className="p-6 space-y-4">
                                 {selectedElection.candidates && selectedElection.candidates.filter((c: any) => c.post === post).sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0)).map((c: any, idx: number) => (
                                    <div key={c.id} className="flex items-center justify-between">
                                       <div className="flex items-center gap-3">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-amber-500 text-amber-950' : 'bg-[#1e293b] text-slate-400'}`}>
                                             {idx + 1}
                                          </div>
                                          <span className="text-sm font-bold text-white">{c.name}</span>
                                       </div>
                                       <div className="flex items-center gap-4">
                                          <div className="h-1.5 w-24 bg-[#1e293b] rounded-full overflow-hidden">
                                             <div 
                                               className="h-full bg-[#38bdf8]" 
                                               style={{ width: `${Math.min(100, (c.votes || 0) * 10)}%` }}
                                             ></div>
                                          </div>
                                          <span className="text-xs font-mono font-bold text-[#38bdf8]">{c.votes || 0}</span>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                         ))}
                       </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-8">
                      {!isVoterEligible && (
                         <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] mb-6 text-center font-bold uppercase tracking-widest">
                            Access Restricted: Unauthorized Batch
                         </div>
                      )}
                      
                      <div className="space-y-12">
                         {(selectedElection.posts || ['President', 'Vice President', 'Secretary']).map((post: string) => (
                           <div key={post} className="space-y-6">
                              <div className="flex items-center gap-3">
                                 <div className="h-px flex-1 bg-[#1e293b]"></div>
                                 <h3 className="text-xs font-black text-[#38bdf8] uppercase tracking-[0.2em]">{post}</h3>
                                 <div className="h-px flex-1 bg-[#1e293b]"></div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {selectedElection.candidates && selectedElection.candidates.filter((c: any) => c.post === post).length > 0 ? (
                                   selectedElection.candidates.filter((c: any) => c.post === post).map((candidate: any) => (
                                     <div 
                                       key={candidate.id} 
                                       className={`p-6 rounded-xl border transition-all ${
                                         votedPosts.includes(post)
                                         ? 'bg-[#020617]/30 border-[#1e293b]' 
                                         : 'bg-[#0f172a] border-[#1e293b] hover:border-[#38bdf8]/50'
                                       }`}
                                     >
                                        <div className="flex justify-between items-start mb-4">
                                           <div>
                                              <h4 className="font-bold text-white">{candidate.name}</h4>
                                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{candidate.department || 'CMRIT'}</p>
                                           </div>
                                           {votedPosts.includes(post) && (
                                              <div className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/20">
                                                 <CheckCircle2 size={16} />
                                              </div>
                                           )}
                                        </div>
                                        
                                        <button
                                          disabled={isCasting || !isVoterEligible || votedPosts.includes(post) || selectedElection.status !== 'ongoing'}
                                          onClick={() => handleVote(candidate.id, post)}
                                          className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-30 ${
                                            votedPosts.includes(post) 
                                            ? 'bg-transparent border border-[#1e293b] text-slate-500' 
                                            : 'bg-[#38bdf8] text-[#020617] hover:bg-[#38bdf8]/90'
                                          }`}
                                        >
                                          {votedPosts.includes(post) ? 'Vote Recorded' : 'Cast Transaction'}
                                        </button>
                                     </div>
                                   ))
                                 ) : (
                                   <div className="col-span-full py-10 text-center border border-dashed border-[#1e293b] rounded-xl">
                                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No candidates approved for this position yet</p>
                                   </div>
                                 )}
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>
                  )}
               </div>
            </section>

            <aside className="space-y-6">
               <div className="bg-[#0f172a] p-8 rounded-2xl border border-[#1e293b] space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Election Details</h3>
                  <div className="space-y-6">
                     <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Network Hub</p>
                        <p className="text-[11px] font-mono text-[#38bdf8] truncate">CMRIT Mainnet v2.0</p>
                     </div>
                     <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Eligible Batches</p>
                        <div className="flex gap-1 flex-wrap">
                           {(selectedElection.voterBatches || [22, 23, 24, 25]).map((b: number) => (
                             <span key={b} className="px-2 py-1 bg-[#1e293b] text-slate-300 rounded text-[9px] font-bold">BATCH {b}</span>
                           ))}
                        </div>
                     </div>
                     {selectedElection.nominationEndDate && (
                        <div>
                           <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Nomination Deadline</p>
                           <p className="text-[11px] font-bold text-white uppercase tracking-tighter">
                              {new Date(selectedElection.nominationEndDate).toLocaleDateString()} at {new Date(selectedElection.nominationEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </p>
                        </div>
                     )}
                  </div>
               </div>
            </aside>
          </div>
        </motion.div>
      )}

      {isCasting && (
        <div className="fixed inset-0 z-[100] bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0f172a] border border-[#1e293b] p-12 rounded-2xl max-w-md text-center space-y-6"
          >
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-[#1e293b]"></div>
              <div className="absolute inset-0 rounded-full border-2 border-[#38bdf8] border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Signing Transaction</h2>
              <p className="text-slate-400 text-sm">Interacting with Ethereum nodes. Your vote is being hashed and stored on the immutable ledger.</p>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
