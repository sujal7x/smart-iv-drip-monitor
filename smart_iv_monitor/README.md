# Smart IV Drip Monitor for Hospitals - Flask Backend

A lightweight, reliable, beginner-friendly IoT backend built using **Python, Flask, and SQLite** for a college / Aavishkar engineering prototype.

The backend acts as the central telemetry server receiving real-time IV drip data from bedside ESP32 controllers, calculating flow statuses, estimating remaining infusion times, managing alerts, and providing REST APIs for future nurse dashboard integration.

---

## 1. System Architecture

```text
             IV DROP
                ↓
          IR/OPTICAL SENSOR
                ↓
              ESP32
                ↓
           Wi-Fi (HTTP)
                ↓
        Flask REST API
                ↓
             SQLite
                ↓
        Prediction + Alerts
                ↓
        Nurse Web Dashboard (Future)
```

---

## 2. Project Directory Structure

```text
smart_iv_monitor/
│
├── backend/
│   ├── app.py              # Flask server, REST API endpoints & Dashboard route (GET /)
│   ├── database.py         # SQLite connection, tables, and CRUD operations
│   ├── prediction.py       # Status logic, volume %, and time-to-empty estimation
│   └── requirements.txt    # Python package dependencies
│
├── templates/
│   └── dashboard.html      # Responsive Nurse Station Web Dashboard
│
├── static/
│   ├── css/
│   │   └── style.css       # Clinical UI theme & status indicators
│   └── js/
│       └── dashboard.js    # Live data polling (2s), Chart.js & alert manager
│
├── simulator/
│   └── esp32_simulator.py  # Standalone multi-bed simulation script
│
├── database/
│   └── iv_monitor.db       # SQLite database (auto-generated on first run)
│
└── README.md               # Complete setup, API, and testing documentation
```

---

## 3. Installation & Quick Start

### Step 1: Open Terminal & Navigate to Project
```bash
cd "smart_iv_monitor"
```

### Step 2: Install Python Dependencies
```bash
pip install -r backend/requirements.txt
```
*(Dependencies: `Flask`, `flask-cors`, `requests`)*

### Step 3: Run the Flask Backend
```bash
python backend/app.py
```
When running, you will see:
```text
==================================================
       SMART IV DRIP MONITOR - FLASK BACKEND       
==================================================
 * Service running on: http://0.0.0.0:5000
 * Accessible locally via: http://127.0.0.1:5000
 * Connect real ESP32 using your PC's Wi-Fi IP address
==================================================
```

