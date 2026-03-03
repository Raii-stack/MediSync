# Hardware & Network Setup Guide

This document explains the technical reasons behind the issues you are experiencing with the Kiosk deployment on the Raspberry Pi, and provides solutions for each.

---

## 1. iPad/Tablet USB Tethering IP Issues

**The Problem:**
You configured a static IP for `usb0` (the USB tethering interface), but when you connect a *different* tablet, the IP address changes or the connection drops.

**Why this happens:**
When you plug in an Android Tablet or iPad via USB, the Raspberry Pi creates a virtual network interface (usually `usb0` or `enx...`). Every tablet has a different, randomized MAC address for its tethering adapter. When you switch tablets, the Linux networking daemon on the Pi treats it as an entirely new network connection and assigns it a different dynamic IP, ignoring your static `usb0` rule.

**The Solution:**
Instead of relying on the tablet to provide a static IP, you must configure the Raspberry Pi to act as a DHCP Host on the `usb0` interface, or use a hostname.

1. **Use mDNS (Easiest)**
   Install `avahi-daemon` on the Pi. This allows any tablet connected via USB to simply navigate to `http://raspberrypi.local:5173` (or whatever your Pi's hostname is) instead of typing a direct IP address.
   `sudo apt-get install avahi-daemon`

2. **Configure dnsmasq for a fixed subnet**
   Use a networking tool like `dnsmasq` to force the Pi to hold the IP address `192.168.42.1` on the `usb0` interface, and give the tablet an IP address of `192.168.42.2` regardless of what tablet it is. 

---

## 2. Inconsistent Heartbeat Scanner Speeds (MAX30102 / ESP32)

**The Problem:**
Sometimes the heartbeat sensor completes its scan in 30 seconds, and other times it takes over a minute.

**Why this happens:**
Pulse oximetry and heart rate sensors (like the MAX30102) do not just take a single photo. They shine Infrared and Red light into the finger and measure the *tiny* fluctuations in light absorption as blood pumps through the capillaries (the AC component of the signal).

The algorithm running on your ESP32 has a buffer window (usually 5 to 10 seconds of data). It will **only** calculate a BPM if the signal is clean and steady. 
- **Inconsistencies are usually physical:** 
  1. **Finger Pressure:** Pressing too hard squashes the capillaries, stopping blood flow. Pressing too lightly lets ambient room light bleed into the sensor.
  2. **Finger Temperature:** Cold hands cause blood vessels to constrict, making the heartbeat virtually invisible to the sensor.
  3. **Movement:** Even tiny finger twitches ruin the algorithmic window, forcing the ESP32 to throw away the noisy data and start collecting the 5-10 second window all over again.

**The Solution:**
You can modify the ESP32 C++ code to lower the threshold for a "valid" reading, which makes it faster but much less accurate. Otherwise, adding a physical finger guide (like a silicon hood) to force students to place their finger lightly and block out overhead lights dramatically stabilizes the reading times.

---

## 3. Raspberry Pi GPIO LED via JavaScript

**The Problem:**
The RFID LED connected directly to the Raspberry Pi GPIO pins is not lighting up, and you suspect JavaScript cannot run GPIO pins.

**Why this happens:**
JavaScript (Node.js) **can** absolutely control Raspberry Pi GPIO pins using the `gpiod` toolset. However, based on the [gpioService.js](file:///d:/vscode/MediSync/Kiosk/Backend/gpioService.js) in your backend, your code is likely falling back to a "Mock" because the `gpioset` command is not available or the GPIO character device is not accessible inside the container.

Here is why it fails on the Raspberry Pi:
1. **Docker Permissions:** You are running the backend inside Docker. By default, Docker containers **do not have access** to the host's physical hardware. If the Node.js app tries to write to the GPIO, Linux blocks it.
2. **Missing Dependencies:** The `gpiod` userspace tools must be installed inside the container. Without `gpiod` and `libgpiod-dev`, the `gpioset` command will not be found and the service falls back to Mock Mode.

**The Solution:**
The backend uses `gpiod` (via the `gpioset` command) for LED control. This is the modern, native approach for the 64-bit Raspberry Pi OS kernel and does not require any host daemon.

**Step 1 — Install gpiod on the Pi host (for testing outside Docker):**
```bash
sudo apt-get install gpiod libgpiod-dev
```

**Step 2 — Verify GPIO access with gpiod:**
```bash
# List available GPIO chips
gpiodetect

# Test toggling pin 23 (Red LED) high and low
gpioset gpiochip0 23=1
gpioset gpiochip0 23=0
```

**Step 3 — Docker configuration:**
In your [docker-compose.prod.yml](file:///d:/vscode/MediSync/docker-compose.prod.yml), add `privileged: true` and map the GPIO character device to your backend service:

```yaml
  backend:
    build:
      context: ./Kiosk/Backend
      dockerfile: Dockerfile.prod
    privileged: true
    volumes:
      - /dev/gpiochip0:/dev/gpiochip0  # GPIO character device for gpiod
      - /run/dbus:/run/dbus
```

The `gpiod` approach uses the `/dev/gpiochip0` character device (the modern Linux GPIO API) instead of the legacy `/dev/gpiomem` or `/dev/mem` interfaces, and does not require a host-side daemon like `pi-blaster`.

---

## 4. Connecting a Physical Emergency Button to the ESP32

**The Problem:**
You connected a push button to the ESP32, but it doesn't trigger the emergency modal or register presses.

**Why this happens:**
Digital pins on microcontrollers "float" when nothing is connected to them. If you just connect a button between a GPIO pin and 3.3V, when the button isn't pressed, the pin is connected to *nothing*. This causes it to read random noise from the room (like radio waves) and rapidly flip between HIGH and LOW, ruining your code logic. Additionally, physical buttons literally "bounce" microscopically when pressed, causing a single push to look like 20 rapid presses to the ESP32.

**The Solution:**
You must wire the button using a Pull-Down or Pull-Up resistor, and handle debouncing in your ESP32 Arduino code.

**Hardware Wiring (Pull-Up Method - Recommended):**
1. Connect one side of the push button to **GND** (Ground).
2. Connect the other side of the push button to your chosen ESP32 GPIO Pin (e.g., `GPIO 15`).
3. You do *not* need a physical resistor if you enable the ESP32's internal resistor in your code.

**Arduino Code (ESP32):**
In your Arduino `.ino` file, configure the pin as an `INPUT_PULLUP`. This forces the pin state to `HIGH` internally until the button bridges it to Ground, making it go `LOW`.

```cpp
const int BUTTON_PIN = 15;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50; // 50 milliseconds
int lastButtonState = HIGH;

void setup() {
  Serial.begin(115200);
  // Important: Use INPUT_PULLUP
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  int reading = digitalRead(BUTTON_PIN);

  // Debounce logic
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    // If the button is pressed (LOW because of Pull-up)
    if (reading == LOW) {
      // Send the JSON payload exactly as the Node.js backend expects it
      Serial.println("{\"event\":\"emergency_button\",\"timestamp\":" + String(millis()) + ",\"kiosk_id\":\"kiosk-001\"}");
      
      // Wait for release to prevent sending 1000 times
      while(digitalRead(BUTTON_PIN) == LOW) {
        delay(10);
      }
    }
  }
  lastButtonState = reading;
}
```

Once wired this way, pressing the button sends the exact JSON string `{"event":"emergency_button"...}` to the Raspberry Pi over USB, which the `serial.js` backend intercepts and broadcasts to your frontend Emergency Modal.
