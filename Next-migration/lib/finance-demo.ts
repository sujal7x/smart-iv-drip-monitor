export type FinanceStatus = "CLEAR" | "PAYMENT_DUE" | "INSURANCE_PENDING" | "DOCUMENTS_REQUIRED" | "DISCHARGE_HOLD";

export type Charge = {
  id: string;
  date: string;
  category: string;
  description: string;
  quantity: number;
  amount: number;
  status: "Billed" | "Covered" | "Paid" | "Pending";
};

export type Payment = {
  id: string;
  date: string;
  method: string;
  amount: number;
  status: "Paid" | "Pending";
};

export type FinancePatient = {
  id: string;
  bed: string;
  ward: string;
  name: string;
  admissionDate: string;
  dischargeDate: string;
  insurer: string;
  policyId: string;
  insuranceStatus: "Documents pending" | "Pre-authorisation" | "Submitted" | "Approved";
  estimate: number;
  billed: number;
  insuranceCovered: number;
  status: FinanceStatus;
  charges: Charge[];
  payments: Payment[];
};

export const demoFinancePatients: FinancePatient[] = [
  {
    id: "bed-a1", bed: "A-01", ward: "Ward 01", name: "Maya Fernandes", admissionDate: "2026-10-05", dischargeDate: "2026-10-09", insurer: "Aster Health Insurance", policyId: "AHI-2026-580174", insuranceStatus: "Approved", estimate: 18000, billed: 12450, insuranceCovered: 8500, status: "PAYMENT_DUE",
    charges: [
      { id: "charge-1", date: "06 Oct", category: "Admission", description: "Registration and bed allocation", quantity: 1, amount: 1500, status: "Paid" },
      { id: "charge-2", date: "06 Oct", category: "Room and nursing", description: "Room 101 · nursing care", quantity: 2, amount: 4800, status: "Covered" },
      { id: "charge-3", date: "07 Oct", category: "IV and consumables", description: "Normal saline and IV set", quantity: 2, amount: 1250, status: "Billed" },
      { id: "charge-4", date: "07 Oct", category: "Medicines", description: "Prescribed medicines", quantity: 1, amount: 1900, status: "Billed" },
      { id: "charge-5", date: "07 Oct", category: "Professional fees", description: "Doctor consultation", quantity: 1, amount: 3000, status: "Covered" },
    ],
    payments: [{ id: "PAY-10182", date: "05 Oct · 10:32", method: "UPI", amount: 1500, status: "Paid" }],
  },
  {
    id: "bed-a2", bed: "A-02", ward: "Ward 01", name: "Arjun Mehta", admissionDate: "2026-10-06", dischargeDate: "2026-10-10", insurer: "CareShield TPA", policyId: "CST-883510", insuranceStatus: "Pre-authorisation", estimate: 22000, billed: 15800, insuranceCovered: 0, status: "INSURANCE_PENDING",
    charges: [], payments: [{ id: "PAY-10184", date: "06 Oct · 12:10", method: "Card", amount: 4000, status: "Paid" }],
  },
  {
    id: "bed-b1", bed: "B-01", ward: "Ward 01", name: "Sana Iqbal", admissionDate: "2026-10-04", dischargeDate: "2026-10-12", insurer: "SecureLife Health", policyId: "SLH-249051", insuranceStatus: "Documents pending", estimate: 36000, billed: 28400, insuranceCovered: 18000, status: "DOCUMENTS_REQUIRED",
    charges: [], payments: [{ id: "PAY-10162", date: "04 Oct · 09:18", method: "Cash counter", amount: 2500, status: "Paid" }],
  },
  {
    id: "bed-c1", bed: "C-01", ward: "Ward 01", name: "Daniel Joseph", admissionDate: "2026-10-05", dischargeDate: "2026-10-08", insurer: "Self pay", policyId: "—", insuranceStatus: "Documents pending", estimate: 14000, billed: 10400, insuranceCovered: 0, status: "DISCHARGE_HOLD",
    charges: [], payments: [{ id: "PAY-10173", date: "05 Oct · 14:32", method: "UPI", amount: 5000, status: "Paid" }],
  },
  {
    id: "bed-c2", bed: "C-02", ward: "Ward 01", name: "Ishita Kapoor", admissionDate: "2026-10-06", dischargeDate: "2026-10-13", insurer: "Aster Health Insurance", policyId: "AHI-2026-713447", insuranceStatus: "Submitted", estimate: 26000, billed: 9800, insuranceCovered: 6500, status: "CLEAR",
    charges: [], payments: [{ id: "PAY-10189", date: "06 Oct · 16:40", method: "Net banking", amount: 3300, status: "Paid" }],
  },
];

export function paidAmount(patient: FinancePatient) { return patient.payments.filter((item) => item.status === "Paid").reduce((total, item) => total + item.amount, 0); }
export function outstandingAmount(patient: FinancePatient) { return Math.max(0, patient.billed - patient.insuranceCovered - paidAmount(patient)); }

