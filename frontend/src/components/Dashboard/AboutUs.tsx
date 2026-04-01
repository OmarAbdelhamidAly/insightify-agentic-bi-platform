import { motion } from 'framer-motion';
import { 
  Shield, Cpu, Binary, Globe, Database, Layers, GitBranch, 
  Monitor, Activity, Zap, FileJson, FileText, 
  Search, CheckCircle2, Lock, Shuffle, Network
} from 'lucide-react';
import omarImg from '../../assets/omar.jpeg';
import rawanImg from '../../assets/rawan.jpeg';
import menaImg from '../../assets/mena.jpeg';

export default function AboutUs() {
  const team = [
    { 
      name: "Omar Abdelhamid Aly", 
      role: "AI Engineer", 
      linkedin: "https://www.linkedin.com/in/omar-abdelhamid-ai/", 
      github: "https://github.com/OmarAbdelhamidAly",
      image: omarImg
    },
    { name: "Ahmed Medhat", role: "AI Engineer", linkedin: "#", github: "#", image: "" },
    { name: "Rawan Tarek", role: "AI Engineer", linkedin: "https://www.linkedin.com/in/rawan-tarek-ml", github: "https://github.com/RawanTarekkk", image: rawanImg },
    { name: "Sherif Sharaf", role: "AI Engineer", linkedin: "#", github: "#", image: "" },
    { name: "Mennatullah Essam", role: "AI Engineer", linkedin: "https://www.linkedin.com/in/mennaessam28", github: "https://github.com/MennaEssam8", image: menaImg },
    { name: "Salma Hamdy", role: "AI Engineer", linkedin: "#", github: "#", image: "" },
  ];

  const mainStats = [
    { val: "4+", lbl: "Core Pillars", icon: GitBranch },
    { val: "24ms", lbl: "Avg Latency", icon: Activity },
    { val: "RBAC", lbl: "Security Auth", icon: Shield },
    { val: "μSvc", lbl: "Architecture", icon: Cpu },
  ];

  const pillars = [
    { title: "SQL Oracle", desc: "11-Node graph. Zero-row reflection, Hybrid text-to-SQL Fusion, and Insight Verification loops.", icon: Database, color: "text-blue-400" },
    { title: "CSV Center", desc: "7-Node graph. Automatic data cleaning, outlier detection, and statistical machine learning scoring.", icon: Layers, color: "text-emerald-400" },
    { title: "PDF RAG", desc: "ColPali Multi-vector vision orchestration. Pauses for HITL verification before visual insight synthesis.", icon: FileText, color: "text-rose-400" },
    { title: "JSON Mapper", desc: "10-Node graph. Auto-structuring and semantic caching for immediate recall of identical nested logs.", icon: FileJson, color: "text-amber-400" },
  ];

  const guardrails = [
    { title: "Layer 1: Structural Check", desc: "Strict SELECT/WITH allowlist enforcement at the ingest layer.", icon: CheckCircle2 },
    { title: "Layer 2: Regex Blocklist", desc: "Pattern matching against DML and DDL commands (DROP, DELETE, UPDATE).", icon: Search },
    { title: "Layer 3: LLM Policy", desc: "Semantic NLP-based guardrail enforcing admin privacy policies (e.g. PII).", icon: Shield },
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scroll bg-[#03060a] relative selection:bg-indigo-500/30 font-sans">
      
      {/* ── Immersive Background & Grid ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.1]" 
             style={{ 
               backgroundImage: `radial-gradient(circle at 1px 1px, #6366f1 1px, transparent 0)`,
               backgroundSize: '40px 40px' 
             }} 
        />
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-indigo-500/10 blur-[180px] rounded-full" 
        />
        <motion.div 
          animate={{ x: [0, -40, 0], y: [0, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-purple-500/10 blur-[180px] rounded-full" 
        />
      </div>

      <div className="relative z-10 px-6 py-12 lg:px-32 lg:py-24 w-full max-w-[1700px] mx-auto space-y-48">

        {/* ========================================================== */}
        {/* SECTION 1: HERO OVERVIEW                                   */}
        {/* ========================================================== */}
        <section className="grid lg:grid-cols-5 gap-16 items-start pt-12">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-3 space-y-10"
          >
            <div className="inline-flex items-center gap-3 py-2 px-5 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-xl text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] shadow-2xl">
               <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
               Insightify — Intelligent Analytics
            </div>
            
            <h1 className="text-7xl lg:text-[110px] font-black text-white tracking-tighter leading-[0.85] uppercase">
              The Engine <span className="text-slate-700 whitespace-nowrap opacity-50 block lg:inline">for</span><br />
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-shimmer bg-[length:200%_auto]">
                Knowledge Control.
              </span>
            </h1>
            
            <p className="text-xl text-slate-400 leading-relaxed max-w-2xl font-medium">
              We bridge the gap between fragmented data and executive clarity. Insightify orchestrates autonomous agents to fetch, reason, and visualize across your enterprise ecosystem.
            </p>

            <div className="flex flex-wrap items-center gap-12 pt-8">
               <div className="flex items-center gap-4 group">
                  <div className="p-4 bg-indigo-500/5 rounded-2xl border border-white/5 group-hover:bg-indigo-500/10 transition-colors"><Zap className="w-6 h-6 text-indigo-400" /></div>
                  <div>
                    <div className="text-white font-black text-base uppercase tracking-tight">2.0 Flash Core</div>
                    <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Model Pipeline</div>
                  </div>
               </div>
               <div className="flex items-center gap-4 group">
                  <div className="p-4 bg-purple-500/5 rounded-2xl border border-white/5 group-hover:bg-purple-500/10 transition-colors"><Globe className="w-6 h-6 text-purple-400" /></div>
                  <div>
                    <div className="text-white font-black text-base uppercase tracking-tight">Hybrid RAG Fusion</div>
                    <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Cross-Source</div>
                  </div>
               </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="lg:col-span-2 grid grid-cols-2 gap-5"
          >
            {mainStats.map((s, i) => (
              <div key={i} className="group relative p-8 bg-white/[0.01] border border-white/5 rounded-[40px] backdrop-blur-xl hover:bg-white/[0.03] hover:border-indigo-500/30 transition-all duration-700 hover:-translate-y-2">
                 <s.icon className="w-6 h-6 text-slate-600 group-hover:text-indigo-400 mb-6 transition-colors" />
                 <div className="text-4xl font-black text-white mb-2 tracking-tighter">{s.val}</div>
                 <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{s.lbl}</div>
                 <div className="absolute top-6 right-6 text-[30px] font-black text-white opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">0{i+1}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ========================================================== */}
        {/* SECTION 2: THE 4 EXECUTION PILLARS                         */}
        {/* ========================================================== */}
        <section>
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.5em] flex items-center gap-4 mb-4">
              <span className="w-12 h-[1px] bg-indigo-500/30" /> Multi-Agent Execution Data Pipes
            </h2>
            <div className="text-5xl font-black text-white uppercase tracking-tighter max-w-2xl">The Four Pillars</div>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map((p, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="group p-8 bg-gradient-to-b from-white/[0.02] to-transparent border border-white/5 rounded-[40px] hover:border-white/10 transition-all duration-500 relative overflow-hidden"
              >
                <div className={`w-14 h-14 rounded-[20px] bg-black/50 border border-white/5 flex items-center justify-center ${p.color} mb-8 group-hover:scale-110 transition-transform duration-500`}>
                  <p.icon size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">{p.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed font-medium">{p.desc}</p>
                <div className="absolute bottom-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-all duration-500 translate-x-4 translate-y-4">
                  <p.icon size={100} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ========================================================== */}
        {/* SECTION 3: GOVERNANCE & SECURITY                           */}
        {/* ========================================================== */}
        <section className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-[11px] font-black text-rose-400 uppercase tracking-[0.5em] flex items-center gap-4">
              <span className="w-12 h-[1px] bg-rose-500/30" /> Zero-Trust Environment
            </h2>
            <div className="text-5xl font-black text-white uppercase tracking-tighter">Security & Governance</div>
            <p className="text-slate-400 text-lg leading-relaxed font-medium">
              Every query, interaction, and data point is isolated mathematically. Tenant-ID scoping ensures users and data sources are compartmentalized with AES-256-GCM encryption at rest.
            </p>
            <div className="flex items-center gap-4 bg-rose-500/10 text-rose-300 py-3 px-6 rounded-2xl border border-rose-500/20 w-fit">
              <Lock size={18} />
              <span className="text-sm font-black tracking-widest uppercase">Multi-Tenant Isolated</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            {guardrails.map((g, i) => (
              <div key={i} className="flex gap-6 p-6 bg-white/[0.01] border border-white/5 rounded-3xl hover:bg-white/[0.03] transition-colors">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-rose-400">
                  <g.icon size={20} />
                </div>
                <div>
                  <h4 className="text-white font-black uppercase tracking-tight mb-1">{g.title}</h4>
                  <p className="text-[13px] text-slate-500 font-medium">{g.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ========================================================== */}
        {/* SECTION 4: LANGGRAPH REASONING AND HEALING                 */}
        {/* ========================================================== */}
        <section>
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16 space-y-6"
          >
            <h2 className="text-[11px] font-black text-purple-400 uppercase tracking-[0.5em] justify-center flex items-center gap-4">
              <span className="w-8 h-[1px] bg-purple-500/30" /> Self-Healing Architecture <span className="w-8 h-[1px] bg-purple-500/30" />
            </h2>
            <div className="text-5xl font-black text-white uppercase tracking-tighter">LangGraph Reasoning</div>
            <p className="text-slate-400 font-medium">Unlike rigid pipelines, our agents think. They map errors to logic, backtrack dynamically, and pause for human oversight before exposing potentially hallucinated anomalies.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Zero-Row Reflection", desc: "If an SQL query returns 0 results, the agent extracts literals, checks data distribution, and auto-rewrites queries (up to 3 loops) instead of hard-failing.", icon: Shuffle },
              { title: "Anti-Hallucination Gate", desc: "A verifier node cross-references insight output exclusively with the bounded context. If mismatch occurs, it retriggers the synthesis engine.", icon: Network },
              { title: "Human-in-the-Loop", desc: "For destructive or high-cost queries, execution is interrupted, checkpointed to Redis, and waits for a senior administrator's approval.", icon: Binary },
            ].map((node, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-8 bg-black/40 border border-purple-500/20 rounded-[32px] text-center group hover:border-purple-500/50 transition-colors"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                  <node.icon size={26} />
                </div>
                <h4 className="text-lg font-black text-white uppercase tracking-tight mb-3">{node.title}</h4>
                <p className="text-[13px] text-slate-400 leading-relaxed font-medium">{node.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ========================================================== */}
        {/* SECTION 5: ARCHITECT CIRCLE (TEAM)                         */}
        {/* ========================================================== */}
        <section className="bg-white/[0.01] border border-white/5 rounded-[60px] p-8 lg:p-20 relative overflow-hidden">
           <div className="absolute -top-40 -right-40 text-[400px] font-black text-white/[0.01] select-none pointer-events-none">Q</div>
           
           <div className="grid lg:grid-cols-3 gap-20 relative z-10">
              <div className="space-y-8">
                 <div className="inline-block py-1.5 px-4 rounded-lg bg-pink-500/10 border border-pink-500/20 text-[10px] font-black text-pink-400 uppercase tracking-[0.3em]">Architect Circle</div>
                 <h2 className="text-6xl font-black text-white leading-[0.9] uppercase tracking-tighter">Human <br />Reasoning.</h2>
                 <p className="text-slate-400 font-medium leading-relaxed text-lg">
                   We built Insightify as a symphony of agents and engineers, ensuring technical precision never loses human intent.
                 </p>
                 <div className="pt-6">
                    <button className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase tracking-[0.3em] hover:bg-white/10 transition-all flex items-center gap-4">
                       Explore Tech Stack <Monitor size={16} />
                    </button>
                 </div>
              </div>

              <div className="lg:col-span-2 grid md:grid-cols-2 gap-10">
                 {team.map((m, i) => (
                    <motion.a 
                      key={i}
                      href={m.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      viewport={{ once: true }}
                      className="group/item relative block p-6 rounded-[30px] bg-white/[0.01] border border-white/5 hover:border-indigo-400/30 hover:bg-white/[0.03] transition-all"
                    >
                       <div className="flex items-center gap-5 mb-5">
                          <div className="w-16 h-16 rounded-[20px] bg-slate-900 flex items-center justify-center text-xl font-black text-indigo-400 overflow-hidden shrink-0">
                             {m.image ? (
                               <img src={m.image} alt={m.name} className="w-full h-full object-cover grayscale group-hover/item:grayscale-0 transition-all duration-700" />
                             ) : (
                               m.name.charAt(0)
                             )}
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-white group-hover/item:text-indigo-400 transition-colors uppercase tracking-tight">{m.name}</h4>
                            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">{m.role}</div>
                          </div>
                       </div>
                    </motion.a>
                 ))}
              </div>
           </div>
        </section>

        {/* ── Footer ── */}
        <div className="border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center gap-8 opacity-50 pb-12">
           <div className="flex items-center gap-6">
              <div className="w-12 h-[1px] bg-indigo-500/30" />
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Integrated Intelligence // NTI 2026</div>
           </div>
           <div className="flex items-center gap-6">
              <div className="text-[10px] font-mono text-slate-700 uppercase tracking-widest leading-loose">
                 VIRTUAL_PROVISIONING: ACTIVE<br />
                 DATA_INTEGRITY: VERIFIED
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center font-black text-white text-lg">Q</div>
           </div>
        </div>

      </div>
    </div>
  );
}