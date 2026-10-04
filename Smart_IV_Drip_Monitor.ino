/*
  =============================================================================
                     SMART IV DRIP MONITOR - PROTOTYPE V1
  =============================================================================
  Project: Low-cost IoT-based IV Drip Monitoring Prototype for Hospitals
  Target Board: ESP32 Development Board (ESP32-WROOM-32 / NodeMCU-32S)
  Author: Student Prototype for College / Aavishkar Demonstration
  
  DISCLAIMER:
  This prototype is designed strictly for educational and demonstration purposes.
  It is tested with pure water only. Do not use for clinical medication delivery,
  patient infusion control, or medical treatments.
  =============================================================================

  PIN ASSIGNMENTS:
  -----------------------------------------------------------------------------
  Component           ESP32 Pin       Connection Detail
  -----------------------------------------------------------------------------
  IR / Optical Sensor GPIO 27         Digital OUT (Detects falling drop)
  Active Buzzer       GPIO 25         Positive pin (Negative to GND)
  Green LED           GPIO 26         Anode via 220-ohm resistor (Cathode to GND)
  Red LED             GPIO 32         Anode via 220-ohm resistor (Cathode to GND)
  IR Sensor VCC       3.3V            Power input
  IR Sensor GND       GND             Common ground
  -----------------------------------------------------------------------------

  SERIAL OUTPUT EXAMPLES (At 115200 Baud):
  -----------------------------------------------------------------------------
  NORMAL CONDITION EXAMPLE:
  Drops in 10 seconds: 6
  Drip Rate: 36 drops/min
  Status: NORMAL

  LOW FLOW WARNING EXAMPLE:
  Drops in 10 seconds: 1
  Drip Rate: 6 drops/min
  Status: LOW FLOW WARNING

  CRITICAL CONDITION EXAMPLE:
  Drops in 10 seconds: 0
  Drip Rate: 0 drops/min
  Status: CRITICAL
  ALERT: IV FLOW STOPPED
  -----------------------------------------------------------------------------
*/

// =============================================================================
// PIN DEFINITIONS
// =============================================================================
const int SENSOR_PIN    = 27;  // Digital output of IR obstacle / drop sensor
const int BUZZER_PIN    = 25;  // Buzzer positive terminal
const int GREEN_LED_PIN = 26;  // Green LED (Normal flow indicator)
const int RED_LED_PIN   = 32;  // Red LED (Alert / Stoppage indicator)

// =============================================================================
// TIMING CONSTANTS & THRESHOLDS
// =============================================================================
// Measurement window: 10 seconds (10,000 milliseconds)
const unsigned long WINDOW_DURATION_MS = 10000;

// Immediate safety timeout: 15 seconds without a single drop triggers critical alert
const unsigned long NO_DROP_TIMEOUT_MS  = 15000;

// Refractory / Debounce delay: 200 ms prevents counting the same drop twice
const unsigned long DEBOUNCE_DELAY_MS   = 200;

// Minimum acceptable drip rate for normal status (drops per minute)
const int NORMAL_THRESHOLD_DPM = 10;

// =============================================================================
// VOLATILE & STATE VARIABLES
// =============================================================================
// Volatile drop counter incremented inside the Hardware Interrupt Service Routine
volatile unsigned long isrDropCount = 0;
volatile unsigned long lastDropTimestamp = 0;

// Non-blocking measurement tracking
unsigned long windowStartTime = 0;
unsigned long lastDropSeenTime = 0;
bool immediateSafetyAlertFired = false;

// Non-blocking buzzer timer
unsigned long buzzerTurnOffTime = 0;
bool isBuzzerActive = false;

// =============================================================================
// INTERRUPT SERVICE ROUTINE (ISR) FOR DROP DETECTION
// =============================================================================
// Triggered on FALLING EDGE (HIGH -> LOW) when a drop passes through the IR beam
void IRAM_ATTR onDropDetected() {
  unsigned long now = millis();
  
  // Software debounce check (Refractory window)
  if (now - lastDropTimestamp >= DEBOUNCE_DELAY_MS) {
    isrDropCount++;
    lastDropTimestamp = now;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Turn buzzer ON non-blockingly for a specified duration in milliseconds
void triggerBuzzer(unsigned long durationMs) {
  digitalWrite(BUZZER_PIN, HIGH);
  buzzerTurnOffTime = millis() + durationMs;
  isBuzzerActive = true;
}

// Update the buzzer state without blocking the CPU
void updateBuzzer() {
  if (isBuzzerActive && (millis() >= buzzerTurnOffTime)) {
    digitalWrite(BUZZER_PIN, LOW);
    isBuzzerActive = false;
  }
}

// Update LED states
void setLedStatus(bool greenState, bool redState) {
  digitalWrite(GREEN_LED_PIN, greenState ? HIGH : LOW);
  digitalWrite(RED_LED_PIN,   redState   ? HIGH : LOW);
}

// =============================================================================
// SETUP
// =============================================================================
void setup() {
  // Initialize Serial communication at 115200 baud
  Serial.begin(115200);
  delay(100); // Brief settle time for hardware UART

  // Configure output pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);

  // Default state: LEDs and buzzer OFF
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);

  // Configure IR sensor pin with internal pull-up resistor
  pinMode(SENSOR_PIN, INPUT_PULLUP);

  // Attach interrupt: detects falling edge (HIGH to LOW) when beam is interrupted
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onDropDetected, FALLING);

  // Initialize reference timestamps
  unsigned long currentMillis = millis();
  windowStartTime = currentMillis;
  lastDropSeenTime = currentMillis;
  lastDropTimestamp = currentMillis;

  // Print startup banner
  Serial.println("==================================");
  Serial.println("   SMART IV DRIP MONITOR");
  Serial.println("         PROTOTYPE V1");
  Serial.println("==================================");
  Serial.println();
  Serial.println("System Started");
  Serial.println("Waiting for IV drops...");
  Serial.println("----------------------------------");
}

