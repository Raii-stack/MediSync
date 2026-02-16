# ESP32 Quick Reference Card

## 📌 Pin Assignments

| Component               | Pin     | Type    | Voltage | Notes                  |
| ----------------------- | ------- | ------- | ------- | ---------------------- |
| **MLX90614 Thermal**    |         |         |         |                        |
| SDA                     | GPIO 21 | I2C     | 5V      | I2C Bus 0              |
| SCL                     | GPIO 22 | I2C     | 5V      | 100kHz                 |
| **MAX30102 Heart Rate** |         |         |         |                        |
| SDA                     | GPIO 18 | I2C     | 3.3V    | I2C Bus 1, **NOT 5V!** |
| SCL                     | GPIO 19 | I2C     | 3.3V    | 400kHz                 |
| **RC522 RFID**          |         |         |         |                        |
| SS                      | GPIO 5  | SPI     | 3.3V    | Chip Select            |
| RST                     | GPIO 4  | Digital | 3.3V    | Reset                  |
| MOSI                    | GPIO 23 | SPI     | 3.3V    | Hardware SPI           |
| MISO                    | GPIO 19 | SPI     | 3.3V    | Hardware SPI           |
| SCK                     | GPIO 18 | SPI     | 3.3V    | Hardware SPI           |
| **Relay Slot 1**        | GPIO 33 | Output  | 5V      | Active LOW             |
| **Relay Slot 2**        | GPIO 32 | Output  | 5V      | Active LOW             |
| **Relay Slot 3**        | GPIO 25 | Output  | 5V      | Active LOW             |
| **Relay Slot 4**        | GPIO 26 | Output  | 5V      | Active LOW             |
| **Progress LED Red**    | GPIO 12 | PWM     | 3.3V    | Common Cathode         |
| **Progress LED Green**  | GPIO 13 | PWM     | 3.3V    | Common Cathode         |
| **Progress LED Blue**   | GPIO 14 | PWM     | 3.3V    | Common Cathode         |
| **Status LED Red**      | GPIO 27 | PWM     | 3.3V    | Common Cathode         |
| **Status LED Green**    | GPIO 26 | PWM     | 3.3V    | Common Cathode         |
| **Status LED Blue**     | GPIO 25 | PWM     | 3.3V    | Common Cathode         |
| **Buzzer**              | GPIO 15 | PWM     | 3.3V    | Passive buzzer         |
| **Emergency Button**    | GPIO 34 | Input   | 3.3V    | Internal pull-up       |
| **UART to RPI TX**      | GPIO 17 | Serial  | 3.3V    | ESP TX → RPI RX        |
| **UART to RPI RX**      | GPIO 16 | Serial  | 3.3V    | ESP RX → RPI TX        |

---

## 🔌 Power Requirements

| Component          | Voltage    | Current (typ) | Current (max) |
| ------------------ | ---------- | ------------- | ------------- |
| ESP32              | 5V via USB | 80-260mA      | 500mA         |
| MLX90614           | 5V         | 2mA           | 3mA           |
| MAX30102           | 3.3V       | 50µA          | 1.8mA         |
| RC522              | 3.3V       | 13mA          | 26mA          |
| Relay Module (per) | 5V         | 15mA          | 70mA          |
| RGB LED (per)      | 3.3V       | 20mA          | 60mA          |
| Buzzer             | 3.3V       | 10mA          | 30mA          |
| **TOTAL**          | 5V 2A      | ~150mA idle   | ~800mA peak   |

**Recommended Power Supply:** 5V 2A USB adapter

---

## 📡 Communication Protocols

### JSON Message Format

**ESP32 → Backend (Events)**

```json
{"event":"system_ready"}
{"event":"rfid_scan","uid":"A1B2C3D4","timestamp":123456}
{"event":"vitals_data","temperature":36.5,"heartRate":75,"timestamp":123456}
{"event":"dispense_complete","slot":1,"timestamp":123456}
{"event":"emergency_button","timestamp":123456,"kiosk_id":"kiosk-001"}
```

**Backend → ESP32 (Commands)**

```json
{"command":"dispense","slot":1}
{"command":"test_buzzer"}
{"command":"test_led"}
{"command":"reset"}
```

---

## 🔊 Tone Patterns

All tones use passive buzzer on GPIO 15. Different patterns for different events:

