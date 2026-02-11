const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file location (adjust path as needed for your Raspberry Pi setup)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kiosk.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite database at: ${DB_PATH}`);
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON', (err) => {
  if (err) {
    console.error('Error enabling foreign keys:', err.message);
    process.exit(1);
  }
});

// Arrays to track completion
const tables = [
  'kiosk_config',
  'students_cache',
  'medicines_library',
  'kiosk_slots',
  'kiosk_logs',
  'emergency_alerts'
];
let completedTables = 0;

// 1. Create kiosk_config table
db.run(`
  CREATE TABLE IF NOT EXISTS kiosk_config (
    kiosk_id TEXT PRIMARY KEY,
    room_assigned TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creating kiosk_config table:', err.message);
    process.exit(1);
  }
  console.log('✓ kiosk_config table created or already exists');
  completedTables++;
  checkCompletion();
});

// 2. Create students_cache table (local mirror of student data)
db.run(`
  CREATE TABLE IF NOT EXISTS students_cache (
    student_id TEXT PRIMARY KEY,
    student_uuid TEXT,
    rfid_uid TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    section TEXT,
    medical_flags TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creating students_cache table:', err.message);
    process.exit(1);
  }
  console.log('✓ students_cache table created or already exists');
  completedTables++;
  checkCompletion();
});

// 3. Create medicines_library table
db.run(`
  CREATE TABLE IF NOT EXISTS medicines_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    symptoms_target TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating medicines_library table:', err.message);
    process.exit(1);
  }
  console.log('✓ medicines_library table created or already exists');
  completedTables++;
  checkCompletion();
});

// 4. Create kiosk_slots table (Dynamic slot management)
db.run(`
  CREATE TABLE IF NOT EXISTS kiosk_slots (
    slot_id INTEGER PRIMARY KEY,
    medicine_name TEXT NOT NULL,
    current_stock INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 50,
    last_restocked DATETIME,
    synced BOOLEAN DEFAULT 0,
    FOREIGN KEY (medicine_name) REFERENCES medicines_library(name)
  )
`, (err) => {
  if (err) {
    console.error('Error creating kiosk_slots table:', err.message);
    process.exit(1);
  }
  console.log('✓ kiosk_slots table created or already exists');
  completedTables++;
  checkCompletion();
});

// 5. Create kiosk_logs table (references local students_cache, NOT cloud)
db.run(`
  CREATE TABLE IF NOT EXISTS kiosk_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    symptoms TEXT,
    pain_scale INTEGER,
    temp_reading DECIMAL,
    heart_rate INTEGER,
    medicine_dispensed TEXT,
    slot_used INTEGER,
    synced BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students_cache(student_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating kiosk_logs table:', err.message);
    process.exit(1);
  }
  console.log('✓ kiosk_logs table created or already exists');
  completedTables++;
  checkCompletion();
});

// 6. Create emergency_alerts table
db.run(`
  CREATE TABLE IF NOT EXISTS emergency_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    status TEXT DEFAULT 'PENDING',
    synced BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating emergency_alerts table:', err.message);
    process.exit(1);
  }
  console.log('✓ emergency_alerts table created or already exists');
  completedTables++;
  checkCompletion();
});

// Helper function to check if all tables are created
function checkCompletion() {
  if (completedTables === tables.length) {
    console.log('\n✓ Database initialization complete!');
    console.log(`Database location: ${DB_PATH}`);
    
    // Seed medicines library first, then slots (to avoid FK constraint)
    seedMedicinesLibrary(() => {
      seedKioskSlots();
    });
    
    // Display schema info
    console.log('\nDatabase schema:');
    tables.forEach((table) => {
      db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) {
          console.error(`Error reading ${table} schema:`, err.message);
        } else {
          console.log(`\n${table}:`);
          rows.forEach(row => {
            console.log(`  - ${row.name} (${row.type}${row.notnull ? ', NOT NULL' : ''}${row.pk ? ', PRIMARY KEY' : ''})`);
          });
        }
      });
    });
    
    // Close database after a short delay to let schema queries complete
    setTimeout(() => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          process.exit(1);
        }
        console.log('\n✓ Database connection closed');
        process.exit(0);
      });
    }, 1000);
  }
}

// Seed medicines library
function seedMedicinesLibrary(callback) {
  db.get("SELECT COUNT(*) as count FROM medicines_library", (err, row) => {
    if (!err && row.count === 0) {
      console.log('\n📚 Seeding medicines library...');
      const medicines = [
        { name: "Biogesic", description: "Paracetamol 500mg", symptoms_target: "Fever, Headache, Pain", image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop" },
        { name: "Neozep", description: "Cold and Flu Relief", symptoms_target: "Colds, Rhinitis, Cough", image_url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop" },
        { name: "Buscopan", description: "Antispasmodic 10mg", symptoms_target: "Abdominal Pain, Dysmenorrhea", image_url: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop" },
        { name: "Cetirizine", description: "Antihistamine 10mg", symptoms_target: "Allergies, Rhinitis", image_url: "https://images.unsplash.com/photo-1550572017-4332368c8f1f?w=400&h=400&fit=crop" },
        { name: "Bioflu", description: "Multi-symptom Cold Relief", symptoms_target: "Flu, Colds", image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop" },
        { name: "Dolo", description: "Paracetamol 500mg", symptoms_target: "Pain, Fever", image_url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop" }
      ];
      
      const stmt = db.prepare(
        "INSERT INTO medicines_library (name, description, symptoms_target, image_url) VALUES (?, ?, ?, ?)"
      );
      
      medicines.forEach(med => {
        stmt.run(med.name, med.description, med.symptoms_target, med.image_url);
      });
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error seeding medicines:', err.message);
        } else {
          console.log(`✓ Seeded ${medicines.length} medicines`);
        }
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  });
}

// Seed kiosk slots with default configuration
function seedKioskSlots() {
  db.get("SELECT COUNT(*) as count FROM kiosk_slots", (err, row) => {
    if (!err && row.count === 0) {
      console.log('📦 Seeding kiosk slots...');
      const defaultSlots = [
        { slot_id: 1, medicine_name: "Biogesic", current_stock: 50 },
        { slot_id: 2, medicine_name: "Neozep", current_stock: 50 },
        { slot_id: 3, medicine_name: "Buscopan", current_stock: 30 },
        { slot_id: 4, medicine_name: "Cetirizine", current_stock: 30 }
      ];
      
      const stmt = db.prepare(
        "INSERT INTO kiosk_slots (slot_id, medicine_name, current_stock, max_stock) VALUES (?, ?, ?, 50)"
      );
      
      defaultSlots.forEach(slot => {
        stmt.run(slot.slot_id, slot.medicine_name, slot.current_stock);
      });
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error seeding slots:', err.message);
        } else {
          console.log(`✓ Seeded ${defaultSlots.length} kiosk slots`);
        }
      });
    }
  });
}
