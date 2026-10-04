"""
esp32_simulator.py
------------------
Simulates multiple ESP32 bedside units sending real-time IV drip telemetry
to the Flask backend over HTTP REST API.

Use this script to test the backend, database, predictions, and alerts
before connecting the physical ESP32 hardware.

Simulated Beds:
- BED-01: NORMAL Flow (~30 drops/min), fluid volume gradually draining
- BED-02: LOW FLOW (~7 drops/min), fluid draining very slowly
- BED-03: CRITICAL / STOPPED (0 drops/min), fluid not draining
"""

import time
import random
import requests

# Target endpoint of the Flask backend
API_URL = "http://127.0.0.1:5000/api/drip-data"

# Initial states for the simulated hospital beds
beds_state = [
    {
        "bed_id": "BED-01",
        "drop_rate": 30,          # Normal flow (>= 10)
        "current_volume": 450.0,  # Starts at 450 mL
        "bottle_capacity": 500.0,
        "mode": "NORMAL"
    },
    {
        "bed_id": "BED-02",
        "drop_rate": 7,           # Low flow (0 < rate < 10)
        "current_volume": 180.0,  # Starts at 180 mL
        "bottle_capacity": 500.0,
        "mode": "LOW_FLOW"
    },
    {
        "bed_id": "BED-03",
        "drop_rate": 0,           # Critical flow stopped (= 0)
        "current_volume": 320.0,  # Starts at 320 mL
        "bottle_capacity": 500.0,
        "mode": "CRITICAL"
    }
]


def run_simulator():
    print("==================================================")
    print("     SMART IV DRIP MONITOR - ESP32 SIMULATOR      ")
    print("==================================================")
    print(f"Target Server: {API_URL}")
    print("Simulating 3 hospital beds (BED-01, BED-02, BED-03)")
    print("Press Ctrl + C to stop the simulation anytime.")
    print("==================================================\n")

    cycle_count = 1

    while True:
        print(f"\n--- [Cycle #{cycle_count}] Sending Bed Telemetry ---")

        for bed in beds_state:
            # 1. Simulate minor real-world variations & fluid drainage
            if bed["mode"] == "NORMAL":
                # Fluctuates slightly between 28 and 33 drops/min
                bed["drop_rate"] = random.randint(28, 33)
                # Drains roughly 0.1 to 0.2 mL per simulation tick
                bed["current_volume"] = max(0.0, round(bed["current_volume"] - 0.2, 1))

            elif bed["mode"] == "LOW_FLOW":
                # Fluctuates between 6 and 8 drops/min
                bed["drop_rate"] = random.randint(6, 8)
                # Drains very slowly
                bed["current_volume"] = max(0.0, round(bed["current_volume"] - 0.05, 1))

            elif bed["mode"] == "CRITICAL":
                # Flow completely stopped
                bed["drop_rate"] = 0
                # Fluid volume does not decrease

            # 2. Prepare payload matching the exact ESP32 JSON schema
            payload = {
                "bed_id": bed["bed_id"],
                "drop_rate": bed["drop_rate"],
                "current_volume": bed["current_volume"],
                "bottle_capacity": bed["bottle_capacity"]
            }

            # 3. Send HTTP POST request to Flask
            try:
                response = requests.post(API_URL, json=payload, timeout=5)
                if response.status_code == 200:
                    res_json = response.json()
                    print(f"[{bed['bed_id']}] -> Sent: Rate={bed['drop_rate']} dpm, Vol={bed['current_volume']} mL | Response: {res_json['status']} ({res_json['message']})")
                else:
                    print(f"[{bed['bed_id']}] -> HTTP Error {response.status_code}: {response.text}")

            except requests.exceptions.ConnectionError:
                print(f"[{bed['bed_id']}] -> Connection Error: Is the Flask backend running on {API_URL}?")
            except Exception as err:
                print(f"[{bed['bed_id']}] -> Error: {err}")

            # Small 0.5s pause between individual bed transmissions
            time.sleep(0.5)

        cycle_count += 1
        # Wait 2.5 seconds before starting the next reporting cycle
        time.sleep(2.5)


if __name__ == "__main__":
    try:
        run_simulator()
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.")
