export interface SOSPacket {
  id: string;
  sender: string;
  severity: number;
  timestamp: number;
  path: string[];
  payload: string;
  synced: boolean;
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
}