| Tone           | Pattern                   | Frequency            | When Triggered           |
| -------------- | ------------------------- | -------------------- | ------------------------ |
| **Success**    | Two quick ascending beeps | 1000Hz → 1500Hz      | RFID card detected       |
| **Complete**   | Long ascending tone       | 1000Hz → 1500Hz      | Vital signs reading done |
| **Dispensing** | Gentle notification       | 1300Hz (200ms)       | Medicine dispensing      |
| **Warning**    | Three short beeps         | 1200Hz (80ms × 3)    | General warnings         |
| **Error**      | Two descending beeps      | 1500Hz → 800Hz       | Sensor errors, failures  |
| **Emergency**  | Urgent alternating siren  | 2000Hz ↔ 1000Hz (×4) | Emergency button pressed |
| **Test**       | Four ascending tones      | 800Hz → 2000Hz       | Hardware test sequence   |

**Usage in code:**

```cpp
playSuccessTone();    // RFID scan success
playCompleteTone();   // Vitals reading complete
playDispensingTone(); // Medicine dispensing
playWarningTone();    // General warning
playErrorTone();      // Error occurred
playEmergencyTone();  // Emergency situation
playTestTone();       // Hardware test
```

---

## 🧪 Testing Checklist

### Pre-Flight Checks

- [ ] ESP32 powered via USB (check power LED)
- [ ] All sensor modules have power LEDs lit
- [ ] USB-UART cable connected to Raspberry Pi
- [ ] Arduino Serial Monitor closed (conflicts with Node.js)

### Individual Component Tests

#### ✅ ESP32 Boot

1. Upload code via Arduino IDE
2. Open Serial Monitor (115200 baud)
3. Press RST button
4. Verify output:
   ```
   MediSync ESP32 Initializing...
   UART to RPI initialized
   RFID RC522 initialized
   MLX90614 Thermal Sensor initialized
   MAX30102 Heart Rate Sensor initialized
   System Ready!
   ```

#### 🌡️ MLX90614 Temperature Sensor

- **Test:** Point sensor at forehead (3-5cm distance)
- **Expected:** Temperature readings 34-38°C
- **Error:** "MLX90614 not found" → Check I2C wiring, 5V power

#### ❤️ MAX30102 Heart Rate Sensor

- **Test:** Place finger firmly on sensor (cover LED)
- **Expected:** IR value > 50000, BPM 60-100
- **Error:** "MAX30102 not found" → Check I2C wiring, 3.3V power (NOT 5V!)

#### 🔖 RC522 RFID Reader

- **Test:** Tap card/tag on antenna
- **Expected:** UID printed (8 hex digits)
- **Error:** No detection → Check SPI wiring, 3.3V power, antenna connection

#### 💊 Relay Modules

- **Test:** Send dispense command via Serial Monitor
- **Expected:** Click sound, LED indicator, 2-second activation
- **Error:** No click → Check GPIO connection, relay power

#### 💡 RGB LEDs

- **Test:** Send `{"command":"test_led"}` via Serial
- **Expected:** Status LED R→G→B, Progress LED red→green gradient
- **Error:** Wrong colors → Check common cathode wiring, swap R/G/B pins

#### 🔊 Buzzer

- **Test:** Send `{"command":"test_buzzer"}` via Serial
- **Expected:** Four ascending tones (800Hz → 1200Hz → 1600Hz → 2000Hz)
- **Error:** No sound → Check polarity, use passive buzzer (not active)

#### 🚨 Emergency Button

- **Test:** Press physical button (GPIO 34 to GND)
- **Expected:**
  - Both LEDs flash red 5 times
  - Emergency siren plays (alternating high-low)
  - Event sent to backend
- **Error:** No response → Check button wiring, verify internal pull-up enabled

### Full Integration Test

1. **RFID Scan**
   - [ ] Scan card
   - [ ] Status LED turns green
   - [ ] Double beep
   - [ ] UID sent to backend

2. **Vitals Reading**
   - [ ] Progress LED starts red
   - [ ] Place finger on heart sensor
   - [ ] Point thermal sensor at forehead
   - [ ] Progress LED transitions to green
   - [ ] Long beep
   - [ ] Vitals data sent

3. **Dispensing**
   - [ ] Backend sends dispense command
   - [ ] Green LED flashes 3 times
   - [ ] Dispensing tone plays
   - [ ] Relay activates for 2 seconds
   - [ ] Confirmation sent

4. **Emergency Button**
   - [ ] Press physical button
   - [ ] Both LEDs flash red rapidly
   - [ ] Emergency siren plays
   - [ ] Event sent to backend
   - [ ] Backend forwards to clinic (if configured)

