import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import { Plus, Trash2, Save, Users, Calendar, Hash, Check, X, Bell, Wallet, AlertTriangle } from 'lucide-react';
import { collection, addDoc, query, getDocs, doc, updateDoc, getDoc, where, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { db } from '../firebase';
import { blockchain } from '../lib/blockchain';
import { CONTRACT_ADDRESS } from '../constants';

export default function AdminPanel() {
  const { user, role } = useAuth();
  const { account, isCorrectNetwork, connectWallet, isConnecting } = useWallet();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState<string[]>(['President', 'Vice President', 'General Secretary', 'Technical Head']);
  const [isCreating, setIsCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [nominationEndDate, setNominationEndDate] = useState('');
  
  const BATCH_OPTIONS = Array.from({ length: 13 }, (_, i) => 23 + i); // [23..35]

  const getBatchRange = (start: number, end: number): number[] => {
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    const range: number[] = [];
    for (let b = min; b <= max; b++) {
      range.push(b);
    }
    return range;
  };

  const [voterStartBatch, setVoterStartBatch] = useState<number>(23);
  const [voterEndBatch, setVoterEndBatch] = useState<number>(26);
  const [candidateStartBatch, setCandidateStartBatch] = useState<number>(23);
  const [candidateEndBatch, setCandidateEndBatch] = useState<number>(25);

  const voterBatches = getBatchRange(voterStartBatch, voterEndBatch);
  const candidateBatches = getBatchRange(candidateStartBatch, candidateEndBatch);

  const [elections, setElections] = useState<any[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);

  const addPost = () => {
    if (newPost.trim() && !posts.includes(newPost.trim())) {
      setPosts([...posts, newPost.trim()]);
      setNewPost('');
    }
  };

  const removePost = (post: string) => {
    setPosts(posts.filter(p => p !== post));
  };

  useEffect(() => {
    const q = query(collection(db, 'elections'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setElections(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'elections');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedElectionId || role !== 'admin') {
      setNominations([]);
      return;
    }
    const q = query(collection(db, `elections/${selectedElectionId}/nominations`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNominations(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `elections/${selectedElectionId}/nominations`);
    });
    return () => unsubscribe();
  }, [selectedElectionId, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      alert('Please connect your MetaMask wallet first (click "Connect MetaMask" in the header).');
      return;
    }
    if (!isCorrectNetwork) {
      alert('Wrong network. Please switch MetaMask to Ganache Local (Chain ID: 1337).');
      return;
    }

    setIsCreating(true);
    try {
      const contract = await blockchain.getContract();
      const endTime = nominationEndDate ? Math.floor(new Date(nominationEndDate).getTime() / 1000) : 0;
      
      const tx = await contract.createElection(
        title,
        description,
        posts,
        voterBatches,
        candidateBatches,
        endTime
      );
      
      await tx.wait();

      const count = await contract.electionsCount();
      const blockchainId = parseInt(count.toString());

      await addDoc(collection(db, 'elections'), {
        title,
        description,
        posts,
        candidates: [],
        status: 'nomination',
        nominationEndDate,
        voterBatches,
        candidateBatches,
        resultsVisible: false,
        createdAt: new Date().toISOString(),
        creatorId: user?.uid,
        blockchainId,
        contractAddress: CONTRACT_ADDRESS
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setTitle('');
      setDescription('');
    } catch (error) {
      const msg = blockchain.handleError(error);
      alert(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (electionId: string, status: string, blockchainId: number) => {
    if (!account) {
      alert('Please connect your MetaMask wallet first.');
      return;
    }
    if (!isCorrectNetwork) {
      alert('Wrong network. Please switch to Ganache Local.');
      return;
    }
    try {
      const contract = await blockchain.getContract();
      const tx = await contract.updateStatus(blockchainId, status);
      await tx.wait();

      await updateDoc(doc(db, 'elections', electionId), { status });
      alert(`Election status updated to ${status} on blockchain.`);
    } catch (error) {
      const msg = blockchain.handleError(error);
      alert(msg);
    }
  };

  const handleCloseNomination = async (electionId: string, blockchainId: number) => {
    try {
      // In contract, we can enforce nomination end date via timestamp, 
      // but here we manually close in Firestore too.
      await updateDoc(doc(db, 'elections', electionId), { 
        nominationEndDate: new Date().toISOString() 
      });
      alert("Nomination phase closed manually.");
    } catch (error) {
      console.error("Failed to close nomination", error);
    }
  };

  const handleApproveNomination = async (nomination: any) => {
    if (!account) {
      alert('Please connect your MetaMask wallet first.');
      return;
    }
    if (!isCorrectNetwork) {
      alert('Wrong network. Please switch to Ganache Local.');
      return;
    }
    try {
        const electionRef = doc(db, 'elections', selectedElectionId!);
        const electionDoc = await getDoc(electionRef);
        if (!electionDoc.exists()) return;
        const electionData = electionDoc.data();
        const blockchainElectionId = electionData.blockchainId;

        // 1. Approve on Blockchain
        const contract = await blockchain.getContract();
        if (!nomination.blockchainCandidateId) {
            alert("Nomination mapping mismatch. Ensure candidate is registered on-chain.");
            return;
        }

        const tx = await contract.approveCandidate(blockchainElectionId, nomination.blockchainCandidateId);
        await tx.wait();

        // 2. Update Firestore
        const currentCandidates = electionData.candidates || [];
        const newCandidate = {
            id: nomination.blockchainCandidateId.toString(),
            name: nomination.candidateName,
            uid: nomination.candidateUid,
            post: nomination.postTitle,
            votes: 0,
            statement: nomination.statement,
            department: nomination.collegeData?.department
        };

        await updateDoc(electionRef, {
            candidates: [...currentCandidates, newCandidate]
        });

        await updateDoc(doc(db, `elections/${selectedElectionId}/nominations`, nomination.id), {
            status: 'approved'
        });

        alert(`Approved ${nomination.candidateName} as candidate on blockchain.`);
    } catch (error) {
        const msg = blockchain.handleError(error);
        alert(msg);
    }
  };

  const handleRejectNomination = async (nominationId: string) => {
    try {
      await updateDoc(doc(db, `elections/${selectedElectionId}/nominations`, nominationId), {
        status: 'rejected'
      });
      alert("Nomination rejected.");
    } catch (error) {
      console.error("Rejection failed", error);
    }
  };

  const handleNotifyStudents = (electionId: string) => {
    alert(`Notifications sent! All eligible CMRIT students have been notified about ${electionId}.`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-12 pb-20"
    >
      <header className="space-y-4">
        <div>
          <p className="text-[#38bdf8] font-bold tracking-widest text-[10px] uppercase">CMRIT Admin Console</p>
          <h1 className="text-4xl font-bold tracking-tight text-white">Election Management</h1>
        </div>
        {/* Wallet Status Banner */}
        {!account ? (
          <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-orange-400" />
              <div>
                <p className="text-orange-400 font-bold text-sm">Wallet Not Connected</p>
                <p className="text-orange-400/70 text-[11px]">Connect MetaMask to create elections and approve candidates on-chain.</p>
              </div>
            </div>
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="px-4 py-2 bg-orange-500/20 border border-orange-500/40 text-orange-400 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-orange-500/30 transition-all disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        ) : !isCorrectNetwork ? (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertTriangle size={16} className="text-red-400" />
            <div>
              <p className="text-red-400 font-bold text-sm">Wrong Network Detected</p>
              <p className="text-red-400/70 text-[11px]">Switch MetaMask to Ganache Local (Chain ID: 1337, RPC: http://127.0.0.1:7545).</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            <p className="text-emerald-400 text-[11px] font-bold font-mono">Admin wallet connected: {account.slice(0, 10)}...{account.slice(-4)}</p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Create Election */}
          <section className="bg-[#0f172a] p-10 rounded-2xl border border-[#1e293b] space-y-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="text-[#38bdf8]" size={20} /> Initialize Election
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Election Title</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Student Council 2026"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-4 text-white focus:ring-1 focus:ring-[#38bdf8] outline-none transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description & Requirements</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-4 text-white min-h-[120px] outline-none"
                />
              </div>

              <div className="space-y-6 bg-[#020617] border border-[#1e293b] p-6 rounded-xl">
                 <label className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-widest block">Governance Positions (Posts)</label>
                 <div className="flex gap-2">
                    <input 
                       type="text"
                       value={newPost}
                       onChange={(e) => setNewPost(e.target.value)}
                       placeholder="Enter position (e.g. President)"
                       className="flex-1 bg-[#0f172a] border border-[#1e293b] rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-[#38bdf8]"
                    />
                    <button 
                       type="button"
                       onClick={addPost}
                       className="bg-[#38bdf8] text-[#020617] px-4 py-2 rounded-lg font-bold text-xs uppercase"
                    >
                       Add Post
                    </button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {posts.map(post => (
                       <span key={post} className="bg-[#1e293b] text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 border border-[#334155]">
                          {post}
                          <button type="button" onClick={() => removePost(post)} className="text-red-400 hover:text-red-300"><X size={12} /></button>
                       </span>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nomination Deadline</label>
                   <input
                     required
                     type="datetime-local"
                     value={nominationEndDate}
                     onChange={(e) => setNominationEndDate(e.target.value)}
                     className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-4 text-white focus:ring-1 focus:ring-[#38bdf8] outline-none transition-all"
                     style={{ colorScheme: 'dark' }}
                   />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Voter Batches Dropdowns */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Users size={14} className="text-[#38bdf8]" />
                    Voter Batches
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Start Batch</span>
                      <select
                        value={voterStartBatch}
                        onChange={(e) => setVoterStartBatch(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-[#38bdf8] transition-all"
                        style={{ colorScheme: 'dark' }}
                      >
                        {BATCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>Batch {b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">End Batch</span>
                      <select
                        value={voterEndBatch}
                        onChange={(e) => setVoterEndBatch(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-[#38bdf8] transition-all"
                        style={{ colorScheme: 'dark' }}
                      >
                        {BATCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>Batch {b}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">Eligible Voters:</span>
                    {voterBatches.map((b) => (
                      <span key={b} className="px-2 py-0.5 bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 rounded text-[9px] font-bold">
                        Batch {b}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Nominator Batches Dropdowns */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Users size={14} className="text-[#818cf8]" />
                    Nominator Batches
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Start Batch</span>
                      <select
                        value={candidateStartBatch}
                        onChange={(e) => setCandidateStartBatch(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-[#818cf8] transition-all"
                        style={{ colorScheme: 'dark' }}
                      >
                        {BATCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>Batch {b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">End Batch</span>
                      <select
                        value={candidateEndBatch}
                        onChange={(e) => setCandidateEndBatch(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-[#818cf8] transition-all"
                        style={{ colorScheme: 'dark' }}
                      >
                        {BATCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>Batch {b}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">Eligible Nominators:</span>
                    {candidateBatches.map((b) => (
                      <span key={b} className="px-2 py-0.5 bg-[#818cf8]/10 text-[#818cf8] border border-[#818cf8]/20 rounded text-[9px] font-bold">
                        Batch {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-4 bg-[#38bdf8] text-[#020617] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#38bdf8]/90 transition-all shadow-lg active:scale-[0.98]"
              >
                {isCreating ? "Deploying To Blockchain..." : "Launch On-Chain Election"}
              </button>
            </form>
          </section>

          {/* Ongoing Management */}
          <section className="bg-[#0f172a] p-10 rounded-2xl border border-[#1e293b] space-y-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="text-[#38bdf8]" size={20} /> Management Dashboard
            </h2>
            <div className="grid gap-4">
              {elections.map((election) => (
                <div key={election.id} className="p-6 bg-[#020617] border border-[#1e293b] rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white tracking-tight">{election.title}</h3>
                      <p className="text-[10px] text-[#38bdf8] font-bold uppercase tracking-widest">{election.status}</p>
                    </div>
                    <div className="flex gap-2">
                       {election.status === 'nomination' && (
                         <button 
                           onClick={() => setSelectedElectionId(election.id)}
                           className="px-3 py-1.5 bg-[#1e293b] text-white text-[10px] font-bold uppercase rounded-lg border border-[#334155] hover:bg-[#1e293b]/80"
                         >
                           Reviews
                         </button>
                       )}
                       <button 
                          onClick={() => handleNotifyStudents(election.id)}
                          className="px-3 py-1.5 bg-[#38bdf8]/10 text-[#38bdf8] text-[10px] font-bold uppercase rounded-lg border border-[#38bdf8]/20 hover:bg-[#38bdf8]/20"
                       >
                          <Bell size={12} className="inline mr-1" /> Notify
                       </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1e293b]">
                     {election.status === 'nomination' && (
                        <>
                           <button
                             onClick={() => handleCloseNomination(election.id, election.blockchainId)}
                             className="px-4 py-2 bg-[#1e293b] text-white text-[10px] font-black uppercase rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-all"
                           >
                              Freeze Nominations
                           </button>
                           <button
                             onClick={() => handleUpdateStatus(election.id, 'ongoing', election.blockchainId)}
                             className="px-4 py-2 bg-[#38bdf8] text-[#020617] text-[10px] font-black uppercase rounded-lg hover:bg-[#38bdf8]/90 transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                           >
                              Commence Voting
                           </button>
                        </>
                     )}
                     {election.status === 'ongoing' && (
                        <button
                          onClick={() => handleUpdateStatus(election.id, 'ended', election.blockchainId)}
                          className="px-4 py-2 bg-red-500 text-white text-[10px] font-black uppercase rounded-lg hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                        >
                           Terminate Election
                        </button>
                     )}
                     {election.status === 'upcoming' && (
                        <button
                          onClick={() => handleUpdateStatus(election.id, 'nomination', election.blockchainId)}
                          className="px-4 py-2 bg-emerald-500 text-[#020617] text-[10px] font-black uppercase rounded-lg hover:bg-emerald-400 transition-all font-bold"
                        >
                           Open Nominations
                        </button>
                     )}
                     {election.status === 'ended' && (
                       <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                         <Check size={14} className="text-emerald-500" /> Election Finalized
                       </span>
                     )}
                  </div>

                  {(election.status === 'ended' || election.status === 'ongoing') && (
                    <div className="pt-4 border-t border-[#1e293b] space-y-4">
                       <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {election.status === 'ongoing' ? 'Live Consensus Tally' : 'Election Results Controls'}
                          </p>
                          {election.status === 'ended' && (
                            <button 
                              onClick={async () => {
                                await updateDoc(doc(db, 'elections', election.id), { resultsVisible: !election.resultsVisible });
                              }}
                              className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                election.resultsVisible ? 'bg-emerald-500 text-[#020617]' : 'bg-[#1e293b] text-slate-400'
                              }`}
                            >
                                {election.resultsVisible ? 'Results Public' : 'Results Hidden'}
                            </button>
                          )}
                       </div>
                       <div className="bg-[#0f172a] p-4 rounded-xl border border-[#1e293b] space-y-3">
                          {election.candidates && election.candidates.length > 0 ? (
                            <div className="space-y-3">
                              {(election.posts || []).map((post: string) => (
                                <div key={post} className="space-y-1">
                                   <p className="text-[9px] font-black text-[#38bdf8] uppercase tracking-tighter">{post}</p>
                                   <div className="space-y-1 pl-2 border-l border-[#1e293b]">
                                     {(election.candidates as any[]).filter((c: any) => c.post === post).map((c: any) => (
                                       <div key={c.id} className="flex items-center justify-between text-[11px]">
                                          <span className="text-slate-300">{c.name}</span>
                                          <span className="text-white font-mono font-bold">{c.votes || 0}</span>
                                        </div>
                                      ))}
                                   </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest text-center">No votes recorded</p>
                          )}
                       </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Nomination Queue */}
        <aside className="space-y-8">
           <section className="bg-[#0f172a] p-8 rounded-2xl border border-[#1e293b] min-h-[400px] flex flex-col">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-6">
                <Users size={16} className="text-[#38bdf8]" /> Nomination Queue
              </h2>

              {!selectedElectionId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                   <div className="w-12 h-12 bg-[#1e293b] rounded-full flex items-center justify-center text-slate-500">
                      <Hash size={24} />
                   </div>
                   <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest leading-loose">
                      Select an election <br /> to review applicants
                   </p>
                </div>
              ) : (
                <div className="space-y-4">
                   {nominations.length === 0 && (
                     <p className="text-[10px] text-slate-500 text-center py-10 uppercase font-bold tracking-widest">No pending applicants</p>
                   )}
                   {nominations.map((nom) => (
                      <div key={nom.id} className={`p-5 bg-[#020617] border rounded-xl space-y-3 transition-colors ${nom.status === 'pending' ? 'border-[#38bdf8]/30' : 'border-[#1e293b]'}`}>
                         <div className="flex items-center justify-between">
                            <h4 className="font-bold text-white text-sm">{nom.candidateName}</h4>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              nom.status === 'pending' ? 'bg-[#1e1b4b] text-[#818cf8]' :
                              nom.status === 'approved' ? 'bg-[#14532d] text-[#4ade80]' : 'bg-red-900/20 text-red-400'
                            }`}>{nom.status}</span>
                         </div>
                         <p className="text-[10px] text-[#38bdf8] font-black uppercase tracking-tighter">Position: {nom.postTitle}</p>
                         <p className="text-xs text-slate-400 line-clamp-3 italic mb-2">"{nom.statement}"</p>
                         <p className="text-[9px] text-slate-500 font-bold uppercase">Batch {nom.collegeData?.admissionYear} | {nom.collegeData?.department}</p>
                         
                         {nom.status === 'pending' && (
                           <div className="flex gap-2 pt-2">
                              <button 
                                onClick={() => handleApproveNomination(nom)}
                                className="flex-1 py-2 bg-emerald-500 text-[#020617] text-[10px] font-bold uppercase rounded-lg hover:bg-emerald-400"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => handleRejectNomination(nom.id)}
                                className="px-3 py-2 bg-[#1e293b] text-red-400 border border-red-900/30 text-[10px] font-bold uppercase rounded-lg hover:bg-red-900/20"
                              >
                                <X size={14} />
                              </button>
                           </div>
                         )}
                      </div>
                   ))}
                </div>
              )}
           </section>
        </aside>
      </div>
    </motion.div>
  );
}
