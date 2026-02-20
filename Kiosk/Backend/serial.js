const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// --- CONFIGURATION ---
// Force simulation if you don't have hardware connected right now
const FORCE_SIMULATION = false;
const ESP32_ENABLED = process.env.ESP32_ENABLED !== "false";
const PORT_PATH = process.env.ESP32_SERIAL_PORT || "COM3";
const BAUD_RATE = Number(process.env.ESP32_BAUD_RATE) || 115200;
const BASE_RECONNECT_DELAY_MS =
  Number(process.env.ESP32_RETRY_DELAY_MS) || 2000;
const MAX_RECONNECT_DELAY_MS =
  Number(process.env.ESP32_RETRY_MAX_DELAY_MS) || 10000;

let port = null;
let parser = null;
let isSimulationMode = false;
let globalCallback = null; // We save the callback here so we can restart it later
let simulationInterval = null;
let isScanning = false;
let autoStopTimer = null;
let stopCallback = null; // Callback when scan stops
let rfidSimulationTimer = null;
let reconnectTimer = null;
let reconnectAttempt = 0;

function attachParserListener() {
  if (!parser || !globalCallback) return;

  parser.removeAllListeners("data");
  parser.on("data", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      // ESP32 sends JSON format: {"event":"rfid_scan","uid":"..."}
      const parsed = JSON.parse(trimmed);

      if (parsed.event === "rfid_scan") {
        const uid = parsed.uid;
        console.log(`[HARDWARE] 🔖 RFID Scanned: ${uid}`);
        // Auto-enable scanning since ESP32 starts vitals immediately after RFID
        isScanning = true;
        globalCallback({ type: "login", uid });
        return;
      }

      if (parsed.event === "vitals_progress") {
        if (!isScanning) return;
        console.log(
          `[HARDWARE] 📊 Vitals progress: ${parsed.temperature}°C, ${parsed.heartRate} BPM, ${(parsed.progress * 100).toFixed(0)}%`,
        );
        globalCallback({
          type: "vitals",
          data: {
            temp: parsed.temperature,
            bpm: parsed.heartRate,
            progress: parsed.progress,
          },
        });
        return;
      }

      if (parsed.event === "vitals_data") {
        if (!isScanning) return;
        console.log(
          `[HARDWARE] ❤️  Vitals: ${parsed.temperature}°C, ${parsed.heartRate} BPM`,
        );
        // Send as progress update first with 100% progress
        globalCallback({
          type: "vitals",
          data: {
            temp: parsed.temperature,
            bpm: parsed.heartRate,
            progress: parsed.progress || 1.0, // ESP32 sends 1.0, ensure frontend shows 100%
          },
        });
        // ESP32 sends vitals_data as final averaged result - signal completion
        console.log(
          "[HARDWARE] ✅ ESP32 vitals reading complete, signaling completion",
        );
        isScanning = false;
        globalCallback({
          type: "vitals_complete",
          data: {
            temp: parsed.temperature,
            bpm: parsed.heartRate,
          },
        });
        return;
      }

      if (parsed.event === "emergency_button") {
        console.log("[HARDWARE] 🚨 Emergency button pressed!");
        globalCallback({
          type: "emergency",
          source: "physical_button",
          data: parsed,
        });
        return;
      }

      if (parsed.event === "dispense_complete") {
        console.log(`[HARDWARE] 💊 Dispense complete - Slot ${parsed.slot}`);
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
          globalCallback({ type: "login", uid });
        }
        return;
      }

      if (trimmed.startsWith("VITALS:")) {
        if (!isScanning) return;
        const jsonPayload = trimmed.slice("VITALS:".length).trim();
        try {
          const json = JSON.parse(jsonPayload);
          globalCallback({ type: "vitals", data: json });
        } catch (e) {
          console.error("Bad VITALS payload:", jsonPayload);
        }
        return;
      }

      if (trimmed.startsWith("EMERGENCY:")) {
        const payload = trimmed.slice("EMERGENCY:".length).trim();
        console.log("[HARDWARE] 🚨 Emergency button pressed");
        globalCallback({
          type: "emergency",
          source: "physical_button",
          data: payload,
        });
        return;
      }

      console.log("[HARDWARE] 📡 Raw:", trimmed);
    }
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(reason) {
  if (FORCE_SIMULATION || !ESP32_ENABLED) return;
  if (reconnectTimer) return;

  reconnectAttempt += 1;
  const delay = Math.min(
    MAX_RECONNECT_DELAY_MS,
    BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt - 1),
  );

  console.log(
    `[HARDWARE] 🔁 Reconnecting to ESP32 in ${delay}ms (${reason})`,
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToESP32();
  }, delay);
}

