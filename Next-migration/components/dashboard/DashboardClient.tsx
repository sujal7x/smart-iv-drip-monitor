"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { firebaseConfigured } from "../../lib/firebase";
import { loadBeds, saveBed } from "../../lib/bed-repository";
import { Bed, Patient, SalineReading, SalineStatus } from "../../lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);
type View = "ward" | "patients" | "saline" | "vitals" | "alerts";

const timestamp = new Date().toISOString();
const seedBeds: Bed[] = [
  createBed("bed-a1", "A-01", "Room 101", 16, 30, "Maya Fernandes", "Viral fever", "2026-10-09", "Anika Rao", 76, 37.2, true, "STABLE", "Normal saline · 500 mL"),
  createBed("bed-a2", "A-02", "Room 101", 38, 30, "Arjun Mehta", "Dehydration", "2026-10-10", "Anika Rao", 32, 38.1, true, "LOW", "Ringer's lactate · 500 mL"),
  createBed("bed-b1", "B-01", "Room 102", 62, 30, "Sana Iqbal", "Post-operative care", "2026-10-12", "Ravi Shah", 14, 36.9, true, "NEAR_EMPTY", "Normal saline · 500 mL"),
  { id: "bed-b2", label: "B-02", room: "Room 102", position: { x: 84, y: 30 }, patient: null, salineLevel: null, salineLabel: null, temperature: null, lastUpdated: timestamp, deviceConnected: false, status: "OFFLINE" },
  createBed("bed-c1", "C-01", "Room 103", 26, 72, "Daniel Joseph", "Gastroenteritis", "2026-10-08", "Ravi Shah", 58, 37.5, true, "STABLE", "Normal saline · 500 mL"),
  createBed("bed-c2", "C-02", "Room 103", 74, 72, "Ishita Kapoor", "Dengue observation", "2026-10-13", "Meera Nair", 47, 38.4, false, "OFFLINE", "Dextrose saline · 500 mL"),
];

function createBed(id: string, label: string, room: string, x: number, y: number, name: string, diagnosis: string, estimatedDischargeDate: string, nurseName: string, salineLevel: number, temperature: number, deviceConnected: boolean, status: SalineStatus, salineLabel: string): Bed {
  return { id, label, room, position: { x, y }, patient: { name, diagnosis, estimatedDischargeDate, nurseName }, salineLevel, salineLabel, temperature, lastUpdated: timestamp, deviceConnected, status };
}

const statusLabel: Record<SalineStatus, string> = { STABLE: "Stable", LOW: "Low level", NEAR_EMPTY: "Near empty", OFFLINE: "Device offline" };
const pages: Record<View, [string, string]> = {
  ward: ["Bed intelligence", "Saline level monitoring and patient coordination."],
  patients: ["Patients", "Current patients assigned to Ward 01."],
  saline: ["Saline watch", "Review active saline bags and device connections."],
  vitals: ["Vitals", "Latest temperature entries by patient."],
  alerts: ["Alerts", "Saline and device conditions needing attention."],
};

