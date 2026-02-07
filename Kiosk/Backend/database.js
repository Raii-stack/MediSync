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
