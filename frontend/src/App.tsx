import React, { useState, useMemo, useEffect } from 'react';
import { useMesh } from './context/MeshContext';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { nodeId, connected, isGateway, forceOffline, setForceOffline, packets, broadcastSOS, respondToSOS, removePacket, triggerSync, blockchainLogs, hardReset } = useMesh();
  const [payload, setPayload] = useState('');
  const [medicalUrgency, setMedicalUrgency] = useState(5);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [responseNotes, setResponseNotes] = useState('');
  const [interfaceMode, setInterfaceMode] = useState<'VICTIM' | 'REVIEWER'>('VICTIM');

  // Rescue Alert Logic
  const [showRescueAlert, setShowRescueAlert] = useState<{msg: string, node: string} | null>(null);
  const [lastDispatchedId, setLastDispatchedId] = useState<string | null>(null);

  useEffect(() => {
    if (interfaceMode !== 'VICTIM') return;
    const myPackets = packets.filter(p => p.sender === nodeId);
    const dispatched = myPackets.find(p => p.response?.status === 'DISPATCHED' || p.response?.status === 'RESCUED');

    if (dispatched && dispatched.id !== lastDispatchedId) {
      setShowRescueAlert({msg: dispatched.response?.notes || "Help is on the way!", node: dispatched.response?.responderId.substring(0,8) || "Command"});
      setLastDispatchedId(dispatched.id);
      const timer = setTimeout(() => setShowRescueAlert(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [packets, nodeId, interfaceMode, lastDispatchedId]);

  const stats = useMemo(() => {
    const rescued = packets.filter(p => p.response?.status === 'RESCUED').length;
    const dispatched = packets.filter(p => p.response?.status === 'DISPATCHED').length;
    const pending = packets.filter(p => !p.response || p.response.status === 'PENDING').length;
    const total = packets.length;
    return { rescued, dispatched, pending, total };
  }, [packets]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.trim()) return;
    const x = Math.floor(Math.random() * 70) + 15;
    const y = Math.floor(Math.random() * 70) + 15;
    broadcastSOS(payload, medicalUrgency, {
      medicalUrgency,
      peopleAffected: Math.floor(Math.random() * 10) + 1,
      waitStartTime: Date.now(),
      locationDifficulty: Math.floor(Math.random() * 5) + 1
    }, { lat: y, lng: x });
    setPayload('');
  };

  const handleResponse = (status: 'DISPATCHED' | 'RESCUED') => {
    if (!selectedPacketId) return;
    respondToSOS(selectedPacketId, status, responseNotes);
    setResponseNotes('');
  };

  const handleDelete = () => {
    if (!selectedPacketId) return;
    if (window.confirm("Permanent deletion of signal from mesh?")) {
      removePacket(selectedPacketId);
      setSelectedPacketId(null);
    }
  };

  const selectedPacket = useMemo(() => packets.find(p => p.id === selectedPacketId), [packets, selectedPacketId]);

  const theme = {
    bg: isDarkMode ? 'bg-slate-950' : 'bg-slate-50',
    panel: isDarkMode ? 'bg-slate-900/60 backdrop-blur-xl border-slate-800' : 'bg-white/80 backdrop-blur-xl border-slate-200',
    card: isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200',
    inner: isDarkMode ? 'bg-black/40 border-slate-800' : 'bg-slate-100/50 border-slate-200',
    text: isDarkMode ? 'text-white' : 'text-slate-900',
    textDim: isDarkMode ? 'text-slate-500' : 'text-slate-400',
    accent: 'text-cyan-500',
    grid: isDarkMode ? 'rgba(30, 41, 59, 0.2)' : 'rgba(203, 213, 225, 0.5)'
  };

  return (
    <div className={`h-screen w-screen ${theme.bg} ${theme.text} flex overflow-hidden font-sans transition-all duration-700`}>
      
      {/* Premium Rescue Notification */}
      <AnimatePresence>
        {showRescueAlert && (interfaceMode === 'VICTIM') && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: -50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -50 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xl p-1 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 rounded-[2rem] shadow-[0_20px_50px_rgba(16,185,129,0.3)]"
          >
            <div className="bg-slate-950 rounded-[1.8rem] p-8 flex items-center gap-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5 text-6xl">📡</div>
               <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-4xl animate-pulse shadow-[0_0_30px_rgba(16,185,129,0.5)]">🚑</div>
               <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Response Decrypted</span>
                    <span className="text-[10px] font-mono text-slate-500">FROM: NODE_{showRescueAlert.node}</span>
                  </div>
                  <h3 className="text-2xl font-black tracking-tighter text-white mb-2">Help is Dispatched</h3>
                  <p className="text-slate-300 font-medium text-base italic border-l-2 border-green-500 pl-4 py-1">"{showRescueAlert.msg}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                       <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 2 }} className="h-full w-1/3 bg-green-500 shadow-[0_0_10px_#10b981]"></motion.div>
                    </div>
                    <span className="text-[9px] font-black uppercase text-green-500 animate-pulse">Mesh Link Active</span>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid View */}
      <main className={`flex-1 relative border-r ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} overflow-hidden`}>
        {/* Animated Tactical Grid */}
        <div className="absolute inset-0 z-0 opacity-50" style={{ 
          backgroundImage: `radial-gradient(circle, ${theme.grid} 1px, transparent 1px)`, 
          backgroundSize: '50px 50px'
        }}></div>
        
        {/* Mesh SOS Pings */}
        <div className="absolute inset-0 z-10">
          {packets.map(p => (
            <motion.div 
              key={p.id} initial={{ scale: 0 }} animate={{ scale: 1 }}
              onClick={() => setSelectedPacketId(p.id)}
              style={{ top: `${p.location.lat}%`, left: `${p.location.lng}%` }}
              className="absolute w-12 h-12 -ml-6 -mt-6 cursor-pointer z-50 group flex items-center justify-center"
            >
              <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
                p.response?.status === 'RESCUED' ? 'bg-green-500 shadow-[0_0_30px_#22c55e]' : 
                p.response?.status === 'DISPATCHED' ? 'bg-blue-500 shadow-[0_0_30px_#3b82f6]' :
                p.severity > 7 ? 'bg-red-600 shadow-[0_0_30px_#dc2626]' : 'bg-cyan-500 shadow-[0_0_30px_#06b6d4]'
              }`}></div>
              <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                p.response?.status === 'RESCUED' ? 'bg-green-500' : 
                p.response?.status === 'DISPATCHED' ? 'bg-blue-500' : 'bg-white'
              }`}></div>
              <span className="relative z-10 text-[10px] font-black text-white drop-shadow-md">{p.path.length}h</span>
            </motion.div>
          ))}
        </div>

        {/* HUD Top Center */}
        <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-20 pointer-events-none">
          <div className={`${theme.panel} p-6 rounded-[2rem] pointer-events-auto shadow-2xl border border-white/5`}>
            <div className="flex items-center gap-6 mb-4">
                <h1 className={`text-3xl font-black tracking-tighter uppercase ${theme.text}`}>Disaster<span className="text-cyan-500 italic">Net</span></h1>
                <div className={`px-4 py-1.5 rounded-full border ${isDarkMode ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50/50 border-cyan-100'}`}>
                    <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">{interfaceMode} INTERFACE</span>
                </div>
            </div>
            
            <div className="flex items-center gap-10">
              <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textDim} mb-1`}>Rescued Units</span>
                <div className="flex items-end gap-2 leading-none">
                   <span className="text-3xl font-black text-green-500">{stats.rescued}</span>
                   <span className={`text-sm font-bold ${theme.textDim} pb-1`}>/ {stats.total}</span>
                </div>
              </div>
              <div className={`w-[1px] h-10 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textDim} mb-1`}>Pending SOS</span>
                <span className="text-3xl font-black text-red-500 leading-none">{stats.pending}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 items-end pointer-events-auto">
             <div className={`${theme.panel} p-2 rounded-full flex gap-2 border border-white/5 shadow-xl`}>
                 <button onClick={() => setInterfaceMode('VICTIM')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all ${interfaceMode === 'VICTIM' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-900/40' : theme.textDim}`}>Victim Mode</button>
                 <button onClick={() => setInterfaceMode('REVIEWER')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all ${interfaceMode === 'REVIEWER' ? 'bg-red-500 text-white shadow-lg shadow-red-900/40' : theme.textDim}`}>Admin Hub</button>
             </div>
             <div className="flex gap-4">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`${theme.panel} w-12 h-12 rounded-full flex items-center justify-center shadow-lg border border-white/5 text-xl`}>
                  {isDarkMode ? '🌙' : '☀️'}
                </button>
                <div className={`${theme.panel} px-6 rounded-full flex items-center gap-4 border border-white/5 shadow-lg`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textDim}`}>Offline Isolation</span>
                    <button onClick={() => setForceOffline(!forceOffline)} className={`w-12 h-6 rounded-full p-1 transition-all ${forceOffline ? 'bg-red-600' : 'bg-slate-700'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-all ${forceOffline ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                </div>
             </div>
          </div>
        </div>

        {/* Ledger Terminal (Bottom Left) */}
        <div className="absolute bottom-8 left-8 w-80 z-20 pointer-events-auto">
           <div className={`${theme.panel} p-5 rounded-3xl shadow-2xl border border-white/5`}>
              <div className={`text-[9px] font-black uppercase tracking-widest mb-4 flex justify-between ${theme.textDim}`}>
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping"></span> Stellar Chain</span>
                {isGateway && packets.some(p => !p.synced) && <span className="text-purple-400 font-bold">READY</span>}
              </div>
              <div className={`h-16 overflow-y-auto font-mono text-[10px] custom-scrollbar ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {blockchainLogs.slice(0,3).map(log => (
                  <div key={log.id} className="text-purple-400/80 mb-1">TX_SYNC_BLOCK_{log.hash.substring(0,8)}...</div>
                ))}
                {blockchainLogs.length === 0 && <div className="opacity-30 italic">Awaiting sync cycle...</div>}
              </div>
              {isGateway && packets.some(p => !p.synced) && interfaceMode === 'REVIEWER' && (
                <button onClick={triggerSync} className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase py-3 rounded-xl transition-all shadow-xl shadow-purple-900/20">Finalize Ledger Sync</button>
              )}
           </div>
        </div>

        <button onClick={hardReset} className="absolute bottom-8 right-8 text-slate-800 hover:text-red-500 text-[9px] font-black uppercase tracking-widest opacity-20 hover:opacity-100 transition-all pointer-events-auto">Wipe Demo Memory</button>
      </main>

      {/* Side View: Dashboard Hub */}
      <aside className={`w-[480px] ${theme.sidebar} p-10 flex flex-col space-y-10 z-30 transition-all duration-500 relative`}>
        
        {interfaceMode === 'VICTIM' ? (
          <section className="flex flex-col h-full">
            <header className="mb-10">
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500 mb-2 block">Emergency Beacon</span>
               <h2 className="text-4xl font-black tracking-tighter">Broadcast SOS</h2>
            </header>

            <form onSubmit={handleSend} className={`space-y-10 ${theme.card} p-10 rounded-[2.5rem] border shadow-2xl relative overflow-hidden`}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
               <div className="space-y-4">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${theme.textDim} ml-1`}>Incident Description</label>
                  <textarea className={`w-full ${theme.inner} border p-6 rounded-3xl text-lg outline-none focus:border-cyan-500 transition-all resize-none ${theme.text} placeholder:opacity-30`} rows={4} value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="Type your situation here..." />
               </div>
               
               <div className="space-y-6">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                    <span className={theme.textDim}>Medical Urgency</span>
                    <span className="text-cyan-500 text-2xl font-black">{medicalUrgency} <span className="text-[10px] opacity-30">/ 10</span></span>
                  </div>
                  <input type="range" min="1" max="10" value={medicalUrgency} onChange={(e) => setMedicalUrgency(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
               </div>

               <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-8 rounded-3xl font-black text-lg uppercase tracking-[0.2em] transition-all shadow-[0_20px_50px_rgba(6,182,212,0.3)] disabled:opacity-30 disabled:shadow-none" disabled={!connected || !payload.trim()}>
                 Broadcast To Mesh
               </button>
            </form>

            <div className="mt-auto space-y-6">
               <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${theme.textDim}`}>Active Transmissions</h3>
                  <span className="text-[10px] font-mono opacity-30">AUTO-HOP ENABLED</span>
               </div>
               <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                  {packets.filter(p => p.sender === nodeId).map(p => (
                    <div key={p.id} className={`${theme.card} p-5 rounded-2xl border flex justify-between items-center group hover:border-cyan-500/50 transition-all`}>
                       <div className="flex flex-col overflow-hidden mr-4">
                           <span className="text-sm font-bold truncate">"{p.payload}"</span>
                           <span className="text-[9px] font-mono opacity-30 uppercase mt-1">SENT: {new Date(p.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <span className={`text-[10px] font-black px-4 py-2 rounded-full whitespace-nowrap shadow-sm ${
                          p.response?.status === 'RESCUED' ? 'bg-green-500 text-white' :
                          p.response?.status === 'DISPATCHED' ? 'bg-blue-500 text-white animate-pulse shadow-blue-500/30' : 'bg-slate-800 text-slate-500'
                       }`}>{p.response?.status || 'RELAYING...'}</span>
                    </div>
                  ))}
                  {packets.filter(p => p.sender === nodeId).length === 0 && <div className="text-center py-10 opacity-20 italic text-sm">No signals emitted yet.</div>}
               </div>
            </div>
          </section>
        ) : (
          <section className="flex flex-col h-full space-y-10">
            <header>
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 mb-2 block">Rescuer Command</span>
               <h2 className="text-4xl font-black tracking-tighter">Mission Control</h2>
            </header>

            <div className="flex flex-col h-1/2 overflow-hidden">
                <div className="flex justify-between items-end mb-6 border-b border-slate-800 pb-4">
                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${theme.textDim}`}>Incoming Feed</h3>
                    <span className="text-[10px] font-black text-red-500 animate-pulse uppercase">Live Queue</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar">
                    {packets.sort((a,b) => b.timestamp - a.timestamp).map(p => (
                    <div key={p.id} onClick={() => setSelectedPacketId(p.id)} className={`p-6 rounded-3xl border cursor-pointer transition-all ${selectedPacketId === p.id ? 'bg-slate-900 border-cyan-500 shadow-2xl scale-[1.02]' : theme.card + ' hover:border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-3">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full ${p.response?.status === 'RESCUED' ? 'bg-green-500 text-white' : p.response?.status === 'DISPATCHED' ? 'bg-blue-500 text-white' : 'bg-red-500/10 text-red-500'}`}>{p.response?.status || 'UNREAD'}</span>
                        <span className="text-[9px] font-mono opacity-30">{new Date(p.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className={`text-sm font-bold truncate ${theme.text}`}>"{p.payload}"</p>
                        <div className="flex gap-4 mt-3 opacity-30">
                           <span className="text-[9px] font-black uppercase tracking-tighter">Hops: {p.path.length}</span>
                           <span className="text-[9px] font-black uppercase tracking-tighter">Loc: {p.location.lat.toFixed(1)},{p.location.lng.toFixed(1)}</span>
                        </div>
                    </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col border-t border-slate-800 pt-10 overflow-y-auto custom-scrollbar">
                {selectedPacket ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-500">Case Intel</h3>
                        <button onClick={handleDelete} className="text-[9px] font-black bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white px-5 py-2 rounded-full border border-red-600/20 transition-all uppercase tracking-widest">Delete Signal</button>
                    </div>
                    <div className={`${theme.inner} p-8 rounded-3xl border border-white/5`}>
                        <p className={`text-lg font-bold leading-relaxed ${theme.text}`}>"{selectedPacket.payload}"</p>
                    </div>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center ml-1">
                           <label className={`text-[10px] font-black uppercase tracking-widest ${theme.textDim}`}>Response Directives</label>
                           <span className="text-[9px] font-mono opacity-30">ENCRYPTED RELAY</span>
                        </div>
                        <textarea className={`w-full ${theme.inner} border p-6 rounded-3xl text-sm outline-none focus:border-blue-500 transition-all resize-none ${theme.text} placeholder:opacity-30 shadow-inner`} rows={3} value={responseNotes} onChange={(e) => setResponseNotes(e.target.value)} placeholder="Send instructions back to victim..." />
                        <div className="grid grid-cols-2 gap-6">
                        <button onClick={() => handleResponse('DISPATCHED')} className="bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/30">Confirm Team</button>
                        <button onClick={() => handleResponse('RESCUED')} className="bg-green-600 hover:bg-green-500 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-green-900/30">Close Mission</button>
                        </div>
                    </div>
                    </motion.div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 text-center px-10">
                    <div className="text-6xl mb-6">🛡️</div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]">Select an incident to launch response</p>
                    </div>
                )}
            </div>
          </section>
        )}
      </aside>

    </div>
  );
}

export default App;
