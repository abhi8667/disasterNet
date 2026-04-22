import { SOSPacket } from '../types';

export interface PriorityAnalysis {
  score: number;
  breakdown: {
    name: string;
    value: number;
    color: string;
  }[];
  isBiased: boolean;
  biasReasoning?: string;
}

export const calculatePriorityScore = (packet: SOSPacket): PriorityAnalysis => {
  const { medicalUrgency, peopleAffected, waitStartTime, locationDifficulty } = packet.metadata;
  
  const now = Date.now();
  const waitMinutes = (now - waitStartTime) / 60000;

  // 1. Severity Base (0-5 points)
  const severityScore = (medicalUrgency / 10) * 5;
  
  // 2. Population Impact (0-2 points)
  const popScore = Math.min(peopleAffected / 5, 2);
  
  // 3. Accessibility Multiplier (0-1 point)
  const accessScore = (locationDifficulty / 5);

  // 4. Neglect Prevention (The Fairness Factor)
  // If waiting > 30 mins, start boosting score exponentially to force attention
  const waitFactor = waitMinutes > 30 ? Math.min((waitMinutes - 30) / 10, 2) : 0;

  const totalScore = Math.min(severityScore + popScore + accessScore + waitFactor, 10);

  // Explainability Breakdown (SHAP-style)
  const breakdown = [
    { name: 'Medical Urgency', value: severityScore, color: '#f87171' }, // Red-400
    { name: 'People Affected', value: popScore, color: '#60a5fa' }, // Blue-400
    { name: 'Accessibility', value: accessScore, color: '#fbbf24' }, // Amber-400
    { name: 'Neglect Offset', value: waitFactor, color: '#c084fc' }, // Purple-400
  ];

  return {
    score: totalScore,
    breakdown,
    isBiased: waitMinutes > 60,
    biasReasoning: waitMinutes > 60 ? "CRITICAL: Response delay exceeds 60m. High risk of systemic neglect." : undefined
  };
};
