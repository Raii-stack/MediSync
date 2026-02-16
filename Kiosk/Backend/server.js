const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { io: ioClient } = require("socket.io-client");
const cors = require("cors");
require("dotenv").config();
const db = require("./database");
const hardware = require("./serial");

// Initialize App
const app = express();
const KIOSK_ID = process.env.KIOSK_ID || "kiosk-001";

// Connect to Clinic Socket (for emergency alerts)
const CLINIC_SOCKET_URL = process.env.CLINIC_SOCKET_URL;
let clinicSocket = null;

if (CLINIC_SOCKET_URL) {
  console.log(`🏥 Connecting to clinic socket at: ${CLINIC_SOCKET_URL}`);
  clinicSocket = ioClient(CLINIC_SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });

  clinicSocket.on("connect", () => {
    console.log(`✅ Connected to clinic app (Socket ID: ${clinicSocket.id})`);
  });

  clinicSocket.on("disconnect", () => {
    console.log(`⚠️  Disconnected from clinic app`);
  });

  clinicSocket.on("connect_error", (error) => {
    console.error(`❌ Clinic socket connection error: ${error.message}`);
  });
} else {
  console.log(
    "⚠️  CLINIC_SOCKET_URL not set. Emergency alerts will only be logged.",
  );
}

// CORS Configuration - Allow all origins for development
const corsOptions = {
  origin: function (origin, callback) {
    callback(null, true); // Allow all origins
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 30000,
  pingInterval: 10000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,
  allowUpgrades: true,
  perMessageDeflate: false,
  httpCompression: false,
  connectTimeout: 45000,
});

const activeSessionSockets = new Map();

// Vitals tracking for calculating averages
let vitalsSession = {
  isScanning: false,
  bpmSamples: [],
  tempSamples: [],
  sampleCount: 0,
  lastEmitTime: 0,
};

function resetVitalsSession() {
  vitalsSession = {
    isScanning: false,
    bpmSamples: [],
    tempSamples: [],
    sampleCount: 0,
    lastEmitTime: 0,
  };
}

function completeVitalsSession() {
  if (
    vitalsSession.bpmSamples.length === 0 ||
    vitalsSession.tempSamples.length === 0
  ) {
    console.log("[VITALS] No samples collected, not emitting completion event");
    resetVitalsSession();
    return;
  }

  const avgBpm =
    vitalsSession.bpmSamples.reduce((a, b) => a + b, 0) /
    vitalsSession.bpmSamples.length;
  const avgTemp =
    vitalsSession.tempSamples.reduce((a, b) => a + b, 0) /
    vitalsSession.tempSamples.length;

  console.log(
    `[VITALS] ✅ Scan complete - Avg BPM: ${avgBpm.toFixed(1)}, Avg Temp: ${avgTemp.toFixed(1)}`,
  );

  io.emit("vitals-complete", {
    avg_bpm: parseFloat(avgBpm.toFixed(1)),
    temp: parseFloat(avgTemp.toFixed(1)),
  });

  resetVitalsSession();
}

// Socket.IO connection handler
io.on("connection", (socket) => {
  const sessionId = socket.handshake.auth?.sessionId;

  if (sessionId) {
    const existingSocketId = activeSessionSockets.get(sessionId);
    if (existingSocketId && existingSocketId !== socket.id) {
      console.log(`♻️ Replacing duplicate client for session ${sessionId}`);
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        existingSocket.disconnect(true);
      }
    }
    activeSessionSockets.set(sessionId, socket.id);
  }

  console.log(
    `✅ Client connected: ${socket.id}${sessionId ? ` (session ${sessionId})` : ""}`,
  );

  socket.on("disconnect", (reason) => {
    if (sessionId && activeSessionSockets.get(sessionId) === socket.id) {
      activeSessionSockets.delete(sessionId);
    }
    console.log(`❌ Client disconnected: ${socket.id} - ${reason}`);
  });
});

