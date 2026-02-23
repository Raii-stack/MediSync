const { execSync } = require('child_process');

// Graceful GPIO Fallback for Windows/Mac development
let Gpio;
try {
  Gpio = require('onoff').Gpio;
} catch (e) {
  console.warn("⚠️  'onoff' module not found or unsupported. GPIO control is running in Mock Mode.");
  Gpio = null;
}

class GPIOService {
  constructor() {
    // Standard BCM pin assignments for the Raspberry Pi
    this.RFID_R_PIN = 23;
    this.RFID_G_PIN = 24;

    this.rfidLedR = null;
    this.rfidLedG = null;

    if (Gpio) {
      try {
        this.rfidLedR = new Gpio(this.RFID_R_PIN, 'out');
        this.rfidLedG = new Gpio(this.RFID_G_PIN, 'out');
        console.log(`✅ GPIO Initialized on BCM pins R:${this.RFID_R_PIN}, G:${this.RFID_G_PIN}`);
        this.setIdle(); // Default hardware state
      } catch (err) {
        console.error("❌ Failed to initialize RPi GPIO pins:", err.message);
        Gpio = null;
      }
    }
  }

  // --- LED Abstractions ---

  setRfidLed(redState, greenState) {
    if (!Gpio || !this.rfidLedR || !this.rfidLedG) {
      // console.log(`[GPIO MOCK] RFID LED state -> R: ${redState}, G: ${greenState}`);
      return;
    }
    
    // Active High logic. Swap 1 & 0 if your relays/transistors are Active Low.
    this.rfidLedR.writeSync(redState ? 1 : 0);
    this.rfidLedG.writeSync(greenState ? 1 : 0);
  }

  // Solid Green indicating idle / ready
  setIdle() {
    this.setRfidLed(false, true);
  }

  // Solid Red indicating scanning active
  setScanning() {
    this.setRfidLed(true, false);
  }

  // Blinking Red/Green indicating processing or error
  setAlert() {
    this.setRfidLed(true, true); // Yellow-ish if driven simultaneously
  }

  // Off
  setOff() {
    this.setRfidLed(false, false);
  }

  // --- Cleanup Hook ---
  
  cleanup() {
    if (this.rfidLedR) this.rfidLedR.unexport();
    if (this.rfidLedG) this.rfidLedG.unexport();
  }
}

// Export a singleton instance
module.exports = new GPIOService();
