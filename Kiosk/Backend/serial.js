const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// --- CONFIGURATION ---
// Force simulation if you don't have hardware connected right now
const FORCE_SIMULATION = true; 
const PORT_PATH = 'COM3'; 

let port = null;
let parser = null;
let isSimulationMode = false;
let globalCallback = null; // We save the callback here so we can restart it later
let simulationInterval = null;
let isScanning = false;

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
    
    // Send to Frontend
    if (callback) callback(fakeData);
  }, 2000);
}

function stopSimulationGenerator() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("[SIM] 🛑 Stopped Fake Sensor Data Generator.");
  }
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
        if (!isScanning) return;
        try {
          const json = JSON.parse(line);
          callback(json);
        } catch (e) { console.error("Bad Serial Data"); }
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
      const command = JSON.stringify({ action: 'dispense', servo: servoId });
      port.write(command + '\n');
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      console.log(`[SIM] 💊 Dispensing Servo ${servoId} (Fake Motor Move)`);
    }
  },

  // Start/Stop Sensor Scanning
  startScan: () => {
    console.log('[DEBUG] startScan called. isSimulationMode:', isSimulationMode, 'globalCallback exists:', !!globalCallback);
    isScanning = true;
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
    if (!isSimulationMode && port) {
      const command = JSON.stringify({ action: 'sleep' });
      port.write(command + '\n');
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      stopSimulationGenerator();
    }
  }
};