const { execSync } = require('child_process');

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
    this.RFID_B_PIN = 25; // Blue pin

    this.LED_ACTIVE_LOW = false; 
    this.blinkInterval = null;

    if (piblaster) {
      console.log(`✅ Pi-Blaster PWM Initialized on BCM pins R:${this.RFID_R_PIN}, G:${this.RFID_G_PIN}, B:${this.RFID_B_PIN}`);
      this.setIdle(); // Default hardware state
    }
  }

  // --- LED Abstractions ---

  /* 
   * Replicates esp32.ino setColor logic for RPi using soft-PWM (0 to 1 float range).
   * r: 0-255 (Red intensity)
   * g: 0-255 (Green intensity)
   * b: 0-255 (Blue intensity)
   */
  setRfidLed(r, g, b = 0) {
    if (!piblaster) {
      // console.log(`[GPIO PWM MOCK] RFID LED state -> R: ${r}, G: ${g}, B: ${b}`);
      return;
    }

    // Sanitize ESP32 0-255 args down to Pi-Blaster 0.0 - 1.0 floats
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    let rFloat = r / 255.0;
    let gFloat = g / 255.0;
    let bFloat = b / 255.0;

    // Apply Active-Low inversion if required by the hardware wiring
    if (this.LED_ACTIVE_LOW) {
        // If Active-Low, 1.0 (High) is OFF, 0.0 (Low) is ON.
        rFloat = 1.0 - rFloat;
        gFloat = 1.0 - gFloat;
        bFloat = 1.0 - bFloat;
    }

    piblaster.setPwm(this.RFID_R_PIN, rFloat);
    piblaster.setPwm(this.RFID_G_PIN, gFloat);
    piblaster.setPwm(this.RFID_B_PIN, bFloat);
  }

  setIdle() {
    this.setRfidLed(0, 255);
  }

  setScanning() {
    this.setRfidLed(255, 0);
  }

  setAlert() {
    this.stopBlink();
    this.setRfidLed(255, 255, 0); 
  }

  setBlue() {
    this.stopBlink();
    this.setRfidLed(0, 0, 255);
  }

  startBlinkRed() {
    this.stopBlink();
    let isOn = false;
    this.blinkInterval = setInterval(() => {
      if (isOn) this.setOff();
      else this.setRfidLed(255, 0, 0);
      isOn = !isOn;
    }, 500);
  }

  stopBlink() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
  }

  setOff() {
    this.stopBlink();
    this.setRfidLed(0, 0, 0);
  }

  cleanup() {
    this.setOff();
  }
}

// Export a singleton instance
module.exports = new GPIOService();
