import React, { useState } from 'react';
import { useMesh } from './context/MeshContext';

function App() {
  const { nodeId, connected, packets, broadcastSOS } = useMesh();
  const [payload, setPayload] = useState('');
  const [severity, setSeverity] = useState(5);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.trim()) return;
    broadcastSOS(payload, severity);
    setPayload('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">DisasterNet</h1>
            <p className="text-slate-400">Mesh Node Dashboard</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Node ID</div>
            <div className="font-mono bg-slate-800 px-3 py-1 rounded text-cyan-300">
              {nodeId || 'Connecting...'}
            </div>
            <div className="flex items-center gap-2 justify-end mt-2">
              <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></span>
              <span className="text-sm">{connected ? 'Radio Active' : 'Radio Offline'}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Send SOS Panel */}
          <section className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-400 flex items-center gap-2">
              <span className="text-2xl">🚨</span> Broadcast SOS
            </h2>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Message Payload</label>
                <textarea 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                  rows={3}
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  placeholder="Need medical assistance at main square..."
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1 flex justify-between">
                  <span>Severity Level</span>
                  <span className="text-amber-400 font-bold">{severity}/10</span>
                </label>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>
              <button 
                type="submit"
                disabled={!connected || !payload.trim()}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(220,38,38,0.3)]"
              >
                TRANSMIT TO MESH
              </button>
            </form>
          </section>

          {/* Incoming Packets Panel */}
          <section className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 flex flex-col h-[500px]">
            <h2 className="text-xl font-semibold mb-4 text-cyan-400 flex items-center gap-2">
              <span className="text-2xl">📡</span> Mesh Packet Log
            </h2>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {packets.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 italic">
                  Listening for signals...
                </div>
              ) : (
                packets.map(packet => (
                  <div key={packet.id} className="bg-slate-900 border border-slate-700 rounded p-4 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-amber-400 flex items-center gap-2">
                        Severity: {packet.severity}
                        {packet.sender === nodeId && <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">Sent by Me</span>}
                      </div>
                      <div className="text-slate-500 text-xs">
                        {new Date(packet.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <p className="text-slate-200 mb-3 text-base">"{packet.payload}"</p>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs font-mono text-slate-400 overflow-x-auto whitespace-nowrap">
                      <span className="text-slate-500">Path:</span> {packet.path.join(' → ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default App;