### Step 4: Verify Backend Health
Open your web browser or run curl:
[http://127.0.0.1:5000/api/health](http://127.0.0.1:5000/api/health)

Response:
```json
{
  "service": "Smart IV Drip Monitor Backend",
  "status": "running"
}
```

### Step 5: Open Central Nurse Station Web Dashboard
Open your web browser and visit:
👉 **[http://127.0.0.1:5000/](http://127.0.0.1:5000/)**

The dashboard will open, display the live beds (BED-01, BED-02, BED-03), and automatically sync every 2 seconds.

---

## 4. Testing with the ESP32 Simulator

You can test the entire backend without touching physical hardware by running the simulator in a separate terminal:

```bash
python simulator/esp32_simulator.py
```

### What the Simulator Does:
- **`BED-01`**: Simulates **NORMAL** flow (~30 drops/min), fluid volume draining continuously.
- **`BED-02`**: Simulates **LOW FLOW** (~7 drops/min), fluid draining very slowly.
- **`BED-03`**: Simulates **CRITICAL / STOPPED** (0 drops/min), fluid not moving.

The simulator sends data every 2–3 seconds and prints responses directly to the terminal.

---

## 5. How Real ESP32 Communicates with Flask

In the physical setup, your ESP32 and your computer must be connected to the **same Wi-Fi network**.

```text
Computer running Flask (e.g., 192.168.1.105:5000)
        ↑
        │ Wi-Fi / HTTP POST
        │
      ESP32 Bedside Unit
```

### Finding Your Computer's Local IP:
1. Open Command Prompt (`cmd`) or PowerShell on Windows.
2. Type `ipconfig` and press Enter.
3. Locate **IPv4 Address** under your active Wi-Fi adapter (e.g., `192.168.1.105`).
4. In your ESP32 Arduino code, set the server URL:
   ```cpp
   const char* serverUrl = "http://192.168.1.105:5000/api/drip-data";
   ```
*(Do NOT use `127.0.0.1` or `localhost` inside ESP32 code, because localhost on the ESP32 refers to the ESP32 chip itself!)*

---

## 6. REST API Reference

### 1. Ingest Telemetry (ESP32 Endpoint)
- **Method**: `POST`
- **Path**: `/api/drip-data`
- **Content-Type**: `application/json`

#### Request Body Example:
```json
{
  "bed_id": "BED-01",
  "drop_rate": 30,
  "current_volume": 320,
  "bottle_capacity": 500
}
```

#### Successful Response (`200 OK`):
```json
{
  "success": true,
  "bed_id": "BED-01",
  "status": "NORMAL",
  "message": "IV flow normal"
}
```

#### Error Response Example (`400 Bad Request`):
```json
{
  "success": false,
  "error": "Invalid 'drop_rate'. Must be a non-negative number."
}
```

---

### 2. Get All Beds Status (Nurse Dashboard)
- **Method**: `GET`
- **Path**: `/api/beds`

#### Response Example:
```json
[
  {
    "id": 1,
    "bed_id": "BED-01",
    "drop_rate": 30.0,
    "current_volume": 320.0,
    "bottle_capacity": 500.0,
    "status": "NORMAL",
    "remaining_percent": 64.0,
    "estimated_empty_minutes": 213.3,
    "last_updated": "2026-10-04 07:35:00"
  },
  {
    "id": 2,
    "bed_id": "BED-02",
    "drop_rate": 7.0,
    "current_volume": 180.0,
    "bottle_capacity": 500.0,
    "status": "LOW_FLOW",
    "remaining_percent": 36.0,
    "estimated_empty_minutes": 514.3,
    "last_updated": "2026-10-04 07:35:01"
  }
]
```

---

### 3. Get Single Bed Detail
- **Method**: `GET`
- **Path**: `/api/beds/<bed_id>` (e.g., `/api/beds/BED-01`)

---

### 4. Get Bed Historical Readings (For Graphs)
- **Method**: `GET`
- **Path**: `/api/readings/<bed_id>` (e.g., `/api/readings/BED-01`)
- **Description**: Returns the latest 30 readings in chronological order to plot real-time drip rate trends.

---

### 5. Get Recent Alerts
- **Method**: `GET`
- **Path**: `/api/alerts`
- **Description**: Returns the latest 50 alerts across all hospital beds.

#### Response Example:
```json
[
  {
    "id": 3,
    "bed_id": "BED-03",
    "alert_type": "CRITICAL",
    "message": "IV flow stopped",
    "timestamp": "2026-10-04 07:35:05",
    "acknowledged": false
  }
]
```

---

### 6. Acknowledge Alert
- **Method**: `POST`
- **Path**: `/api/alerts/<alert_id>/acknowledge`

#### Response Example:
```json
{
  "success": true,
  "message": "Alert 3 acknowledged successfully."
}
```

---

## 7. Mathematical Prediction Model

Implemented in `prediction.py`:
- **Drop Volume Standard**: $1\text{ drop} \approx 0.05\text{ mL}$ ($20\text{ drops} = 1\text{ mL}$).
- **Flow Rate**:
  $$\text{Flow Rate (mL/min)} = \text{drop\_rate} \times 0.05$$
- **Estimated Minutes to Empty**:
  $$\text{Time to Empty (min)} = \frac{\text{current\_volume}}{\text{Flow Rate (mL/min)}}$$
- **If Flow Stops ($\text{drop\_rate} = 0$)**:
  `estimated_empty_minutes = None`

> [!NOTE]
> This mathematical calculation is intended strictly for student demonstration in an academic prototype and is not a clinical medical algorithm.

---

## 8. Anti-Spam Intelligent Alerting

When an IV drip stops or slows down, the ESP32 sends telemetry every few seconds. To prevent filling the database and overwhelming the nurse station with hundreds of identical alerts:
1. An alert is created **immediately** when the status transitions (e.g., from `NORMAL` to `CRITICAL`).
2. If the problem persists under the same condition, a **60-second cooldown** prevents duplicate alerts from being created on every incoming HTTP packet.
