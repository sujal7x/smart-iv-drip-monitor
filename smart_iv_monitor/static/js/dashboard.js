/**
 * dashboard.js
 * ------------
 * Real-time hospital telemetry client for the Smart IV Drip Monitor.
 * Interacts with Flask REST APIs:
 *   - GET  /api/health
 *   - GET  /api/beds
 *   - GET  /api/beds/<bed_id>
 *   - GET  /api/readings/<bed_id>
 *   - GET  /api/alerts
 *   - POST /api/alerts/<alert_id>/acknowledge
 */

// Application State
let bedsData = [];
let alertsData = [];
let currentFilter = "ALL";
let searchQuery = "";
let selectedModalBedId = null;
let telemetryChartInstance = null;
let isSoundEnabled = true;
let knownAlertIds = new Set();
let isInitialAlertLoad = true;

// Web Audio API Synthesizer Context for medical alert chimes
let audioCtx = null;

function playAlertChime() {
  if (!isSoundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    // Medical alert frequency pattern
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (err) {
    console.warn("Audio chime disabled or blocked by browser policy:", err);
  }
}

// =============================================================================
// INITIALIZATION ON DOM READY
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initSystemClock();
  initEventListeners();
  
  // Initial immediate fetch
  refreshAllData();

  // Polling interval: every 2000 milliseconds (Requirement 6 & 17)
  setInterval(refreshAllData, 2000);
});

// =============================================================================
// SYSTEM CLOCK
// =============================================================================
function initSystemClock() {
  const clockEl = document.getElementById("systemClock");
  function updateTime() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// =============================================================================
// EVENT LISTENERS & CONTROLS
// =============================================================================
function initEventListeners() {
  // Sound Mute/Unmute Toggle
  const soundBtn = document.getElementById("soundToggleBtn");
  const soundIcon = document.getElementById("soundIcon");
  const soundText = document.getElementById("soundText");

  soundBtn.addEventListener("click", () => {
    isSoundEnabled = !isSoundEnabled;
    if (isSoundEnabled) {
      soundIcon.className = "bi bi-volume-up-fill text-primary";
      soundText.textContent = "Sound On";
      playAlertChime(); // Brief test chirp
    } else {
      soundIcon.className = "bi bi-volume-mute-fill text-muted";
      soundText.textContent = "Muted";
    }
  });

  // Filter Buttons
  document.querySelectorAll(".btn-filter").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderBedCards();
    });
  });

  // Search Input
  const searchInput = document.getElementById("bedSearchInput");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderBedCards();
  });

  // Manual Refresh Alerts Button
  document.getElementById("refreshAlertsBtn").addEventListener("click", () => {
    fetchAlerts();
  });

  // Clear modal tracking when closed
  const modalEl = document.getElementById('bedDetailModal');
  modalEl.addEventListener('hidden.bs.modal', () => {
    selectedModalBedId = null;
  });
}

// =============================================================================
// CORE POLLING COORDINATOR
// =============================================================================
async function refreshAllData() {
  await Promise.all([
    checkBackendHealth(),
    fetchBeds(),
    fetchAlerts()
  ]);

  // If a bed modal is actively open, refresh its chart & details live
  if (selectedModalBedId) {
    updateModalTelemetry(selectedModalBedId);
  }
}

// =============================================================================
// 1. BACKEND HEALTH CHECK (GET /api/health)
// =============================================================================
async function checkBackendHealth() {
  const badge = document.getElementById("backendConnectionBadge");
  const text = document.getElementById("backendConnectionText");

  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "running") {
        badge.className = "connection-badge connected";
        text.textContent = "🟢 BACKEND CONNECTED";
        return true;
      }
    }
    throw new Error("Invalid health response");
  } catch (err) {
    badge.className = "connection-badge disconnected";
    text.textContent = "🔴 BACKEND DISCONNECTED";
    return false;
  }
}

