const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Connect to a file-based database
// In production (Docker), DB_PATH should point to /app/data/kiosk.db (the mounted volume)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "kiosk.db");

// Ensure the directory for the database file exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created database directory: ${dbDir}`);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    console.log(`Connected to the SQLite database at: ${DB_PATH}`);
  }
});

db.dbPath = DB_PATH;

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

        // Also check medicines_library compatibility (legacy image_link -> image_url, and cooldown_hours)
        db.all("PRAGMA table_info(medicines_library)", (medErr, medCols) => {
          let hasLegacyImageLink = false;

          if (!medErr && medCols) {
            const medColNames = medCols.map((c) => c.name);
            hasLegacyImageLink = medColNames.includes("image_link");
            if (!medColNames.includes("image_url")) {
              neededMigrations.push(
                "ALTER TABLE medicines_library ADD COLUMN image_url TEXT;",
              );
            }
            if (!medColNames.includes("cooldown_hours")) {
              neededMigrations.push(
                "ALTER TABLE medicines_library ADD COLUMN cooldown_hours INTEGER DEFAULT 0;",
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
                    if (hasLegacyImageLink) {
                      db.run(
                        "UPDATE medicines_library SET image_url = image_link WHERE (image_url IS NULL OR image_url = '') AND image_link IS NOT NULL AND image_link != ''",
                        (copyErr) => {
                          if (copyErr) {
                            console.log(
                              "Info: Could not backfill image_url from image_link:",
                              copyErr.message,
                            );
                          } else {
                            console.log(
                              "✓ Backfilled medicines_library.image_url from image_link",
                            );
                          }
                          resolve();
                        },
                      );
                    } else {
                      resolve();
                    }
                  },
                );
              }
            });
          });
          } else {
            console.log("✓ Schema is up to date");
            if (hasLegacyImageLink) {
              db.run(
                "UPDATE medicines_library SET image_url = image_link WHERE (image_url IS NULL OR image_url = '') AND image_link IS NOT NULL AND image_link != ''",
                (copyErr) => {
                  if (copyErr) {
                    console.log(
                      "Info: Could not backfill image_url from image_link:",
                      copyErr.message,
                    );
                  } else {
                    console.log(
                      "✓ Backfilled medicines_library.image_url from image_link",
                    );
                  }
                  resolve();
                },
              );
            } else {
              resolve();
            }
          }
        });
      });
    });
  });
});

// Wait for migrations to complete before proceeding
migrationError.then(() => {
  console.log("✓ Database ready for queries");

  db.run(
    "UPDATE kiosk_slots SET max_stock = 15 WHERE max_stock IS NULL OR max_stock != 15",
    (slotMaxErr) => {
      if (slotMaxErr) {
        console.log("Info: Could not normalize kiosk_slots.max_stock:", slotMaxErr.message);
      } else {
        console.log("✓ Normalized kiosk_slots.max_stock to 15");
      }
    },
  );

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
