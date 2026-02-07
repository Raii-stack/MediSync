const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// CONFIGURATION: Check your PC's Device Manager for the correct port if actually connecting an ESP32
// Windows: 'COM3' or 'COM4'
// Mac/Linux/Pi: '/dev/ttyUSB0' or '/dev/ttyACM0'
const PORT_PATH = 'COM3'; 

let port = null;
let parser = null;
let isSimulationMode = false;

// Try to initialize serial connection
try {
  port = new SerialPort({ path: PORT_PATH, baudRate: 9600 });
  parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
  console.log(`✅ Connected to ESP32 on ${PORT_PATH}`);
} catch (err) {
  console.log("⚠️  ESP32 NOT FOUND. Switching to SIMULATION MODE.");
  isSimulationMode = true;
  port = null;
  parser = null;
}

// Handle async errors on port
if (port) {
  port.on('error', (err) => {
    console.log("⚠️  ESP32 connection lost. Switching to SIMULATION MODE.");
    isSimulationMode = true;
    port = null;
    parser = null;
  });
}


module.exports = {
  // 1. Listen for Sensor Data
  onData: (callback) => {
    if (!isSimulationMode && port && parser) {
      // Real Mode: Listen to ESP32
      parser.on('data', (line) => {
        try {
          const json = JSON.parse(line);
          callback(json);
        } catch (e) { console.error("Bad Serial Data"); }
      });
    } else {
      // Simulation Mode: Generate fake heartbeat/temp every second
      console.log("[SIM] 🩺 Generating fake sensor data...");
      setInterval(() => {
        const fakeData = {
          temp: (36.0 + Math.random()).toFixed(1), // Random temp 36.0 - 37.0
          bpm: Math.floor(60 + Math.random() * 40) // Random BPM 60 - 100
        };
        callback(fakeData);
      }, 2000);
    }
  },

  // 2. Send Dispense Command
  dispense: (servoId) => {
    if (!isSimulationMode && port) {
      // Real Mode
      const command = JSON.stringify({ action: 'dispense', servo: servoId });
      port.write(command + '\n');
      console.log(`📤 Sent to ESP32: ${command}`);
    } else {
      // Simulation Mode
      console.log(`[SIM] -------------------------`);
      console.log(`[SIM] 💊 MOTOR MOVING: SERVO ${servoId}`);
      console.log(`[SIM] -------------------------`);
    }
  }
};

