# Testing ESP32 on Windows (Development Mode)

This guide shows you how to test the ESP32 hardware integration on your Windows PC before deploying to Raspberry Pi.

---

## 🔧 Hardware Setup

### What You Need

1. ESP32 DevKit v1 with all sensors connected (see [WIRING_DIAGRAM.txt](../MicroControllers/WIRING_DIAGRAM.txt))
2. USB cable (Type-C or Micro-USB depending on your ESP32)
3. Windows PC with available USB port
4. Arduino IDE installed

### Physical Connections

- Connect all sensors to ESP32 as per wiring diagram
- Connect ESP32 to Windows PC via USB cable
- ESP32 power LED should light up

---

## 📥 Software Installation

### 1. Install Node.js Dependencies

Open PowerShell in the Backend directory:

```powershell
cd D:\vscode\MediSync\Kiosk\Backend
npm install serialport @serialport/parser-readline
```

### 2. Install USB Drivers (if needed)

**Check Device Manager:**

1. Press `Win + X` → Device Manager
2. Look under "Ports (COM & LPT)"
3. You should see "Silicon Labs CP210x" or "USB-SERIAL CH340"

**If driver missing:**

- **CP2102**: Download from [Silicon Labs](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
- **CH340**: Download from [manufacturer](http://www.wch-ic.com/downloads/CH341SER_ZIP.html)

### 3. Find Your COM Port

**Method 1: Device Manager**

1. Open Device Manager
2. Expand "Ports (COM & LPT)"
3. Look for COM port (e.g., COM3, COM4, COM5)

**Method 2: Arduino IDE**

1. Open Arduino IDE
2. Tools → Port
3. Note the COM port with your ESP32 name

**Method 3: PowerShell**

```powershell
Get-WmiObject Win32_SerialPort | Select-Object Name, DeviceID
```

**Method 4: Node.js**

```powershell
node -e "const {SerialPort} = require('serialport'); SerialPort.list().then(ports => console.log(ports));"
```

---

## 📤 Upload ESP32 Firmware

### 1. Open Arduino IDE

```
File → Open → D:\vscode\MediSync\Kiosk\MicroControllers\esp32.ino
```

### 2. Install Required Libraries

Go to **Tools → Manage Libraries**, search and install:

- `MFRC522` by GithubCommunity (v1.4.11+)
- `Adafruit MLX90614` by Adafruit (v2.1.3+)
- `MAX30105` by SparkFun (v1.1.1+)
- `heartRate` by SparkFun (included with MAX30105)
- `ArduinoJson` by Benoit Blanchon (v6.21.5+)

### 3. Configure Board Settings

1. **Tools → Board → ESP32 Arduino → ESP32 Dev Module**
2. **Tools → Port → COM3** (or your port)
3. **Tools → Upload Speed → 115200**
4. **Tools → Flash Frequency → 80MHz**
5. **Tools → Partition Scheme → Default**

### 4. Upload Code

1. Click **Upload** button (→)
2. Wait for "Connecting..." message
3. If it hangs, **hold BOOT button** on ESP32 until upload starts
4. Wait for "Hard resetting via RTS pin..."

### 5. Verify Upload

Open Serial Monitor (**Tools → Serial Monitor**):

- Set baud rate to **115200**
- You should see:

```
MediSync ESP32 Initializing...
UART to RPI initialized
RFID RC522 initialized
MLX90614 Thermal Sensor initialized
MAX30102 Heart Rate Sensor initialized
System Ready!
```

⚠️ **IMPORTANT**: Close Serial Monitor before testing with Node.js (port conflict)!

---

## 🧪 Testing Individual Components

### Test 1: Emergency Button

**Hardware:** Connect a push button between GPIO 34 and GND

**Test:**

1. Press the emergency button
2. Serial Monitor should show: `🚨 EMERGENCY BUTTON PRESSED!`
3. Both RGB LEDs flash red
4. Emergency siren plays

**Expected JSON:**

```json
{ "event": "emergency_button", "timestamp": 12345, "kiosk_id": "kiosk-001" }
```

### Test 2: RFID Reader

**Hardware:** RC522 module with card/tag

**Test:**

1. Tap RFID card on antenna
2. Status LED turns GREEN
3. Two ascending beeps (success tone)
4. UID printed to serial

**Expected JSON:**

```json
{ "event": "rfid_scan", "uid": "A1B2C3D4", "timestamp": 12345 }
```

### Test 3: Temperature Sensor

**Hardware:** MLX90614 infrared sensor

**Test:**

1. Point sensor at your forehead (3-5cm away)
2. Should read 34-38°C
3. Values printed to serial

### Test 4: Heart Rate Sensor

**Hardware:** MAX30102 pulse oximeter

**Test:**

1. Place finger firmly on sensor (cover LED)
2. Hold still for 5-10 seconds
3. Should detect beats and calculate BPM (60-100 typical)
4. IR value > 50000 indicates finger detected

### Test 5: Relay Modules

**Hardware:** 4-channel relay module

**Test via Serial Monitor:**

```json
{ "command": "dispense", "slot": 1 }
```

**Expected:**

- Relay 1 clicks
- Green LED flashes 3 times
- Gentle dispensing tone
- Relay activates for 2 seconds

Repeat for slots 2, 3, 4.

### Test 6: Tone Patterns

**Test via Serial Monitor:**

```json
{ "command": "test_buzzer" }
```

**Expected:** Four ascending tones (800Hz → 1200Hz → 1600Hz → 2000Hz)

**All tone types:**

- **Success**: Two quick ascending beeps (RFID scan)
- **Complete**: Long ascending tone (vitals finished)
- **Dispensing**: Gentle notification beep
- **Warning**: Three short medium beeps
- **Error**: Two descending beeps
- **Emergency**: Urgent alternating siren

### Test 7: LED Patterns

**Test via Serial Monitor:**

```json
{ "command": "test_led" }
```

**Expected:**

- Status LED: Red → Green → Blue → Red
- Progress LED: Red→Green gradient
- Test tone plays

---

## 🖥️ Backend Integration Testing

### 1. Update Environment Variables

Create or edit `.env` in Backend directory:

```env
# Use your actual COM port
ESP32_SERIAL_PORT=COM3
ESP32_BAUD_RATE=115200
ESP32_ENABLED=true

# Other existing variables
PORT=3001
KIOSK_ID=kiosk-001
```

### 2. Test Standalone Handler

**Close Arduino Serial Monitor first!**

```powershell
cd D:\vscode\MediSync\Kiosk\Backend
node esp32-handler.js
```

**Expected output:**

```
Available serial ports: [ { path: 'COM3', ... } ]
✅ ESP32 connected on COM3
✅ ESP32 system ready
```

**Interactive test:**

1. Press emergency button → See `🚨 EMERGENCY BUTTON PRESSED!`
2. Scan RFID card → See `🔖 RFID Scanned: A1B2C3D4`
3. Press `Ctrl+C` to exit

### 3. Test with Full Backend Server

**Terminal 1: Start Backend**

```powershell
cd D:\vscode\MediSync\Kiosk\Backend
node server.js
```

You should see:

```
🔌 Initializing ESP32 hardware...
✅ ESP32 connected on COM3
✅ ESP32 system ready
✅ ESP32 hardware initialized successfully
Backend server listening on port 3001
```

**Terminal 2: Test API Endpoints**

**Check hardware status:**

```powershell
curl http://localhost:3001/api/hardware/status
```

**Test buzzer:**

```powershell
curl -X POST http://localhost:3001/api/hardware/test-buzzer
```

**Test LEDs:**

```powershell
curl -X POST http://localhost:3001/api/hardware/test-leds
```

**Test dispensing:**

```powershell
curl -X POST http://localhost:3001/api/dispense `
  -H "Content-Type: application/json" `
  -d '{"slot_number": 1, "session_id": "test123"}'
```

### 4. Monitor Real-Time Events

**Terminal 1: Backend server running**

**Terminal 2: Watch logs**

Now perform actions:

1. **Press emergency button** → Backend logs `🚨 EMERGENCY BUTTON PRESSED!`
2. **Scan RFID card** → Backend logs `🔖 RFID Scanned: ...`
3. **Read vitals** (place finger on heart sensor, point thermal at head)
   - After 5 seconds → Backend logs `❤️ Vitals - Temp: 36.5°C, HR: 75 BPM`

---

## 🌐 Frontend Integration Testing

### 1. Start Frontend

**Terminal 3: Start Frontend**

```powershell
cd D:\vscode\MediSync\Kiosk\Frontend
npm run dev
```

Open browser: `http://localhost:5173`

### 2. Test Emergency Button Flow

1. Backend server running (Terminal 1)
2. Frontend open in browser (http://localhost:5173)
3. **Press physical emergency button on ESP32**
4. **Expected behavior:**
   - ESP32 LEDs flash red
   - Emergency siren plays
   - Backend receives event
   - Backend forwards to clinic socket (if configured)
   - Frontend should show emergency modal (if implemented)

### 3. Test RFID → Vitals Flow

**Prerequisites:**

- Add test student to database with RFID UID
- Or modify code to accept any UID

**Flow:**

1. On Welcome Screen
2. **Scan RFID card** on ESP32
3. ESP32 sends `rfid_scan` event
4. Backend looks up student
5. Frontend shows "Welcome, [Name]!"
6. Automatically starts vitals reading
7. **Place finger on heart sensor**
8. **Point thermal sensor at forehead**
9. Wait 5 seconds
10. Frontend receives vitals and navigates to Symptoms screen

### 4. Test Dispensing Flow

1. Navigate through symptoms → recommendation
2. Click "Dispense Medicine"
3. Backend sends dispense command to ESP32
4. Physical relay clicks
5. Dispensing tone plays
6. Frontend shows DispensingModal animation
7. After 4 seconds → Navigate to Receipt

---

## 🐛 Troubleshooting

### Issue: Port Access Denied

**Error:**

```
Error: Error opening COM3: Access denied
```

**Solutions:**

1. Close Arduino Serial Monitor
2. Close any other serial programs (PuTTY, Tera Term, etc.)
3. Unplug and replug USB cable
4. Try different USB port
5. Restart your PC

### Issue: Port Not Found

**Error:**

```
Error: Error: No such file or directory, cannot open COM3
```

**Solutions:**

1. Check Device Manager for correct COM port
2. Update `.env` with correct port (COM3, COM4, etc.)
3. Reinstall USB drivers
4. Try different USB cable (must support data, not just power)

### Issue: ESP32 Not Responding

**Symptoms:** Backend connects but no events received

**Solutions:**

1. Press RST button on ESP32
2. Re-upload firmware from Arduino IDE
3. Check Serial Monitor (115200 baud) for error messages
4. Verify sensor connections
5. Check power supply (needs sufficient current)

### Issue: Sensors Not Detected

**MLX90614 Not Found:**

- Check I2C wiring (SDA=GPIO21, SCL=GPIO22)
- Verify 5V power connection
- Test with I2C scanner sketch

**MAX30102 Not Found:**

- Check I2C wiring (SDA=GPIO18, SCL=GPIO19)
- **CRITICAL**: Use 3.3V power (NOT 5V!)
- Clean sensor glass surface
- Test with I2C scanner sketch

**RC522 No Read:**

- Check SPI connections
- Verify 3.3V power
- Test antenna connection
- Card must be within 3cm

### Issue: Windows Firewall Blocks Backend

**Symptom:** Frontend can't connect to backend

**Solution:**

```powershell
# Allow Node.js through firewall (run as Administrator)
New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

Or manually: Windows Security → Firewall → Allow an app → Add Node.js

### Issue: Backend Receives Garbled Data

**Symptom:** "Invalid JSON from ESP32"

**Solutions:**

1. Verify baud rate is 115200 on both sides
2. Check line endings (should be `\n`)
3. Restart both ESP32 (RST button) and backend
4. Re-upload firmware
5. Check USB cable quality

---

## 🎯 Quick Test Checklist

Before deploying to Raspberry Pi, verify:

- [ ] ESP32 powers on (LED lit)
- [ ] Firmware uploads successfully
- [ ] Serial Monitor shows "System Ready!"
- [ ] Emergency button triggers alert
- [ ] RFID card scans successfully
- [ ] Temperature sensor reads 34-38°C from forehead
- [ ] Heart rate sensor detects finger (IR > 50000)
- [ ] All 4 relays click on command
- [ ] Both RGB LEDs work (all colors)
- [ ] All tone patterns play correctly
- [ ] Backend connects to ESP32 (COM port)
- [ ] Backend receives RFID events
- [ ] Backend receives vitals events
- [ ] Backend receives emergency events
- [ ] Backend can trigger dispensing
- [ ] Frontend receives Socket.IO events
- [ ] Full user flow works end-to-end

---

## 📝 Development Tips

### Hot Reload Testing

**Terminal setup:**

1. **Terminal 1**: Backend (`node server.js`)
2. **Terminal 2**: Frontend (`npm run dev`)
3. **Terminal 3**: Free for curl commands

Changes to backend code require restart. Use `nodemon` for auto-restart:

```powershell
npm install -g nodemon
nodemon server.js
```

### Debug Mode

Add to ESP32 code (top of file):

```cpp
#define DEBUG_MODE 1
```

Enables verbose logging of all sensor readings.

### Simulating Events

If hardware not ready, simulate events manually:

**Send to backend via stdin:**

```powershell
# In backend terminal (while server running)
# Type these JSON messages directly:
{"event":"rfid_scan","uid":"TEST1234","timestamp":12345}
{"event":"vitals_data","temperature":36.5,"heartRate":75,"timestamp":12345}
{"event":"emergency_button","timestamp":12345,"kiosk_id":"kiosk-001"}
```

### Monitoring Serial Traffic

**Use Arduino Serial Monitor:**

- Shows ESP32 debug output
- Can send JSON commands manually
- Good for isolating hardware issues

**Use Node.js:**

- Shows backend processing
- Good for testing integration
- Can't use simultaneously with Arduino!

---

## 🚀 Deployment to Raspberry Pi

Once testing complete on Windows:

### 1. Prepare Hardware

- Disconnect ESP32 from Windows PC
- Connect ESP32 to Raspberry Pi via USB
- Note: USB connection to RPI, not GPIO pins

### 2. Update Backend .env

On Raspberry Pi:

```env
ESP32_SERIAL_PORT=/dev/ttyUSB0
ESP32_BAUD_RATE=115200
ESP32_ENABLED=true
```

### 3. Install Dependencies

```bash
cd ~/MediSync/Kiosk/Backend
npm install serialport @serialport/parser-readline
```

### 4. Fix Permissions (Linux)

```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Logout and login, or:
sudo chmod 666 /dev/ttyUSB0
```

### 5. Test Connection

```bash
node esp32-handler.js
```

### 6. Setup SystemD Service

See [ESP32_SERVER_INTEGRATION.md](./ESP32_SERVER_INTEGRATION.md) for production deployment.

---

## 📞 Getting Help

### Check Logs

**ESP32 Serial:**

```
Arduino IDE → Tools → Serial Monitor (115200 baud)
```

**Backend:**

```powershell
# Console output shows all events
node server.js
```

**Frontend:**

```
Browser Developer Tools (F12) → Console
```

### Common Log Messages

**✅ Good:**

```
✅ ESP32 connected on COM3
✅ ESP32 system ready
🔖 RFID Scanned: A1B2C3D4
❤️ Vitals - Temp: 36.5°C, HR: 75 BPM
💊 Dispensing from Slot 1
```

**⚠️ Warnings:**

```
⚠️ ESP32 disconnected (USB unplugged or crashed)
⚠️ Unknown RFID: A1B2C3D4 (not in database)
Unknown event from ESP32: ... (firmware version mismatch)
```

**❌ Errors:**

```
❌ Serial port error: Access denied (close Serial Monitor)
❌ Failed to connect to ESP32 (wrong COM port)
ERROR: MLX90614 not found! (check I2C wiring)
ERROR: MAX30102 not found! (check 3.3V power)
Invalid JSON from ESP32 (baud rate mismatch)
```

---

## 🎓 Next Steps

1. ✅ Complete hardware assembly
2. ✅ Test all components individually
3. ✅ Test backend integration on Windows
4. Test frontend integration
5. Calibrate sensor thresholds if needed
6. Add test student RFID cards to database
7. Deploy to Raspberry Pi
8. Test full kiosk workflow
9. Mount in enclosure
10. Field testing with real users

---

**Last Updated:** February 16, 2026  
**Platform:** Windows 10/11  
**Node.js Version:** 18+ recommended  
**Arduino IDE:** 2.0+ recommended
