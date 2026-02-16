# ESP32 Backend Integration Guide

## Overview

This guide explains how to integrate the ESP32 hardware controller with the Node.js backend server using the `esp32-handler.js` module.

---

## Installation

### 1. Install Required Dependencies

```bash
cd Backend
npm install serialport@12.0.0 @serialport/parser-readline
```

### 2. Update Environment Variables

Add to your `.env` file:

```env
# ESP32 Serial Configuration
ESP32_SERIAL_PORT=/dev/ttyUSB0
ESP32_BAUD_RATE=115200
ESP32_ENABLED=true
```

**Port Detection:**

- **Linux/Raspberry Pi**: `/dev/ttyUSB0` or `/dev/ttyACM0`
- **Windows**: `COM3`, `COM4`, etc.
- **macOS**: `/dev/cu.usbserial-*`

To find your port:

```bash
# Linux/macOS
ls /dev/tty*

# Or use Node.js
node -e "const { SerialPort } = require('serialport'); SerialPort.list().then(ports => console.log(ports));"
```

---

## Integration with server.js

### Option 1: Replace Existing serial.js (Recommended)

**Step 1:** Backup old file

```bash
mv serial.js serial.js.backup
```

**Step 2:** Update server.js

Replace this line:

```javascript
const hardware = require("./serial");
```

With:

```javascript
const ESP32Handler = require("./esp32-handler");
const esp32 = new ESP32Handler(
  process.env.ESP32_SERIAL_PORT || "/dev/ttyUSB0",
  parseInt(process.env.ESP32_BAUD_RATE) || 115200,
);
```

**Step 3:** Initialize ESP32 connection after Socket.IO setup

Add this after the `io.on("connection", ...)` handler (around line 200):

```javascript
// ==================== ESP32 HARDWARE INTEGRATION ====================

let isESP32Ready = false;

// Initialize ESP32 if enabled
if (process.env.ESP32_ENABLED === "true") {
  console.log("🔌 Initializing ESP32 hardware...");

  esp32
    .connect()
    .then(() => {
      console.log("✅ ESP32 hardware initialized successfully");
    })
    .catch((error) => {
      console.error("❌ Failed to initialize ESP32:", error.message);
      console.log("⚠️  Continuing without hardware support");
    });

  // ESP32 Event Handlers
  esp32.on("connected", () => {
    console.log("✅ ESP32 connected and ready");
    isESP32Ready = false; // Wait for system_ready event
  });

  esp32.on("system_ready", () => {
    console.log("✅ ESP32 system ready");
    isESP32Ready = true;
    io.emit("hardware-status", { ready: true, type: "esp32" });
  });

  esp32.on("rfid_scan", async (data) => {
    console.log(`🔖 RFID scanned: ${data.uid}`);

    try {
      // Look up student in database
      const student = await new Promise((resolve, reject) => {
        db.get(
          "SELECT * FROM students_cache WHERE rfid_uid = ?",
          [data.uid],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          },
        );
      });

      if (student) {
        console.log(
          `✅ Student identified: ${student.first_name} ${student.last_name}`,
        );
        io.emit("student-identified", {
          student_number: student.student_number,
          first_name: student.first_name,
          last_name: student.last_name,
          rfid_uid: data.uid,
        });
      } else {
        console.log(`⚠️  Unknown RFID: ${data.uid}`);
        io.emit("rfid-error", { message: "Student not found", uid: data.uid });
      }
    } catch (error) {
      console.error("Error looking up student:", error);
      io.emit("rfid-error", { message: "Database error" });
    }
  });

  esp32.on("vitals_data", (data) => {
    console.log(
      `❤️ Vitals received - Temp: ${data.temperature}°C, HR: ${data.heartRate} BPM`,
    );

    // Emit to connected clients
    io.emit("vitals-complete", {
      temperature: data.temperature,
      heartRate: data.heartRate,
      timestamp: data.timestamp,
    });
  });

  esp32.on("dispense_complete", (data) => {
    console.log(`💊 Dispensing complete - Slot ${data.slot}`);

    // Emit confirmation to frontend
    io.emit("dispense-confirmed", {
      slot: data.slot,
      timestamp: data.timestamp,
    });
  });

  esp32.on("emergency_button", (data) => {
    console.log(`🚨 EMERGENCY BUTTON PRESSED!`);
    console.log(`   Kiosk ID: ${data.kiosk_id}`);

    // Emit to connected frontend clients
    io.emit("emergency-alert", {
      kiosk_id: data.kiosk_id,
      timestamp: data.timestamp,
      source: "hardware_button",
    });

    // Forward to clinic socket if connected
    if (clinicSocket && clinicSocket.connected) {
      clinicSocket.emit("kiosk-emergency", {
        kiosk_id: process.env.KIOSK_ID || data.kiosk_id,
        timestamp: new Date().toISOString(),
        message: "Emergency button pressed on kiosk hardware",
        source: "physical_button",
      });
      console.log("✅ Emergency alert forwarded to clinic");
    } else {
      console.log("⚠️  Clinic socket not connected - emergency not forwarded");
    }
  });

  esp32.on("error", (error) => {
    console.error("❌ ESP32 error:", error.message);
    io.emit("hardware-error", { message: error.message });
  });

  esp32.on("disconnected", () => {
    console.log("⚠️  ESP32 disconnected");
    isESP32Ready = false;
    io.emit("hardware-status", { ready: false, type: "esp32" });
  });
} else {
  console.log("⚠️  ESP32 hardware disabled (ESP32_ENABLED=false)");
}
```

