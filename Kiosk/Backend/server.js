const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { io: ioClient } = require("socket.io-client");
const cors = require("cors");
const { execSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const db = require("./database");
const hardware = require("./serial");
const syncService = require("./syncService");
const wifiService = require("./wifiService");
const gpioService = require("./gpioService");

// Initialize App
const app = express();
const KIOSK_ID = process.env.KIOSK_ID || "kiosk-001";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function updateKioskPresence(status, source = "server") {
  const payload = {
    kiosk_id: KIOSK_ID,
    kioskId: KIOSK_ID,
    status,
    source,
    timestamp: new Date().toISOString(),
  };

  if (supabase) {
    const { error } = await supabase.from("kiosks").upsert(
      {
        kiosk_id: KIOSK_ID,
        room_assigned: process.env.ROOM_ASSIGNED || "Room TBD",
        status,
      },
      { onConflict: "kiosk_id" },
    );

    if (error) {
      console.error(`[PRESENCE] Failed to set ${status}:`, error.message);
    } else {
      console.log(`[PRESENCE] Kiosk ${KIOSK_ID} marked ${status}`);
    }
  }

  if (clinicSocket && clinicSocket.connected) {
    clinicSocket.emit("kiosk-status-update", payload);
    clinicSocket.emit("kiosk-status", payload);
    console.log(`[PRESENCE] Emitted kiosk status to clinic socket: ${status}`);
  }
}

function pushKioskLogToCloud(payload, onSuccess) {
  if (!supabase) return;

  supabase
    .from("kiosk_logs")
    .insert([payload])
    .then(({ error }) => {
      if (error) {
        console.error("[CLOUD] Failed to write kiosk log:", error.message);
        return;
      }

      if (onSuccess) onSuccess();
    });
}

function logUnregisteredRfid(uid, timestamp) {
  const payload = {
    kiosk_id: KIOSK_ID,
    rfid_uid: uid,
    symptoms_reported: [],
    pain_scale: null,
    temp_reading: null,
    heart_rate_bpm: null,
    medicine_dispensed: null,
    created_at: timestamp,
  };

  db.run(
    `
      INSERT INTO kiosk_logs 
      (rfid_uid, symptoms, pain_scale, temp_reading, heart_rate, medicine_dispensed, slot_used, synced, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `,
    [uid, "", null, null, null, null, null, timestamp],
    function (err) {
      if (err) {
        console.error("Error logging unregistered RFID:", err.message);
        pushKioskLogToCloud(payload);
        return;
      }

      const localLogId = this.lastID;

      pushKioskLogToCloud(payload, () => {
        db.run(
          "UPDATE kiosk_logs SET synced = 1 WHERE id = ?",
          [localLogId],
          (syncErr) => {
            if (syncErr) {
              console.error(
                "Error marking unregistered RFID log as synced:",
                syncErr.message,
              );
            }
          },
        );
      });
    },
  );
}

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
    updateKioskPresence("Online", "clinic_socket_connect").catch((error) => {
      console.error("[PRESENCE] Online update failed:", error.message);
    });
  });

  clinicSocket.on("disconnect", () => {
    console.log(`⚠️  Disconnected from clinic app`);
    updateKioskPresence("Offline", "clinic_socket_disconnect").catch((error) => {
      console.error("[PRESENCE] Offline update failed:", error.message);
    });
  });

  clinicSocket.on("connect_error", (error) => {
    console.error(`❌ Clinic socket connection error: ${error.message}`);
    updateKioskPresence("Offline", "clinic_socket_error").catch((updateErr) => {
      console.error("[PRESENCE] Offline update failed:", updateErr.message);
    });
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

    // Reset ESP32 and vitals session when client disconnects
    console.log("🔄 Resetting ESP32 and vitals session...");
    resetVitalsSession();

    // Send reset command to ESP32
    if (hardware.stopScan) {
      hardware.stopScan();
    }
    if (hardware.sessionEnd) {
      hardware.sessionEnd();
    }
  });
});

// --- 1. HARDWARE STREAMING ---
// When we get data (real or simulated), send it to the Frontend

// Initialize RFID to idle (green) on startup
setTimeout(() => {
  console.log("[INIT] Setting RFID to idle (green)...");
  if (hardware.sessionEnd) {
    hardware.sessionEnd();
  }
}, 1000);

