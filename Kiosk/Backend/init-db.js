const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database file location (adjust path as needed for your Raspberry Pi setup)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "kiosk.db");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite database at: ${DB_PATH}`);
});

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON", (err) => {
  if (err) {
    console.error("Error enabling foreign keys:", err.message);
    process.exit(1);
  }
});

// Arrays to track completion
const tables = [
  "students_cache",
  "medicines_library",
  "kiosk_slots",
  "kiosk_logs",
  "kiosk_students",
];
let completedTables = 0;

// 1. Create students_cache table (local mirror of student data)
db.run(
  `
  CREATE TABLE IF NOT EXISTS students_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE,
    student_uuid TEXT,
    rfid_uid TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    age INTEGER,
    grade_level INTEGER,
    section TEXT,
    medical_flags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
  (err) => {
    if (err) {
      console.error("Error creating students_cache table:", err.message);
      process.exit(1);
    }
    console.log("✓ students_cache table created or already exists");
    completedTables++;
    checkCompletion();
  },
);

// 2. Create medicines_library table
db.run(
  `
  CREATE TABLE IF NOT EXISTS medicines_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    symptoms_target TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
  (err) => {
    if (err) {
      console.error("Error creating medicines_library table:", err.message);
      process.exit(1);
    }
    console.log("✓ medicines_library table created or already exists");
    completedTables++;
    checkCompletion();
  },
);

// 3. Create kiosk_slots table (Dynamic slot management)
db.run(
  `
  CREATE TABLE IF NOT EXISTS kiosk_slots (
    slot_id INTEGER PRIMARY KEY,
    medicine_name TEXT NOT NULL,
    current_stock INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 50,
    last_restocked DATETIME,
    synced BOOLEAN DEFAULT 0,
    FOREIGN KEY (medicine_name) REFERENCES medicines_library(name)
  )
`,
  (err) => {
    if (err) {
      console.error("Error creating kiosk_slots table:", err.message);
      process.exit(1);
    }
    console.log("✓ kiosk_slots table created or already exists");
    completedTables++;
    checkCompletion();
  },
);

// 4. Create kiosk_logs table
db.run(
  `
  CREATE TABLE IF NOT EXISTS kiosk_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    unregistered_rfid_uid TEXT,
    symptoms TEXT,
    pain_scale INTEGER,
    temp_reading DECIMAL,
    heart_rate INTEGER,
    medicine_dispensed TEXT,
    slot_used INTEGER,
    synced BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
  (err) => {
    if (err) {
      console.error("Error creating kiosk_logs table:", err.message);
      process.exit(1);
    }
    console.log("✓ kiosk_logs table created or already exists");
    completedTables++;
    checkCompletion();
  },
);

// 5. Create kiosk_students table (tracks locally registered students)
db.run(
  `
  CREATE TABLE IF NOT EXISTS kiosk_students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    kiosk_id TEXT NOT NULL,
    rfid_uid TEXT,
    first_name TEXT,
    last_name TEXT,
    age INTEGER,
    grade_level INTEGER,
    section TEXT,
    kiosk_registered BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced BOOLEAN DEFAULT 0,
    UNIQUE(student_id, kiosk_id)
  )
`,
  (err) => {
    if (err) {
      console.error("Error creating kiosk_students table:", err.message);
      process.exit(1);
    }
    console.log("✓ kiosk_students table created or already exists");
    completedTables++;
    checkCompletion();
  },
);

// Helper function to check if all tables are created
function checkCompletion() {
  if (completedTables === tables.length) {
    console.log("\n✓ Database initialization complete!");
    console.log(`Database location: ${DB_PATH}`);

    // Display schema info
    console.log("\nDatabase schema:");
    tables.forEach((table) => {
      db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) {
          console.error(`Error reading ${table} schema:`, err.message);
        } else {
          console.log(`\n${table}:`);
          rows.forEach((row) => {
            console.log(
              `  - ${row.name} (${row.type}${row.notnull ? ", NOT NULL" : ""}${row.pk ? ", PRIMARY KEY" : ""})`,
            );
          });
        }
      });
    });

    // Close database after a short delay to let schema queries complete
    setTimeout(() => {
      db.close((err) => {
        if (err) {
          console.error("Error closing database:", err.message);
          process.exit(1);
        }
        console.log("\n✓ Database connection closed");
        process.exit(0);
      });
    }, 1000);
  }
}
