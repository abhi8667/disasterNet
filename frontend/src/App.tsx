import React, { useState, useMemo } from 'react';
import { useMesh } from './context/MeshContext';
import { calculatePriorityScore } from './ai/fairnessEngine';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as ChartTooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { nodeId, connected, isGateway, forceOffline, setForceOffline, packets, broadcastSOS, triggerSync, blockchainLogs, hardReset } = useMesh();
  const [payload, setPayload] = useState('');
  const [medicalUrgency, setMedicalUrgency] = useState(5);
  const [syncing, setSyncing] = useState(false);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.trim()) return;
    // Generate a random relative coordinate for the CSS map
    const x = Math.floor(Math.random() * 80) + 10;
    const y = Math.floor(Math.random() * 80) + 10;
    
    broadcastSOS(payload, medicalUrgency, {
      medicalUrgency,
      peopleAffected: Math.floor(Math.random() * 10) + 1,
      waitStartTime: Date.now(),
      locationDifficulty: Math.floor(Math.random() * 5) + 1
    }, { lat: y, lng: x });
    setPayload('');
  };

  const selectedPacket = useMemo(() => packets.find(p => p.id === selectedPacketId), [packets, selectedPacketId]);
  const aiAnalysis = useMemo(() => selectedPacket ? calculatePriorityScore(selectedPacket) : null, [selectedPacket]);

  return (
    <div className="h-screen w-screen bg-[#020617] text-white flex overflow-hidden font-sans">
      
      {/* Left Panel: Tactical Map Fallback */}
      <main className="flex-1 relative border-r border-slate-800 bg-[#0a0f1e] overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="text-center opacity-20">
              <h2 className="text-6xl font-black tracking-tighter">TACTICAL GRID</h2>
              <p className="text-sm font-mono tracking-[1em]">SUB-SPACE SCANNING</p>
           </div>
        </div>

        {/* SOS Markers */}
        {packets.map(p => (
          <motion.div 
            key={p.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => setSelectedPacketId(p.id)}
            style={{ top: `${p.location.lat}%`, left: `${p.location.lng}%` }}
            className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full cursor-pointer z-20 group`}
          >
            <div className={`absolute inset-0 rounded-full ${p.severity > 7 ? 'bg-red-500 shadow-[0_0_20px_#ef4444]' : 'bg-cyan-500 shadow-[0_0_20px_#06b6d4]'}`}></div>
            <div className={`absolute inset-0 rounded-full animate-ping opacity-40 ${p.severity > 7 ? 'bg-red-500' : 'bg-cyan-500'}`}></div>
            
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 border border-slate-700 px-2 py-1 rounded text-[8px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              SCORE: {calculatePriorityScore(p).score.toFixed(1)}
            </div>
          </motion.div>
        ))}

        {/* Status Overlays */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
          <div className="bg-black/80 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl pointer-events-auto shadow-2xl">
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">Disaster<span className="text-cyan-400">Net</span></h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mesh Node Active</span>
              </div>
              <div className="w-[1px] h-3 bg-slate-700"></div>
              <span className="text-[10px] font-mono text-cyan-400/80 uppercase">{nodeId ? `ID: ${nodeId.substring(0,8)}` : 'BOOTING...'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 items-end">
             <div className="bg-black/80 backdrop-blur-xl border border-slate-800 p-2 rounded-full pointer-events-auto flex items-center gap-4 px-6 shadow-2xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Manual Offline Mode</span>
                <button onClick={() => setForceOffline(!forceOffline)} className={`w-10 h-5 rounded-full p-1 transition-all ${forceOffline ? 'bg-red-600' : 'bg-slate-700'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-all ${forceOffline ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
             </div>
             <div className={`bg-black/80 backdrop-blur-xl border p-4 rounded-2xl pointer-events-auto transition-all ${isGateway ? 'border-purple-500/50 shadow-purple-500/20' : 'border-slate-800 opacity-40'}`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Network Gateway</div>
                <div className={`text-sm font-black ${isGateway ? 'text-purple-400' : 'text-slate-500'}`}>{isGateway ? '🌐 STELLAR SYNC READY' : '📻 MESH (NO INTERNET)'}</div>
             </div>
          </div>
        </div>

        <button onClick={hardReset} className="absolute bottom-6 right-6 bg-black/40 hover:bg-red-900 border border-slate-800 text-[8px] font-black uppercase tracking-widest px-4 py-2 rounded-full pointer-events-auto transition-all opacity-30 hover:opacity-100">Hard Reset Demo</button>

        <div className="absolute bottom-6 left-6 w-96 max-h-48 overflow-hidden pointer-events-auto">
           <div className="bg-black/90 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl flex flex-col h-full shadow-2xl">
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>Stellar Ledger Live Feed</span>
                {isGateway && packets.some(p => !p.synced) && (
                  <button onClick={async () => { setSyncing(true); await triggerSync(); setSyncing(false); }} className="text-purple-400 font-black animate-pulse uppercase px-2 bg-purple-400/10 rounded">Anchor to Ledger</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[9px] text-slate-400 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {blockchainLogs.map(log => (
                    <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} key={log.id} className="flex gap-2 text-purple-400/80">
                      <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className="font-bold">TX_VERIFIED</span>
                      <span className="text-slate-500 truncate">{log.hash}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {blockchainLogs.length === 0 && <div className="italic opacity-20 py-4">Waiting for gateway sync events...</div>}
              </div>
           </div>
        </div>
      </main>

      {/* Right Panel: Command Center */}
      <aside className="w-[450px] flex flex-col bg-slate-950 p-8 space-y-8 overflow-y-auto custom-scrollbar shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-10">
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-red-500">Emergency Broadcast</h2>
            <div className="text-[10px] font-bold text-slate-600">PROTOCOL v5.0</div>
          </div>
          <form onSubmit={handleSend} className="space-y-6 bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50 shadow-inner">
            <textarea className="w-full bg-black/60 border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-red-500/50 transition-all resize-none shadow-inner" rows={2} value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="Enter SOS Sit-Rep..." />
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Medical Severity</span>
              <span className="text-red-400 font-black text-xs">{medicalUrgency}/10</span>
            </div>
            <input type="range" min="1" max="10" value={medicalUrgency} onChange={(e) => setMedicalUrgency(Number(e.target.value))} className="w-full accent-red-500 h-1 bg-slate-800 rounded-lg appearance-none" />
            <button className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-red-900/40 disabled:opacity-20" disabled={!connected || !payload.trim()}>
              Origin Message
            </button>
          </form>
        </section>

        <section className="flex-1 flex flex-col min-h-[400px]">
          {selectedPacket && aiAnalysis ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col space-y-8 bg-slate-900/80 p-8 rounded-3xl border border-slate-800 shadow-2xl">
               <div className="flex justify-between items-start">
                  <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">Priority Auditor</h3>
                  <div className="text-center">
                    <div className="text-5xl font-black text-white leading-none">{aiAnalysis.score.toFixed(1)}</div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">AI Rank</div>
                  </div>
               </div>

               <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aiAnalysis.breakdown} layout="vertical" margin={{ left: -30 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" hide />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {aiAnalysis.breakdown.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>

               <div className="space-y-3">
                  {aiAnalysis.breakdown.map((item, i) => (
                    <div key={i} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-slate-800/50">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
                      <span className="text-xs font-black text-slate-200">+{item.value.toFixed(1)}</span>
                    </div>
                  ))}
               </div>

               {aiAnalysis.isBiased && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 border-l-4">
                  <span className="text-xl">⚖️</span>
                  <p className="text-[9px] text-red-400 font-bold leading-relaxed tracking-tight">{aiAnalysis.biasReasoning}</p>
                </div>
               )}

               <div className="mt-auto pt-6 border-t border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Protocol Audit</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${selectedPacket.synced ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-600'}`}>
                      {selectedPacket.synced ? 'On Ledger' : 'Mesh Data'}
                    </span>
                  </div>
                  <div className="bg-black/50 p-3 rounded-xl font-mono text-[8px] text-slate-600 break-all leading-relaxed shadow-inner">
                    {selectedPacket.id}
                  </div>
               </div>
            </motion.div>
          ) : (
            <div className="flex-1 border-2 border-dashed border-slate-900/50 rounded-3xl flex flex-col items-center justify-center text-slate-800 px-10 text-center">
              <div className="text-5xl mb-6 grayscale opacity-10">⚖️</div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed opacity-40">
                Select a tactical pulse to audit mission integrity
              </p>
            </div>
          )}
        </section>
      </aside>

    </div>
  );
}

export default App;
