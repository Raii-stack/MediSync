const sqlite3 = require('sqlite3').verbose();

// Connect to a file-based database
const db = new sqlite3.Database('./kiosk.db', (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

db.serialize(() => {
  // Note: Tables are created by init-db.js
  // This section only seeds sample data if tables are empty

  // 1. Seed Students Cache (Dummy Data)
  db.get("SELECT count(*) as count FROM students_cache", (err, row) => {
    if (!err && row.count === 0) {
      console.log("Seeding initial students...");
      const stmt = db.prepare("INSERT OR IGNORE INTO students_cache (student_id, student_uuid, rfid_uid, first_name, last_name, section, medical_flags) VALUES (?, ?, ?, ?, ?, ?, ?)");
      stmt.run("123456", null, "RFID001", "Ryan", "Dela Cruz", "12-STEM", "");
      stmt.run("TEST-001", null, "RFID002", "Juan", "Reyes", "11-ICT", "");
      stmt.run("TEST-002", null, "RFID003", "Maria", "Santos", "12-ABM", "");
      stmt.run("TEST-003", null, "RFID004", "Pedro", "Garcia", "11-HUMSS", "");
      stmt.finalize();
    }
  });
});

module.exports = db;