function connectToESP32() {
  if (FORCE_SIMULATION || !ESP32_ENABLED) return;

  try {
    const nextPort = new SerialPort({
      path: PORT_PATH,
      baudRate: BAUD_RATE,
      autoOpen: false,
    });

    const nextParser = nextPort.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    nextPort.on("open", () => {
      console.log(`✅ Connected to ESP32 on ${PORT_PATH}`);
      port = nextPort;
      parser = nextParser;
      reconnectAttempt = 0;
      clearReconnectTimer();

      if (isSimulationMode) {
        stopSimulationGenerator();
        stopRFIDSimulation();
      }

      isSimulationMode = false;
      attachParserListener();
    });

    nextPort.on("error", (err) => {
      console.log(`⚠️  ESP32 Error: ${err.message}`);
      switchToSimulation();
      scheduleReconnect("error");
    });

    nextPort.on("close", () => {
      console.log("⚠️  ESP32 Connection Closed.");
      switchToSimulation();
      scheduleReconnect("close");
    });

    nextPort.open((err) => {
      if (err) {
        console.log(`⚠️  ESP32 Open Error: ${err.message}`);
        switchToSimulation();
        scheduleReconnect("open_error");
      }
    });
  } catch (err) {
    console.log("⚠️  ESP32 Start Error. Switching to SIMULATION.");
    switchToSimulation();
    scheduleReconnect("start_error");
  }
}

// 1. Try to Connect
if (!FORCE_SIMULATION && ESP32_ENABLED) {
  console.log(`✅ Attempting connection to ESP32 on ${PORT_PATH}...`);
  connectToESP32();
} else {
  console.log("⚠️  FORCE_SIMULATION is ON or ESP32 disabled.");
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
      attachParserListener();
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
    // ESP32 automatically reads vitals after RFID scan - no wake command needed
    if (!isSimulationMode && port && port.isOpen) {
      console.log("✅ [HARDWARE] Sending start_vitals to ESP32");
      // Send start_vitals command to ESP32 so it enters READING_VITALS state
      // This ensures scanning works even if called independently of RFID
      const command = JSON.stringify({ command: "start_vitals" });
      port.write(`${command}\n`);
      console.log(`📤 Sent to ESP32: ${command}`);
      // No auto-stop timer for hardware - ESP32 manages its own scan duration
    } else {
      console.log(
        "[DEBUG] In simulation mode or no port. Starting simulation generator.",
      );
      // Auto-stop timer only for simulation mode
      startAutoStopTimer();
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
    if (!isSimulationMode && port && port.isOpen) {
      console.log("✅ [HARDWARE] Sending reset to ESP32");
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

  // Set RFID LED to red (session active)
  sessionStart: () => {
    if (!isSimulationMode && port && port.isOpen) {
      const command = JSON.stringify({ command: "session_start" });
      port.write(`${command}\n`);
      console.log(`📤 Sent to ESP32: ${command}`);
      return { success: true, mode: "real_hardware" };
    } else {
      console.log(`[SIM] 🔴 Session start (RFID LED red)`);
      return { success: true, mode: "simulation" };
    }
  },

  // Set RFID LED to green (session idle)
  sessionEnd: () => {
    if (!isSimulationMode && port && port.isOpen) {
      const command = JSON.stringify({ command: "session_end" });
      port.write(`${command}\n`);
      console.log(`📤 Sent to ESP32: ${command}`);
      return { success: true, mode: "real_hardware" };
    } else {
      console.log(`[SIM] 🟢 Session end (RFID LED green)`);
      return { success: true, mode: "simulation" };
    }
  },

  // Check if in simulation mode
  isSimulation: () => {
    return isSimulationMode;
  },
};