console.log("[DEBUG] Setting up hardware.onData callback...");
hardware.onData((event) => {
  if (!event) return;

  if (event.type === "login") {
    const uid = event.uid;
    if (!uid) return;

    // Don't call sessionStart here - it will be called when vitals scan starts
    // Just emit the RFID scan event to the frontend

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

          logUnregisteredRfid(uid, timestamp);

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
      // Simulation fallback: calculate based on sample count (5 samples total)
      progress = Math.min(100, vitalsSession.sampleCount * 20);
    }
    io.emit("vitals-progress", {
      bpm: bpmValue,
      temp: tempValue,
      progress: progress,
    });

    // Auto-complete after collecting enough samples (SIMULATION MODE ONLY)
    // In hardware mode, wait for ESP32's vitals_complete signal
    if (
      hardware.isSimulation &&
      hardware.isSimulation() &&
      vitalsSession.sampleCount >= 5
    ) {
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

  if (event.type === "status") {
    if (event.status === "waiting_for_finger") {
      io.emit("sensor-status", { status: "waiting_for_finger" });
    }
    return;
  }

  if (event.type === "emergency") {
    console.log(`🚨 EMERGENCY BUTTON - Physical device triggered, telling UI to open modal`);
    // Emit to local UI to show the Emergency Modal
    io.emit("physical-emergency-trigger");
    return;
  }

  if (event.type === "rfid_test") {
    const uid = event.uid;
    if (!uid) return;

    console.log(`[RFID TEST] 🧪 Test scan received: ${uid}`);

    // Look up student in database and emit to frontend
    db.get(
      "SELECT * FROM students_cache WHERE rfid_uid = ?",
      [uid],
      (err, row) => {
        if (err) {
          console.error("[RFID TEST] Database error:", err.message);
          io.emit("rfid-test-scan", { student: null, uid });
          return;
        }

        if (row) {
          console.log(
            `[RFID TEST] ✅ Student found: ${row.first_name} ${row.last_name}`,
          );
          io.emit("rfid-test-scan", { student: row, uid });
        } else {
          console.log(`[RFID TEST] ⚠️  Unknown RFID: ${uid}`);
          io.emit("rfid-test-scan", { student: null, uid });
        }
      },
    );

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
        console.log(`⚠️  Unknown student ID: ${student_id} - login rejected`);
        res.status(401).json({
          success: false,
          error: "Unregistered Student",
          message: "You are not registered in the system. Please proceed to the clinic admin to register.",
        });
      }
    },
  );
});

