const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const db = require('./database');
const hardware = require('./serial');

// Initialize App
const app = express();
app.use(cors()); // Allow Frontend to access this
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*" } // Allow any connection (for dev)
});

// --- 1. HARDWARE STREAMING ---
// When we get data (real or simulated), send it to the Frontend
hardware.onData((data) => {
  io.emit('vitals-update', data);
});

// --- 2. API ENDPOINTS ---

// POST: Student Login / Scan ID
app.post('/api/login', (req, res) => {
  const { student_id } = req.body;
  
  if (!student_id) {
    return res.status(400).json({ error: "student_id required" });
  }
  
  db.get("SELECT * FROM students_cache WHERE student_id = ?", [student_id], (err, row) => {
    if (err) {
      console.error("Login DB error:", err.message);
      return res.status(500).json({ error: "Database Error" });
    }
    
    if (row) {
      console.log(`✅ Student logged in: ${row.first_name} ${row.last_name} (${student_id})`);
      res.json({ success: true, student: row });
    } else {
      // Auto-register "Unknown" students for testing
      console.log(`⚠️  Unknown student ID: ${student_id} - allowing as Guest`);
      res.json({ 
        success: true, 
        student: { 
          student_id, 
          first_name: "Guest", 
          last_name: "Student",
          section: "N/A"
        } 
      });
    }
  });
});

// GET: Check Inventory (Kiosk Slots)
app.get('/api/inventory', (req, res) => {
  db.all(`
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
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- ADMIN API: Get all medicines ---
app.get('/api/admin/medicines', (req, res) => {
  db.all("SELECT * FROM medicines_library ORDER BY name", (err, rows) => {
    if (err) {
      console.error('Error fetching medicines:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, medicines: rows });
  });
});

// --- ADMIN API: Add new medicine ---
app.post('/api/admin/medicines', (req, res) => {
  const { name, description, symptoms_target } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: "Medicine name required" });
  }
  
  db.run(
    "INSERT INTO medicines_library (name, description, symptoms_target) VALUES (?, ?, ?)",
    [name, description || '', symptoms_target || ''],
    function(err) {
      if (err) {
        console.error('Error adding medicine:', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        success: true, 
        message: `Medicine '${name}' added`,
        id: this.lastID 
      });
    }
  );
});

// --- ADMIN API: Get current slot configuration ---
app.get('/api/admin/slots', (req, res) => {
  db.all(`
    SELECT 
      ks.slot_id, 
      ks.medicine_name, 
      ks.current_stock,
      ks.max_stock,
      ks.last_restocked,
      ml.description,
      ml.symptoms_target
    FROM kiosk_slots ks
    LEFT JOIN medicines_library ml ON ks.medicine_name = ml.name
    ORDER BY ks.slot_id
  `, (err, rows) => {
    if (err) {
      console.error('Error fetching slots:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, slots: rows });
  });
});

// --- ADMIN API: Update slot assignment ---
app.post('/api/admin/slots', (req, res) => {
  const { slot_id, medicine_name, current_stock } = req.body;
  
  if (!slot_id || !medicine_name) {
    return res.status(400).json({ error: "slot_id and medicine_name required" });
  }
  
  // Verify medicine exists
  db.get("SELECT id FROM medicines_library WHERE name = ?", [medicine_name], (err, row) => {
    if (err || !row) {
      return res.status(400).json({ error: `Medicine '${medicine_name}' not found` });
    }
    
    // Update slot
    db.run(
      "UPDATE kiosk_slots SET medicine_name = ?, current_stock = ?, synced = 0 WHERE slot_id = ?",
      [medicine_name, current_stock || 0, slot_id],
      function(err) {
        if (err) {
          console.error('Error updating slot:', err.message);
          return res.status(500).json({ error: err.message });
        }
        
        console.log(`✅ Updated Slot ${slot_id} to ${medicine_name}`);
        res.json({ 
          success: true, 
          message: `Slot ${slot_id} updated to ${medicine_name}` 
        });
      }
    );
  });
});

// POST: Dispense Medicine (Dynamic Slots)
app.post('/api/dispense', (req, res) => {
  const { medicine, student_id, student_name, symptoms, pain_level, vitals } = req.body;

  console.log(`Request to dispense: ${medicine} for ${student_name || student_id}`);

  // Query kiosk_slots to find which slot has this medicine
  db.get(
    "SELECT slot_id, current_stock FROM kiosk_slots WHERE medicine_name = ?",
    [medicine],
    (err, slot) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!slot) {
        return res.status(400).json({ 
          success: false, 
          message: `Medicine '${medicine}' not loaded in any slot` 
        });
      }

      if (slot.current_stock <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Out of Stock: ${medicine}` 
        });
      }

      // Trigger hardware dispense using slot_id (1-4)
      const servoId = slot.slot_id;
      console.log(`📤 Dispensing from Slot ${servoId}: ${medicine}`);
      hardware.dispense(servoId);

      // Decrement stock in kiosk_slots
      db.run(
        "UPDATE kiosk_slots SET current_stock = current_stock - 1, synced = 0 WHERE slot_id = ?",
        [servoId]
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
        Array.isArray(symptoms) ? symptoms.join(",") : (symptoms || ""),
        pain_level || null,
        vitals?.temp || null,
        vitals?.bpm || null,
        medicine,
        servoId,
        timestamp
      );
      stmt.finalize();

      res.json({ 
        success: true, 
        message: `Dispensing ${medicine}...`,
        slot_id: servoId,
        timestamp: new Date().toLocaleString()
      });
    }
  );
});

// POST: Start Sensor Scan
app.post('/api/scan/start', (req, res) => {
  console.log('🟢 START_SCAN received');
  hardware.startScan();
  res.json({ success: true, message: 'Scan started' });
});

// POST: Stop Sensor Scan
app.post('/api/scan/stop', (req, res) => {
  console.log('🟠 STOP_SCAN received');
  hardware.stopScan();
  res.json({ success: true, message: 'Scan stopped' });
});

// POST: Emergency Alert
app.post('/api/emergency', (req, res) => {
  const { room_number } = req.body;
  console.log(`🚨 EMERGENCY ALERT RECEIVED FROM ROOM: ${room_number}`);
  
  // Here we will add the Supabase Cloud Sync later
  
  res.json({ success: true, message: "Clinic Notified" });
});

// --- START SERVER ---
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ MediSync Backend running on http://localhost:${PORT}`);
});
