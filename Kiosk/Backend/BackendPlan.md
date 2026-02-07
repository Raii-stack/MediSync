

### **Chunk 1: Project Initialization**

1. **Create a folder** for your backend on your desktop (e.g., `medisync-backend`).
2. **Open VS Code** and drag this folder into it.
3. **Open the Terminal** (`Ctrl + ``) and run these commands:

```bash
# Initialize the project (creates package.json)
npm init -y

# Install the required libraries
# express: Web Server
# sqlite3: Local Database
# serialport: To talk to ESP32
# socket.io: Real-time communication (for Heartbeat graph)
# cors: Allows Frontend to talk to Backend
# @supabase/supabase-js: For Cloud Sync
npm install express sqlite3 serialport socket.io cors @supabase/supabase-js

```

---

### **Chunk 2: The Local Database (`database.js`)**

This file manages your offline-first data. It creates the tables automatically if they don't exist.

**Create a new file named `database.js`:**

```javascript
const sqlite3 = require('sqlite3').verbose();

// Connect to a file-based database
const db = new sqlite3.Database('./medisync.db', (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

db.serialize(() => {
  // 1. Create Inventory Table
  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    current_stock INTEGER,
    max_stock INTEGER
  )`);

  // 2. Create Transactions Table (Logs)
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    symptoms TEXT,
    pain_level INTEGER,
    medicine_dispensed TEXT,
    synced INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 3. Seed Data (Only if empty) - So you have something to test with
  db.get("SELECT count(*) as count FROM inventory", (err, row) => {
    if (row.count === 0) {
      console.log("Seeding initial inventory...");
      const stmt = db.prepare("INSERT INTO inventory (name, current_stock, max_stock) VALUES (?, ?, ?)");
      stmt.run("Biogesic", 50, 50);
      stmt.run("Neozep", 50, 50);
      stmt.run("Buscopan", 30, 30);
      stmt.run("Cetirizine", 30, 30);
      stmt.finalize();
    }
  });
});

module.exports = db;

```

---

### **Chunk 3: The Hardware Bridge (`serial.js`)**

This script handles the ESP32. I have added a `try-catch` block so that if you are on your PC (where there is no ESP32 connected), it enters **Simulation Mode** instead of crashing.

**Create a new file named `serial.js`:**

```javascript
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// CONFIGURATION: Check your PC's Device Manager for the correct port if actually connecting an ESP32
// Windows: 'COM3' or 'COM4'
// Mac/Linux/Pi: '/dev/ttyUSB0' or '/dev/ttyACM0'
const PORT_PATH = 'COM3'; 

let port;
let parser;

try {
  port = new SerialPort({ path: PORT_PATH, baudRate: 9600 });
  parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
  console.log(`Connected to ESP32 on ${PORT_PATH}`);
} catch (err) {
  console.log("⚠️ ESP32 NOT FOUND. Switching to SIMULATION MODE.");
  port = null;
}

module.exports = {
  // 1. Listen for Sensor Data
  onData: (callback) => {
    if (port && parser) {
      // Real Mode: Listen to ESP32
      parser.on('data', (line) => {
        try {
          const json = JSON.parse(line);
          callback(json);
        } catch (e) { console.error("Bad Serial Data"); }
      });
    } else {
      // Simulation Mode: Generate fake heartbeat/temp every second
      console.log("[SIM] Generating fake sensor data...");
      setInterval(() => {
        const fakeData = {
          temp: (36.0 + Math.random()).toFixed(1), // Random temp 36.0 - 37.0
          bpm: Math.floor(60 + Math.random() * 40) // Random BPM 60 - 100
        };
        callback(fakeData);
      }, 2000);
    }
  },

  // 2. Send Dispense Command
  dispense: (servoId) => {
    if (port) {
      // Real Mode
      const command = JSON.stringify({ action: 'dispense', servo: servoId });
      port.write(command + '\n');
      console.log(`Sent to ESP32: ${command}`);
    } else {
      // Simulation Mode
      console.log(`[SIMULATION] -------------------------`);
      console.log(`[SIMULATION] 💊 MOTOR MOVING: SERVO ${servoId}`);
      console.log(`[SIMULATION] -------------------------`);
    }
  }
};

```

---

### **Chunk 4: The Main Server (`server.js`)**

This ties everything together. It runs on **Port 3001** to avoid conflict with your React Frontend (which usually runs on 3000 or 5173).

**Create a new file named `server.js`:**

```javascript
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

```

---

### **How to Run It**

1. Make sure you are in the `medisync-backend` folder in your terminal.
2. Run the server:
```bash
node server.js

```