// GET: Fetch all students directly from the Clinic API
app.get("/api/students", async (req, res) => {
  if (!CLINIC_SOCKET_URL) {
    return res.status(500).json({ success: false, error: "CLINIC_SOCKET_URL not configured" });
  }

  try {
    console.log(`[API] Fetching students from clinic backend...`);
    // The clinic backend endpoint we created
    const response = await fetch(`${CLINIC_SOCKET_URL}/api/students/kiosk-get-students`);
    
    if (!response.ok) {
      throw new Error(`Clinic API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data); // Returns { success: true, count: X, data: [...] }
  } catch (error) {
    console.error("[API] Error fetching students from clinic backend:", error.message);
    
    // Fallback to local cache if offline
    console.log("[API] Falling back to local students cache...");
    db.all(
      "SELECT id, student_id, rfid_uid, first_name, last_name, age, grade_level, section, COALESCE(created_at, datetime('now')) as created_at FROM students_cache ORDER BY first_name",
      (err, rows) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }
        // Map to match the clinic API structure for seamless frontend integration
        res.json({ success: true, count: rows.length, data: rows || [] });
      }
    );
  }
});

// POST: Register a new student with RFID
app.post("/api/students/register", async (req, res) => {
  const {
    student_id,
    rfid_uid,
    first_name,
    last_name,
    age,
    grade_level,
    section,
  } = req.body;

  // Validate required fields
  if (
    !student_id ||
    !rfid_uid ||
    !first_name ||
    !last_name ||
    age === undefined ||
    grade_level === undefined ||
    !section
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Missing required fields: student_id, rfid_uid, first_name, last_name, age, grade_level, section",
    });
  }

  if (!CLINIC_SOCKET_URL) {
    return res.status(500).json({ success: false, error: "CLINIC_SOCKET_URL not configured" });
  }

  try {
    console.log(`[API] Registering student ${first_name} ${last_name} to clinic backend...`);
    
    const response = await fetch(`${CLINIC_SOCKET_URL}/api/students/kiosk-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    console.log(`✅ Student registered successfully in clinic backend`);

    // Add to local cache for quick login/offline support after successful cloud registration
    db.run(
      "INSERT OR IGNORE INTO students_cache (student_id, rfid_uid, first_name, last_name, age, grade_level, section) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        student_id,
        rfid_uid,
        first_name,
        last_name,
        age,
        grade_level,
        section,
      ],
      function (insertErr) {
        if (insertErr) {
          console.error("Error caching registered student locally:", insertErr.message);
        } else {
          // Also track in kiosk_students
          db.run(
            "INSERT OR IGNORE INTO kiosk_students (student_id, kiosk_id, rfid_uid, first_name, last_name, age, grade_level, section, kiosk_registered, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)",
            [
              student_id,
              KIOSK_ID,
              rfid_uid,
              first_name,
              last_name,
              age,
              grade_level,
              section,
            ]
          );
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Student registered successfully",
      student: data.data?.student || req.body,
    });
  } catch (error) {
    console.error("[API] Error registering student to clinic backend:", error.message);
    res.status(500).json({ success: false, error: "Failed to reach Clinic Server for registration" });
  }
});

// PUT: Update student data
app.put("/api/students/:id", (req, res) => {
  const { id } = req.params;
  const { student_id, first_name, last_name, age, grade_level, section } =
    req.body;

  // Validate required fields
  if (
    !student_id ||
    !first_name ||
    !last_name ||
    age === undefined ||
    grade_level === undefined ||
    !section
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Missing required fields: student_id, first_name, last_name, age, grade_level, section",
    });
  }

  // Update student in database
  db.run(
    "UPDATE students_cache SET student_id = ?, first_name = ?, last_name = ?, age = ?, grade_level = ?, section = ? WHERE id = ?",
    [student_id, first_name, last_name, age, grade_level, section, id],
    function (err) {
      if (err) {
        console.error("Error updating student:", err.message);
        return res.status(500).json({ success: false, error: "Update failed" });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: "Student not found",
        });
      }

      // Fetch and return the updated student
      db.get(
        "SELECT id, student_id, rfid_uid, first_name, last_name, age, grade_level, section, created_at FROM students_cache WHERE id = ?",
        [id],
        (fetchErr, student) => {
          if (fetchErr) {
            console.error("Error fetching updated student:", fetchErr.message);
            return res.status(500).json({
              success: false,
              error: "Failed to fetch updated student",
            });
          }

          console.log(
            `✅ Student updated: ${first_name} ${last_name} (${student_id})`,
          );
          res.json({
            success: true,
            message: "Student updated successfully",
            student: student,
          });
        },
      );
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
  const { medicine, student_id, rfid_uid, student_name, symptoms, pain_level, vitals } =
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
        (rfid_uid, symptoms, pain_scale, temp_reading, heart_rate, medicine_dispensed, slot_used, synced, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      stmt.run(
        rfid_uid || null,
        Array.isArray(symptoms) ? symptoms.join(",") : symptoms || "",
        pain_level || null,
        vitals?.temp || null,
        vitals?.bpm || null,
        medicine,
        servoId,
        timestamp,
        function (logErr) {
          if (logErr) {
            console.error("Error logging dispense:", logErr.message);
            return;
          }

          if (!supabase) return;

          const localLogId = this.lastID;
          const symptomsArray = Array.isArray(symptoms)
            ? symptoms
            : typeof symptoms === "string" && symptoms.trim().length > 0
              ? symptoms.split(",").map((s) => s.trim())
              : [];

          const logPayloadBase = {
            kiosk_id: KIOSK_ID,
            rfid_uid: rfid_uid || null,
            symptoms_reported: symptomsArray,
            pain_scale: pain_level || null,
            temp_reading: vitals?.temp || null,
            heart_rate_bpm: vitals?.bpm || null,
            medicine_dispensed: medicine,
            created_at: timestamp,
          };

          const localStudentId =
            student_id && student_id !== "ANON" ? student_id : null;

          const markSynced = () => {
            db.run(
              "UPDATE kiosk_logs SET synced = 1 WHERE id = ?",
              [localLogId],
              (syncErr) => {
                if (syncErr) {
                  console.error(
                    "Error marking dispense log as synced:",
                    syncErr.message,
                  );
                }
              },
            );
          };

          pushKioskLogToCloud(logPayloadBase, markSynced);
        },
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
app.get("/api/scan", async (req, res) => {
  const result = await wifiService.scanWifi();
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// POST: Connect to WiFi network
app.post("/api/connect", async (req, res) => {
  const { ssid, password } = req.body;

  if (!ssid) {
    return res.status(400).json({
      success: false,
      error: "SSID is required",
    });
  }

  const result = await wifiService.connectToWifi(ssid, password);
  if (result.success) {
    res.json({
      success: true,
      message: result.message,
      ssid,
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.message || `Failed to connect to ${ssid}`,
    });
  }
});

// POST: Start Sensor Scan
app.post("/api/scan/start", (req, res) => {
  console.log("🟢 START_SCAN received");
  resetVitalsSession();
  vitalsSession.isScanning = true;

  // Disable RFID when session starts
  if (hardware.sessionStart) {
    hardware.sessionStart();
  }
  
  // Set LED to Scanning Active visual state
  gpioService.setScanning();

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

// POST: End kiosk session (reset RFID LED)
app.post("/api/session/end", (req, res) => {
  console.log("🔵 SESSION_END received");
  if (hardware.sessionEnd) {
    hardware.sessionEnd();
  }
  gpioService.setIdle();
  res.json({ success: true, message: "Session ended" });
});

// POST: RFID Test - Allow admin to test RFID without affecting session state
app.post("/api/rfid-test/simulate", (req, res) => {
  const { rfid_uid } = req.body;

  if (!rfid_uid) {
    return res.status(400).json({
      success: false,
      message: "rfid_uid required",
    });
  }

  console.log(`🧪 [TEST] Simulating RFID scan: ${rfid_uid}`);

  db.get(
    "SELECT * FROM students_cache WHERE rfid_uid = ?",
    [rfid_uid],
    (err, row) => {
      if (err) {
        console.error("RFID lookup error:", err.message);
        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      if (row) {
        console.log(
          `✅ [TEST] Student found: ${row.first_name} ${row.last_name} (${rfid_uid})`,
        );
        return res.json({
          success: true,
          student: row,
          uid: rfid_uid,
        });
      } else {
        console.log(`⚠️  [TEST] Unknown RFID: ${rfid_uid}`);
        return res.json({
          success: true,
          student: null,
          uid: rfid_uid,
        });
      }
    },
  );
});

// POST: Start RFID Hardware Test Mode
app.post("/api/rfid-test/start", (req, res) => {
  console.log("🧪 RFID_TEST_START received - Enabling hardware test mode");
  if (hardware.startRfidTest) {
    const result = hardware.startRfidTest();
    return res.json({
      success: true,
      message: "RFID test mode enabled",
      mode: result.mode,
    });
  }
  res.status(500).json({
    success: false,
    message: "Hardware not available",
  });
});

// POST: Stop RFID Hardware Test Mode
app.post("/api/rfid-test/stop", (req, res) => {
  console.log("🧪 RFID_TEST_STOP received - Disabling hardware test mode");
  if (hardware.stopRfidTest) {
    const result = hardware.stopRfidTest();
    return res.json({
      success: true,
      message: "RFID test mode disabled",
      mode: result.mode,
    });
  }
  res.status(500).json({
    success: false,
    message: "Hardware not available",
  });
});

// POST: Explicitly enable RFID scanner
app.post("/api/esp32/enable-rfid", (req, res) => {
  console.log("🔓 ENABLE_RFID received - Enabling scanner independently");
  if (hardware.enableRfid) {
    const result = hardware.enableRfid();
    gpioService.setScanning();
    return res.json({
      success: true,
      message: "RFID scanner enabled",
      mode: result.mode,
    });
  }
  res.status(500).json({
    success: false,
    message: "Hardware not available",
  });
});

// POST: Explicitly disable RFID scanner
app.post("/api/esp32/disable-rfid", (req, res) => {
  console.log("🔒 DISABLE_RFID received - Disabling scanner independently");
  if (hardware.disableRfid) {
    const result = hardware.disableRfid();
    gpioService.setIdle();
    return res.json({
      success: true,
      message: "RFID scanner disabled",
      mode: result.mode,
    });
  }
  res.status(500).json({
    success: false,
    message: "Hardware not available",
  });
});

// POST: Emergency Alert
app.post("/api/emergency", (req, res) => {
  const { student_id, rfid_uid, equipment } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`🚨 EMERGENCY ALERT TRIGGERED`);
  console.log(`   Kiosk: ${KIOSK_ID}`);
  console.log(`   Student ID: ${student_id || "Unknown"}`);
  console.log(`   RFID UID: ${rfid_uid || "None"}`);
  console.log(`   Equipment: ${equipment || "None"}`);
  console.log(`   Time: ${timestamp}`);

  const emergencyData = {
    kiosk_id: KIOSK_ID,
    student_id: student_id || null,
    rfid_uid: rfid_uid || null,
    timestamp,
    equipment: equipment || null,
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

  if (!slot_id || slot_id < 1 || slot_id > 5) {
    return res.status(400).json({
      success: false,
      message: "Invalid slot_id (must be 1-5)",
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

  updateKioskPresence("Online", "server_start").catch((error) => {
    console.error("[PRESENCE] Startup online update failed:", error.message);
  });

  // Start edge-to-cloud sync service (shares this process's db + supabase)
  syncService.start(db, supabase, { kioskId: KIOSK_ID });
});

// Graceful shutdown
let shuttingDown = false;

async function handleShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`🛑 ${signal} received. Marking kiosk offline...`);

  try {
    await updateKioskPresence("Offline", `shutdown_${signal}`);
  } catch (error) {
    console.error("[PRESENCE] Shutdown offline update failed:", error.message);
  }

  syncService.stop();
  process.exit(0);
}

process.on("SIGINT", () => {
  handleShutdown("SIGINT");
});
process.on("SIGTERM", () => {
  handleShutdown("SIGTERM");
});
