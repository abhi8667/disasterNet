export interface SOSPacket {
  id: string;
  sender: string;
  originalSender: string; // Add this to track the original author
  severity: number;
  timestamp: number;
  path: string[];
  payload: string;
  synced: boolean;
  ttl: number;
  signature?: string;
  publicKey?: string;
  triage: {
    canWalk: boolean;
    breathing: boolean;
    isInjured: boolean;
    tag: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK'; // S.T.A.R.T. Triage Tag
  };
  metadata: {
    medicalUrgency: number;
    peopleAffected: number;
    waitStartTime: number;
    locationDifficulty: number;
  };
  location: {
    lat: number;
    lng: number;
  };
  response?: {
    responderId: string;
    status: 'DISPATCHED' | 'RESCUED' | 'PENDING';
    notes: string;
    timestamp: number;
  };
}