// =============================================================================
// MAIN LOOP
// =============================================================================
void loop() {
  unsigned long currentMillis = millis();

  // Continuously handle non-blocking buzzer turn-off
  updateBuzzer();

  // ---------------------------------------------------------------------------
  // 1. SYNCHRONIZE DROPS FROM ISR
  // ---------------------------------------------------------------------------
  unsigned long recentDropTime = 0;
  // Safely read volatile drop timestamp
  noInterrupts();
  recentDropTime = lastDropTimestamp;
  interrupts();

  // If a new drop occurred since our last tracking update
  if (recentDropTime > lastDropSeenTime) {
    lastDropSeenTime = recentDropTime;
    immediateSafetyAlertFired = false; // Reset the 15-second safety alert flag
  }

  // ---------------------------------------------------------------------------
  // 2. IMMEDIATE 15-SECOND NO-DROP SAFETY CHECK (Requirement 10)
  // ---------------------------------------------------------------------------
  // If no drop has been detected for 15 seconds, alert immediately without
  // waiting for the 10-second measurement cycle to complete.
  if ((currentMillis - lastDropSeenTime >= NO_DROP_TIMEOUT_MS) && !immediateSafetyAlertFired) {
    immediateSafetyAlertFired = true; // Avoid re-triggering continuously

    // Immediate Alert Action: Green OFF, Red ON, Buzzer ON for 1000 ms
    setLedStatus(false, true);
    triggerBuzzer(1000);

    Serial.println("\n[IMMEDIATE SAFETY ALERT]");
    Serial.println("No drop detected for over 15 seconds!");
    Serial.println("Status: CRITICAL");
    Serial.println("ALERT: IV FLOW STOPPED");
    Serial.println("----------------------------------");
  }

  // ---------------------------------------------------------------------------
  // 3. 10-SECOND MEASUREMENT WINDOW CYCLE (Requirements 4, 5, 6, 7, 8, 9)
  // ---------------------------------------------------------------------------
  if (currentMillis - windowStartTime >= WINDOW_DURATION_MS) {
    // Atomically retrieve and reset the drop counter
    noInterrupts();
    unsigned long dropsIn10Seconds = isrDropCount;
    isrDropCount = 0; // Reset drop counter for the next 10-second cycle
    interrupts();

    // Reset window timer
    windowStartTime = currentMillis;

    // Calculate drip rate: Drip Rate (drops/min) = drops_in_10_seconds * 6
    unsigned long dripRate = dropsIn10Seconds * 6;

    // Evaluate flow conditions
    if (dropsIn10Seconds == 0) {
      // -----------------------------------------------------------------------
      // CRITICAL CONDITION: Zero drops detected in the 10-second window
      // -----------------------------------------------------------------------
      setLedStatus(false, true);  // Green OFF, Red ON
      triggerBuzzer(1000);        // Buzzer ON for approximately 1 second

      Serial.print("Drops in 10 seconds: ");
      Serial.println(dropsIn10Seconds);
      Serial.print("Drip Rate: ");
      Serial.print(dripRate);
      Serial.println(" drops/min");
      Serial.println("Status: CRITICAL");
      Serial.println("ALERT: IV FLOW STOPPED");
      Serial.println("----------------------------------");

    } else if (dripRate < NORMAL_THRESHOLD_DPM) {
      // -----------------------------------------------------------------------
      // LOW FLOW WARNING: Drops detected, but drip rate < 10 drops/min
      // -----------------------------------------------------------------------
      setLedStatus(false, true);  // Green OFF, Red ON
      triggerBuzzer(150);         // Short buzzer beep (150 ms)

      Serial.print("Drops in 10 seconds: ");
      Serial.println(dropsIn10Seconds);
      Serial.print("Drip Rate: ");
      Serial.print(dripRate);
      Serial.println(" drops/min");
      Serial.println("Status: LOW FLOW WARNING");
      Serial.println("----------------------------------");

    } else {
      // -----------------------------------------------------------------------
      // NORMAL CONDITION: Drip rate >= 10 drops/min
      // -----------------------------------------------------------------------
      setLedStatus(true, false);  // Green ON, Red OFF
      // Buzzer remains OFF for normal infusion

      Serial.print("Drops in 10 seconds: ");
      Serial.println(dropsIn10Seconds);
      Serial.print("Drip Rate: ");
      Serial.print(dripRate);
      Serial.println(" drops/min");
      Serial.println("Status: NORMAL");
      Serial.println("----------------------------------");
    }
  }
}