**Step 4:** Add API endpoint for dispensing

Add this with your other API routes (around line 400):

```javascript
// Dispense medicine from specific slot
app.post("/api/dispense", (req, res) => {
  const { slot_number } = req.body;

  if (!slot_number || slot_number < 1 || slot_number > 4) {
    return res.status(400).json({ error: "Invalid slot_number (1-4)" });
  }

  if (process.env.ESP32_ENABLED === "true") {
    if (!isESP32Ready) {
      return res.status(503).json({ error: "ESP32 hardware not ready" });
    }

    const success = esp32.dispenseSlot(slot_number);

    if (success) {
      // Log dispensing in database
      const timestamp = new Date().toISOString();
      db.run(
        `INSERT INTO kiosk_logs (session_id, action, details, timestamp) 
         VALUES (?, ?, ?, ?)`,
        [
          req.body.session_id || "unknown",
          "dispense",
          JSON.stringify({ slot: slot_number }),
          timestamp,
        ],
        (err) => {
          if (err) console.error("Failed to log dispensing:", err);
        },
      );

      res.json({
        success: true,
        message: `Dispensing from slot ${slot_number}`,
        slot: slot_number,
      });
    } else {
      res.status(500).json({ error: "Failed to send dispense command" });
    }
  } else {
    // Simulation mode
    console.log(`[SIM] 💊 Simulating dispense from slot ${slot_number}`);
    setTimeout(() => {
      io.emit("dispense-confirmed", {
        slot: slot_number,
        timestamp: Date.now(),
      });
    }, 2000);

    res.json({
      success: true,
      message: `[SIMULATION] Dispensing from slot ${slot_number}`,
      slot: slot_number,
    });
  }
});

// Hardware test endpoints
app.post("/api/hardware/test-buzzer", (req, res) => {
  if (process.env.ESP32_ENABLED === "true" && isESP32Ready) {
    esp32.testBuzzer();
    res.json({ success: true, message: "Buzzer test triggered" });
  } else {
    res.status(503).json({ error: "ESP32 not available" });
  }
});

app.post("/api/hardware/test-leds", (req, res) => {
  if (process.env.ESP32_ENABLED === "true" && isESP32Ready) {
    esp32.testLEDs();
    res.json({ success: true, message: "LED test triggered" });
  } else {
    res.status(503).json({ error: "ESP32 not available" });
  }
});

app.post("/api/hardware/reset", (req, res) => {
  if (process.env.ESP32_ENABLED === "true" && isESP32Ready) {
    esp32.reset();
    res.json({ success: true, message: "ESP32 reset triggered" });
  } else {
    res.status(503).json({ error: "ESP32 not available" });
  }
});

app.get("/api/hardware/status", (req, res) => {
  if (process.env.ESP32_ENABLED === "true") {
    res.json({
      enabled: true,
      ready: isESP32Ready,
      connected: esp32.isReady(),
      lastRFID: esp32.getLastRFID(),
      lastVitals: esp32.getLastVitals(),
    });
  } else {
    res.json({
      enabled: false,
      mode: "simulation",
    });
  }
});
```

**Step 5:** Add cleanup on shutdown

Add at the bottom of server.js:

```javascript
// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");

  if (esp32 && esp32.isReady()) {
    esp32.disconnect();
  }

  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received");
  if (esp32 && esp32.isReady()) {
    esp32.disconnect();
  }
  process.exit(0);
});
```

---

## Frontend Integration

### Update VitalsScreen.tsx

The ESP32 now handles RFID scanning AND vital signs reading automatically. Update your VitalsScreen to listen for the combined event:

```typescript
useEffect(() => {
  // Listen for vitals completion from ESP32
  socket.on(
    "vitals-complete",
    (data: { temperature: number; heartRate: number }) => {
      console.log("Vitals received from ESP32:", data);

      sessionStorage.setItem("temperature", data.temperature.toString());
      sessionStorage.setItem("heart_rate", data.heartRate.toString());

      // Navigate to symptoms screen
      navigate("/symptoms");
    },
  );

  return () => {
    socket.off("vitals-complete");
  };
}, [socket, navigate]);
```

