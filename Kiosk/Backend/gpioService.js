const { execSync } = require('child_process');

// Graceful PWM Fallback for Windows/Mac development
let piblaster;
try {
  piblaster = require('pi-blaster.js');
} catch (e) {
  console.warn("⚠️  'pi-blaster.js' module not found or unsupported. PWM LED control is running in Mock Mode.");
  piblaster = null;
}

class GPIOService {
  constructor() {
    // Standard BCM pin assignments for the Raspberry Pi
    this.RFID_R_PIN = 23;
    this.RFID_G_PIN = 24;

    this.LED_ACTIVE_LOW = false; 

    if (piblaster) {
      console.log(`✅ Pi-Blaster PWM Initialized on BCM pins R:${this.RFID_R_PIN}, G:${this.RFID_G_PIN}`);
      this.setIdle(); // Default hardware state
    }
  }

  // --- LED Abstractions ---

  /* 
   * Replicates esp32.ino setColor logic for RPi using soft-PWM (0 to 1 float range).
   * r: 0-255 (Red intensity)
   * g: 0-255 (Green intensity)
   */
  setRfidLed(r, g) {
    if (!piblaster) {
      // console.log(`[GPIO PWM MOCK] RFID LED state -> R: ${r}, G: ${g}`);
      return;
    }

    // Sanitize ESP32 0-255 args down to Pi-Blaster 0.0 - 1.0 floats
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));

    let rFloat = r / 255.0;
    let gFloat = g / 255.0;

    // Apply Active-Low inversion if required by the hardware wiring
    if (this.LED_ACTIVE_LOW) {
        // If Active-Low, 1.0 (High) is OFF, 0.0 (Low) is ON.
        rFloat = 1.0 - rFloat;
        gFloat = 1.0 - gFloat;
    }

    // Drive the pins
    piblaster.setPwm(this.RFID_R_PIN, rFloat);
    piblaster.setPwm(this.RFID_G_PIN, gFloat);
  }

  // Solid Green indicating idle / ready
  setIdle() {
    this.setRfidLed(0, 255);
  }

  // Solid Red indicating scanning active
  setScanning() {
    this.setRfidLed(255, 0);
  }

  // Yellow-ish indicating processing or error
  setAlert() {
    this.setRfidLed(255, 255); 
  }

  // Off
  setOff() {
    this.setRfidLed(0, 0);
  }

  // --- Cleanup Hook ---
  cleanup() {
    // Restore default passive states upon destruction
    this.setOff();
  }
}

// Export a singleton instance
module.exports = new GPIOService();
