import React, { useState, useMemo, useEffect } from 'react';
import { useMesh } from './context/MeshContext';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function App() {
  const { nodeId, keyPair, connected, isGateway, forceOffline, setForceOffline, packets, broadcastSOS, respondToSOS, removePacket, triggerSync, blockchainLogs, hardReset } = useMesh();
  
  // UI Controls
  const [interfaceMode, setInterfaceMode] = useState<'VICTIM' | 'REVIEWER'>('VICTIM');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  
  // Victim States
  const [payload, setPayload] = useState('');
  const [isSosActive, setIsSosActive] = useState(false);
  const [triageData, setTriageData] = useState({ canWalk: true, breathing: true, isInjured: false });
  const [showSurvivalGuide, setShowSurvivalGuide] = useState(false);

  // Reviewer States
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState('');

  // UI States for Notifications
  const [showRescueAlert, setShowRescueAlert] = useState<{msg: string, node: string} | null>(null);
  const [lastDispatchedId, setLastDispatchedId] = useState<string | null>(null);
  const [newSosAlert, setNewSosAlert] = useState<SOSPacket | null>(null);
  const [showDispatchAlert, setShowDispatchAlert] = useState<boolean>(false);
  const [showRescueSuccessAlert, setShowRescueSuccessAlert] = useState<boolean>(false);

  // Monitor for incoming SOS (Admin View)
  useEffect(() => {
    if (interfaceMode !== 'REVIEWER') return;
    if (packets.length === 0) return;
    
    const latest = packets[0];
    const isNew = !packets.find((p, i) => i > 0 && p.id === latest.id);
    
    if (isNew && latest.originalSender !== nodeId && (!latest.response)) {
      setNewSosAlert(latest);
      const timer = setTimeout(() => setNewSosAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [packets, interfaceMode, nodeId]);

  const [showAckAlert, setShowAckAlert] = useState<{hops: number, id: string} | null>(null);
  const [lastAckId, setLastAckId] = useState<string | null>(null);

  // Monitor for incoming help/acks
  useEffect(() => {
    if (interfaceMode !== 'VICTIM') return;
    const myPackets = packets.filter(p => p.originalSender === nodeId);
    
    // 1. Check for Rescue/Dispatch (High Priority)
    const dispatched = myPackets.find(p => p.response?.status === 'DISPATCHED' || p.response?.status === 'RESCUED');
    if (dispatched && dispatched.id !== lastDispatchedId) {
      setShowRescueAlert({
        msg: dispatched.response?.notes || "Help is on the way!", 
        node: dispatched.response?.responderId.substring(0,8) || "Command"
      });
      setLastDispatchedId(dispatched.id);
      const timer = setTimeout(() => setShowRescueAlert(null), 10000);
      return () => clearTimeout(timer);
    }

    // 2. Check for Basic Acknowledgement (Mesh Confirmation)
    const acked = myPackets.find(p => p.response);
    if (acked && acked.id !== lastAckId) {
       setShowAckAlert({ hops: acked.path.length, id: acked.id.substring(0,6) });
       setLastAckId(acked.id);
       const timer = setTimeout(() => setShowAckAlert(null), 6000);
       return () => clearTimeout(timer);
    }
  }, [packets, nodeId, interfaceMode, lastDispatchedId, lastAckId]);

  // Add this line to derive the selected packet
  const selectedPacket = useMemo(() => 
    packets.find(p => p.id === selectedPacketId),
    [packets, selectedPacketId]
  );

  // Triage Tagging Logic
  const calculateTriageTag = (data: typeof triageData, severity: number) => {
    if (!data.breathing) return 'BLACK';
    if (!data.canWalk) return 'RED';
    if (data.isInjured || severity > 7) return 'YELLOW';
    return 'GREEN';
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalPayload = isSosActive ? "RAPID SOS" : (payload || "S.T.A.R.T. Report Only");
    const tag = calculateTriageTag(triageData, isSosActive ? 10 : 5);
    
    broadcastSOS(finalPayload, isSosActive ? 10 : 5, {
      medicalUrgency: isSosActive ? 10 : 5,
      peopleAffected: Math.floor(Math.random() * 10) + 1,
      waitStartTime: Date.now(),
      locationDifficulty: Math.floor(Math.random() * 5) + 1
    }, { 
      canWalk: triageData.canWalk,
      breathing: triageData.breathing,
      isInjured: triageData.isInjured,
      tag
    }, { 
      lat: Math.floor(Math.random() * 70) + 15, 
      lng: Math.floor(Math.random() * 70) + 15 
    });
    
    setPayload('');
    if (isSosActive) setTimeout(() => setIsSosActive(false), 2000);
  };

  // NEW: Report Generator logic
  const generateMissionReport = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleString();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 128, 128); // Teal
    doc.text("DisasterNet: Mission Impact Report", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${now}`, 14, 28);
    doc.text(`Command Node ID: ${nodeId}`, 14, 33);
    
    // Mission Stats
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Mission Summary", 14, 45);
    
    const statsData = [
      ["Total Distress Signals", packets.length.toString()],
      ["Successful Rescues", packets.filter(p => p.response?.status === 'RESCUED').length.toString()],
      ["Average Hop Count", (packets.reduce((acc, p) => acc + p.path.length, 0) / (packets.length || 1)).toFixed(1)],
      ["Blockchain Anchors", blockchainLogs.length.toString()]
    ];
    
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: statsData,
      theme: 'striped',
      headStyles: { fillColor: [0, 128, 128] }
    });
    
    // Detailed Incident Log
    doc.text("Incident Log (Verified via Ed25519)", 14, (doc as any).lastAutoTable.finalY + 15);
    
    const logData = packets.map(p => [
      new Date(p.timestamp).toLocaleTimeString(),
      p.triage?.tag || 'PENDING',
      p.payload.substring(0, 30) + "...",
      p.response?.status || 'UNSOLVED',
      p.path.length.toString()
    ]);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Time', 'Triage', 'Message', 'Status', 'Hops']],
      body: logData,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] } // Red for urgency
    });
    
    // Cryptographic Proof
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.text("Cryptographic Verification Root", 14, finalY);
    doc.setFontSize(8);
    doc.setFont("courier");
    doc.text(`STellar_MERKLE_ROOT: ${blockchainLogs[0]?.hash || "WAITING_FOR_GATEWAY_SYNC"}`, 14, finalY + 5);
    doc.text(`PUBLIC_KEY_AUTH: ${keyPair?.publicKey ? "ED25519_ACTIVE_SESSION" : "OFFLINE_LOCAL"}`, 14, finalY + 10);

    doc.save(`DisasterNet_Report_${Date.now()}.pdf`);
  };

  const stats = useMemo(() => {
    const rescued = packets.filter(p => p.response?.status === 'RESCUED').length;
    const total = packets.length;
    const byTag = {
        RED: packets.filter(p => p.triage?.tag === 'RED').length,
        YELLOW: packets.filter(p => p.triage?.tag === 'YELLOW').length,
        GREEN: packets.filter(p => p.triage?.tag === 'GREEN').length,
    };
    return { rescued, total, byTag };
  }, [packets]);

  const theme = {
    bg: isDarkMode ? 'bg-slate-950' : 'bg-slate-50',
    panel: isDarkMode ? 'bg-slate-900/70 backdrop-blur-2xl border-slate-800' : 'bg-white/90 backdrop-blur-xl border-slate-200',
    card: isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200',
    text: isDarkMode ? 'text-white' : 'text-slate-900',
    textDim: isDarkMode ? 'text-slate-500' : 'text-slate-400',
    tagColors: {
        RED: 'bg-red-600 text-white shadow-[0_0_15px_#dc2626]',
        YELLOW: 'bg-amber-500 text-black shadow-[0_0_15px_#f59e0b]',
        GREEN: 'bg-emerald-500 text-white shadow-[0_0_15px_#10b981]',
        BLACK: 'bg-black text-white'
    }
  };

  return (
    <div className={`h-screen w-screen ${theme.bg} ${theme.text} flex overflow-hidden font-sans transition-all duration-700`}>
      
      {/* Rapid SOS Mode Overlay */}
      <AnimatePresence>
        {isSosActive && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-red-600 flex flex-col items-center justify-center text-center p-10"
            onClick={() => handleSend()}
          >
             <motion.div 
               animate={lowPowerMode ? {} : { scale: [1, 1.1, 1] }} 
               transition={{ repeat: Infinity, duration: 0.5 }}
               className="w-72 h-72 bg-white rounded-full flex items-center justify-center text-8xl shadow-2xl cursor-pointer"
             >
                🆘
             </motion.div>
             <h2 className="text-white text-5xl font-black mt-12">TAP TO RESCUE</h2>
             <p className="text-white/80 font-bold uppercase mt-4">One-Tap Broadcast Active</p>
          </motion.div>
        )}
      </AnimatePresence>
      
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
                    <span className="text-[10px] font-mono text-slate-500 uppercase">SECURE_NODE_{showRescueAlert.node}</span>
                  </div>
                  <h3 className="text-2xl font-black tracking-tighter text-white mb-2">Help is Dispatched</h3>
                  <p className="text-slate-300 font-medium text-base italic border-l-2 border-green-500 pl-4 py-1">"{showRescueAlert.msg}"</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin: Mission Dispatched Alert */}
      <AnimatePresence>
        {showDispatchAlert && (interfaceMode === 'REVIEWER') && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] px-10 py-5 bg-blue-600 text-white rounded-3xl font-black shadow-[0_20px_50px_rgba(37,99,235,0.4)] flex items-center gap-4 border border-blue-400"
          >
            <span className="text-2xl">🚑</span>
            <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest opacity-70">Tactical Command</span>
                <span className="text-sm">MISSION DISPATCHED TO MESH</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin: Rescue Success Alert */}
      <AnimatePresence>
        {showRescueSuccessAlert && (interfaceMode === 'REVIEWER') && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute inset-0 z-[300] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-emerald-600 text-white px-12 py-8 rounded-[3rem] font-black shadow-[0_30px_70px_rgba(16,185,129,0.5)] flex flex-col items-center gap-4 border-4 border-emerald-400">
                <span className="text-6xl animate-bounce">🏆</span>
                <span className="text-2xl uppercase tracking-tighter">Victim Marked Safe</span>
                <span className="text-[10px] uppercase opacity-70">Mission Archive Updated</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tactical Incoming SOS Alert (Admin Mode) */}
      <AnimatePresence>
        {newSosAlert && (interfaceMode === 'REVIEWER') && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            onClick={() => { setSelectedPacketId(newSosAlert.id); setNewSosAlert(null); }}
            className="absolute top-10 right-10 z-[150] w-96 p-1 bg-red-600 rounded-3xl shadow-[0_20px_50px_rgba(220,38,38,0.4)] cursor-pointer"
          >
            <div className="bg-slate-950 rounded-[1.4rem] p-6 flex items-center gap-5 border border-white/10">
               <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-2xl animate-pulse">📡</div>
               <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black uppercase text-red-500 tracking-widest">Incoming Signal</span>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">#{newSosAlert.id.substring(0,6)}</span>
                  </div>
                  <h3 className="text-lg font-black text-white leading-tight">Distress Detected</h3>
                  <p className="text-slate-400 text-[10px] font-medium truncate mt-1">Tag: {newSosAlert.triage?.tag || 'UNKNOWN'}</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Signal Acknowledged Alert (Victim Mode) */}
      <AnimatePresence>
        {showAckAlert && (interfaceMode === 'VICTIM') && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-40 left-10 right-10 z-[100] p-1 bg-cyan-500 rounded-3xl shadow-[0_20px_50px_rgba(6,182,212,0.3)]"
          >
            <div className="bg-slate-950 rounded-[1.4rem] p-6 flex items-center gap-6 border border-white/10">
               <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(6,182,212,0.5)]">✅</div>
               <div className="flex-1">
                  <span className="text-[9px] font-black uppercase text-cyan-400 tracking-[0.2em] mb-1 block">Signal Anchored</span>
                  <h3 className="text-xl font-black text-white">SOS Received Successfully</h3>
                  <div className="flex gap-4 mt-2">
                    <div className="text-[10px] font-mono text-slate-500">RELAY_HOPS: {showAckAlert.hops}</div>
                    <div className="text-[10px] font-mono text-slate-500">PACKET_ID: {showAckAlert.id}</div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid View */}
      <main className={`flex-1 relative border-r ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} overflow-hidden`}>
        {/* Force-Directed Graph Emulation in Grid */}
        <div className="absolute inset-0 z-0 opacity-20 tactical-grid"></div>
        
        {/* Mesh Connections (Visual lines between hops) */}
        <svg className="absolute inset-0 z-5 pointer-events-none w-full h-full">
            {packets.map(p => (
                p.path.length > 1 && (
                    <motion.line 
                        key={`line-${p.id}`}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.3 }}
                        x1={`${p.location.lng}%`} y1={`${p.location.lat}%`} 
                        x2="50%" y2="50%" // Emulating lines to the central hub for demo visual
                        stroke={p.triage?.tag === 'RED' ? '#ef4444' : '#06b6d4'} 
                        strokeWidth="1" 
                        strokeDasharray="5,5"
                    />
                )
            ))}
        </svg>

        {/* SOS Markers */}
        <div className="absolute inset-0 z-10">
          {packets.map(p => (
            <motion.div 
              key={p.id} initial={{ scale: 0 }} animate={{ scale: 1 }}
              onClick={() => setSelectedPacketId(p.id)}
              style={{ top: `${p.location.lat}%`, left: `${p.location.lng}%` }}
              className="absolute w-12 h-12 -ml-6 -mt-6 cursor-pointer z-50 flex items-center justify-center"
            >
              <div className={`absolute inset-0 rounded-full transition-all duration-500 ${theme.tagColors[p.triage?.tag || 'YELLOW']}`}></div>
              {!lowPowerMode && <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${theme.tagColors[p.triage?.tag || 'YELLOW']}`}></div>}
              <span className="relative z-10 text-[10px] font-black text-inherit drop-shadow-md">{p.path.length}h</span>
            </motion.div>
          ))}
        </div>

        {/* HUD Top Center */}
        <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-20 pointer-events-none">
          <div className={`${theme.panel} p-6 rounded-[2.5rem] pointer-events-auto shadow-2xl border border-white/5`}>
            <div className="flex items-center gap-6 mb-4">
                <h1 className="text-3xl font-black tracking-tighter uppercase">Disaster<span className="text-cyan-500 italic">Net</span></h1>
                <div className="flex gap-2">
                    {['RED', 'YELLOW', 'GREEN'].map(t => (
                        <div key={t} className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/50 rounded-full border border-white/5">
                            <div className={`w-2 h-2 rounded-full ${theme.tagColors[t as any].split(' ')[0]}`}></div>
                            <span className="text-[10px] font-black text-slate-400">{(stats.byTag as any)[t]}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="flex items-center gap-10">
              <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textDim}`}>Success Rate</span>
                <span className="text-3xl font-black text-green-500">{Math.round((stats.rescued / (stats.total || 1)) * 100)}%</span>
              </div>
              <div className="w-[1px] h-10 bg-slate-800"></div>
              <button onClick={generateMissionReport} className="pointer-events-auto bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-900/20 transition-all">
                Export Mission PDF
              </button>
              <button onClick={() => { if(window.confirm("Wipe entire mesh? This clears ALL devices.")) { packets.forEach(p => removePacket(p.id)); hardReset(); } }} className="pointer-events-auto bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-500/20 transition-all">
                Wipe Demo
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 items-end pointer-events-auto">
             <div className={`${theme.panel} p-2 rounded-full flex gap-2 border border-white/5 shadow-xl`}>
                 <button onClick={() => setInterfaceMode('VICTIM')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all ${interfaceMode === 'VICTIM' ? 'bg-cyan-500 text-white' : theme.textDim}`}>Victim Mode</button>
                 <button onClick={() => setInterfaceMode('REVIEWER')} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all ${interfaceMode === 'REVIEWER' ? 'bg-red-500 text-white' : theme.textDim}`}>Admin Hub</button>
             </div>
             <div className="flex gap-4">
                <button onClick={() => setLowPowerMode(!lowPowerMode)} className={`${theme.panel} px-6 rounded-full flex items-center gap-3 border border-white/5 shadow-lg`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${lowPowerMode ? 'text-orange-500' : theme.textDim}`}>Battery Saver</span>
                    <div className={`w-8 h-4 rounded-full p-1 transition-all ${lowPowerMode ? 'bg-orange-500' : 'bg-slate-700'}`}>
                      <div className={`w-2 h-2 bg-white rounded-full transition-all ${lowPowerMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                </button>
             </div>
          </div>
        </div>
      </main>

      {/* Side View: Dashboard Hub */}
      <aside className={`w-[500px] ${interfaceMode === 'VICTIM' ? 'bg-slate-900' : theme.panel} p-10 flex flex-col space-y-10 z-30 transition-all duration-500`}>
        
        {interfaceMode === 'VICTIM' ? (
          <section className="flex flex-col h-full">
            <header className="mb-10 flex justify-between items-start">
               <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500 mb-2 block">Personal Beacon</span>
                  <h2 className="text-4xl font-black tracking-tighter text-white">Emergency</h2>
               </div>
               <button onClick={() => setShowSurvivalGuide(!showSurvivalGuide)} className="bg-cyan-500/10 text-cyan-500 p-4 rounded-2xl border border-cyan-500/20 text-xl">📖</button>
            </header>

            {showSurvivalGuide ? (
                <div className="flex-1 space-y-6">
                    <h3 className="text-xl font-black text-cyan-500 uppercase tracking-widest">Survival Guide</h3>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {[
                            { title: "Control Bleeding", text: "Apply firm, steady pressure with a clean cloth." },
                            { title: "Heat Exhaustion", text: "Move to shade. Sip water. Loosen clothing." },
                            { title: "Water Safety", text: "Boil water for 1 min if possible." },
                            { title: "Signal For Help", text: "Use mirrors or whistles. Groups of 3 are standard signals." }
                        ].map((g, i) => (
                            <div key={i} className="bg-slate-800/50 p-6 rounded-3xl border border-white/5">
                                <h4 className="font-black text-white mb-2">{g.title}</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">{g.text}</p>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setShowSurvivalGuide(false)} className="w-full py-4 text-cyan-500 font-black uppercase text-xs">Back to SOS</button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    <div className="bg-slate-800/50 p-8 rounded-[2.5rem] border border-white/5 mb-8">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Medical Triage Check</h3>
                       <div className="grid grid-cols-1 gap-4">
                          {[
                            { id: 'canWalk', label: "I can walk on my own", icon: "🚶" },
                            { id: 'isInjured', label: "I have visible injuries", icon: "🩹" },
                            { id: 'breathing', label: "I have no trouble breathing", icon: "🫁" }
                          ].map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setTriageData(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof triageData] }))}
                                className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                                    (triageData as any)[item.id] ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'
                                }`}
                            >
                                <span className="font-bold text-sm">{item.label}</span>
                                <span className="text-xl">{item.icon}</span>
                            </button>
                          ))}
                       </div>
                    </div>
                    <button onClick={() => setIsSosActive(true)} className="w-full bg-red-600 hover:bg-red-500 text-white py-10 rounded-[2.5rem] font-black text-2xl uppercase tracking-[0.2em] transition-all shadow-2xl">Trigger SOS</button>
                </div>
            )}
          </section>
        ) : (
          <section className="flex flex-col h-full space-y-10">
             <header>
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 mb-2 block">Command Hub</span>
               <h2 className="text-4xl font-black tracking-tighter">Mission Control</h2>
            </header>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-end mb-6 border-b border-slate-800 pb-4">
                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${theme.textDim}`}>Active Feed</h3>
                    <span className="text-[10px] font-black text-red-500 animate-pulse uppercase">Live Queue</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar mb-6">
                    {packets.filter(p => !p.response || p.response.status !== 'RESCUED').sort((a,b) => {
                        const priority = { RED: 3, YELLOW: 2, GREEN: 1, BLACK: 0 };
                        return priority[b.triage?.tag || 'GREEN'] - priority[a.triage?.tag || 'GREEN'];
                    }).map(p => (
                        <div key={p.id} onClick={() => setSelectedPacketId(p.id)} className={`p-6 rounded-3xl border cursor-pointer transition-all ${selectedPacketId === p.id ? 'bg-slate-900 border-cyan-500 shadow-2xl scale-[1.02]' : theme.card}`}>
                            <div className="flex justify-between items-start mb-3">
                                <span className={`text-[10px] font-black px-4 py-1.5 rounded-full ${theme.tagColors[p.triage?.tag || 'YELLOW']}`}>
                                    {p.triage?.tag || 'PENDING'}
                                </span>
                                <span className="text-[10px] font-mono opacity-30">{new Date(p.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-base font-bold truncate">"{p.payload}"</p>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-end mb-4 border-b border-slate-800 pb-4">
                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${theme.textDim}`}>Successful Missions</h3>
                    <span className="text-[10px] font-black text-green-500 uppercase">Archived</span>
                </div>
                <div className="h-32 overflow-y-auto space-y-2 pr-4 custom-scrollbar">
                    {packets.filter(p => p.response?.status === 'RESCUED').map(p => (
                        <div key={p.id} onClick={() => setSelectedPacketId(p.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedPacketId === p.id ? 'bg-slate-900 border-green-500' : theme.card + ' opacity-60'}`}>
                            <div className="flex justify-between items-center">
                                <p className="text-xs font-bold truncate">Rescue: {p.id.substring(0,8)}</p>
                                <span className="text-[8px] font-black text-green-500 uppercase">Completed</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedPacket && (
                <div className="pt-10 border-t border-slate-800 space-y-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-cyan-500">Medical Dossier</h3>
                        <div className="flex gap-2">
                           <button onClick={() => { if(window.confirm("Delete this signal from mesh?")) { removePacket(selectedPacket.id); setSelectedPacketId(null); } }} className="text-[8px] font-black bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-3 py-1 rounded-full border border-red-500/20 transition-all uppercase">Delete</button>
                           <div className="bg-green-500/10 text-green-500 text-[8px] font-black px-2 py-1 rounded">VERIFIED_ED25519</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: "Walking", val: selectedPacket.triage?.canWalk, ok: "YES", bad: "NO" },
                            { label: "Breathing", val: selectedPacket.triage?.breathing, ok: "YES", bad: "NO" },
                            { label: "Injured", val: selectedPacket.triage?.isInjured, ok: "YES", bad: "NO" }
                        ].map((m, i) => (
                            <div key={i} className={`p-4 rounded-2xl border ${m.val === (m.label === 'Injured' ? false : true) ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                <div className="text-[8px] font-black uppercase mb-1 opacity-50">{m.label}</div>
                                <div className="text-xs font-black">{m.val ? m.ok : m.bad}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-6">
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <div className="text-[8px] font-black uppercase mb-1 text-slate-500">Grid Pos</div>
                            <div className="text-[10px] font-mono text-cyan-500">
                                {selectedPacket.location.lat.toFixed(1)}°N, {selectedPacket.location.lng.toFixed(1)}°E
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <div className="text-[8px] font-black uppercase mb-1 text-slate-500">Severity</div>
                            <div className="text-xs font-black text-orange-500">{selectedPacket.severity}/10</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <div className={`text-[8px] font-black uppercase mb-1 text-slate-500`}>Mesh Hops</div>
                            <div className="text-xs font-black text-white">{selectedPacket.path.length} Units</div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => { respondToSOS(selectedPacket.id, 'DISPATCHED', 'Rescue En Route'); setShowDispatchAlert(true); setTimeout(() => setShowDispatchAlert(false), 3000); }} className="flex-1 bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Dispatch</button>
                        <button onClick={() => { respondToSOS(selectedPacket.id, 'RESCUED', 'Safe'); setShowRescueSuccessAlert(true); setTimeout(() => setShowRescueSuccessAlert(false), 3000); }} className="flex-1 bg-green-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Mark Safe</button>
                    </div>
                </div>
            )}
          </section>
        )}
      </aside>

    </div>
  );
}

export default App;
