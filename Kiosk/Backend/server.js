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

// GET: Check Inventory
app.get('/api/inventory', (req, res) => {
  db.all("SELECT * FROM inventory", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST: Dispense Medicine
app.post('/api/dispense', (req, res) => {
  const { medicine, student_id, symptoms, pain_level } = req.body;

  console.log(`Request to dispense: ${medicine}`);

  // Map Medicine Name -> Servo ID
  const servoMap = {
    "Biogesic": 1,
    "Neozep": 2,
    "Buscopan": 3,
    "Cetirizine": 4
  };

  const servoId = servoMap[medicine];
  if (!servoId) return res.status(400).json({ error: "Unknown Medicine" });

  // Check Stock
  db.get("SELECT current_stock FROM inventory WHERE name = ?", [medicine], (err, row) => {
    if (!row || row.current_stock <= 0) {
      return res.status(400).json({ success: false, message: "Out of Stock" });
    }

    // IF STOCK AVAILABLE:
    // 1. Move Motor
    hardware.dispense(servoId);

    // 2. Deduct Stock
    db.run("UPDATE inventory SET current_stock = current_stock - 1 WHERE name = ?", [medicine]);

    // 3. Log Transaction
    const stmt = db.prepare("INSERT INTO transactions (student_id, symptoms, pain_level, medicine_dispensed) VALUES (?, ?, ?, ?)");
    stmt.run(student_id || "ANON", JSON.stringify(symptoms), pain_level, medicine);
    stmt.finalize();

    res.json({ success: true, message: `Dispensing ${medicine}...` });
  });
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
