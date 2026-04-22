export interface SOSPacket {
  id: string; // Unique ID
  sender: string; // Node ID
  severity: number; // 1-10
  timestamp: number;
  path: string[]; // Track hop history for visualization
  payload: string; // The SOS message
}
