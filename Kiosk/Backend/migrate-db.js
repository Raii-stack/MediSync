const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kiosk.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite database at: ${DB_PATH}`);
});

db.serialize(() => {
  // Drop and recreate students_cache with student_uuid column
  console.log('Migrating students_cache table...');
  
  db.run('DROP TABLE IF EXISTS students_cache', (err) => {
    if (err) {
      console.error('Error dropping table:', err.message);
      process.exit(1);
    }
    
    // Recreate with new schema
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
        console.error('Error creating table:', err.message);
        process.exit(1);
      }
      console.log('✓ students_cache table migrated successfully');
      
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          process.exit(1);
        }
        console.log('✓ Database connection closed');
        process.exit(0);
      });
    });
  });
});