// --- 1. HARDWARE STREAMING ---
// When we get data (real or simulated), send it to the Frontend
console.log("[DEBUG] Setting up hardware.onData callback...");
hardware.onData((event) => {
  if (!event) return;

  if (event.type === "login") {
    const uid = event.uid;
    if (!uid) return;

    db.get(
      "SELECT * FROM students_cache WHERE rfid_uid = ?",
      [uid],
      (err, row) => {
        if (err) {
          console.error("RFID lookup error:", err.message);
          io.emit("rfid-scan", { student: null, uid });
          return;
        }

        if (row) {
          // Student found in cache
          console.log(
            `✅ Student found: ${row.first_name} ${row.last_name} (${uid})`,
          );
          io.emit("rfid-scan", { student: row, uid });
        } else {
          // Student not in cache - create a placeholder entry for later sync
          console.log(`⚠️  Unknown RFID: ${uid} - Caching for sync`);
          const timestamp = new Date().toISOString();
          const tempStudentId = `UNCACHED_${uid}_${Date.now()}`;

          db.run(
            `INSERT INTO students_cache (student_id, rfid_uid, first_name, last_name, section, medical_flags) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [tempStudentId, uid, "Unknown", "Student", "Pending Sync", ""],
            function (insertErr) {
              if (insertErr) {
                console.error("Error caching unknown RFID:", insertErr.message);
                io.emit("rfid-scan", { student: null, uid });
              } else {
                console.log(
                  `🆕 Cached unknown RFID ${uid} as ${tempStudentId}`,
                );
                const newStudent = {
                  student_id: tempStudentId,
                  rfid_uid: uid,
                  first_name: "Unknown",
                  last_name: "Student",
                  section: "Pending Sync",
                  medical_flags: "",
                };
                io.emit("rfid-scan", { student: newStudent, uid });
              }
            },
          );
        }
      },
    );
    return;
  }

  if (event.type === "vitals") {
    console.log("[DEBUG] hardware vitals event:", event.data);
    console.log("[DEBUG] Connected clients count:", io.engine.clientsCount);

    // Track samples for averaging
    const bpmValue = parseFloat(event.data.bpm);
    const tempValue = parseFloat(event.data.temp);

    if (!isNaN(bpmValue)) {
      vitalsSession.bpmSamples.push(bpmValue);
    }
    if (!isNaN(tempValue)) {
      vitalsSession.tempSamples.push(tempValue);
    }
    vitalsSession.sampleCount++;
    vitalsSession.isScanning = true;

    // Use progress from ESP32 if provided (hardware mode), otherwise calculate for simulation
    // ESP32 sends progress as 0-1 (heartReadings/15), convert to 0-100 for frontend
    let progress;
    if (event.data.progress !== undefined) {
      // Hardware mode: ESP32 sends 0-1.0, convert to 0-100
      progress = Math.min(100, event.data.progress * 100);
    } else {
      // Simulation fallback: calculate based on sample count
      progress = Math.min(100, vitalsSession.sampleCount * 10);
    }
    io.emit("vitals-progress", {
      bpm: bpmValue,
      temp: tempValue,
      progress: progress,
    });

    // Auto-complete after collecting enough samples (SIMULATION MODE ONLY)
    // In hardware mode, wait for ESP32's vitals_complete signal
    if (hardware.isSimulation && hardware.isSimulation() && vitalsSession.sampleCount >= 17) {
      console.log(
        "[VITALS] [SIMULATION] Auto-completing scan after collecting sufficient samples",
      );
      hardware.stopScan();
      completeVitalsSession();
    }

    return;
  }

  // Handle hardware vitals completion (ESP32 sends final averaged result)
  if (event.type === "vitals_complete") {
    console.log("[VITALS] ✅ Hardware vitals complete:", event.data);

    const bpmValue = parseFloat(event.data.bpm);
    const tempValue = parseFloat(event.data.temp);

    // Add to session samples if not already added
    if (!isNaN(bpmValue) && !vitalsSession.bpmSamples.includes(bpmValue)) {
      vitalsSession.bpmSamples.push(bpmValue);
    }
    if (!isNaN(tempValue) && !vitalsSession.tempSamples.includes(tempValue)) {
      vitalsSession.tempSamples.push(tempValue);
    }
    vitalsSession.isScanning = true;

    // Complete the session immediately with the hardware's averaged data
    completeVitalsSession();
    return;
  }

  if (event.type === "emergency") {
    console.log(`🚨 EMERGENCY BUTTON - Physical device triggered`);
    const timestamp = new Date().toISOString();

    const emergencyData = {
      kiosk_id: KIOSK_ID,
      student_id: null, // Physical button doesn't know who pressed it
      timestamp,
      alert_type: "physical_button",
      source: event.source || "physical_button",
    };

    // Emit to local UI
    io.emit("emergency-alert", emergencyData);

    // Emit to clinic app via socket
    if (clinicSocket && clinicSocket.connected) {
      clinicSocket.emit("kiosk-emergency", emergencyData);
      console.log(`✅ Physical emergency alert sent to clinic app`);
    } else {
      console.error(
        "❌ Clinic socket not connected. Physical emergency alert not sent.",
      );
    }

    return;
  }
});

// Register callback for when simulation auto-stops the scan
hardware.onStop(() => {
  console.log("[VITALS] Simulation auto-stop triggered, completing session");
  if (vitalsSession.isScanning) {
    completeVitalsSession();
  }
});

// --- 2. API ENDPOINTS ---

// POST: Student Login / Scan ID
app.post("/api/login", (req, res) => {
  const { student_id } = req.body;

  if (!student_id) {
    return res.status(400).json({ error: "student_id required" });
  }

  db.get(
    "SELECT * FROM students_cache WHERE student_id = ?",
    [student_id],
    (err, row) => {
      if (err) {
        console.error("Login DB error:", err.message);
        return res.status(500).json({ error: "Database Error" });
      }

      if (row) {
        console.log(
          `✅ Student logged in: ${row.first_name} ${row.last_name} (${student_id})`,
        );
        res.json({ success: true, student: row });
      } else {
        // Auto-register "Unknown" students for testing
        console.log(
          `⚠️  Unknown student ID: ${student_id} - allowing as Guest`,
        );
        res.json({
          success: true,
          student: {
            student_id,
            first_name: "Guest",
            last_name: "Student",
            section: "N/A",
          },
        });
      }
    },
  );
});

// GET: Check Inventory (Kiosk Slots)
app.get("/api/inventory", (req, res) => {
  db.all(
    `
    SELECT 
      ks.slot_id, 
      ks.medicine_name, 
      ks.current_stock,
      ks.max_stock,
      ml.description,
      ml.symptoms_target
    FROM kiosk_slots ks
    LEFT JOIN medicines_library ml ON ks.medicine_name = ml.name
    ORDER BY ks.slot_id
  `,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    },
  );
});

// --- ADMIN API: Get all medicines ---
app.get("/api/admin/medicines", (req, res) => {
  db.all("SELECT * FROM medicines_library ORDER BY name", (err, rows) => {
    if (err) {
      console.error("Error fetching medicines:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, medicines: rows });
  });
});

// --- ADMIN API: Add new medicine ---
app.post("/api/admin/medicines", (req, res) => {
  const { name, description, symptoms_target } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Medicine name required" });
  }

  db.run(
    "INSERT INTO medicines_library (name, description, symptoms_target) VALUES (?, ?, ?)",
    [name, description || "", symptoms_target || ""],
    function (err) {
      if (err) {
        console.error("Error adding medicine:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: `Medicine '${name}' added`,
        id: this.lastID,
      });
    },
  );
});

// --- ADMIN API: Get current slot configuration ---
app.get("/api/admin/slots", (req, res) => {
  db.all(
    `
    SELECT 
      ks.slot_id, 
      ks.medicine_name, 
      ks.current_stock,
      ks.max_stock as max_capacity,
      ks.last_restocked,
      ml.description,
      ml.symptoms_target,
      ml.image_url
    FROM kiosk_slots ks
    LEFT JOIN medicines_library ml ON ks.medicine_name = ml.name
    ORDER BY ks.slot_id
  `,
    (err, rows) => {
      if (err) {
        console.error("Error fetching slots:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, slots: rows });
    },
  );
});

// --- ADMIN API: Update slot assignment ---
app.post("/api/admin/slots", (req, res) => {
  const { slot_id, medicine_name, current_stock, stock } = req.body;

  if (!slot_id || !medicine_name) {
    return res
      .status(400)
      .json({ error: "slot_id and medicine_name required" });
  }

  // Accept stock from either "stock" or "current_stock" field
  const providedStock = stock !== undefined ? stock : current_stock;

  // Verify medicine exists
  db.get(
    "SELECT id FROM medicines_library WHERE name = ?",
    [medicine_name],
    (err, row) => {
      if (err || !row) {
        return res
          .status(400)
          .json({ error: `Medicine '${medicine_name}' not found` });
      }

      // If stock was provided, validate and use it; otherwise keep existing stock
      if (providedStock !== undefined && providedStock !== null) {
        const stockNum = parseInt(providedStock, 10);
        if (isNaN(stockNum) || stockNum < 0) {
          return res
            .status(400)
            .json({ error: "current_stock must be a valid integer >= 0" });
        }

        db.run(
          "UPDATE kiosk_slots SET medicine_name = ?, current_stock = ?, synced = 0 WHERE slot_id = ?",
          [medicine_name, stockNum, slot_id],
          function (err) {
            if (err) {
              console.error("Error updating slot:", err.message);
              return res.status(500).json({ error: err.message });
            }
            console.log(
              `✅ Updated Slot ${slot_id} to ${medicine_name} (Stock: ${stockNum})`,
            );
            res.json({
              success: true,
              message: `Slot ${slot_id} updated to ${medicine_name} (Stock: ${stockNum})`,
            });
          },
        );
      } else {
        // No stock provided — update medicine only, keep existing stock
        db.run(
          "UPDATE kiosk_slots SET medicine_name = ?, synced = 0 WHERE slot_id = ?",
          [medicine_name, slot_id],
          function (err) {
            if (err) {
              console.error("Error updating slot:", err.message);
              return res.status(500).json({ error: err.message });
            }
            console.log(
              `✅ Updated Slot ${slot_id} to ${medicine_name} (Stock: unchanged)`,
            );
            res.json({
              success: true,
              message: `Slot ${slot_id} updated to ${medicine_name}`,
            });
          },
        );
      }
    },
  );
});

// POST: Dispense Medicine (Dynamic Slots)
app.post("/api/dispense", (req, res) => {
  const { medicine, student_id, student_name, symptoms, pain_level, vitals } =
    req.body;

  console.log(
    `Request to dispense: ${medicine} for ${student_name || student_id}`,
  );

  // Query kiosk_slots to find which slot has this medicine
  db.get(
    "SELECT slot_id, current_stock FROM kiosk_slots WHERE medicine_name = ?",
    [medicine],
    (err, slot) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ error: "Database error" });
      }

      if (!slot) {
        return res.status(400).json({
          success: false,
          message: `Medicine '${medicine}' not loaded in any slot`,
        });
      }

      if (slot.current_stock <= 0) {
        return res.status(400).json({
          success: false,
          message: `Out of Stock: ${medicine}`,
        });
      }

      // Trigger hardware dispense using slot_id (1-4)
      const servoId = slot.slot_id;
      console.log(`📤 Dispensing from Slot ${servoId}: ${medicine}`);
      hardware.dispense(servoId);

      // Decrement stock in kiosk_slots
      db.run(
        "UPDATE kiosk_slots SET current_stock = current_stock - 1, synced = 0 WHERE slot_id = ?",
        [servoId],
      );

      // Log transaction
      const timestamp = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO kiosk_logs 
        (student_id, symptoms, pain_scale, temp_reading, heart_rate, medicine_dispensed, slot_used, synced, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      stmt.run(
        student_id || "ANON",
        Array.isArray(symptoms) ? symptoms.join(",") : symptoms || "",
        pain_level || null,
        vitals?.temp || null,
        vitals?.bpm || null,
        medicine,
        servoId,
        timestamp,
      );
      stmt.finalize();

      res.json({
        success: true,
        message: `Dispensing ${medicine}...`,
        slot_id: servoId,
        timestamp: new Date().toLocaleString(),
      });
    },
  );
});

// --- ADMIN API: WiFi Network Management ---
// GET: Scan for WiFi networks
app.get("/api/scan", (req, res) => {
  console.log("📡 WiFi Scan requested");

  // For development/testing, return mock data
  // In production on Raspberry Pi, use nmcli or similar
  const mockNetworks = [
    {
      ssid: "SchoolNet_5G",
      signalStrength: 95,
      security: "WPA2",
      isConnected: false,
    },
    {
      ssid: "SchoolNet_2.4G",
      signalStrength: 88,
      security: "WPA2",
      isConnected: false,
    },
    {
      ssid: "Clinic_Network",
      signalStrength: 72,
      security: "WPA3",
      isConnected: false,
    },
    {
      ssid: "Guest_WiFi",
      signalStrength: 65,
      security: "Open",
      isConnected: false,
    },
  ];

  // TODO: On Raspberry Pi, use:
  // const { execSync } = require('child_process');
  // const output = execSync('nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list').toString();
  // Parse the output and return networks

  res.json({
    success: true,
    networks: mockNetworks,
  });
});

// POST: Connect to WiFi network
app.post("/api/connect", (req, res) => {
  const { ssid, password } = req.body;

  if (!ssid) {
    return res.status(400).json({
      success: false,
      error: "SSID is required",
    });
  }

  console.log(`📶 Attempting to connect to WiFi: ${ssid}`);

  // For development/testing, simulate success
  // In production on Raspberry Pi, use nmcli to connect
  // TODO: On Raspberry Pi, use:
  // const { execSync } = require('child_process');
  // try {
  //   execSync(`nmcli dev wifi connect "${ssid}" password "${password}"`);
  //   res.json({ success: true, message: `Connected to ${ssid}` });
  // } catch (error) {
  //   res.status(500).json({ success: false, error: error.message });
  // }

  setTimeout(() => {
    res.json({
      success: true,
      message: `Connected to ${ssid}`,
      ssid,
    });
  }, 1000);
});

// POST: Start Sensor Scan
app.post("/api/scan/start", (req, res) => {
  console.log("🟢 START_SCAN received");
  resetVitalsSession();
  vitalsSession.isScanning = true;
  hardware.startScan();
  res.json({ success: true, message: "Scan started" });
});

// POST: Stop Sensor Scan
app.post("/api/scan/stop", (req, res) => {
  console.log("🟠 STOP_SCAN received");
  hardware.stopScan();

  // Complete the vitals session with averaged data
  if (vitalsSession.isScanning) {
    completeVitalsSession();
  }

  res.json({ success: true, message: "Scan stopped" });
});

// POST: Emergency Alert
app.post("/api/emergency", (req, res) => {
  const { student_id } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`🚨 EMERGENCY ALERT TRIGGERED`);
  console.log(`   Kiosk: ${KIOSK_ID}`);
  console.log(`   Student ID: ${student_id || "Unknown"}`);
  console.log(`   Time: ${timestamp}`);

  const emergencyData = {
    kiosk_id: KIOSK_ID,
    student_id: student_id || null,
    timestamp,
    alert_type: "emergency_button",
  };

  // Emit to local UI (for immediate feedback)
  io.emit("emergency-alert", emergencyData);

  // Emit to clinic app via socket
  if (clinicSocket && clinicSocket.connected) {
    clinicSocket.emit("kiosk-emergency", emergencyData);
    console.log(`✅ Emergency alert sent to clinic app`);
    res.json({
      success: true,
      message: "Emergency alert sent to clinic.",
    });
  } else {
    console.error("❌ Clinic socket not connected. Alert not sent.");
    res.status(503).json({
      success: false,
      message: "Clinic connection unavailable. Please contact staff directly.",
    });
  }
});

// ========== DEBUG ENDPOINTS ==========
// These endpoints are for testing Socket.IO without hardware

// POST: Debug - Simulate RFID Tap
app.post("/api/debug/rfid", (req, res) => {
  // Explicitly set CORS headers
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  const { rfid_uid } = req.body;
  const uid = rfid_uid || `TEST_RFID_${Date.now()}`;

  console.log(`\n\n🔴 [DEBUG] Simulating RFID tap: ${uid}`);

  // Trigger RFID lookup
  db.get(
    "SELECT * FROM students_cache WHERE rfid_uid = ?",
    [uid],
    (err, row) => {
      if (err) {
        console.error("RFID lookup error:", err.message);
        io.emit("rfid-scan", { student: null, uid, debug: true });
        return;
      }
      io.emit("rfid-scan", { student: row || null, uid, debug: true });
      console.log(`✅ [DEBUG] RFID scan emitted for ${uid}`);
    },
  );

  res.json({ success: true, message: `Simulating RFID: ${uid}` });
});

// POST: Debug - Trigger ESP32 RFID Simulation
app.post("/api/debug/esp32-rfid", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  const { uid } = req.body;

  console.log(`\n\n🔴 [DEBUG] Sending fake RFID to ESP32 to trigger vitals...`);

  const result = hardware.sendFakeRFIDToESP32(uid);

  if (result.success) {
    res.json({
      success: true,
      message: `Fake RFID sent to ESP32: ${result.uid}`,
      uid: result.uid,
      mode: result.mode,
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Failed to send fake RFID to ESP32",
    });
  }
});

// POST: Debug - Simulate Vitals Data
app.post("/api/debug/vitals", (req, res) => {
  // Explicitly set CORS headers
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  const { bpm, temp, duration } = req.body;
  const simulatedBpm = bpm || 75;
  const simulatedTemp = temp || 37.0;
  const simulationDuration = duration || 5; // seconds

  console.log(
    `\n\n🔴 [DEBUG] Simulating vitals data for ${simulationDuration}s`,
  );
  console.log(`  BPM: ${simulatedBpm}, Temp: ${simulatedTemp}°C`);

  let sampleCount = 0;
  const totalSamples = simulationDuration * 2; // 2 samples per second
  const interval = setInterval(() => {
    sampleCount++;
    // Progress 0-100 to match ESP32 flow
    const progress = Math.min(
      100,
      Math.round((sampleCount / totalSamples) * 100),
    );

    // Add some variance
    const varyBpm = simulatedBpm + (Math.random() - 0.5) * 10;
    const varyTemp = parseFloat(simulatedTemp) + (Math.random() - 0.5) * 0.5;

    console.log(
      `[DEBUG] Sample ${sampleCount}/${totalSamples}: BPM=${varyBpm.toFixed(1)}, Temp=${varyTemp.toFixed(1)}, Progress=${progress}%`,
    );

    io.emit("vitals-progress", {
      bpm: parseFloat(varyBpm.toFixed(1)),
      temp: parseFloat(varyTemp.toFixed(1)),
      progress: progress,
      sample_count: sampleCount,
      debug: true,
    });

    // Complete after duration
    if (sampleCount >= totalSamples) {
      clearInterval(interval);
      io.emit("vitals-complete", {
        avg_bpm: simulatedBpm,
        temp: parseFloat(simulatedTemp.toFixed(1)),
        debug: true,
      });
      console.log(`✅ [DEBUG] Vitals simulation complete`);
    }
  }, 500);

  res.json({
    success: true,
    message: `Simulating vitals for ${simulationDuration}s`,
    params: { bpm: simulatedBpm, temp: simulatedTemp },
  });
});

// POST: ESP32 - Blink Heart Rate LED
app.post("/api/esp32/blink-heart-led", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  console.log("💡 [ESP32] Starting heart rate LED blink");

  const result = hardware.blinkHeartLED();

  res.json({
    success: result.success,
    message: "Heart rate LED blinking started",
    mode: result.mode,
  });
});

// POST: ESP32 - Stop LED Blinking
app.post("/api/esp32/stop-blink", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  console.log("💡 [ESP32] Stopping LED blink");

  const result = hardware.stopBlinkLED();

  res.json({
    success: result.success,
    message: "LED blinking stopped",
    mode: result.mode,
  });
});

// POST: Test Dispense (Admin tool - just triggers hardware without logging)
app.post("/api/test-dispense", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  const { slot_id } = req.body;

  if (!slot_id || slot_id < 1 || slot_id > 4) {
    return res.status(400).json({
      success: false,
      message: "Invalid slot_id (must be 1-4)",
    });
  }

  console.log(`🧪 [TEST] Dispensing from Slot ${slot_id}`);
  hardware.dispense(slot_id);

  res.json({
    success: true,
    message: `Test dispense from slot ${slot_id} sent to hardware`,
    slot_id: slot_id,
  });
});

// --- START SERVER ---
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ MediSync Backend running on http://localhost:${PORT}`);
  console.log(`🔓 CORS: Allowing all origins`);
  console.log(`🔌 Socket.IO: Available at ws://localhost:${PORT}`);
});