// =============================================================================
// 2. FETCH & RENDER BEDS (GET /api/beds)
// =============================================================================
async function fetchBeds() {
  try {
    const res = await fetch("/api/beds", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bedsData = await res.json();

    updateKPISummary();
    renderBedCards();

    const timestampEl = document.getElementById("gridSyncTimestamp");
    const now = new Date();
    timestampEl.textContent = `Updated: ${now.toLocaleTimeString()}`;
  } catch (err) {
    console.error("Failed to fetch beds:", err);
  }
}

// Update Top KPI Summary Counters
function updateKPISummary() {
  const total = bedsData.length;
  const normal = bedsData.filter(b => b.status === "NORMAL").length;
  const lowFlow = bedsData.filter(b => b.status === "LOW_FLOW").length;
  const critical = bedsData.filter(b => b.status === "CRITICAL").length;

  document.getElementById("statTotalBeds").textContent = total;
  document.getElementById("statNormalBeds").textContent = normal;
  document.getElementById("statLowFlowBeds").textContent = lowFlow;
  document.getElementById("statCriticalBeds").textContent = critical;

  // Filter badges
  const filterCountEl = document.getElementById("filterCountAll");
  if (filterCountEl) filterCountEl.textContent = total;
}

// Format Estimated Empty Minutes into readable format (Requirement 8)
function formatEmptyTime(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return { short: "--", label: "Flow stopped" };
  }
  const mins = Math.round(minutes);
  if (mins <= 0) {
    return { short: "0 min", label: "Bottle Empty" };
  }
  if (mins < 60) {
    return { short: `~${mins}m`, label: `~${mins} minutes` };
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return {
    short: `${hrs}h ${remainingMins}m`,
    label: `${hrs} hr ${remainingMins} min (~${mins} min)`
  };
}

// Format Status Badge
function getStatusBadgeConfig(status) {
  switch (status) {
    case "NORMAL":
      return {
        badgeClass: "NORMAL",
        icon: "🟢",
        text: "NORMAL",
        progressColor: "bg-success"
      };
    case "LOW_FLOW":
      return {
        badgeClass: "LOW_FLOW",
        icon: "🟡",
        text: "LOW FLOW",
        progressColor: "bg-warning"
      };
    case "CRITICAL":
      return {
        badgeClass: "CRITICAL",
        icon: "🔴",
        text: "CRITICAL",
        progressColor: "bg-danger"
      };
    default:
      return {
        badgeClass: "NORMAL",
        icon: "⚪",
        text: status || "UNKNOWN",
        progressColor: "bg-secondary"
      };
  }
}

// Render dynamic bed cards
function renderBedCards() {
  const container = document.getElementById("bedCardsContainer");

  // Apply filters
  let filtered = bedsData;
  if (currentFilter !== "ALL") {
    filtered = filtered.filter(b => b.status === currentFilter);
  }
  if (searchQuery) {
    filtered = filtered.filter(b => b.bed_id.toLowerCase().includes(searchQuery));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="p-4 bg-white rounded-3 shadow-sm border">
          <i class="bi bi-inbox fs-2 text-muted d-block mb-2"></i>
          <h6 class="text-secondary fw-bold mb-1">No Beds Matching Filter</h6>
          <p class="text-muted small mb-0">No active beds match the selected status or search query.</p>
        </div>
      </div>
    `;
    return;
  }

  // Generate cards
  const cardsHtml = filtered.map(bed => {
    const statusCfg = getStatusBadgeConfig(bed.status);
    const emptyTime = formatEmptyTime(bed.estimated_empty_minutes);
    const percent = Math.min(100, Math.max(0, bed.remaining_percent || 0));

    // Format last updated timestamp nicely
    let formattedTime = "--";
    if (bed.last_updated) {
      try {
        const d = new Date(bed.last_updated + "Z");
        formattedTime = isNaN(d) ? bed.last_updated : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      } catch (e) {
        formattedTime = bed.last_updated;
      }
    }

    return `
      <div class="col-12 col-md-6 col-lg-4 col-xl-3">
        <div class="card bed-card status-${bed.status} shadow-sm h-100">
          
          <!-- Card Header -->
          <div class="bed-card-header d-flex justify-content-between align-items-center">
            <span class="bed-id-badge">${bed.bed_id}</span>
            <span class="bed-status-pill ${statusCfg.badgeClass}">
              ${statusCfg.icon} ${statusCfg.text}
            </span>
          </div>

          <!-- Card Body -->
          <div class="card-body p-3">
            
            <!-- Drip Rate Hero Display -->
            <div class="mb-3">
              <div class="text-muted small text-uppercase fw-semibold mb-1">Drip Rate</div>
              <div class="drip-hero">
                <span class="drip-number ${bed.status === 'CRITICAL' ? 'text-danger' : 'text-dark'}">${Math.round(bed.drop_rate)}</span>
                <span class="drip-unit">drops/min</span>
              </div>
            </div>

            <!-- IV Fluid Volume & Remaining % -->
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center small mb-1">
                <span class="text-muted fw-semibold">Fluid Volume</span>
                <span class="font-monospace fw-bold text-dark">${Math.round(bed.current_volume)} / ${Math.round(bed.bottle_capacity)} mL</span>
              </div>
              
              <!-- Progress bar -->
              <div class="iv-progress-wrapper">
                <div class="progress-bar progress-bar-striped progress-bar-animated ${statusCfg.progressColor}" 
                     role="progressbar" 
                     style="width: ${percent}%;" 
                     aria-valuenow="${percent}" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                </div>
              </div>
              <div class="text-end text-muted small mt-1 font-monospace">${percent}% remaining</div>
            </div>

            <!-- Estimated Empty Time (Prediction) -->
            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
              <span class="text-muted small fw-semibold">Estimated Empty:</span>
              <span class="empty-time-pill ${bed.status === 'CRITICAL' ? 'text-danger fw-bold' : 'text-primary'}" title="${emptyTime.label}">
                ${emptyTime.short}
              </span>
            </div>

          </div>

          <!-- Card Footer & Actions -->
          <div class="bed-card-footer d-flex justify-content-between align-items-center">
            <span class="text-muted small font-monospace" style="font-size: 0.72rem;">
              <i class="bi bi-clock"></i> ${formattedTime}
            </span>
            <button class="btn btn-sm btn-outline-primary py-1 px-2 d-flex align-items-center gap-1" 
                    onclick="openBedDetailModal('${bed.bed_id}')">
              <i class="bi bi-activity"></i> Telemetry
            </button>
          </div>

        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = cardsHtml;
}

// =============================================================================
// 3. FETCH & RENDER ALERTS (GET /api/alerts & POST acknowledge)
// =============================================================================
async function fetchAlerts() {
  try {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    alertsData = await res.json();

    // Check for new critical unacknowledged alerts to sound chime
    const unacknowledgedList = alertsData.filter(a => !a.acknowledged);
    const activeCount = unacknowledgedList.length;

    // Update active alerts counters
    document.getElementById("statActiveAlerts").textContent = activeCount;
    document.getElementById("alertsPanelCountBadge").textContent = `${activeCount} Active`;

    const alertPingBadge = document.getElementById("alertPingBadge");
    if (activeCount > 0) {
      alertPingBadge.classList.remove("d-none");
    } else {
      alertPingBadge.classList.add("d-none");
    }

    // Audio chime trigger on new critical alerts
    if (!isInitialAlertLoad) {
      const hasNewCritical = unacknowledgedList.some(a => !knownAlertIds.has(a.id) && a.alert_type === "CRITICAL");
      if (hasNewCritical) {
        playAlertChime();
      }
    }
    alertsData.forEach(a => knownAlertIds.add(a.id));
    isInitialAlertLoad = false;

    renderAlertsTable();
  } catch (err) {
    console.error("Failed to fetch alerts:", err);
  }
}

function renderAlertsTable() {
  const tbody = document.getElementById("alertsTableBody");

  if (alertsData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <i class="bi bi-shield-check text-success fs-3 d-block mb-1"></i>
          No active alerts recorded. All beds operating normally.
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = alertsData.slice(0, 15).map(alert => {
    const isCritical = alert.alert_type === "CRITICAL";
    const icon = isCritical ? "🚨" : "⚠️";
    const badgeBg = isCritical ? "bg-danger text-white" : "bg-warning text-dark";
    const rowClass = alert.acknowledged ? "" : (isCritical ? "alert-row-CRITICAL" : "alert-row-LOW_FLOW");

    return `
      <tr class="${rowClass}">
        <td>
          <span class="badge bg-dark font-monospace">${alert.bed_id}</span>
        </td>
        <td>
          <span class="alert-type-badge ${badgeBg}">
            ${icon} ${alert.alert_type}
          </span>
        </td>
        <td class="fw-semibold text-dark">${alert.message}</td>
        <td class="text-muted small font-monospace">${alert.timestamp}</td>
        <td>
          ${alert.acknowledged 
            ? `<span class="badge bg-secondary-subtle text-secondary border">Acknowledged</span>` 
            : `<span class="badge bg-danger">Active</span>`
          }
        </td>
        <td class="text-end">
          ${alert.acknowledged
            ? `<span class="text-muted small"><i class="bi bi-check2-all text-success"></i> Done</span>`
            : `<button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="acknowledgeAlert(${alert.id})">
                 <i class="bi bi-check-lg"></i> Acknowledge
               </button>`
          }
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rowsHtml;
}

// Acknowledge Alert (POST /api/alerts/<alert_id>/acknowledge)
window.acknowledgeAlert = async function(alertId) {
  try {
    const res = await fetch(`/api/alerts/${alertId}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (res.ok) {
      // Refresh immediately
      fetchAlerts();
    } else {
      alert("Failed to acknowledge alert. Check server logs.");
    }
  } catch (err) {
    console.error("Error acknowledging alert:", err);
  }
};

// =============================================================================
// 4. BED TELEMETRY & CHART.JS MODAL (GET /api/readings/<bed_id>)
// =============================================================================
window.openBedDetailModal = async function(bedId) {
  selectedModalBedId = bedId;

  // Initialize or show modal
  const modalEl = document.getElementById('bedDetailModal');
  const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
  modalInstance.show();

  // Populate data
  await updateModalTelemetry(bedId);
};

async function updateModalTelemetry(bedId) {
  const bed = bedsData.find(b => b.bed_id === bedId);
  if (!bed) return;

  // Header and title
  document.getElementById("bedDetailModalLabel").textContent = `${bed.bed_id} Telemetry & Drip Analytics`;
  document.getElementById("modalBedSubtitle").textContent = `Ward 01 • Continuous Infusion Monitoring • ${bed.bottle_capacity} mL Capacity`;

  // Badges & figures
  const statusCfg = getStatusBadgeConfig(bed.status);
  const statusBadge = document.getElementById("modalBedStatusBadge");
  statusBadge.className = `badge ${statusCfg.badgeClass === 'CRITICAL' ? 'bg-danger' : (statusCfg.badgeClass === 'LOW_FLOW' ? 'bg-warning text-dark' : 'bg-success')}`;
  statusBadge.textContent = `${statusCfg.icon} ${statusCfg.text}`;

  document.getElementById("modalBedDropRate").textContent = `${Math.round(bed.drop_rate)} dpm`;
  document.getElementById("modalBedVolume").textContent = `${Math.round(bed.current_volume)} / ${Math.round(bed.bottle_capacity)} mL`;
  
  const emptyTime = formatEmptyTime(bed.estimated_empty_minutes);
  document.getElementById("modalBedEmptyTime").textContent = emptyTime.label;

  document.getElementById("modalLastUpdatedText").textContent = `Last updated: ${bed.last_updated || new Date().toLocaleTimeString()}`;

  // Fetch readings for chart
  await renderBedChart(bedId);

  // Filter alerts for this bed
  const bedAlerts = alertsData.filter(a => a.bed_id === bedId).slice(0, 5);
  const alertsListEl = document.getElementById("modalBedAlertsList");
  if (bedAlerts.length === 0) {
    alertsListEl.innerHTML = `<div class="list-group-item text-muted small py-3 text-center">No recent critical alerts for this bed.</div>`;
  } else {
    alertsListEl.innerHTML = bedAlerts.map(a => `
      <div class="list-group-item d-flex justify-content-between align-items-center py-2">
        <div>
          <span class="badge ${a.alert_type === 'CRITICAL' ? 'bg-danger' : 'bg-warning text-dark'} me-1">${a.alert_type}</span>
          <span class="small fw-semibold text-dark">${a.message}</span>
        </div>
        <span class="text-muted small font-monospace">${a.timestamp}</span>
      </div>
    `).join("");
  }
}

// Chart.js Line Graph for Drip Rate History
async function renderBedChart(bedId) {
  try {
    const res = await fetch(`/api/readings/${bedId}`, { cache: "no-store" });
    if (!res.ok) return;
    const readings = await res.json();

    const labels = readings.map(r => {
      // Extract time portion
      if (r.timestamp) {
        const parts = r.timestamp.split(" ");
        return parts.length > 1 ? parts[1] : r.timestamp;
      }
      return "";
    });
    const dataValues = readings.map(r => r.drop_rate);

    const canvas = document.getElementById("bedTelemetryChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (telemetryChartInstance) {
      // Smooth update of existing chart
      telemetryChartInstance.data.labels = labels;
      telemetryChartInstance.data.datasets[0].data = dataValues;
      telemetryChartInstance.update("none"); // update without disruptive animation
    } else {
      // Create new chart instance
      telemetryChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Drip Rate (drops/min)',
            data: dataValues,
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#0d6efd',
            pointRadius: 3,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1e293b',
              titleFont: { size: 13 },
              bodyFont: { size: 13, weight: 'bold' },
              callbacks: {
                label: (ctx) => `Drop Rate: ${ctx.parsed.y} drops/min`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: 'JetBrains Mono', size: 11 }, maxTicksLimit: 8 }
            },
            y: {
              beginAtZero: true,
              suggestedMax: 50,
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { family: 'JetBrains Mono', size: 11 },
                stepSize: 10
              },
              title: {
                display: true,
                text: 'drops / min',
                font: { size: 11, weight: 'bold' }
              }
            }
          }
        }
      });
    }
  } catch (err) {
    console.error("Error rendering bed chart:", err);
  }
}
