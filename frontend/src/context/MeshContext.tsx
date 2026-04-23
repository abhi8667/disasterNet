import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64, decodeUTF8 } from 'tweetnacl-util';
import { BloomFilter } from 'bloomfilter';
import { SOSPacket } from '../types';
import { saveSOS, getAllSOS, initDB, resetLocalDatabase, deleteSOS as deleteFromDB } from '../db';
import { syncToStellar } from '../blockchain';

// Bloom Filter for packet deduplication (prevents broadcast storms)
const BF_SIZE = 32 * 1024; // 32KB
const BF_HASHES = 16;

interface MeshContextType {
  nodeId: string;
  keyPair: nacl.SignKeyPair | null;
  connected: boolean;
  isGateway: boolean;
  forceOffline: boolean;
  setForceOffline: (val: boolean) => void;
  packets: SOSPacket[];
  broadcastSOS: (payload: string, severity: number, metadata: SOSPacket['metadata'], triage: SOSPacket['triage'], location: SOSPacket['location']) => void;
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
  const [keyPair, setKeyPair] = useState<nacl.SignKeyPair | null>(null);
  const [connected, setConnected] = useState(false);
  const [isGateway, setIsGateway] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);
  const [packets, setPackets] = useState<SOSPacket[]>([]);
  const [blockchainLogs, setBlockchainLogs] = useState<{ id: string; hash: string; timestamp: number }[]>([]);
  
  // High-Efficiency Deduplication
  const bloomFilter = useRef(new BloomFilter(BF_SIZE, BF_HASHES));
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Generate Cryptographic Identity
    const kp = nacl.sign.keyPair();
    setKeyPair(kp);
  }, []);

  useEffect(() => {
    const checkOnline = () => setIsGateway(navigator.onLine && !forceOffline);
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
        savedPackets.forEach(p => {
            seenIds.current.add(p.id);
            bloomFilter.current.add(p.id);
        });
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
    seenIds.current.clear();
    bloomFilter.current = new BloomFilter(BF_SIZE, BF_HASHES);
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
      // 1. Bloom Filter Check (Deduplication)
      const alreadySeen = bloomFilter.current.test(packet.id) && seenIds.current.has(packet.id);
      
      if (alreadySeen) {
          // Check if this is a response update
          if (packet.response) {
            setPackets((prev) => {
              const index = prev.findIndex(p => p.id === packet.id);
              const existing = prev[index];
              
              // Only update and RELAY if the response is newer or missing
              if (index !== -1 && (!existing.response || existing.response.timestamp < packet.response.timestamp)) {
                const updated = [...prev];
                updated[index] = packet;
                // RELAY the update back to the mesh
                newSocket.emit('mesh_broadcast', packet);
                return updated;
              }
              return prev;
            });
          }
          return;
      }

      // 2. Cryptographic Signature Verification
      if (packet.signature && packet.publicKey) {
          const messageUint8 = decodeUTF8(packet.payload + packet.timestamp + packet.sender);
          const signatureUint8 = decodeBase64(packet.signature);
          const pubKeyUint8 = decodeBase64(packet.publicKey);
          const isValid = nacl.sign.detached.verify(messageUint8, signatureUint8, pubKeyUint8);
          if (!isValid) {
              console.warn("[SECURITY] Dropping unverified packet:", packet.id);
              return;
          }
      }

      // 3. TTL Check (Prevent infinite loops)
      if (packet.ttl <= 0) {
          console.warn("[MESH] TTL Expired for packet:", packet.id);
          return;
      }

      // 4. Accept Packet
      bloomFilter.current.add(packet.id);
      seenIds.current.add(packet.id);
      await saveSOS(packet);
      
      const updatedPacket = { 
          ...packet, 
          ttl: packet.ttl - 1, 
          path: [...packet.path, newSocket.id || 'unknown'] 
      };
      setPackets((prev) => [updatedPacket, ...prev]);
      newSocket.emit('mesh_broadcast', updatedPacket);
    });

    newSocket.on('mesh_remove', async (packetId: string) => {
       await deleteFromDB(packetId);
       setPackets(prev => prev.filter(p => p.id !== packetId));
       seenIds.current.delete(packetId);
    });

    return () => { newSocket.close(); };
  }, []);

  const broadcastSOS = async (payload: string, severity: number, metadata: SOSPacket['metadata'], triage: SOSPacket['triage'], location: SOSPacket['location']) => {
    if (!socket || !nodeId || !keyPair) return;
    
    const timestamp = Date.now();
    // Sign the message
    const messageUint8 = decodeUTF8(payload + timestamp + nodeId);
    const signature = encodeBase64(nacl.sign.detached(messageUint8, keyPair.secretKey));
    const publicKey = encodeBase64(keyPair.publicKey);

    const newPacket: SOSPacket = { 
        id: uuidv4(), 
        sender: nodeId, 
        originalSender: nodeId, // Set the original author
        severity, 
        timestamp, 
        path: [nodeId], 
        payload, 
        synced: false, 
        ttl: 10, // Max 10 hops
        signature,
        publicKey,
        metadata,
        triage,
        location 
    };

    bloomFilter.current.add(newPacket.id);
    seenIds.current.add(newPacket.id);
    await saveSOS(newPacket);
    setPackets((prev) => [newPacket, ...prev]);
    socket.emit('mesh_broadcast', newPacket);
  };

  const respondToSOS = async (packetId: string, status: SOSPacket['response']['status'], notes: string) => {
    if (!socket || !nodeId) return;
    setPackets((prev) => {
      const index = prev.findIndex(p => p.id === packetId);
      if (index === -1) return prev;
      
      const updatedPacket: SOSPacket = { 
        ...prev[index], 
        sender: nodeId, // Update sender to current node for relay
        timestamp: Date.now(), // Update timestamp to treat as fresh mesh update
        response: { responderId: nodeId, status, notes, timestamp: Date.now() } 
      };
      
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
    seenIds.current.delete(packetId);
    socket.emit('mesh_remove', packetId);
  };

  return (
    <MeshContext.Provider value={{ nodeId, keyPair, connected, isGateway, forceOffline, setForceOffline, packets, broadcastSOS, respondToSOS, removePacket, triggerSync, blockchainLogs, hardReset }}>
      {children}
    </MeshContext.Provider>
  );
};

export const useMesh = () => {
  const context = useContext(MeshContext);
  if (context === undefined) throw new Error('useMesh must be used within a MeshProvider');
  return context;
};
