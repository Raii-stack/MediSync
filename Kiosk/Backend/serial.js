const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// --- CONFIGURATION ---
// Force simulation if you don't have hardware connected right now
const FORCE_SIMULATION = false;
const PORT_PATH = "COM3";

let port = null;
let parser = null;
let isSimulationMode = false;
let globalCallback = null; // We save the callback here so we can restart it later
let simulationInterval = null;
let isScanning = false;
let autoStopTimer = null;
let stopCallback = null; // Callback when scan stops
let rfidSimulationTimer = null;

// 1. Try to Connect
if (!FORCE_SIMULATION) {
  try {
    // ESP32 uses 115200 baud rate (not 9600)
    port = new SerialPort({ path: PORT_PATH, baudRate: 115200 });
    parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    console.log(`✅ Attempting connection to ESP32 on ${PORT_PATH}...`);

    // Handle Async Errors (e.g., Port opens then closes, or doesn't exist)
    port.on("error", (err) => {
      console.log(`⚠️  ESP32 Error: ${err.message}`);
      switchToSimulation();
    });

    port.on("close", () => {
      console.log("⚠️  ESP32 Connection Closed.");
      switchToSimulation();
    });
  } catch (err) {
    console.log("⚠️  ESP32 Start Error. Switching to SIMULATION.");
    isSimulationMode = true;
  }
} else {
  console.log("⚠️  FORCE_SIMULATION is ON.");
  isSimulationMode = true;
}

// 2. Helper to Start Simulation
function startSimulationGenerator(callback) {
  if (simulationInterval) clearInterval(simulationInterval); // Prevent duplicates

  console.log("[SIM] 🩺 Starting Fake Sensor Data Generator...");

  simulationInterval = setInterval(() => {
    const fakeData = {
      temp: (36.0 + Math.random()).toFixed(1),
      bpm: Math.floor(60 + Math.random() * 40),
    };

    // Print to console so you can see it working
    console.log(`[SIM] ❤️  Generated: ${JSON.stringify(fakeData)}`);

    // Send to server handler
    if (callback) {
      callback({ type: "vitals", data: fakeData });
    }
  }, 2000);
}

// Helper to simulate RFID scans (for testing without hardware)
function startRFIDSimulation(callback) {
  if (rfidSimulationTimer) return; // Already running

  console.log("[SIM] 🔖 RFID Simulator ready - Will trigger in 3 seconds...");

  rfidSimulationTimer = setTimeout(() => {
    const fakeUID = `SIM${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(8, "0")}`;
    console.log(`[SIM] 🔖 Simulating RFID scan: ${fakeUID}`);

    if (callback) {
      callback({
        type: "login",
        uid: fakeUID,
      });
    }

    rfidSimulationTimer = null;
  }, 3000);
}

function stopRFIDSimulation() {
  if (rfidSimulationTimer) {
    clearTimeout(rfidSimulationTimer);
    rfidSimulationTimer = null;
    console.log("[SIM] 🛑 Stopped RFID Simulator.");
  }
}

function stopSimulationGenerator() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("[SIM] 🛑 Stopped Fake Sensor Data Generator.");
  }
}

function clearAutoStopTimer() {
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
}

function startAutoStopTimer() {
  clearAutoStopTimer();
  autoStopTimer = setTimeout(() => {
    if (isScanning) {
      console.log("[AUTO] ⏱️  Scan auto-stopped after 35 seconds.");
      module.exports.stopScan();
      // Notify via callback that the scan completed
      if (stopCallback) {
        stopCallback();
      }
    }
  }, 35000);
}

// 3. Logic to Switch Modes Automatically
function switchToSimulation() {
  if (isSimulationMode) return; // Already in sim mode

  isSimulationMode = true;
  console.log("🔄 Switching to Simulation Mode now...");

  if (globalCallback && isScanning) {
    startSimulationGenerator(globalCallback);
  }
}

