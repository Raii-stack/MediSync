const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Connect to a file-based database
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "kiosk.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    console.log(`Connected to the SQLite database at: ${DB_PATH}`);
  }
});

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON");

// Run migrations synchronously BEFORE allowing other queries
const migrationError = new Promise((resolve) => {
  db.serialize(() => {
    // Check and apply migrations
    db.all("PRAGMA table_info(students_cache)", (err, columns) => {
      if (err) {
        console.error("Error checking table schema:", err.message);
        resolve();
        return;
      }

      const columnNames = columns.map((col) => col.name);
      let migrationsApplied = 0;
      let migrationsTotal = 0;

      // Check what needs to be migrated
      const neededMigrations = [];

      // Check students_cache
      if (!columnNames.includes("age")) {
        neededMigrations.push(
          "ALTER TABLE students_cache ADD COLUMN age INTEGER;",
        );
      }
      if (!columnNames.includes("grade_level")) {
        neededMigrations.push(
          "ALTER TABLE students_cache ADD COLUMN grade_level INTEGER;",
        );
      }
      if (!columnNames.includes("created_at")) {
        neededMigrations.push(
          "ALTER TABLE students_cache ADD COLUMN created_at DATETIME;",
        );
      }
      if (!columnNames.includes("section")) {
        neededMigrations.push(
          "ALTER TABLE students_cache ADD COLUMN section TEXT;",
        );
      }
      if (!columnNames.includes("medical_flags")) {
        neededMigrations.push(
          "ALTER TABLE students_cache ADD COLUMN medical_flags TEXT;",
        );
      }

      // Chain the migrations to also check kiosk_logs
      db.all("PRAGMA table_info(kiosk_logs)", (logErr, logCols) => {
        if (!logErr && logCols) {
          const logColNames = logCols.map((c) => c.name);
          if (!logColNames.includes("rfid_uid")) {
            neededMigrations.push(
              "ALTER TABLE kiosk_logs ADD COLUMN rfid_uid TEXT;",
            );
          }
        }

        if (neededMigrations.length > 0) {
          console.log(
            `🔄 Running ${neededMigrations.length} schema migrations...`,
          );
          migrationsTotal = neededMigrations.length;

          neededMigrations.forEach((migration) => {
            db.run(migration, (runErr) => {
              migrationsApplied++;
              if (runErr) {
                console.log("Migration already applied or info:", runErr.message);
              } else {
                console.log(
                  "✓ Migration applied:",
                  migration.substring(0, 50) + "...",
                );
              }

              // Resolve promise when all migrations are attempted
              if (migrationsApplied === migrationsTotal) {
                console.log("✓ All migrations completed");

                // Update NULL created_at values for existing records
                db.run(
                  "UPDATE students_cache SET created_at = datetime('now') WHERE created_at IS NULL",
                  (updateErr) => {
                    if (updateErr) {
                      console.log(
                        "Info: Could not update created_at:",
                        updateErr.message,
                      );
                    } else {
                      console.log("✓ Updated created_at for existing records");
                    }
                    resolve();
                  },
                );
              }
            });
          });
        } else {
          console.log("✓ Schema is up to date");
          resolve();
        }
      });
    });
  });
});

// Wait for migrations to complete before proceeding
migrationError.then(() => {
  console.log("✓ Database ready for queries");

  // Note: Tables are created by init-db.js
  // This section only seeds sample data if tables are empty

  // 1. Seed Students Cache (Dummy Data)
  db.get("SELECT count(*) as count FROM students_cache", (err, row) => {
    if (!err && row && row.count === 0) {
      console.log("Seeding initial students...");
      const stmt = db.prepare(
        "INSERT OR IGNORE INTO students_cache (student_id, student_uuid, rfid_uid, first_name, last_name, age, grade_level, section, medical_flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      stmt.run(
        "123456",
        null,
        "RFID001",
        "Ryan",
        "Dela Cruz",
        15,
        10,
        "12-STEM",
        "",
      );
      stmt.run(
        "TEST-001",
        null,
        "RFID002",
        "Juan",
        "Reyes",
        16,
        11,
        "11-ICT",
        "",
      );
      stmt.run(
        "TEST-002",
        null,
        "RFID003",
        "Maria",
        "Santos",
        17,
        12,
        "12-ABM",
        "",
      );
      stmt.run(
        "TEST-003",
        null,
        "RFID004",
        "Pedro",
        "Garcia",
        15,
        11,
        "11-HUMSS",
        "",
      );
      stmt.finalize();
    }
  });
});

module.exports = db;
