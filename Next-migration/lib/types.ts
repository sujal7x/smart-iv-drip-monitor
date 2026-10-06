export type SalineStatus = "STABLE" | "LOW" | "NEAR_EMPTY" | "OFFLINE";

export interface Patient {
  name: string;
  diagnosis: string;
  estimatedDischargeDate: string;
  nurseName: string;
}

export interface Bed {
  id: string;
  label: string;
  room: string;
  position: { x: number; y: number };
  patient: Patient | null;
  salineLevel: number | null;
  salineLabel: string | null;
  temperature: number | null;
  lastUpdated: string;
  deviceConnected: boolean;
  status: SalineStatus;
}

export interface SalineReading {
  timestamp: string;
  level: number;
}