### Update WelcomeScreen.tsx

Listen for RFID scan events:

```typescript
useEffect(() => {
  socket.on("student-identified", (data: any) => {
    console.log("Student identified:", data);

    // Store student info
    sessionStorage.setItem("student", JSON.stringify(data));

    // Show welcome message
    toast.success(`Welcome, ${data.first_name}!`);

    // Navigate to vitals screen
    // The ESP32 will automatically start reading vitals
    navigate("/vitals");
  });

  socket.on("rfid-error", (data: any) => {
    toast.error(data.message || "Card not recognized");
  });

  return () => {
    socket.off("student-identified");
    socket.off("rfid-error");
  };
}, [socket, navigate]);
```

---

## Testing

### 1. Test Connection

```bash
node esp32-handler.js
```

You should see:

```
Available serial ports: [ ... ]
✅ ESP32 connected on /dev/ttyUSB0
✅ ESP32 system ready
```

### 2. Test Hardware Functions

From another terminal:

```bash
curl -X POST http://localhost:3001/api/hardware/test-buzzer
curl -X POST http://localhost:3001/api/hardware/test-leds
curl -X POST http://localhost:3001/api/hardware/reset
```

### 3. Test Dispensing

```bash
curl -X POST http://localhost:3001/api/dispense \
  -H "Content-Type: application/json" \
  -d '{"slot_number": 1, "session_id": "test123"}'
```

### 4. Check Hardware Status

```bash
curl http://localhost:3001/api/hardware/status
```

Expected response:

```json
{
  "enabled": true,
  "ready": true,
  "connected": true,
  "lastRFID": "A1B2C3D4",
  "lastVitals": {
    "temperature": 36.5,
    "heartRate": 75,
    "timestamp": 123456
  }
}
```

---

## User Flow with ESP32

1. **Student approaches kiosk** → WelcomeScreen displayed
2. **Student scans RFID card** → ESP32 emits `rfid_scan` event
3. **Backend looks up student** → Emits `student-identified` to frontend
4. **Frontend navigates to VitalsScreen** → Shows "Measuring vitals..."
5. **ESP32 automatically reads vitals** (5 seconds)
6. **ESP32 emits `vitals_data`** → Backend forwards to frontend
7. **Frontend navigates to SymptomsScreen** → Student selects symptoms
8. **Frontend navigates to RecommendationScreen** → Student clicks "Dispense"
9. **Frontend calls `/api/dispense`** → Backend sends command to ESP32
10. **ESP32 activates relay** (2 seconds) → Emits `dispense_complete`
11. **Backend emits `dispense-confirmed`** → Frontend shows success
12. **Frontend navigates to ReceiptScreen** → Transaction complete

---

## Troubleshooting

### Port Not Found

```
Error: Error: No such file or directory, cannot open /dev/ttyUSB0
```

**Solution:**

1. Check USB connection
2. List available ports: `ls /dev/tty*`
3. Update `ESP32_SERIAL_PORT` in `.env`
4. On Linux, add user to dialout group: `sudo usermod -a -G dialout $USER`

### Permission Denied

```
Error: Error: Permission denied, cannot open /dev/ttyUSB0
```

**Solution:**

```bash
sudo chmod 666 /dev/ttyUSB0
# Or permanently:
sudo usermod -a -G dialout $USER
# Then logout and login again
```

### ESP32 Not Responding

- Check if Arduino Serial Monitor is open (close it)
- Press RST button on ESP32
- Check baud rate (must be 115200)
- Verify wiring and power supply

### JSON Parse Errors

- Check line endings in Arduino code (`\n` only)
- Verify JSON format with `ArduinoJson` assistant
- Add more debug prints in ESP32 code

---

## Production Deployment

### 1. Enable ESP32 in Production

```env
# .env
ESP32_ENABLED=true
ESP32_SERIAL_PORT=/dev/ttyUSB0
ESP32_BAUD_RATE=115200
```

### 2. Setup SystemD Service (Linux)

Create `/etc/systemd/system/medisync-kiosk.service`:

```ini
[Unit]
Description=MediSync Kiosk Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/MediSync/Kiosk/Backend
Environment="NODE_ENV=production"
Environment="ESP32_ENABLED=true"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable medisync-kiosk
sudo systemctl start medisync-kiosk
sudo systemctl status medisync-kiosk
```

### 3. Monitor Logs

```bash
# Real-time logs
sudo journalctl -u medisync-kiosk -f

# Recent logs
sudo journalctl -u medisync-kiosk -n 100
```

---

## Next Steps

1. ✅ Upload ESP32 code to hardware
2. ✅ Test individual components
3. ✅ Integrate with backend
4. Test complete user flow
5. Calibrate sensor thresholds
6. Setup production service
7. Create hardware maintenance guide