export default function DashboardClient() {
  const [beds, setBeds] = useState<Bed[]>(seedBeds);
  const [selectedId, setSelectedId] = useState(seedBeds[0].id);
  const [view, setView] = useState<View>("ward");
  const [formOpen, setFormOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [dataMode, setDataMode] = useState(firebaseConfigured ? "Firebase ready" : "Demo data");

  useEffect(() => { loadBeds().then((saved) => { if (saved?.length) { setBeds(saved); setSelectedId(saved[0].id); setDataMode("Firestore"); } }).catch(() => setDataMode("Demo data")); }, []);

  const selected = beds.find((bed) => bed.id === selectedId) ?? beds[0];
  const occupied = beds.filter((bed) => bed.patient).length;
  const attention = beds.filter((bed) => ["LOW", "NEAR_EMPTY", "OFFLINE"].includes(bed.status)).length;
  const connected = beds.filter((bed) => bed.salineLevel !== null);
  const average = connected.length ? Math.round(connected.reduce((sum, bed) => sum + (bed.salineLevel ?? 0), 0) / connected.length) : 0;

  const selectBed = (id: string) => { setSelectedId(id); setView("ward"); };
  async function addPatient(input: Patient & { bedId: string }) {
    const existing = beds.find((bed) => bed.id === input.bedId);
    if (!existing) return;
    const updated: Bed = { ...existing, patient: input, salineLevel: 100, salineLabel: "No saline assigned", temperature: null, status: "OFFLINE", deviceConnected: false, lastUpdated: new Date().toISOString() };
    setBeds((current) => current.map((bed) => bed.id === updated.id ? updated : bed));
    setSelectedId(updated.id); setView("ward"); setFormOpen(false);
    if (await saveBed(updated)) setDataMode("Firestore");
  }

  return <div className="neon-app" style={{ background: "#070a08", color: "#f1f5ed" }}>
    <FunctionalStyles />
    <Sidebar current={view} onChange={setView} occupied={occupied} attention={attention} dataMode={dataMode} />
    <main className="neon-main">
      <header className="topbar"><div><div className="crumb">WARD 01 <i className="bi bi-chevron-right" /> {view.toUpperCase()}</div><h1>{pages[view][0]}</h1><p>{pages[view][1]}</p></div><div className="top-actions"><div className="date-chip"><i className="bi bi-calendar3" /> {new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</div><button className="neon-button" onClick={() => setFormOpen(true)}><i className="bi bi-plus-lg" /> Add patient</button></div></header>
      <MobileNav current={view} onChange={setView} />
      {view === "ward" && <WardView beds={beds} selected={selected} occupied={occupied} attention={attention} average={average} onSelect={setSelectedId} onTracker={() => setTrackerOpen(true)} />}
      {view === "patients" && <PatientsView beds={beds} onSelect={selectBed} />}
      {view === "saline" && <SalineWatch beds={beds} onSelect={selectBed} />}
      {view === "vitals" && <VitalsView beds={beds} onSelect={selectBed} />}
      {view === "alerts" && <AlertsView beds={beds} onSelect={selectBed} />}
    </main>
    {formOpen && <AddPatientModal beds={beds} onClose={() => setFormOpen(false)} onSave={addPatient} />}
    {trackerOpen && <PatientTracker bed={selected} onClose={() => setTrackerOpen(false)} />}
  </div>;
}

function Sidebar({ current, onChange, occupied, attention, dataMode }: { current: View; onChange: (view: View) => void; occupied: number; attention: number; dataMode: string }) {
  const items: Array<[View, string, string, number?]> = [["ward", "bi-grid-1x2", "Ward map"], ["patients", "bi-people", "Patients", occupied], ["saline", "bi-clipboard-pulse", "Saline watch"], ["vitals", "bi-thermometer-half", "Vitals"], ["alerts", "bi-bell", "Alerts", attention]];
  return <aside className="neon-sidebar"><div className="brand"><span className="brand-orb"><i className="bi bi-droplet-fill" /></span><span>PulseWard</span></div><div className="ward-pill"><span className="pulse" /> Ward 01 <i className="bi bi-chevron-down" /></div><nav>{items.map(([view, icon, label, count]) => <button key={view} type="button" className={current === view ? "active" : ""} onClick={() => onChange(view)}><i className={`bi ${icon}`} /> {label}{count !== undefined && <span>{count}</span>}</button>)}</nav><div className="sidebar-bottom"><span className="eyebrow">DATA SOURCE</span><div className="source-status"><span className="pulse" /> {dataMode}</div></div></aside>;
}

function MobileNav({ current, onChange }: { current: View; onChange: (view: View) => void }) {
  const items: Array<[View, string, string]> = [["ward", "bi-grid-1x2", "Map"], ["patients", "bi-people", "Patients"], ["saline", "bi-clipboard-pulse", "Saline"], ["vitals", "bi-thermometer-half", "Vitals"], ["alerts", "bi-bell", "Alerts"]];
  return <nav className="mobile-nav" aria-label="Ward sections">{items.map(([view, icon, label]) => <button key={view} type="button" className={current === view ? "active" : ""} onClick={() => onChange(view)}><i className={`bi ${icon}`} /><span>{label}</span></button>)}</nav>;
}

function WardView({ beds, selected, occupied, attention, average, onSelect, onTracker }: { beds: Bed[]; selected: Bed; occupied: number; attention: number; average: number; onSelect: (id: string) => void; onTracker: () => void }) {
  return <><section className="metric-grid"><Metric icon="bi-hospital" label="Occupied beds" value={`${occupied}/${beds.length}`} detail="Active care in Ward 01" tone="lime" /><Metric icon="bi-droplet" label="Average saline" value={`${average}%`} detail="Across active saline bags" tone="cyan" /><Metric icon="bi-exclamation-circle" label="Needs review" value={attention} detail="Low, near empty, or offline" tone="orange" /><Metric icon="bi-thermometer-half" label="Latest vitals" value={beds.filter((bed) => bed.temperature !== null).length} detail="Temperature entries today" tone="violet" /></section><section className="content-grid"><WardMap beds={beds} selectedId={selected.id} onSelect={onSelect} /><PatientPanel bed={selected} onTracker={onTracker} /></section><section className="lower-grid"><SalineChart bed={selected} /><Activity beds={beds} onSelect={onSelect} /></section></>;
}

function Metric({ icon, label, value, detail, tone }: { icon: string; label: string; value: string | number; detail: string; tone: string }) { return <article className={`metric-card ${tone}`}><div className="metric-head"><span>{label}</span><i className={`bi ${icon}`} /></div><strong>{value}</strong><small>{detail}</small></article>; }

function WardMap({ beds, selectedId, onSelect }: { beds: Bed[]; selectedId: string; onSelect: (id: string) => void }) { return <section className="panel ward-map"><div className="panel-heading"><div><span className="eyebrow">INTERACTIVE WARD</span><h2>Room map</h2></div><div className="map-legend"><span><i className="stable" /> Stable</span><span><i className="low" /> Low</span><span><i className="near-empty" /> Near empty</span><span><i className="offline" /> Offline</span></div></div><div className="floor-plan"><div className="hallway">MAIN CORRIDOR</div><div className="room-label room-one">ROOM 101</div><div className="room-label room-two">ROOM 102</div><div className="room-label room-three">ROOM 103</div>{beds.map((bed) => <button key={bed.id} className={`bed-node ${classFor(bed)} ${selectedId === bed.id ? "selected" : ""}`} style={{ left: `${bed.position.x}%`, top: `${bed.position.y}%` }} onClick={() => onSelect(bed.id)}><span className="bed-shape"><i className="bi bi-person-fill" /></span><strong>{bed.label}</strong><small>{bed.patient ? bed.patient.name.split(" ")[0] : "Vacant"}</small></button>)}</div><p className="map-hint"><i className="bi bi-cursor" /> Select a bed to inspect the patient record and saline trend.</p></section>; }

function PatientPanel({ bed, onTracker }: { bed: Bed; onTracker: () => void }) { const patient = bed.patient; return <aside className="panel patient-panel"><div className="panel-heading"><div><span className="eyebrow">BED {bed.label}</span><h2>{patient?.name ?? "Vacant bed"}</h2></div><span className={`status-badge ${classFor(bed)}`}>{statusLabel[bed.status]}</span></div>{patient ? <><div className="patient-meta"><span><i className="bi bi-heart-pulse" /> {patient.diagnosis}</span><span><i className="bi bi-calendar-event" /> Est. discharge {formatDate(patient.estimatedDischargeDate)}</span><span><i className="bi bi-person-badge" /> Input by {patient.nurseName}</span></div><div className="level-card"><div><span className="eyebrow">CURRENT SALINE LEVEL</span><strong>{bed.salineLevel ?? "—"}<em>%</em></strong><small>{bed.salineLabel}</small></div><div className="radial-level" style={{ "--level": `${bed.salineLevel ?? 0}%` } as React.CSSProperties}><span><i className="bi bi-droplet-fill" /></span></div></div><div className="details-row"><div><span>Temperature</span><strong>{bed.temperature ? `${bed.temperature}°C` : "Not recorded"}</strong></div><div><span>ESP status</span><strong className={bed.deviceConnected ? "good" : "warn"}>{bed.deviceConnected ? "Connected" : "Awaiting link"}</strong></div></div><button className="outline-button" onClick={onTracker}>Open patient tracker <i className="bi bi-arrow-up-right" /></button></> : <div className="vacant-state"><i className="bi bi-person-plus" /><h3>Ready for a patient</h3><p>Use Add patient to begin a care record for this bed.</p></div>}</aside>; }

function SalineChart({ bed }: { bed: Bed }) { const readings: SalineReading[] = Array.from({ length: 12 }, (_, index) => ({ timestamp: `${String(index + 8).padStart(2, "0")}:00`, level: Math.max(0, Math.round((bed.salineLevel ?? 0) + (11 - index) * 2.8)) })); const data = { labels: readings.map((reading) => reading.timestamp), datasets: [{ data: readings.map((reading) => reading.level), borderColor: "#b6ff37", backgroundColor: "rgba(182, 255, 55, .16)", fill: true, tension: .42, borderWidth: 2.5, pointRadius: 0 }] }; return <section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">SALINE LEVEL HISTORY</span><h2>{bed.label} level trend</h2></div><span className="soft-chip">Last 12 readings</span></div><div className="chart-wrap"><Line data={data} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: "rgba(255,255,255,.06)" }, ticks: { color: "#c6d0c1" } }, y: { min: 0, max: 100, grid: { color: "rgba(255,255,255,.07)" }, ticks: { color: "#c6d0c1", callback: (value) => `${value}%` } } } }} /></div></section>; }

function Activity({ beds, onSelect }: { beds: Bed[]; onSelect: (id: string) => void }) { return <aside className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">WARD ACTIVITY</span><h2>Care queue</h2></div></div>{beds.filter((bed) => bed.patient).slice(0, 4).map((bed) => <button className="activity-item" key={bed.id} onClick={() => onSelect(bed.id)}><span className={`activity-dot ${classFor(bed)}`} /><div><strong>{bed.label} · {bed.patient?.name}</strong><small>{bed.status === "OFFLINE" ? "Connect ESP device to begin readings" : `${bed.salineLevel}% saline level · ${bed.salineLabel}`}</small></div><i className="bi bi-arrow-up-right" /></button>)}</aside>; }

function PatientsView({ beds, onSelect }: { beds: Bed[]; onSelect: (id: string) => void }) { return <section className="panel data-view"><div className="panel-heading"><div><span className="eyebrow">ACTIVE ASSIGNMENTS</span><h2>Patient directory</h2></div><span className="soft-chip">{beds.filter((bed) => bed.patient).length} active</span></div><div className="data-list">{beds.filter((bed) => bed.patient).map((bed) => <button key={bed.id} className="data-row" onClick={() => onSelect(bed.id)}><span className={`activity-dot ${classFor(bed)}`} /><div><strong>{bed.patient?.name}</strong><small>{bed.label} · {bed.room} · {bed.patient?.diagnosis}</small></div><span>{formatDate(bed.patient!.estimatedDischargeDate)}</span><i className="bi bi-arrow-right" /></button>)}</div></section>; }

function SalineWatch({ beds, onSelect }: { beds: Bed[]; onSelect: (id: string) => void }) { return <section className="panel data-view"><div className="panel-heading"><div><span className="eyebrow">LIVE LEVELS</span><h2>Saline watch</h2></div><span className="soft-chip">Select a row for bed map</span></div><div className="data-list">{beds.filter((bed) => bed.patient).sort((a, b) => (a.salineLevel ?? 101) - (b.salineLevel ?? 101)).map((bed) => <button key={bed.id} className="data-row" onClick={() => onSelect(bed.id)}><span className={`activity-dot ${classFor(bed)}`} /><div><strong>{bed.label} · {bed.patient?.name}</strong><small>{bed.salineLabel} · {bed.deviceConnected ? "ESP connected" : "ESP awaiting link"}</small></div><span className={`level-value ${classFor(bed)}`}>{bed.salineLevel ?? "—"}%</span><i className="bi bi-arrow-right" /></button>)}</div></section>; }

function VitalsView({ beds, onSelect }: { beds: Bed[]; onSelect: (id: string) => void }) { return <section className="panel data-view"><div className="panel-heading"><div><span className="eyebrow">LATEST OBSERVATIONS</span><h2>Temperature board</h2></div><span className="soft-chip">Today</span></div><div className="data-list">{beds.filter((bed) => bed.patient).map((bed) => <button key={bed.id} className="data-row" onClick={() => onSelect(bed.id)}><i className="bi bi-thermometer-half" /><div><strong>{bed.patient?.name}</strong><small>{bed.label} · recorded with current care check</small></div><span className={bed.temperature && bed.temperature >= 38 ? "temperature-high" : "temperature-ok"}>{bed.temperature ? `${bed.temperature}°C` : "Not recorded"}</span><i className="bi bi-arrow-right" /></button>)}</div></section>; }

function AlertsView({ beds, onSelect }: { beds: Bed[]; onSelect: (id: string) => void }) { const flagged = beds.filter((bed) => ["LOW", "NEAR_EMPTY", "OFFLINE"].includes(bed.status)); return <section className="panel data-view"><div className="panel-heading"><div><span className="eyebrow">OPEN CONDITIONS</span><h2>Review queue</h2></div><span className="soft-chip">{flagged.length} open</span></div><div className="data-list">{flagged.map((bed) => <button key={bed.id} className="data-row" onClick={() => onSelect(bed.id)}><span className={`activity-dot ${classFor(bed)}`} /><div><strong>{bed.label} · {statusLabel[bed.status]}</strong><small>{bed.patient ? `${bed.patient.name} · ${bed.salineLevel ?? "No"}% saline level` : "Bed awaiting patient assignment"}</small></div><span>{bed.status === "OFFLINE" ? "Check device" : "Review level"}</span><i className="bi bi-arrow-right" /></button>)}</div></section>; }

function PatientTracker({ bed, onClose }: { bed: Bed; onClose: () => void }) { const patient = bed.patient; return <div className="modal-surface" role="dialog" aria-modal="true"><section className="add-patient-modal tracker-modal"><div className="modal-title"><div><span className="eyebrow">PATIENT TRACKER · BED {bed.label}</span><h2>{patient?.name ?? "Vacant bed"}</h2></div><button type="button" className="close-button" onClick={onClose}><i className="bi bi-x-lg" /></button></div>{patient ? <><div className="tracker-grid"><TrackerStat label="Working diagnosis" value={patient.diagnosis} /><TrackerStat label="Est. discharge" value={formatDate(patient.estimatedDischargeDate)} /><TrackerStat label="Entered by" value={patient.nurseName} /><TrackerStat label="Temperature" value={bed.temperature ? `${bed.temperature}°C` : "Not recorded"} /></div><div className="tracker-event"><i className="bi bi-droplet-fill" /><div><strong>{bed.salineLevel}% saline level</strong><small>{bed.salineLabel} · {bed.deviceConnected ? "ESP32 connected" : "ESP32 needs linking"}</small></div></div><button className="neon-button full" onClick={onClose}>Return to ward map <i className="bi bi-arrow-left" /></button></> : <p className="form-note">No patient is assigned to this bed.</p>}</section></div>; }

function TrackerStat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function FunctionalStyles() { return <style>{`
  .neon-sidebar nav button { width:100%; border:0; background:transparent; color:#c7d0c4; text-align:left; padding:11px 10px; border-radius:9px; display:flex; align-items:center; gap:12px; font:600 14px Manrope, sans-serif; cursor:pointer; }
  .neon-sidebar nav button i { font-size:17px; }
  .neon-sidebar nav button span { margin-left:auto; background:#b6ff37; color:#10180e; border-radius:20px; padding:1px 6px; font-size:10px; }
  .neon-sidebar nav button.active { background:linear-gradient(90deg,rgba(182,255,55,.17),rgba(182,255,55,.02)); color:#b6ff37; border:1px solid rgba(182,255,55,.14); }
  .mobile-nav { display:none; }
  .data-view { max-width:100%; min-height:480px; }
  .data-list { margin-top:18px; border-top:1px solid #273127; }
  .data-row { width:100%; border:0; border-bottom:1px solid #273127; background:transparent; color:#f1f5ed; padding:17px 6px; display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; gap:13px; align-items:center; text-align:left; cursor:pointer; font:inherit; }
  .data-row:hover { background:rgba(182,255,55,.06); }
  .data-row div { display:grid; gap:4px; }
  .data-row strong { font-size:14px; }
  .data-row small { font-size:11px; color:#aab3a7; }
  .data-row > span:not(.activity-dot) { color:#e7efe3; font-size:12px; font-weight:700; }
  .level-value.low,.temperature-high { color:#ff9a62 !important; }
  .level-value.near-empty { color:#ff7580 !important; }
  .level-value.stable,.temperature-ok { color:#b6ff37 !important; }
  .activity-item { width:100%; border:0; background:transparent; color:#f1f5ed; text-align:left; cursor:pointer; font:inherit; }
  .activity-item:hover { background:rgba(182,255,55,.06); }
  .tracker-modal { width:min(620px,100%); }
  .tracker-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .tracker-grid > div { padding:13px; border:1px solid #344034; border-radius:9px; background:#090e0a; }
  .tracker-grid span { display:block; color:#aab3a7; font-size:10px; }
  .tracker-grid strong { display:block; margin-top:6px; color:#f1f5ed; font-size:13px; }
  .tracker-event { margin:4px 0 12px; padding:14px; border:1px solid #43503f; border-radius:9px; display:flex; gap:12px; align-items:center; background:#09100a; }
  .tracker-event i { color:#b6ff37; font-size:20px; }
  .tracker-event div { display:grid; gap:3px; }
  .tracker-event strong { font-size:13px; }
  .tracker-event small { color:#aab3a7; font-size:11px; }
  @media(max-width:760px){ .mobile-nav { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; margin:-10px 0 18px; padding:6px; border:1px solid #273127; border-radius:12px; background:#0b100c; } .mobile-nav button { border:0; border-radius:8px; background:transparent; color:#9da79a; min-height:46px; display:grid; place-content:center; gap:3px; font:700 9px Manrope,sans-serif; cursor:pointer; } .mobile-nav button i { font-size:15px; } .mobile-nav button.active { background:rgba(182,255,55,.14); color:#b6ff37; } }
  @media(max-width:600px){ .data-row { grid-template-columns:auto minmax(0,1fr) auto; } .data-row > i { display:none; } .tracker-grid { grid-template-columns:1fr; } }
`}</style>; }

function AddPatientModal({ beds, onClose, onSave }: { beds: Bed[]; onClose: () => void; onSave: (input: Patient & { bedId: string }) => void }) { const [bedId, setBedId] = useState(beds.find((bed) => !bed.patient)?.id ?? beds[0].id); const [name, setName] = useState(""); const [diagnosis, setDiagnosis] = useState(""); const [estimatedDischargeDate, setEstimatedDischargeDate] = useState(""); const [nurseName, setNurseName] = useState(""); const submit = (event: React.FormEvent) => { event.preventDefault(); if (name && diagnosis && estimatedDischargeDate && nurseName) onSave({ bedId, name, diagnosis, estimatedDischargeDate, nurseName }); }; return <div className="modal-surface" role="dialog" aria-modal="true"><form className="add-patient-modal" onSubmit={submit}><div className="modal-title"><div><span className="eyebrow">NEW CARE RECORD</span><h2>Add patient to bed</h2></div><button type="button" className="close-button" onClick={onClose}><i className="bi bi-x-lg" /></button></div><label>Bed<select value={bedId} onChange={(event) => setBedId(event.target.value)}>{beds.map((bed) => <option key={bed.id} value={bed.id}>{bed.label} · {bed.room}{bed.patient ? " (replace assignment)" : ""}</option>)}</select></label><label>Patient name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" autoFocus /></label><label>Working diagnosis<input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="e.g. Viral fever" /></label><label>Estimated discharge date<input type="date" value={estimatedDischargeDate} onChange={(event) => setEstimatedDischargeDate(event.target.value)} /></label><label>Nurse entering this record<input value={nurseName} onChange={(event) => setNurseName(event.target.value)} placeholder="Full name" /></label><p className="form-note"><i className="bi bi-info-circle" /> The nurse name is recorded with this patient assignment.</p><button className="neon-button full" type="submit">Create patient record <i className="bi bi-arrow-right" /></button></form></div>; }

function classFor(bed: Bed) { return bed.status.toLowerCase().replace("_", "-"); }
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
