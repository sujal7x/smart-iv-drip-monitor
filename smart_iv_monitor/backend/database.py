"""
database.py
-----------
SQLite database management module for the Smart IV Drip Monitor.
Handles initialization, beds upsert, historical readings, and intelligent alerting.
"""

import os
import sqlite3
import datetime

# Determine project paths dynamically
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(BASE_DIR, "database")
DB_PATH = os.path.join(DB_DIR, "iv_monitor.db")


def get_connection():
    """
    Creates and returns a connection to the SQLite database.
    Uses sqlite3.Row for convenient column access by name.
    """
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Creates required database tables (beds, readings, alerts) if they do not exist.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Beds Table: Stores latest status of each hospital bed
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS beds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bed_id TEXT UNIQUE NOT NULL,
        current_volume REAL NOT NULL,
        bottle_capacity REAL NOT NULL,
        drop_rate REAL NOT NULL,
        status TEXT NOT NULL,
        remaining_percent REAL NOT NULL,
        estimated_empty_minutes REAL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Readings Table: Stores historical telemetry for graphs/charts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bed_id TEXT NOT NULL,
        drop_rate REAL NOT NULL,
        current_volume REAL NOT NULL,
        status TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Alerts Table: Stores critical events and nurse notifications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bed_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged INTEGER DEFAULT 0
    );
    """)

    conn.commit()
    conn.close()


def upsert_bed(bed_id, current_volume, bottle_capacity, drop_rate, status, remaining_percent, estimated_empty_minutes):
    """
    Inserts a new bed record or updates the existing bed with the latest reading.
    Ensures that data for other beds is never overwritten.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO beds (bed_id, current_volume, bottle_capacity, drop_rate, status, remaining_percent, estimated_empty_minutes, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(bed_id) DO UPDATE SET
        current_volume = excluded.current_volume,
        bottle_capacity = excluded.bottle_capacity,
        drop_rate = excluded.drop_rate,
        status = excluded.status,
        remaining_percent = excluded.remaining_percent,
        estimated_empty_minutes = excluded.estimated_empty_minutes,
        last_updated = CURRENT_TIMESTAMP;
    """, (bed_id, current_volume, bottle_capacity, drop_rate, status, remaining_percent, estimated_empty_minutes))

    conn.commit()
    conn.close()


def insert_reading(bed_id, drop_rate, current_volume, status):
    """
    Stores an individual time-stamped reading in the readings table for telemetry history.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO readings (bed_id, drop_rate, current_volume, status, timestamp)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
    """, (bed_id, drop_rate, current_volume, status))

    conn.commit()
    conn.close()


def get_all_beds():
    """
    Retrieves the latest status of all registered beds.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM beds ORDER BY bed_id ASC;")
    rows = cursor.fetchall()
    conn.close()

    beds = []
    for row in rows:
        beds.append({
            "id": row["id"],
            "bed_id": row["bed_id"],
            "current_volume": row["current_volume"],
            "bottle_capacity": row["bottle_capacity"],
            "drop_rate": row["drop_rate"],
            "status": row["status"],
            "remaining_percent": row["remaining_percent"],
            "estimated_empty_minutes": row["estimated_empty_minutes"],
            "last_updated": row["last_updated"]
        })
    return beds


def get_bed(bed_id):
    """
    Retrieves the latest status for a single bed by its bed_id.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM beds WHERE bed_id = ?;", (bed_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "id": row["id"],
            "bed_id": row["bed_id"],
            "current_volume": row["current_volume"],
            "bottle_capacity": row["bottle_capacity"],
            "drop_rate": row["drop_rate"],
            "status": row["status"],
            "remaining_percent": row["remaining_percent"],
            "estimated_empty_minutes": row["estimated_empty_minutes"],
            "last_updated": row["last_updated"]
        }
    return None


def get_recent_readings(bed_id, limit=30):
    """
    Retrieves the most recent readings for a specific bed.
    Returns them in chronological order (oldest to newest) for easy charting.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT * FROM readings
    WHERE bed_id = ?
    ORDER BY id DESC
    LIMIT ?;
    """, (bed_id, limit))
    rows = cursor.fetchall()
    conn.close()

    # Reverse so the earliest timestamp is first for graph plotting
    readings = []
    for row in reversed(rows):
        readings.append({
            "id": row["id"],
            "bed_id": row["bed_id"],
            "drop_rate": row["drop_rate"],
            "current_volume": row["current_volume"],
            "status": row["status"],
            "timestamp": row["timestamp"]
        })
    return readings


def get_recent_alerts(limit=50):
    """
    Retrieves recent alerts from the database.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT * FROM alerts
    ORDER BY id DESC
    LIMIT ?;
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()

    alerts = []
    for row in rows:
        alerts.append({
            "id": row["id"],
            "bed_id": row["bed_id"],
            "alert_type": row["alert_type"],
            "message": row["message"],
            "timestamp": row["timestamp"],
            "acknowledged": bool(row["acknowledged"])
        })
    return alerts


def acknowledge_alert(alert_id):
    """
    Marks an alert as acknowledged by a nurse.
    Returns True if an alert was updated, False if not found.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    UPDATE alerts
    SET acknowledged = 1
    WHERE id = ?;
    """, (alert_id,))
    
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def should_create_alert(bed_id, alert_type, cooldown_seconds=60):
    """
    Prevents spamming duplicate alerts every second.
    Creates a new alert only if:
    1. No previous alert exists for this bed, OR
    2. The status has changed (e.g., LOW_FLOW -> CRITICAL), OR
    3. The cooldown period (e.g., 60 seconds) has elapsed since the last alert of the same type.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT alert_type, timestamp FROM alerts
    WHERE bed_id = ?
    ORDER BY id DESC
    LIMIT 1;
    """, (bed_id,))
    last_alert = cursor.fetchone()
    conn.close()

    if not last_alert:
        return True

    last_type = last_alert["alert_type"]
    last_time_str = last_alert["timestamp"]

    # If the alert category changed, alert immediately
    if last_type != alert_type:
        return True

    # Check cooldown duration for the same alert type
    try:
        # SQLite CURRENT_TIMESTAMP format is 'YYYY-MM-DD HH:MM:SS'
        last_time = datetime.datetime.strptime(last_time_str, "%Y-%m-%d %H:%M:%S")
        now = datetime.datetime.utcnow()
        elapsed = (now - last_time).total_seconds()
        return elapsed >= cooldown_seconds
    except Exception:
        # If timestamp parsing fails, allow alert creation
        return True


def create_alert(bed_id, alert_type, message):
    """
    Inserts a new alert into the database.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO alerts (bed_id, alert_type, message, timestamp, acknowledged)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0);
    """, (bed_id, alert_type, message))

    conn.commit()
    conn.close()
