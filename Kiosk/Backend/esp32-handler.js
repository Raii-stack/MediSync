/**
 * ESP32 Serial Communication Handler
 *
 * This module handles bidirectional communication with the ESP32 microcontroller
 * via UART (Serial). It processes hardware events and sends commands to control
 * the medicine dispensing system.
 */

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const EventEmitter = require("events");

class ESP32Handler extends EventEmitter {
  constructor(portPath = "/dev/ttyUSB0", baudRate = 115200) {
    super();

    this.portPath = portPath;
    this.baudRate = baudRate;
    this.port = null;
    this.parser = null;
    this.isConnected = false;

    this.lastRFID = null;
    this.lastVitals = null;
  }

  /**
   * Initialize serial connection to ESP32
   */
  async connect() {
    try {
      // List available ports for debugging
      const ports = await SerialPort.list();
      console.log(
        "Available serial ports:",
        ports.map((p) => p.path),
      );

      // Open serial port
      this.port = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        autoOpen: false,
      });

      // Create line parser
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      // Setup event handlers
      this.port.on("open", () => {
        console.log(`✅ ESP32 connected on ${this.portPath}`);
        this.isConnected = true;
        this.emit("connected");
      });

      this.port.on("error", (err) => {
        console.error("❌ Serial port error:", err.message);
        this.isConnected = false;
        this.emit("error", err);
      });

      this.port.on("close", () => {
        console.log("⚠️ ESP32 disconnected");
        this.isConnected = false;
        this.emit("disconnected");
      });

      this.parser.on("data", (data) => {
        this.handleESP32Message(data);
      });

      // Open the port
      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      console.error("Failed to connect to ESP32:", error);
      throw error;
    }
  }

  /**
   * Handle incoming messages from ESP32
   */
  handleESP32Message(data) {
    console.log("📡 ESP32 Raw:", data);

    try {
      const message = JSON.parse(data);

      switch (message.event) {
        case "system_ready":
          this.handleSystemReady();
          break;

        case "rfid_scan":
          this.handleRFIDScan(message);
          break;

        case "vitals_data":
          this.handleVitalsData(message);
          break;

        case "dispense_complete":
          this.handleDispenseComplete(message);
          break;

        case "emergency_button":
          this.handleEmergencyButton(message);
          break;

        default:
          console.warn("Unknown event from ESP32:", message.event);
      }
    } catch (err) {
      console.error("Invalid JSON from ESP32:", data);
    }
  }

  /**
   * ESP32 system ready event
   */
  handleSystemReady() {
    console.log("✅ ESP32 system ready");
    this.emit("system_ready");
  }

  /**
   * RFID card scanned event
   */
  handleRFIDScan(message) {
    const { uid, timestamp } = message;
    console.log(`🔖 RFID Scanned: ${uid}`);

    this.lastRFID = uid;
    this.emit("rfid_scan", { uid, timestamp });
  }

  /**
   * Vital signs data received
   */
  handleVitalsData(message) {
    const { temperature, heartRate, timestamp } = message;
    console.log(`❤️ Vitals - Temp: ${temperature}°C, HR: ${heartRate} BPM`);

    this.lastVitals = { temperature, heartRate, timestamp };
    this.emit("vitals_data", { temperature, heartRate, timestamp });
  }

  /**
   * Medicine dispensing completed
   */
  handleDispenseComplete(message) {
    const { slot, timestamp } = message;
    console.log(`💊 Dispensing complete - Slot ${slot}`);

    this.emit("dispense_complete", { slot, timestamp });
  }

  /**
   * Emergency button pressed
   */
  handleEmergencyButton(message) {
    const { timestamp, kiosk_id } = message;
    console.log(`🚨 EMERGENCY BUTTON PRESSED!`);
    console.log(`   Kiosk ID: ${kiosk_id}`);
    console.log(`   Timestamp: ${timestamp}`);

    this.emit("emergency_button", { timestamp, kiosk_id });
  }

  /**
   * Send command to ESP32
   */
  sendCommand(command) {
    if (!this.isConnected || !this.port || !this.port.isOpen) {
      console.error("❌ Cannot send command: ESP32 not connected");
      return false;
    }

    try {
      const jsonString = JSON.stringify(command) + "\n";
      console.log("📤 Sending to ESP32:", jsonString.trim());

      this.port.write(jsonString, (err) => {
        if (err) {
          console.error("Error writing to serial:", err);
          this.emit("error", err);
        }
      });

      return true;
    } catch (error) {
      console.error("Failed to send command:", error);
      return false;
    }
  }

  /**
   * Dispense medicine from specific slot
   */
  dispenseSlot(slotNumber) {
    if (slotNumber < 1 || slotNumber > 4) {
      console.error("Invalid slot number. Must be 1-4");
      return false;
    }

    console.log(`💊 Dispensing from slot ${slotNumber}...`);
    return this.sendCommand({
      command: "dispense",
      slot: slotNumber,
    });
  }

  /**
   * Test buzzer
   */
  testBuzzer() {
    console.log("🔊 Testing buzzer...");
    return this.sendCommand({ command: "test_buzzer" });
  }

  /**
   * Test LEDs
   */
  testLEDs() {
    console.log("💡 Testing LEDs...");
    return this.sendCommand({ command: "test_led" });
  }

  /**
   * Reset ESP32 state
   */
  reset() {
    console.log("🔄 Resetting ESP32...");
    this.lastRFID = null;
    this.lastVitals = null;
    return this.sendCommand({ command: "reset" });
  }

  /**
   * Close serial connection
   */
  disconnect() {
    if (this.port && this.port.isOpen) {
      console.log("Closing ESP32 connection...");
      this.port.close();
    }
  }

  /**
   * Get last RFID scan data
   */
  getLastRFID() {
    return this.lastRFID;
  }

  /**
   * Get last vitals data
   */
  getLastVitals() {
    return this.lastVitals;
  }

  /**
   * Check connection status
   */
  isReady() {
    return this.isConnected && this.port && this.port.isOpen;
  }
}

module.exports = ESP32Handler;

// Example usage for testing
if (require.main === module) {
  const esp32 = new ESP32Handler("/dev/ttyUSB0"); // Change port as needed

  // Event handlers
  esp32.on("connected", () => {
    console.log("ESP32 handler ready!");

    // Test commands after connection
    setTimeout(() => {
      esp32.testBuzzer();
    }, 1000);

    setTimeout(() => {
      esp32.testLEDs();
    }, 2000);
  });

  esp32.on("rfid_scan", (data) => {
    console.log("Received RFID:", data);
  });

  esp32.on("vitals_data", (data) => {
    console.log("Received Vitals:", data);
  });

  esp32.on("dispense_complete", (data) => {
    console.log("Dispensing complete:", data);
  });

  esp32.on("error", (error) => {
    console.error("ESP32 error:", error);
  });

  esp32.on("disconnected", () => {
    console.log("ESP32 disconnected");
    process.exit(0);
  });

  // Connect
  esp32.connect().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });

  // Handle process termination
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    esp32.disconnect();
    setTimeout(() => process.exit(0), 500);
  });
}
