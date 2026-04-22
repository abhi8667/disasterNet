import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { SOSPacket } from '../types';

interface MeshContextType {
  nodeId: string;
  connected: boolean;
  packets: SOSPacket[];
  broadcastSOS: (payload: string, severity: number) => void;
}

const MeshContext = createContext<MeshContextType | undefined>(undefined);

export const MeshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nodeId, setNodeId] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [packets, setPackets] = useState<SOSPacket[]>([]);
  
  // Use a ref for receivedIds to prevent stale closures in socket event handlers
  const receivedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // For the hackathon, we use socket.io to emulate radio/mesh transmission
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      // In a real mesh, we'd use device MAC or a generated UUID. Here we just use socket id for simplicity.
      setNodeId(newSocket.id || uuidv4().substring(0, 8));
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('mesh_receive', (packet: SOSPacket) => {
      // THE GOSSIP PROTOCOL LOGIC: Check if we've already seen this packet
      if (receivedIds.current.has(packet.id)) {
        console.log(`[Mesh] Dropping duplicate packet: ${packet.id}`);
        return;
      }

      console.log(`[Mesh] Received NEW packet: ${packet.id}`);
      
      // 1. Add to received list
      receivedIds.current.add(packet.id);
      
      // 2. Add ourselves to the hop path
      const updatedPacket = {
        ...packet,
        path: [...packet.path, newSocket.id || 'unknown']
      };

      // 3. Store locally for UI
      setPackets((prev) => [updatedPacket, ...prev]);

      // 4. Relay (Broadcast) to neighbors
      // Emulate standard mesh behavior where a node blindly relays to others
      console.log(`[Mesh] Relaying packet: ${updatedPacket.id}`);
      newSocket.emit('mesh_broadcast', updatedPacket);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const broadcastSOS = (payload: string, severity: number) => {
    if (!socket || !nodeId) return;

    const newPacket: SOSPacket = {
      id: uuidv4(),
      sender: nodeId,
      severity,
      timestamp: Date.now(),
      path: [nodeId],
      payload,
    };

    // Store our own packet so we don't process it if it bounces back
    receivedIds.current.add(newPacket.id);
    
    // Add to local state
    setPackets((prev) => [newPacket, ...prev]);

    // Send it over the "air"
    console.log(`[Mesh] Originating broadcast: ${newPacket.id}`);
    socket.emit('mesh_broadcast', newPacket);
  };

  return (
    <MeshContext.Provider value={{ nodeId, connected, packets, broadcastSOS }}>
      {children}
    </MeshContext.Provider>
  );
};

export const useMesh = () => {
  const context = useContext(MeshContext);
  if (context === undefined) {
    throw new Error('useMesh must be used within a MeshProvider');
  }
  return context;
};
