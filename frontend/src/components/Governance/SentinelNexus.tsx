import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  Zap, 
  Trash2, 
  Loader2,
  Database,
  BookOpen,
  Brain,
  Target,
  Upload,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GovernanceAPI, KnowledgeAPI, MetricsAPI } from '../../services/api';

type SentinelTab = 'security' | 'knowledge' | 'dictionary';

export default function SentinelNexus() {
  const [activeTab, setActiveTab] = useState<SentinelTab>('security');
  const [loading, setLoading] = useState(true);
  
  // -- Security State --
  const [protocols, setProtocols] = useState<any[]>([]);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  // -- Knowledge State --
  const [kbList, setKbList] = useState<any[]>([]);
  const [selectedKb, setSelectedKb] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // -- Dictionary State --
  const [metrics, setMetrics] = useState<any[]>([]);
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [policies, kbs, mets] = await Promise.all([
        GovernanceAPI.list(),
        KnowledgeAPI.list(),
        MetricsAPI.list()
      ]);
      setProtocols(policies);
      setKbList(kbs);
      setMetrics(mets);
    } catch (e) {
      console.error("Sentinel sync failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -- Security Logic --
  const handleEstablishPolicy = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await GovernanceAPI.create({
        name: formData.get('name') as string,
        rule_type: formData.get('type') as string,
        description: `Autonomous guardrail for ${formData.get('type')} with ${formData.get('severity')} priority.`
      });
      const data = await GovernanceAPI.list();
      setProtocols(data);
      setIsPolicyModalOpen(false);
    } catch (e) {
      alert("Failed to establish policy.");
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!confirm("Revoke this security protocol?")) return;
    try {
      await GovernanceAPI.delete(id);
      const data = await GovernanceAPI.list();
      setProtocols(data);
    } catch (e) {
      alert("Revocation failed.");
    }
  };

  // -- Knowledge Logic --
  const handleKbClick = async (kb: any) => {
    try {
      setSelectedKb(kb);
      const docs = await KnowledgeAPI.listDocuments(kb.id);
      setDocuments(docs);
    } catch (e) {
      console.error("Doc fetch failed", e);
    }
  };

  useEffect(() => {
    let interval: any;
    const hasProcessingDocs = documents.some(d => ['pending', 'processing', 'running'].includes(d.status));
    if (hasProcessingDocs && selectedKb) {
      interval = setInterval(async () => {
        try {
          const docs = await KnowledgeAPI.listDocuments(selectedKb.id);
          setDocuments(docs);
          const kbs = await KnowledgeAPI.list();
          setKbList(kbs);
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [documents, selectedKb]);

  const handleCreateKb = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await KnowledgeAPI.create({
        name: formData.get('name') as string,
        description: formData.get('description') as string
      });
      const kbs = await KnowledgeAPI.list();
      setKbList(kbs);
      setIsKbModalOpen(false);
    } catch (e) {
      alert("Collection creation failed.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !selectedKb) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      await KnowledgeAPI.uploadDocument(selectedKb.id, file);
      const docs = await KnowledgeAPI.listDocuments(selectedKb.id);
      setDocuments(docs);
    } catch (e) {
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteKb = async (id: string) => {
    if (!confirm("Delete knowledge collection?")) return;
    try {
      await KnowledgeAPI.delete(id);
      const kbs = await KnowledgeAPI.list();
      setKbList(kbs);
      setSelectedKb(null);
    } catch (e) {
      alert("Delete failed.");
    }
  };

  // -- Dictionary Logic --
  const handleCreateMetric = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await MetricsAPI.create({
        name: formData.get('name') as string,
        definition: formData.get('definition') as string,
        formula: formData.get('formula') as string
      });
      const mets = await MetricsAPI.list();
      setMetrics(mets);
      setIsMetricModalOpen(false);
    } catch (e) {
      alert("Metric definition failed.");
    }
  };

  const handleDeleteMetric = async (id: string) => {
    if (!confirm("Remove business logic definition?")) return;
    try {
      await MetricsAPI.delete(id);
      const mets = await MetricsAPI.list();
      setMetrics(mets);
    } catch (e) {
      alert("Delete failed.");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0d17]/50 relative">
      <AnimatePresence>
        {/* Policy Modal */}
        {isPolicyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPolicyModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[#171c2a] border border-slate-700/50 rounded-[32px] overflow-hidden">
                <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                   <h2 className="text-xl font-black text-white uppercase tracking-tight">Establish Policy</h2>
                   <button onClick={() => setIsPolicyModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <form onSubmit={handleEstablishPolicy} className="p-8 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Name</label>
                      <input name="name" required placeholder="e.g. Data Anonymization" className="w-full bg-black/20 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm font-bold" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</label>
                        <select name="type" className="w-full bg-black/20 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm font-bold appearance-none">
                          <option value="security">Security</option>
                          <option value="compliance">Compliance</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Severity</label>
                        <select name="severity" className="w-full bg-black/20 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm font-bold appearance-none">
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                        </select>
                      </div>
                   </div>
                   <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3"><Zap className="w-5 h-5" /> Activate Guardrail</button>
                </form>
             </motion.div>
          </div>
        )}

        {/* KB Modal */}
        {isKbModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsKbModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[#171c2a] border border-slate-700/50 rounded-[32px] overflow-hidden">
               <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">New Knowledge Collection</h2>
                  <button onClick={() => setIsKbModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
               </div>
               <form onSubmit={handleCreateKb} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Collection Identity</label>
                    <input name="name" required placeholder="e.g. Legal Contracts" className="w-full bg-black/20 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm font-bold" />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all">Establish Repository</button>
               </form>
            </motion.div>
          </div>
        )}

        {/* Metric Modal */}
        {isMetricModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMetricModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[#171c2a] border border-slate-700/50 rounded-[32px] overflow-hidden">
               <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">Define Business Logic</h2>
                  <button onClick={() => setIsMetricModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
               </div>
               <form onSubmit={handleCreateMetric} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metric Identity</label>
                    <input name="name" required placeholder="e.g. EBITDA" className="w-full bg-black/20 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Definition</label>
                    <textarea name="definition" rows={2} required placeholder="Business meaning..." className="w-full bg-black/20 border border-slate-800 rounded-2xl px-5 py-4 text-white text-sm font-bold" />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all">Sync Dictionary</button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-8 pb-8 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-end justify-between">
          <div>
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                   <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Sentinel Nexus — Global Oversight</span>
             </div>
             <h1 className="text-4xl font-black text-white tracking-tight">Sentinel Hub</h1>
             <p className="text-slate-400 mt-2 font-medium max-w-xl">
               Manage multi-source security policies, knowledge repositories, and business logic from a single command node.
             </p>
          </div>

          <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-xl">
             <button onClick={() => setActiveTab('security')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'security' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}>Security</button>
             <button onClick={() => setActiveTab('knowledge')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'knowledge' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>Vault</button>
             <button onClick={() => setActiveTab('dictionary')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dictionary' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'}`}>Logic</button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden px-8 pb-8">
        {activeTab === 'security' && (
          <div className="h-full flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Autonomous Guardrails</h3>
               <button onClick={() => setIsPolicyModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-500/5"><Plus className="w-3.5 h-3.5" /> Establish Policy</button>
            </div>
            
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[32px] overflow-hidden backdrop-blur-xl custom-scroll overflow-y-auto">
               <div className="divide-y divide-slate-800/50">
                  {loading ? (
                    <div className="p-12 flex flex-col items-center gap-4"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Syncing Security Matrix...</p></div>
                  ) : protocols.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center gap-4 opacity-30"><Lock className="w-12 h-12 text-slate-500" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No active guardrails</p></div>
                  ) : protocols.map((p) => (
                    <div key={p.id} className="p-6 hover:bg-white/5 transition-all group flex items-center justify-between">
                       <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${p.rule_type === 'security' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            {p.rule_type === 'security' ? <Lock className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                               <p className="font-bold text-white group-hover:text-emerald-400 transition-colors uppercase text-sm tracking-tight">{p.name}</p>
                               <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase tracking-widest">{p.id.substring(0, 8)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{p.rule_type.toUpperCase()} • ENFORCED REAL-TIME</p>
                          </div>
                       </div>
                       <button onClick={() => handleDeletePolicy(p.id)} className="p-2 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="h-full flex gap-8">
             <div className="w-[380px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scroll">
                <div className="flex items-center justify-between px-2">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Collections</h3>
                   <button onClick={() => setIsKbModalOpen(true)} className="p-1.5 hover:bg-white/5 rounded-lg text-indigo-400"><Plus className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                   {kbList.map((kb) => (
                      <div key={kb.id} onClick={() => handleKbClick(kb)} className={`p-6 rounded-[32px] border transition-all cursor-pointer group flex flex-col gap-4 ${selectedKb?.id === kb.id ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
                         <div className="flex items-center justify-between">
                            <div className={`p-2.5 rounded-xl border ${selectedKb?.id === kb.id ? 'bg-indigo-500 text-white' : 'bg-slate-800/50 text-slate-400'}`}><Database className="w-5 h-5" /></div>
                            <span className="text-[8px] font-black px-2 py-1 rounded bg-black/40 text-slate-500 uppercase tracking-widest">{kb.document_count || 0} Docs</span>
                         </div>
                         <h4 className="font-black text-white text-sm group-hover:text-indigo-400 transition-colors uppercase truncate">{kb.name}</h4>
                      </div>
                   ))}
                </div>
             </div>

             <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[40px] overflow-hidden backdrop-blur-xl flex flex-col">
                {selectedKb ? (
                  <>
                    <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/5 to-transparent shrink-0">
                       <h3 className="text-xl font-black text-white uppercase tracking-tight">{selectedKb.name}</h3>
                       <div className="flex gap-3">
                          <label className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-white transition-all cursor-pointer flex items-center gap-2 group">
                             <Upload className="w-4 h-4" /> <span>Sync Doc</span>
                             <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt" />
                          </label>
                          <button onClick={() => handleDeleteKb(selectedKb.id)} className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-8 py-6 custom-scroll space-y-4">
                       {documents.map((doc) => (
                         <div key={doc.id} className="p-6 bg-black/20 border border-slate-800/50 hover:border-indigo-500/30 rounded-2xl flex items-center justify-between group transition-all">
                            <div className="flex items-center gap-4">
                               <div className="p-3 bg-slate-800 rounded-xl text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all"><BookOpen className="w-4 h-4" /></div>
                               <div><p className="font-bold text-white text-xs uppercase">{doc.name}</p></div>
                            </div>
                            <span className="text-[8px] font-black px-2 py-1 rounded bg-black/40 text-slate-600 uppercase group-hover:text-amber-400">{doc.status}</span>
                         </div>
                       ))}
                       {isUploading && <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 animate-pulse text-[9px] font-black text-indigo-400 uppercase text-center rounded-xl">Neural Sync...</div>}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-20"><Brain className="w-20 h-20 text-indigo-500 mb-6" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Select a Repository</p></div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'dictionary' && (
          <div className="h-full flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logic Dictionary</h3>
               <button onClick={() => setIsMetricModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-purple-500/5"><Plus className="w-3.5 h-3.5" /> Define Metric</button>
            </div>
            
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-[32px] overflow-hidden backdrop-blur-xl p-8 overflow-y-auto custom-scroll">
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {metrics.map((m) => (
                    <div key={m.id} className="p-6 bg-black/20 border border-slate-800/50 rounded-3xl hover:border-purple-500/30 transition-all group relative">
                       <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400"><Target className="w-4 h-4" /></div>
                             <h4 className="font-black text-white uppercase text-xs tracking-tight">{m.name}</h4>
                          </div>
                          <button onClick={() => handleDeleteMetric(m.id)} className="p-2 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                       </div>
                       <p className="text-[10px] text-slate-400 font-medium mb-4 line-clamp-2 uppercase leading-relaxed">{m.definition}</p>
                       <div className="p-2.5 bg-purple-500/5 border border-purple-500/10 rounded-xl font-mono text-[9px] text-purple-400">{m.formula || 'DYNAMIC_RESOLVE'}</div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
