# ESP32 Fake RFID Debug Tool - Quick Guide

## 🎯 What This Does

Sends a fake RFID scan command to your real ESP32 hardware to trigger the vitals reading process **without needing a physical RFID card**.

## ✅ Updated Files

1. **ESP32 Firmware** (`esp32.ino`):
   - Now sends RFID data to RPI when card is scanned
   - Added handler for `simulate_rfid` command
   - Triggers full vitals reading cycle
2. **Backend** (`serial.js`):
   - Added `sendFakeRFIDToESP32()` function
   - Sends JSON command to ESP32: `{"command":"simulate_rfid","uid":"..."}`

3. **API Endpoint** (`server.js`):
   - Updated `/api/debug/esp32-rfid` to send command to real hardware
   - Returns mode (real_hardware or simulation)

## 🚀 How to Use

### Method 1: API Call (PowerShell)

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/debug/esp32-rfid" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"uid":"TESTCARD001"}'
```

### Method 2: API Call (curl)

```bash
curl -X POST http://localhost:3001/api/debug/esp32-rfid \
  -H "Content-Type: application/json" \
  -d '{"uid":"TESTCARD001"}'
```

### Method 3: Run Test Script

```powershell
cd D:\vscode\MediSync\Kiosk\Backend
.\test-esp32-sim.ps1
```

### Method 4: Frontend Button (coming soon)

Add this to your React component:

```javascript
const triggerFakeRFID = async () => {
  const response = await fetch("http://localhost:3001/api/debug/esp32-rfid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: "FRONTEND_TEST" }),
  });
  const data = await response.json();
  console.log("Fake RFID sent:", data);
};
```

## 📡 What Happens on ESP32

When the debug command is received:

1. **LED Feedback**:
   - Status LED turns GREEN (from RED)
   - Progress LED starts red→green gradient

2. **Audio Feedback**:
   - Success tone plays (2 ascending beeps: 1000Hz → 1500Hz)

3. **Sensor Reading Starts**:
   - Reads temperature from MLX90614 sensor
   - Reads heart rate from MAX30102 sensor
   - Continues for 5 seconds

4. **Completion**:
   - Progress LED turns solid GREEN
   - Completion tone plays
   - Sends vitals data to backend via UART
   - Status LED returns to RED (idle)

## 📊 Expected Backend Output

### Real ESP32 Mode:

```
🔴 [DEBUG] Sending fake RFID to ESP32 to trigger vitals...
📤 Sent fake RFID to ESP32: {"command":"simulate_rfid","uid":"TESTCARD001"}
📡 ESP32 Raw: {"event":"rfid_scan","uid":"TESTCARD001","timestamp":12345}
🔖 RFID Scanned: TESTCARD001
📡 ESP32 Raw: {"event":"vitals_data","temperature":36.8,"heartRate":75,"timestamp":17345}
❤️ Vitals - Temp: 36.8°C, HR: 75 BPM
```

### Simulation Mode (COM3 not available):

```
🔴 [DEBUG] Sending fake RFID to ESP32 to trigger vitals...
[SIM] 🔖 Fake RFID in simulation mode: TESTCARD001
[SIM] ❤️ Generated: {"temp":"36.5","bpm":72}
```

## 🔧 Troubleshooting

### "No physical changes on ESP32"

1. Check Serial Monitor output - you should see: `Simulating RFID scan: TESTCARD001`
2. If you see "Invalid command format", check that COM3 isn't being used by another program
3. Try unplugging and replugging the ESP32

### "Backend shows simulation mode"

- This means COM3 is not accessible
- Close Arduino Serial Monitor
- Restart backend: `npm run dev`

### "Sensors not reading"

- Thermal sensor: Point MLX90614 at your forehead (3-5cm away)
- Heart rate: Place finger on MAX30102 and hold still
- If both fail, ESP32 will still complete after 5 seconds with default values

## 🎥 Full Test Workflow

1. **Upload ESP32 firmware**:

   ```
   Arduino IDE → Upload → Wait for "Done uploading"
   ```

2. **Close Serial Monitor** (important!)

3. **Start backend**:

   ```powershell
   cd D:\vscode\MediSync\Kiosk\Backend
   npm run dev
   ```

   Wait for: `✅ Listening to Real ESP32...`

4. **Trigger fake RFID**:

   ```powershell
   .\test-esp32-sim.ps1
   ```

5. **Watch the ESP32**:
   - Status LED: RED → GREEN → RED
   - Progress LED: Gradient animation
   - Listen for beeps

6. **Check backend console** for vitals data

7. **Test dispense** (optional):
   Script will automatically test this

## 🔄 Next Steps

Once this works:

- Add physical RFID reader (RC522 module)
- Connect actual sensors (MLX90614, MAX30102)
- Test with real RFID cards
- Remove debug endpoints in production

## 📝 Notes

- **UID format**: Can be any string (e.g., "TEST12345678", "FAKE_RFID", etc.)
- **Multiple triggers**: Wait 5+ seconds between calls (vitals reading time)
- **Real vs Simulation**: Check backend response `"mode"` field
- **Emergency button**: Still works independently on GPIO 23
