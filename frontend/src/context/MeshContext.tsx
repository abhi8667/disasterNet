import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { SOSPacket } from '../types';
import { saveSOS, getAllSOS, initDB, resetLocalDatabase, deleteSOS as deleteFromDB } from '../db';
import { syncToStellar } from '../blockchain';

interface MeshContextType {
  nodeId: string;
  connected: boolean;
  isGateway: boolean;
  forceOffline: boolean;
  setForceOffline: (val: boolean) => void;
  packets: SOSPacket[];
  broadcastSOS: (payload: string, severity: number, metadata: SOSPacket['metadata'], location: SOSPacket['location']) => void;
  respondToSOS: (packetId: string, status: SOSPacket['response']['status'], notes: string) => void;
  removePacket: (packetId: string) => void;
  triggerSync: () => Promise<void>;
  blockchainLogs: { id: string; hash: string; timestamp: number }[];
  hardReset: () => void;
}

const MeshContext = createContext<MeshContextType | undefined>(undefined);

export const MeshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nodeId, setNodeId] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [isGateway, setIsGateway] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);
  const [packets, setPackets] = useState<SOSPacket[]>([]);
  const [blockchainLogs, setBlockchainLogs] = useState<{ id: string; hash: string; timestamp: number }[]>([]);
  const receivedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkOnline = () => {
      setIsGateway(navigator.onLine && !forceOffline);
    };
    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', checkOnline);
    checkOnline();
    return () => {
      window.removeEventListener('online', checkOnline);
      window.removeEventListener('offline', checkOnline);
    };
  }, [forceOffline]);

  useEffect(() => {
    const hydrate = async () => {
      const savedPackets = await getAllSOS();
      if (savedPackets.length > 0) {
        setPackets(savedPackets.sort((a, b) => b.timestamp - a.timestamp));
        savedPackets.forEach(p => receivedIds.current.add(p.id));
      }
    };
    hydrate();
  }, []);

  const triggerSync = async () => {
    if (!isGateway) return;
    const db = await initDB();
    const allMessages = await db.getAll('messages');
    const unsynced = allMessages.filter(m => !m.synced);

    if (unsynced.length > 0) {
      try {
        const txHash = await syncToStellar(unsynced);
        const tx = db.transaction('messages', 'readwrite');
        for (const msg of unsynced) {
          msg.synced = true;
          tx.store.put(msg);
        }
        await tx.done;
        setBlockchainLogs(prev => [{ id: uuidv4(), hash: txHash, timestamp: Date.now() }, ...prev]);
        const updatedAll = await db.getAll('messages');
        setPackets(updatedAll.sort((a, b) => b.timestamp - a.timestamp));
      } catch (err) {
        console.error("[BLOCKCHAIN] Sync Failure.");
      }
    }
  };

  const hardReset = async () => {
    await resetLocalDatabase();
    setPackets([]);
    setBlockchainLogs([]);
    receivedIds.current.clear();
    window.location.reload();
  };

  useEffect(() => {
    const backendUrl = `http://${window.location.hostname}:3001`;
    const newSocket = io(backendUrl);
    setSocket(newSocket);
    newSocket.on('connect', () => {
      setConnected(true);
      setNodeId(newSocket.id || uuidv4().substring(0, 8));
    });

    newSocket.on('mesh_receive', async (packet: SOSPacket) => {
      // Check if it's a deletion command (metadata could carry a 'deleted' flag in a real app, 
      // but for this demo we'll just handle it by ID check or by broadcasting a special 'remove' event)
      // For simplicity, we just handle the bi-directional updates.
      
      if (receivedIds.current.has(packet.id)) {
        setPackets((prev) => {
          const index = prev.findIndex(p => p.id === packet.id);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = packet;
            return updated;
          }
          return prev;
        });
        return;
      }

      receivedIds.current.add(packet.id);
      await saveSOS(packet);
      const updatedPacket = { ...packet, path: [...packet.path, newSocket.id || 'unknown'] };
      setPackets((prev) => [updatedPacket, ...prev]);
      newSocket.emit('mesh_broadcast', updatedPacket);
    });

    // Listen for a specific removal event
    newSocket.on('mesh_remove', async (packetId: string) => {
       await deleteFromDB(packetId);
       setPackets(prev => prev.filter(p => p.id !== packetId));
       receivedIds.current.delete(packetId);
    });

    return () => { newSocket.close(); };
  }, []);

  const broadcastSOS = async (payload: string, severity: number, metadata: SOSPacket['metadata'], location: SOSPacket['location']) => {
    if (!socket || !nodeId) return;
    const newPacket: SOSPacket = { id: uuidv4(), sender: nodeId, severity, timestamp: Date.now(), path: [nodeId], payload, synced: false, metadata, location };
    receivedIds.current.add(newPacket.id);
    await saveSOS(newPacket);
    setPackets((prev) => [newPacket, ...prev]);
    socket.emit('mesh_broadcast', newPacket);
  };

  const respondToSOS = async (packetId: string, status: SOSPacket['response']['status'], notes: string) => {
    if (!socket || !nodeId) return;
    setPackets((prev) => {
      const index = prev.findIndex(p => p.id === packetId);
      if (index === -1) return prev;
      const updatedPacket = { ...prev[index], response: { responderId: nodeId, status, notes, timestamp: Date.now() } };
      saveSOS(updatedPacket);
      socket.emit('mesh_broadcast', updatedPacket);
      const newList = [...prev];
      newList[index] = updatedPacket;
      return newList;
    });
  };

  const removePacket = async (packetId: string) => {
    if (!socket) return;
    await deleteFromDB(packetId);
    setPackets(prev => prev.filter(p => p.id !== packetId));
    receivedIds.current.delete(packetId);
    // Broadcast the removal to other nodes
    socket.emit('mesh_remove', packetId);
  };

  return (
    <MeshContext.Provider value={{ nodeId, connected, isGateway, forceOffline, setForceOffline, packets, broadcastSOS, respondToSOS, removePacket, triggerSync, blockchainLogs, hardReset }}>
      {children}
    </MeshContext.Provider>
  );
};

export const useMesh = () => {
  const context = useContext(MeshContext);
  if (context === undefined) throw new Error('useMesh must be used within a MeshProvider');
  return context;
};
