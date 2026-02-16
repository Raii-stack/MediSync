const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();
const db = require("./database");
const hardware = require("./serial");

// Initialize App
const app = express();
const KIOSK_ID = process.env.KIOSK_ID || "kiosk-001";

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

    // Emit as vitals-progress for realtime updates
    const progress = Math.min(10, vitalsSession.sampleCount / 5);
    io.emit("vitals-progress", {
      bpm: bpmValue,
      temp: tempValue,
      progress: progress,
    });

    // Auto-complete after collecting enough samples (around 35 seconds worth)
    // Simulation generates every 2 seconds, so ~17 samples
    if (vitalsSession.sampleCount >= 17) {
      console.log(
        "[VITALS] Auto-completing scan after collecting sufficient samples",
      );
      hardware.stopScan();
      completeVitalsSession();
    }

    return;
  }
});

// Register callback for when hardware auto-stops the scan
hardware.onStop(() => {
  console.log("[VITALS] Hardware auto-stop triggered, completing session");
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

  // Insert emergency alert into database
  db.run(
    `INSERT INTO emergency_alerts (student_id, status, synced, created_at) 
     VALUES (?, ?, ?, ?)`,
    [student_id || null, "PENDING", 0, timestamp],
    function (err) {
      if (err) {
        console.error("❌ Failed to save emergency alert:", err.message);
        return res.status(500).json({
          success: false,
          message: "Failed to save alert",
        });
      }

      console.log(`✅ Emergency alert saved (ID: ${this.lastID})`);
      console.log(`   Will sync to cloud on next sync cycle`);

      // Emit Socket.IO event for real-time dashboard updates
      io.emit("emergency-alert", {
        id: this.lastID,
        kiosk_id: KIOSK_ID,
        student_id: student_id || null,
        timestamp,
      });

      res.json({
        success: true,
        message: "Emergency alert sent. Clinic will be notified.",
        alert_id: this.lastID,
      });
    },
  );
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
  const interval = setInterval(() => {
    sampleCount++;
    const progress = Math.min(10, sampleCount / 2);

    // Add some variance
    const varyBpm = simulatedBpm + (Math.random() - 0.5) * 10;
    const varyTemp = parseFloat(simulatedTemp) + (Math.random() - 0.5) * 0.5;

    console.log(
      `[DEBUG] Sample ${sampleCount}: BPM=${varyBpm.toFixed(1)}, Temp=${varyTemp.toFixed(1)}, Progress=${progress.toFixed(1)}`,
    );

    io.emit("vitals-progress", {
      bpm: parseFloat(varyBpm.toFixed(1)),
      temp: parseFloat(varyTemp.toFixed(1)),
      progress: parseFloat(progress.toFixed(1)),
      sample_count: sampleCount,
      debug: true,
    });

    // Complete after duration
    if (sampleCount >= simulationDuration * 2) {
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

// GET: Debug - Status
app.get("/api/debug/status", (req, res) => {
  // Explicitly set CORS headers
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  res.json({
    success: true,
    debug_mode: true,
    connected_clients: io.engine.clientsCount,
    message:
      "Debug endpoints available: POST /api/debug/rfid, POST /api/debug/vitals",
  });
});

// --- START SERVER ---
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ MediSync Backend running on http://localhost:${PORT}`);
  console.log(`🔓 CORS: Allowing all origins`);
  console.log(`🔌 Socket.IO: Available at ws://localhost:${PORT}`);
});
