const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// --- CONFIGURATION ---
// Force simulation if you don't have hardware connected right now
const FORCE_SIMULATION = false; 
const PORT_PATH = 'COM3'; 

let port = null;
let parser = null;
let isSimulationMode = false;
let globalCallback = null; // We save the callback here so we can restart it later
let simulationInterval = null;
let isScanning = false;
let autoStopTimer = null;
let stopCallback = null; // Callback when scan stops

// 1. Try to Connect
if (!FORCE_SIMULATION) {
  try {
    port = new SerialPort({ path: PORT_PATH, baudRate: 9600 });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    
    console.log(`✅ Attempting connection to ESP32 on ${PORT_PATH}...`);

    // Handle Async Errors (e.g., Port opens then closes, or doesn't exist)
    port.on('error', (err) => {
      console.log(`⚠️  ESP32 Error: ${err.message}`);
      switchToSimulation();
    });

    port.on('close', () => {
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
      bpm: Math.floor(60 + Math.random() * 40) 
    };

    // Print to console so you can see it working
    console.log(`[SIM] ❤️  Generated: ${JSON.stringify(fakeData)}`);
    
    // Send to server handler
    if (callback) {
      callback({ type: 'vitals', data: fakeData });
    }
  }, 2000);
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
      console.log('[AUTO] ⏱️  Scan auto-stopped after 35 seconds.');
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
      // Real Mode
      parser.on('data', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('LOGIN:')) {
          const uid = trimmed.slice('LOGIN:'.length).trim();
          if (uid) {
            callback({ type: 'login', uid });
          }
          return;
        }

        if (trimmed.startsWith('VITALS:')) {
          if (!isScanning) return;
          const jsonPayload = trimmed.slice('VITALS:'.length).trim();
          try {
            const json = JSON.parse(jsonPayload);
            callback({ type: 'vitals', data: json });
          } catch (e) {
            console.error('Bad VITALS payload:', jsonPayload);
          }
          return;
        }
      });
      console.log("✅ Listening to Real ESP32...");
    } else {
      // Simulation Mode (Wait for START_SCAN)
      if (isScanning) {
        startSimulationGenerator(callback);
      }
    }
  },

  // Send Dispense Command
  dispense: (servoId) => {
    if (!isSimulationMode && port) {
      const command = `DISPENSE:${servoId}`;
      port.write(`${command}\n`);
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      console.log(`[SIM] 💊 Dispensing Servo ${servoId} (Fake Motor Move)`);
    }
  },

  // Start/Stop Sensor Scanning
  startScan: () => {
    console.log('[DEBUG] startScan called. isSimulationMode:', isSimulationMode, 'globalCallback exists:', !!globalCallback);
    isScanning = true;
    startAutoStopTimer();
    if (!isSimulationMode && port) {
      const command = JSON.stringify({ action: 'wake' });
      port.write(command + '\n');
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      console.log('[DEBUG] In simulation mode or no port. Starting simulation generator.');
      if (globalCallback) {
        startSimulationGenerator(globalCallback);
      } else {
        console.error('[ERROR] globalCallback is null! Cannot start simulation.');
      }
    }
  },

  stopScan: () => {
    console.log('[DEBUG] stopScan called');
    isScanning = false;
    clearAutoStopTimer();
    if (!isSimulationMode && port) {
      const command = JSON.stringify({ action: 'sleep' });
      port.write(command + '\n');
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      stopSimulationGenerator();
    }
  },

  // Register callback for when scan stops
  onStop: (callback) => {
    stopCallback = callback;
  }
};