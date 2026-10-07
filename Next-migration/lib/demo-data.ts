import { Bed, SalineStatus } from "./types";

const timestamp = new Date().toISOString();

function createBed(id: string, label: string, room: string, x: number, y: number, name: string, diagnosis: string, estimatedDischargeDate: string, nurseName: string, salineLevel: number, temperature: number, deviceConnected: boolean, status: SalineStatus, salineLabel: string, loadCellDelta = 18, dropsPerMinute = 22): Bed {
  return { id, label, room, position: { x, y }, patient: { name, diagnosis, estimatedDischargeDate, nurseName }, salineLevel, salineLabel, loadCellDelta, dropsPerMinute, temperature, lastUpdated: timestamp, deviceConnected, status };
}

export const demoBeds: Bed[] = [
  createBed("bed-a1", "A-01", "Room 101", 16, 30, "Maya Fernandes", "Viral fever", "2026-10-09", "Anika Rao", 76, 37.2, true, "STABLE", "Normal saline · 500 mL"),
  createBed("bed-a2", "A-02", "Room 101", 38, 30, "Arjun Mehta", "Dehydration", "2026-10-10", "Anika Rao", 32, 38.1, true, "LOW", "Ringer's lactate · 500 mL"),
  createBed("bed-b1", "B-01", "Room 102", 62, 30, "Sana Iqbal", "Post-operative care", "2026-10-12", "Ravi Shah", 4, 36.9, true, "NEAR_EMPTY", "Normal saline · 500 mL"),
  { id: "bed-b2", label: "B-02", room: "Room 102", position: { x: 84, y: 30 }, patient: null, salineLevel: null, salineLabel: null, loadCellDelta: null, dropsPerMinute: null, temperature: null, lastUpdated: timestamp, deviceConnected: false, status: "OFFLINE" },
  createBed("bed-c1", "C-01", "Room 103", 26, 72, "Daniel Joseph", "Gastroenteritis", "2026-10-08", "Ravi Shah", 58, 37.5, true, "STABLE", "Normal saline · 500 mL", 96, 21),
  createBed("bed-c2", "C-02", "Room 103", 74, 72, "Ishita Kapoor", "Dengue observation", "2026-10-13", "Meera Nair", 47, 38.4, false, "OFFLINE", "Dextrose saline · 500 mL"),
];

export function demoBedById(id: string) {
  return demoBeds.find((bed) => bed.id === id);
}
