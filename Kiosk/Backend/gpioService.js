const { execSync } = require('child_process');

const GPIOCHIP = 'gpiochip0';

let gpiodAvailable = false;
try {
  execSync('which gpioset', { stdio: 'ignore' });
  gpiodAvailable = true;
} catch (e) {
  console.warn("⚠️  'gpioset' command not found. GPIO LED control is running in Mock Mode.");
}

function gpioSet(chip, pin, value) {
  try {
    execSync(`gpioset ${chip} ${pin}=${value}`, { stdio: 'ignore' });
  } catch (e) {
    console.warn(`[GPIO] Failed to set pin ${pin} to ${value}: ${e.message}`);
  }
}

class GPIOService {
  constructor() {
    // Standard BCM pin assignments for the Raspberry Pi
    this.RFID_R_PIN = 23;
    this.RFID_G_PIN = 24;
    this.RFID_B_PIN = 25; // Blue pin

    this.LED_ACTIVE_LOW = false;
    this.blinkInterval = null;

    if (gpiodAvailable) {
      console.log(`✅ gpiod Initialized on BCM pins R:${this.RFID_R_PIN}, G:${this.RFID_G_PIN}, B:${this.RFID_B_PIN}`);
      this.setIdle(); // Default hardware state
    }
  }

  // --- LED Abstractions ---

  /* 
   * Replicates esp32.ino setColor logic for RPi using gpiod digital on/off.
   * r: 0-255 (Red intensity, treated as on/off threshold)
   * g: 0-255 (Green intensity, treated as on/off threshold)
   * b: 0-255 (Blue intensity, treated as on/off threshold)
   */
  setRfidLed(r, g, b = 0) {
    if (!gpiodAvailable) {
      return;
    }

    // Convert 0-255 values to digital 0/1 for gpiod (any non-zero intensity = LED on)
    let rVal = r > 0 ? 1 : 0;
    let gVal = g > 0 ? 1 : 0;
    let bVal = b > 0 ? 1 : 0;

    // Apply Active-Low inversion if required by the hardware wiring
    if (this.LED_ACTIVE_LOW) {
      rVal = 1 - rVal;
      gVal = 1 - gVal;
      bVal = 1 - bVal;
    }

    gpioSet(GPIOCHIP, this.RFID_R_PIN, rVal);
    gpioSet(GPIOCHIP, this.RFID_G_PIN, gVal);
    gpioSet(GPIOCHIP, this.RFID_B_PIN, bVal);
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