module.exports = {
  // Listen for Sensor Data
  onData: (callback) => {
    globalCallback = callback; // Save this so we can use it if error happens later

    if (!isSimulationMode && port && parser) {
      // Real Mode - Parse JSON from ESP32
      parser.on("data", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          // ESP32 sends JSON format: {"event":"rfid_scan","uid":"..."}
          const parsed = JSON.parse(trimmed);

          if (parsed.event === "rfid_scan") {
            const uid = parsed.uid;
            console.log(`[HARDWARE] 🔖 RFID Scanned: ${uid}`);
            callback({ type: "login", uid });
            return;
          }

          if (parsed.event === "vitals_data") {
            if (!isScanning) return;
            console.log(
              `[HARDWARE] ❤️  Vitals: ${parsed.temperature}°C, ${parsed.heartRate} BPM`,
            );
            callback({
              type: "vitals",
              data: {
                temp: parsed.temperature,
                bpm: parsed.heartRate,
              },
            });
            return;
          }

          if (parsed.event === "emergency_button") {
            console.log("[HARDWARE] 🚨 Emergency button pressed!");
            callback({
              type: "emergency",
              source: "physical_button",
              data: parsed,
            });
            return;
          }

          if (parsed.event === "dispense_complete") {
            console.log(
              `[HARDWARE] 💊 Dispense complete - Slot ${parsed.slot}`,
            );
            return;
          }

          if (parsed.event === "system_ready") {
            console.log("[HARDWARE] ✅ ESP32 System Ready");
            return;
          }
        } catch (e) {
          // Not JSON, try old format for backward compatibility
          if (trimmed.startsWith("LOGIN:")) {
            const uid = trimmed.slice("LOGIN:".length).trim();
            if (uid) {
              callback({ type: "login", uid });
            }
            return;
          }

          if (trimmed.startsWith("VITALS:")) {
            if (!isScanning) return;
            const jsonPayload = trimmed.slice("VITALS:".length).trim();
            try {
              const json = JSON.parse(jsonPayload);
              callback({ type: "vitals", data: json });
            } catch (e) {
              console.error("Bad VITALS payload:", jsonPayload);
            }
            return;
          }

          if (trimmed.startsWith("EMERGENCY:")) {
            const payload = trimmed.slice("EMERGENCY:".length).trim();
            console.log("[HARDWARE] 🚨 Emergency button pressed");
            callback({
              type: "emergency",
              source: "physical_button",
              data: payload,
            });
            return;
          }

          console.log("[HARDWARE] 📡 Raw:", trimmed);
        }
      });
      console.log("✅ Listening to Real ESP32...");
    } else {
      // Simulation Mode
      if (isScanning) {
        startSimulationGenerator(callback);
      }
      // Auto-trigger RFID simulation in simulation mode
      startRFIDSimulation(callback);
    }
  },

  // Send Dispense Command - ESP32 expects JSON format
  dispense: (servoId) => {
    if (!isSimulationMode && port && port.isOpen) {
      const command = JSON.stringify({ command: "dispense", slot: servoId });
      port.write(`${command}\n`);
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      console.log(`[SIM] 💊 Dispensing Servo ${servoId} (Fake Motor Move)`);
    }
  },

  // Start/Stop Sensor Scanning
  startScan: () => {
    console.log(
      "[DEBUG] startScan called. isSimulationMode:",
      isSimulationMode,
      "globalCallback exists:",
      !!globalCallback,
    );
    isScanning = true;
    startAutoStopTimer();
    // ESP32 automatically reads vitals after RFID scan - no wake command needed
    if (!isSimulationMode && port && port.isOpen) {
      console.log(
        "✅ [HARDWARE] ESP32 is reading vitals (triggered by RFID scan)",
      );
      // No command needed - ESP32 auto-starts after RFID
    } else {
      console.log(
        "[DEBUG] In simulation mode or no port. Starting simulation generator.",
      );
      if (globalCallback) {
        startSimulationGenerator(globalCallback);
      } else {
        console.error(
          "[ERROR] globalCallback is null! Cannot start simulation.",
        );
      }
    }
  },

  stopScan: () => {
    console.log("[DEBUG] stopScan called");
    isScanning = false;
    clearAutoStopTimer();
    // ESP32 automatically stops after 5 seconds or when vitals complete
    if (!isSimulationMode && port && port.isOpen) {
      console.log("✅ [HARDWARE] ESP32 will auto-stop after vitals complete");
      // Send reset command to put ESP32 back to IDLE state
      const command = JSON.stringify({ command: "reset" });
      port.write(command + "\n");
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      stopSimulationGenerator();
    }
  },

  // Register callback for when scan stops
  onStop: (callback) => {
    stopCallback = callback;
  },

  // Manually trigger RFID simulation (for testing without hardware)
  simulateRFID: (uid = null) => {
    if (!globalCallback) {
      console.error("[ERROR] Cannot simulate RFID - no callback registered");
      return false;
    }

    const fakeUID =
      uid ||
      `SIM${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(8, "0")}`;
    console.log(`[SIM] 🔖 Manual RFID simulation: ${fakeUID}`);

    globalCallback({
      type: "login",
      uid: fakeUID,
    });

    return true;
  },

  // Send fake RFID command to real ESP32 (triggers vitals reading)
  sendFakeRFIDToESP32: (uid = null) => {
    const fakeUID =
      uid ||
      `TEST${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(8, "0")}`;

    if (!isSimulationMode && port && port.isOpen) {
      const command = JSON.stringify({
        command: "simulate_rfid",
        uid: fakeUID,
      });
      port.write(`${command}\n`);
      console.log(`📤 Sent fake RFID to ESP32: ${command}`);
      return { success: true, uid: fakeUID, mode: "real_hardware" };
    } else {
      console.log(`[SIM] 🔖 Fake RFID in simulation mode: ${fakeUID}`);
      if (globalCallback) {
        globalCallback({
          type: "login",
          uid: fakeUID,
        });
      }
      return { success: true, uid: fakeUID, mode: "simulation" };
    }
  },

  // Start blinking heart rate LED (sensor prompt)
  blinkHeartLED: () => {
    if (!isSimulationMode && port && port.isOpen) {
      const command = JSON.stringify({ command: "blink_heart_led" });
      port.write(`${command}\n`);
      console.log(`📤 Sent to ESP32: ${command}`);
      return { success: true, mode: "real_hardware" };
    } else {
      console.log(`[SIM] 💡 LED blinking in simulation mode`);
      return { success: true, mode: "simulation" };
    }
  },

  // Stop blinking heart rate LED
  stopBlinkLED: () => {
    if (!isSimulationMode && port && port.isOpen) {
      const command = JSON.stringify({ command: "stop_blink_led" });
      port.write(`${command}\n`);
      console.log(`📤 Sent to ESP32: ${command}`);
      return { success: true, mode: "real_hardware" };
    } else {
      console.log(`[SIM] 💡 Stop LED blinking in simulation mode`);
      return { success: true, mode: "simulation" };
    }
  },
};
