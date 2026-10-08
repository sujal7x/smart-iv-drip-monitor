export type Recommendation = {
  id: string;
  title: string;
  description: string;
  doctor: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  sender: "doctor" | "patient";
  text: string;
  time: string;
};

export type Appointment = {
  id: string;
  date: string;
  time: string;
  doctor: string;
  specialty: string;
  mode: "Video follow-up" | "In-person";
  status: "Booked" | "Requested";
};

export type DispatchPatient = {
  id: string;
  name: string;
  bed: string;
  diagnosis: string;
  dischargeDate: string;
  doctor: string;
  specialty: string;
  recommendations: Recommendation[];
  messages: ChatMessage[];
  appointments: Appointment[];
};

export const recommendationTemplates = [
  { title: "Hydration and rest", description: "Maintain fluid intake, rest adequately, and monitor symptoms at home." },
  { title: "Medicine adherence", description: "Continue prescribed medicines exactly as directed. Do not skip or double doses." },
  { title: "Diet and recovery", description: "Follow the advised diet plan and avoid foods that may worsen current symptoms." },
  { title: "Warning signs", description: "Seek urgent care for worsening pain, persistent fever, breathing difficulty, or any new severe symptom." },
  { title: "Follow-up review", description: "Attend the scheduled follow-up so recovery and medicines can be reviewed." },
];

export const demoDispatchPatients: DispatchPatient[] = [
  {
    id: "bed-a1", name: "Maya Fernandes", bed: "A-01", diagnosis: "Viral fever", dischargeDate: "2026-10-09", doctor: "Dr. Kavya Menon", specialty: "General Medicine",
    recommendations: [{ id: "rec-1", title: "Hydration and rest", description: "Maintain fluid intake, rest adequately, and monitor symptoms at home.", doctor: "Dr. Kavya Menon", createdAt: "Today · 10:15" }],
    messages: [{ id: "msg-1", sender: "doctor", text: "Your temperature trend is improving. Continue fluids and rest today.", time: "10:18" }, { id: "msg-2", sender: "patient", text: "Thank you, doctor. Can I resume work next week?", time: "10:24" }],
    appointments: [{ id: "apt-1", date: "2026-10-12", time: "11:30 AM", doctor: "Dr. Kavya Menon", specialty: "General Medicine", mode: "Video follow-up", status: "Booked" }],
  },
  {
    id: "bed-a2", name: "Arjun Mehta", bed: "A-02", diagnosis: "Dehydration", dischargeDate: "2026-10-10", doctor: "Dr. Kavya Menon", specialty: "General Medicine",
    recommendations: [], messages: [{ id: "msg-3", sender: "patient", text: "Will I need a follow-up after discharge?", time: "09:40" }], appointments: [],
  },
  {
    id: "bed-b1", name: "Sana Iqbal", bed: "B-01", diagnosis: "Post-operative care", dischargeDate: "2026-10-12", doctor: "Dr. Rohan Shah", specialty: "Surgery",
    recommendations: [{ id: "rec-2", title: "Warning signs", description: "Seek urgent care for worsening pain, persistent fever, breathing difficulty, or any new severe symptom.", doctor: "Dr. Rohan Shah", createdAt: "Yesterday · 04:30" }], messages: [], appointments: [{ id: "apt-2", date: "2026-10-16", time: "04:00 PM", doctor: "Dr. Rohan Shah", specialty: "Surgery", mode: "In-person", status: "Booked" }],
  },
  {
    id: "bed-c1", name: "Daniel Joseph", bed: "C-01", diagnosis: "Gastroenteritis", dischargeDate: "2026-10-08", doctor: "Dr. Kavya Menon", specialty: "General Medicine",
    recommendations: [], messages: [{ id: "msg-4", sender: "doctor", text: "Please continue oral rehydration and update us if symptoms worsen.", time: "Yesterday" }], appointments: [],
  },
  {
    id: "bed-c2", name: "Ishita Kapoor", bed: "C-02", diagnosis: "Dengue observation", dischargeDate: "2026-10-13", doctor: "Dr. Sameer Kulkarni", specialty: "Internal Medicine",
    recommendations: [], messages: [], appointments: [],
  },
];

