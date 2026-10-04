import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

import database
from prediction import determine_status, calculate_predictions

# Determine template and static directory paths dynamically so the app works regardless of current working directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Initialize Flask application with custom template and static folders
app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

# Enable Cross-Origin Resource Sharing (CORS) so web dashboards can interact seamlessly
CORS(app)

# Automatically initialize database and tables on startup
database.init_db()


# =============================================================================
# NURSE DASHBOARD WEB PAGE ROUTE
# =============================================================================
@app.route("/", methods=["GET"])
def index():
    """
    Renders the responsive Central Nurse Station Web Dashboard.
    """
    return render_template("dashboard.html")


# =============================================================================
# HEALTH CHECK ENDPOINT
# =============================================================================
@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Verification endpoint to confirm backend server is up and responsive.
    """
    return jsonify({
        "status": "running",
        "service": "Smart IV Drip Monitor Backend"
    }), 200


# =============================================================================
# ESP32 TELEMETRY INGESTION ENDPOINT
# =============================================================================
@app.route("/api/drip-data", methods=["POST"])
def receive_drip_data():
    """
    Primary ingestion endpoint for ESP32 bedside units.
    Expects JSON payload:
    {
        "bed_id": "BED-01",
        "drop_rate": 30,
        "current_volume": 320,
        "bottle_capacity": 500
    }
    """
    # 1. Ensure JSON payload is present
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "Missing or invalid JSON body. Content-Type must be application/json."
        }), 400

    # 2. Extract and validate required fields
    bed_id = data.get("bed_id")
    drop_rate = data.get("drop_rate")
    current_volume = data.get("current_volume")
    bottle_capacity = data.get("bottle_capacity")

    if not bed_id or not isinstance(bed_id, str) or not bed_id.strip():
        return jsonify({
            "success": False,
            "error": "Missing or invalid 'bed_id'. Must be a non-empty string."
        }), 400

    bed_id = bed_id.strip()

    # Validate drop_rate
    if drop_rate is None or not isinstance(drop_rate, (int, float)) or drop_rate < 0:
        return jsonify({
            "success": False,
            "error": "Invalid 'drop_rate'. Must be a non-negative number."
        }), 400

    # Validate current_volume
    if current_volume is None or not isinstance(current_volume, (int, float)) or current_volume < 0:
        return jsonify({
            "success": False,
            "error": "Invalid 'current_volume'. Must be a non-negative number."
        }), 400

    # Validate bottle_capacity
    if bottle_capacity is None or not isinstance(bottle_capacity, (int, float)) or bottle_capacity <= 0:
        return jsonify({
            "success": False,
            "error": "Invalid 'bottle_capacity'. Must be greater than 0."
        }), 400

    # 3. Calculate infusion status and predictive metrics
    status, message = determine_status(drop_rate)
    remaining_percent, estimated_empty_minutes = calculate_predictions(
        drop_rate=drop_rate,
        current_volume=current_volume,
        bottle_capacity=bottle_capacity
    )

    # 4. Update SQLite database
    try:
        # Update or insert bed telemetry (updates only this specific bed)
        database.upsert_bed(
            bed_id=bed_id,
            current_volume=current_volume,
            bottle_capacity=bottle_capacity,
            drop_rate=drop_rate,
            status=status,
            remaining_percent=remaining_percent,
            estimated_empty_minutes=estimated_empty_minutes
        )

        # Record this measurement into historical readings
        database.insert_reading(
            bed_id=bed_id,
            drop_rate=drop_rate,
            current_volume=current_volume,
            status=status
        )

        # 5. Check and record alerts for abnormal flow states
        if status in ("CRITICAL", "LOW_FLOW"):
            # Prevent duplicate spam by enforcing cooldown / status change check
            if database.should_create_alert(bed_id, status, cooldown_seconds=60):
                database.create_alert(bed_id, status, message)

    except Exception as db_err:
        return jsonify({
            "success": False,
            "error": f"Database operation failed: {str(db_err)}"
        }), 500

    # 6. Structured console logging
    print("\n[ESP32 DATA]")
    print(f"Bed: {bed_id}")
    print(f"Drop Rate: {drop_rate} drops/min")
    print(f"Volume: {current_volume} mL")
    print(f"Status: {status}")
    if estimated_empty_minutes is not None:
        print(f"Estimated Empty: {estimated_empty_minutes} minutes")
    else:
        print("Estimated Empty: N/A (Flow stopped)")

    if status == "CRITICAL":
        print(f"[ALERT]\n{bed_id} - IV FLOW STOPPED")
    elif status == "LOW_FLOW":
        print(f"[ALERT]\n{bed_id} - IV FLOW SLOWER THAN EXPECTED")

    # 7. Return response to ESP32
    return jsonify({
        "success": True,
        "bed_id": bed_id,
        "status": status,
        "message": message
    }), 200


# =============================================================================
# NURSE DASHBOARD API ENDPOINTS
# =============================================================================

@app.route("/api/beds", methods=["GET"])
def get_beds():
    """
    Returns the latest status of all hospital beds.
    """
    try:
        beds = database.get_all_beds()
        return jsonify(beds), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/beds/<bed_id>", methods=["GET"])
def get_bed_detail(bed_id):
    """
    Returns latest telemetry for a single bed.
    """
    try:
        bed = database.get_bed(bed_id)
        if bed:
            return jsonify(bed), 200
        return jsonify({"success": False, "error": f"Bed '{bed_id}' not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/readings/<bed_id>", methods=["GET"])
def get_bed_readings(bed_id):
    """
    Returns the latest 30 readings for a bed (useful for graphing drip rate over time).
    """
    try:
        readings = database.get_recent_readings(bed_id, limit=30)
        return jsonify(readings), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    """
    Returns recent alerts generated across all hospital beds.
    """
    try:
        alerts = database.get_recent_alerts(limit=50)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/alerts/<int:alert_id>/acknowledge", methods=["POST"])
def acknowledge_alert_endpoint(alert_id):
    """
    Allows nursing staff to acknowledge and clear an active alert.
    """
    try:
        success = database.acknowledge_alert(alert_id)
        if success:
            return jsonify({
                "success": True,
                "message": f"Alert {alert_id} acknowledged successfully."
            }), 200
        return jsonify({
            "success": False,
            "error": f"Alert ID {alert_id} not found."
        }), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =============================================================================
# APPLICATION ENTRYPOINT
# =============================================================================
if __name__ == "__main__":
    print("==================================================")
    print("       SMART IV DRIP MONITOR - FLASK BACKEND       ")
    print("==================================================")
    print(" * Service running on: http://0.0.0.0:5000")
    print(" * Accessible locally via: http://127.0.0.1:5000")
    print(" * Connect real ESP32 using your PC's Wi-Fi IP address")
    print("==================================================")
    # host='0.0.0.0' allows external devices (ESP32) on the same Wi-Fi network to connect
    app.run(host="0.0.0.0", port=5000, debug=True)