---

## 🐛 Common Issues

### Issue: ESP32 not detected by computer

**Solution:**

- Install CP2102 or CH340 USB driver
- Try different USB cable (must support data)
- Check Device Manager (Windows) or `lsusb` (Linux)

### Issue: Upload failed / permission denied

**Solution:**

- Close Arduino Serial Monitor
- Close any other serial programs
- Linux: `sudo chmod 666 /dev/ttyUSB0`
- Press and hold BOOT button during upload

### Issue: Sensors show 0 or NaN values

**Solution:**

- Check I2C wiring (SDA/SCL not swapped)
- Verify correct voltage (3.3V vs 5V)
- Scan I2C bus with scanner sketch
- Check for loose connections

### Issue: RFID reads but gets same UID repeatedly

**Solution:**

- Cooldown period is 2 seconds (normal behavior)
- Remove card fully before rescanning
- Not an error, prevents duplicate reads

### Issue: Heart rate sensor timeout

**Solution:**

- Ensure finger placement covers LED completely
- Clean sensor surface
- Apply gentle but firm pressure
- Wait 5-10 seconds for stable reading

### Issue: Relay clicks but doesn't switch load

**Solution:**

- Check relay type (signal relay vs power relay)
- Verify load voltage/current within relay specs
- Use separate power supply for high-current loads
- Check COM/NO/NC wiring

### Issue: Backend receives garbled messages

**Solution:**

- Verify baud rate (115200 on both sides)
- Check line endings (`\n` only)
- Ensure Serial.println() used (not Serial.print())
- Restart both ESP32 and backend

---

## 🔧 Maintenance

### Weekly

- [ ] Clean RFID antenna with isopropyl alcohol
- [ ] Clean heart rate sensor glass surface
- [ ] Check thermal sensor viewing window (no obstructions)
- [ ] Test all 4 relay slots
- [ ] Verify buzzer and LEDs

### Monthly

- [ ] Check all wire connections (no loose terminals)
- [ ] Inspect USB cable (no fraying)
- [ ] Test with known RFID cards
- [ ] Calibrate thermal sensor if needed
- [ ] Update firmware if bugs fixed

### As Needed

- [ ] Replace buzzer if sound weak
- [ ] Replace RGB LEDs if colors fade
- [ ] Replace relays if clicking inconsistent
- [ ] Flash fresh firmware if behavior erratic

---

## 📞 Support

### Serial Debug Output

Always check Serial Monitor first:

```
RFID Detected: A1B2C3D4
Sent to RPI: {"event":"rfid_scan","uid":"A1B2C3D4","timestamp":12345}
Starting vital signs reading...
Vitals - Temp: 36.5°C, HR: 75 BPM
Sent to RPI: {"event":"vitals_data",...}
```

### Enable Debug Mode

Add to top of ESP32 code:

```cpp
#define DEBUG_MODE 1
```

### Get Help

- Check [ESP32_INTEGRATION.md](./ESP32_INTEGRATION.md) for detailed wiring
- Review [ESP32_SERVER_INTEGRATION.md](../Backend/ESP32_SERVER_INTEGRATION.md) for backend
- Test with standalone Arduino examples first
- Use I2C scanner to find sensor addresses

---

## 📚 Library Versions (Tested)

```
MFRC522           v1.4.11    (GithubCommunity)
Adafruit_MLX90614 v2.1.3     (Adafruit)
MAX30105          v1.1.1     (SparkFun)
heartRate         v1.0.0     (SparkFun)
ArduinoJson       v6.21.5    (Benoit Blanchon)
```

**Installation:**

```
Arduino IDE → Tools → Manage Libraries → Search and install
```

---

## 🎯 Quick Commands

### Arduino Upload

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 esp32.ino
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 esp32.ino
```

### Serial Monitor

```bash
arduino-cli monitor -p /dev/ttyUSB0 -c baudrate=115200
# Or
screen /dev/ttyUSB0 115200
```

### Test Backend Integration

```bash
# Terminal 1: Monitor ESP32
screen /dev/ttyUSB0 115200

# Terminal 2: Run backend
cd Backend
node server.js

# Terminal 3: Send test commands
echo '{"command":"test_buzzer"}' > /dev/ttyUSB0
echo '{"command":"test_led"}' > /dev/ttyUSB0
```

---

**Last Updated:** January 2025  
**Hardware Version:** ESP32 DevKit v1  
**Firmware Version:** 1.0.0
