const { createClient } = require("@supabase/supabase-js");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config(); // Load .env file

/**
 * ============================================================================
 * MediSync SYNC AGENT
 * ============================================================================
 *
 * SYNC STRATEGY:
 *
 * PULL (Cloud → Local):
 * - medicines_library: Pull all medicines from cloud to keep local copy updated
 * - kiosk_inventory: Pull slot configurations for this kiosk to stay in sync
 *
 * PUSH (Local → Cloud):
 * - kiosk_students: Push only locally registered students (not entire student DB)
 * - kiosk_logs: Push all kiosk usage logs to cloud for analytics
 * - kiosk_inventory: Push current stock levels (kiosk is source of truth)
 *
 * STUDENT CACHE STRATEGY:
 * - students_cache: LOCAL ONLY - stores students who use this kiosk
 * - kiosk_students: Tracks local registrations for sync to cloud
 * - Does NOT pull entire students table from cloud
 * - Only tracks students who physically use this kiosk
 *
 * This ensures:
 * 1. Each kiosk has a lean, local cache
 * 2. Cloud stays in sync with kiosk activity
 * 3. Medicines and recipes are globally updated
 * 4. Stock levels are accurate per kiosk
 */

// Open local SQLite database
const dbPath = process.env.DB_PATH || path.join(__dirname, "kiosk.db");
let db = null;

function initializeDatabase() {
  return new Promise((resolve) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening local database:", err.message);
        resolve(false);
        return;
      }

      // Enable foreign keys
      db.run("PRAGMA foreign_keys = ON", (err) => {
        if (err) {
          console.error("Error enabling foreign keys:", err.message);
          resolve(false);
        } else {
          console.log("✓ Local database connected");
          resolve(true);
        }
      });
    });
  });
}

// Initialize Supabase (using environment variables)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not found in .env");
  console.warn("   Sync agent will run in offline mode. Syncing disabled.");
}

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const KIOSK_ID = process.env.KIOSK_ID || "kiosk-001";
const SYNC_INTERVAL = (process.env.SYNC_INTERVAL || 60) * 1000; // Default 60 seconds
let wasOffline = false;

async function isCloudAvailable() {
  try {
    const { error } = await supabase.from("kiosks").select("kiosk_id").limit(1);

    return !error;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// SYNC AGENT: Runs every SYNC_INTERVAL milliseconds
// ============================================================================

async function syncData() {
  if (!supabase) {
    console.log("[SYNC] Supabase not configured. Skipping sync.");
    return;
  }

  const cloudAvailable = await isCloudAvailable();

  if (!cloudAvailable) {
    if (!wasOffline) {
      console.warn("[SYNC] Cloud unavailable. Offline mode enabled.");
    }
    wasOffline = true;
    return;
  }

  if (wasOffline) {
    console.log("[SYNC] ✅ Cloud is back online! Starting sync...");
    wasOffline = false;
  } else {
    console.log("[SYNC] Cloud online. Running scheduled sync.");
  }

  try {
    console.log(
      `\n[SYNC] 🔄 Starting sync cycle at ${new Date().toLocaleTimeString()}...`,
    );

    // =====================================================================
    // STEP 0: ENSURE KIOSK RECORD EXISTS IN CLOUD
    // =====================================================================
    await ensureKioskExists();

    // =====================================================================
    // STEP A: PULL MEDICINES FROM CLOUD (Cloud → Local)
    // =====================================================================
    await pullMedicines();

    // =====================================================================
    // STEP B: PULL SLOT CONFIGURATIONS FROM CLOUD (Cloud → Local)
    // =====================================================================
    await pullSlotConfigurations();

    // =====================================================================
    // STEP C: PUSH LOCALLY REGISTERED STUDENTS TO CLOUD
    // =====================================================================
    await pushLocalStudents();

    // =====================================================================
    // STEP D: PUSH UNSYNCED KIOSK LOGS TO CLOUD (Local → Cloud)
    // =====================================================================
    await pushKioskLogs();

    // =====================================================================
    // STEP E: PUSH INVENTORY LEVELS TO CLOUD (Local → Cloud)
    // =====================================================================
    await pushInventory();

    console.log("[SYNC] ✅ Sync cycle complete.\n");
  } catch (err) {
    console.error("[SYNC] ❌ Sync error:", err.message);
  }
}

// ============================================================================
// STEP 0: Ensure Kiosk Record Exists in Cloud
// ============================================================================
async function ensureKioskExists() {
  return new Promise(async (resolve) => {
    try {
      console.log("[SYNC-0] 🔍 Checking if kiosk record exists...");

      // Check if kiosk exists in cloud
      const { data, error } = await supabase
        .from("kiosks")
        .select("*")
        .eq("kiosk_id", KIOSK_ID)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 means no rows found, which is expected
        console.error("[SYNC-0] Error checking kiosk:", error.message);
        return resolve();
      }

      if (data) {
        console.log("[SYNC-0] ✓ Kiosk record already exists.");
        return resolve();
      }

      // Kiosk doesn't exist, create it
      console.log("[SYNC-0] 📝 Creating kiosk record...");
      const { error: insertError } = await supabase.from("kiosks").insert({
        kiosk_id: KIOSK_ID,
        room_assigned: process.env.ROOM_ASSIGNED || "Room TBD",
        status: "Online",
      });

      if (insertError) {
        console.error("[SYNC-0] Failed to create kiosk:", insertError.message);
        return resolve();
      }

      console.log("[SYNC-0] ✅ Kiosk record created successfully.");
      resolve();
    } catch (err) {
      console.error("[SYNC-0] Error:", err.message);
      resolve();
    }
  });
}

// ============================================================================
// STEP A: Pull Medicines from Cloud to Local (Cloud → Local)
// Keeps medicine library up-to-date locally
// ============================================================================
async function pullMedicines() {
  return new Promise((resolve, reject) => {
    try {
      console.log("[SYNC-A] 📥 Pulling medicines from cloud...");

      supabase
        .from("medicines_library")
        .select("*")
        .then(({ data, error }) => {
          if (error) {
            console.error("[SYNC-A] Supabase error:", error.message);
            return resolve();
          }

          if (!data || data.length === 0) {
            console.log("[SYNC-A] ✓ No medicines to sync.");
            return resolve();
          }

          console.log(
            `[SYNC-A] 📥 Found ${data.length} medicine(s). Updating local cache...`,
          );

          // Use INSERT OR REPLACE to update medicines
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO medicines_library 
            (name, description, symptoms_target, image_url)
            VALUES (?, ?, ?, ?)
          `);

          data.forEach((medicine) => {
            stmt.run(
              medicine.name,
              medicine.description || "",
              medicine.symptoms_target || "",
              medicine.image_url || "",
            );
          });

          stmt.finalize((err) => {
            if (err) {
              console.error(
                "[SYNC-A] Failed to update medicines:",
                err.message,
              );
            } else {
              console.log(
                `[SYNC-A] ✅ Updated ${data.length} medicine(s) in local database.`,
              );
            }
            resolve();
          });
        });
    } catch (err) {
      console.error("[SYNC-A] Error:", err.message);
      resolve();
    }
  });
}

// ============================================================================
// STEP B: Pull Slot Configurations from Cloud (Cloud → Local)
// Keeps slot assignments and max stock levels up-to-date
// ============================================================================
async function pullSlotConfigurations() {
  return new Promise((resolve, reject) => {
    try {
      console.log("[SYNC-B] 📥 Pulling slot configurations from cloud...");

      supabase
        .from("kiosk_inventory")
        .select("*")
        .eq("kiosk_id", KIOSK_ID)
        .then(({ data, error }) => {
          if (error) {
            console.error("[SYNC-B] Supabase error:", error.message);
            return resolve();
          }

          if (!data || data.length === 0) {
            console.log("[SYNC-B] ✓ No slot configurations to sync.");
            return resolve();
          }

          console.log(
            `[SYNC-B] 📥 Found ${data.length} slot(s). Updating local cache...`,
          );

          // Update slot configurations (medicine assignments, max_stock)
          // Keep local current_stock unchanged - it's the source of truth
          data.forEach((slot) => {
            db.run(
              `UPDATE kiosk_slots 
               SET medicine_name = ?, max_stock = ?, synced = 1 
               WHERE slot_id = ?`,
              [slot.medicine_name, slot.max_stock || 50, slot.slot_id],
              (err) => {
                if (err) {
                  console.error(
                    `[SYNC-B] Failed to update slot ${slot.slot_id}:`,
                    err.message,
                  );
                } else {
                  console.log(
                    `[SYNC-B] ✅ Updated Slot ${slot.slot_id}: ${slot.medicine_name}`,
                  );
                }
              },
            );
          });

          resolve();
        });
    } catch (err) {
      console.error("[SYNC-B] Error:", err.message);
      resolve();
    }
  });
}

// ============================================================================
// STEP C: Push Locally Registered Students to Cloud (Local → Cloud)
// Pushes students registered on THIS kiosk to the cloud students table
// ============================================================================
async function pushLocalStudents() {
  return new Promise((resolve, reject) => {
    try {
      console.log(
        "[SYNC-C] 📤 Checking for locally registered students to push...",
      );

      // Get locally registered students from kiosk_students table that haven't been synced yet
      db.all(
        `SELECT * FROM kiosk_students 
         WHERE synced = 0 
         ORDER BY created_at DESC`,
        async (err, rows) => {
          if (err) {
            console.error("[SYNC-C] Database error:", err.message);
            return resolve();
          }

          if (!rows || rows.length === 0) {
            console.log("[SYNC-C] ✓ No local students to push.");
            return resolve();
          }

          console.log(
            `[SYNC-C] 📤 Found ${rows.length} locally registered student(s). Pushing to cloud...`,
          );

          try {
            // Transform local students for cloud 'students' table
            const studentsToSync = rows.map((student) => ({
              student_id: student.student_id,
              rfid_uid: student.rfid_uid,
              first_name: student.first_name,
              last_name: student.last_name,
              age: student.age || null,
              grade_level: student.grade_level || null,
              section: student.section || "",
              created_at: student.created_at,
            }));

            // Upsert into cloud 'students' table (not kiosk_students)
            const { error } = await supabase
              .from("students")
              .upsert(studentsToSync, { onConflict: "student_id" });

            if (error) {
              console.error("[SYNC-C] Supabase error:", error.message);
              return resolve();
            }

            // Mark students as synced in local kiosk_students table
            const updateStmt = db.prepare(
              `UPDATE kiosk_students SET synced = 1 WHERE synced = 0`,
            );

            updateStmt.run((err) => {
              if (err) {
                console.error(
                  "[SYNC-C] Failed to mark students as synced:",
                  err.message,
                );
              } else {
                console.log(
                  `[SYNC-C] ✅ Marked ${rows.length} student(s) as synced.`,
                );
                rows.forEach((student) => {
                  console.log(
                    `[SYNC-C] ✅ Synced local student: ${student.first_name} ${student.last_name} (RFID: ${student.rfid_uid})`,
                  );
                });
              }
            });

            updateStmt.finalize();
            resolve();
          } catch (err) {
            console.error("[SYNC-C] Error:", err.message);
            resolve();
          }
        },
      );
    } catch (err) {
      console.error("[SYNC-C] Error:", err.message);
      resolve();
    }
  });
}

// ============================================================================
// STEP D: Push Unsynced Kiosk Logs to Cloud (Local → Cloud)
// Handles both registered students (via UUID) and unregistered RFIDs
// For unregistered RFIDs, looks them up in cloud students table to get proper ID
// =====================================================================
async function pushKioskLogs() {
  return new Promise((resolve, reject) => {
    // Query logs with student UUID from cache
    db.all(
      `
      SELECT 
        kl.*,
        COALESCE(sc.student_uuid, NULL) as student_uuid
      FROM kiosk_logs kl
      LEFT JOIN students_cache sc ON kl.student_id = sc.student_id
      WHERE kl.synced = 0 
      ORDER BY kl.created_at DESC
    `,
      async (err, rows) => {
        if (err) {
          console.error("[SYNC-D] Database error:", err.message);
          return resolve();
        }

        if (rows.length === 0) {
          console.log("[SYNC-D] ✓ No kiosk logs to sync.");
          return resolve();
        }

        console.log(
          `[SYNC-D] 📤 Found ${rows.length} unsynced log(s). Processing...`,
        );

        try {
          // Separate logs into registered and unregistered
          const registeredLogs = rows.filter((row) => row.student_uuid);
          const unregisteredLogs = rows.filter(
            (row) => !row.student_uuid && row.unregistered_rfid_uid,
          );

          console.log(
            `[SYNC-D] 📋 ${registeredLogs.length} registered, ${unregisteredLogs.length} unregistered.`,
          );

          // Process unregistered logs: look up RFID in cloud to get student ID
          const processedLogs = [...registeredLogs];

          if (unregisteredLogs.length > 0) {
            console.log(
              `[SYNC-D] 🔍 Looking up ${unregisteredLogs.length} unregistered RFID(s) in cloud...`,
            );

            for (const log of unregisteredLogs) {
              try {
                // Query cloud students table by rfid_uid
                const { data: studentData, error: lookupError } = await supabase
                  .from("students")
                  .select("id, rfid_uid, first_name, last_name")
                  .eq("rfid_uid", log.unregistered_rfid_uid)
                  .single();

                if (lookupError && lookupError.code !== "PGRST116") {
                  console.error(
                    `[SYNC-D] Error looking up RFID ${log.unregistered_rfid_uid}:`,
                    lookupError.message,
                  );
                  // Keep the log as unregistered if lookup fails
                  processedLogs.push(log);
                } else if (studentData) {
                  // Found the student in cloud! Update local log with student_id
                  console.log(
                    `[SYNC-D] ✅ Found student: ${studentData.first_name} ${studentData.last_name} (ID: ${studentData.id})`,
                  );

                  // Update local kiosk_logs with the cloud student ID
                  await new Promise((resolveUpdate) => {
                    db.run(
                      "UPDATE kiosk_logs SET student_id = ? WHERE id = ? AND unregistered_rfid_uid = ?",
                      [studentData.id, log.id, log.unregistered_rfid_uid],
                      (updateErr) => {
                        if (updateErr) {
                          console.error(
                            `[SYNC-D] Failed to update log ID ${log.id}:`,
                            updateErr.message,
                          );
                        } else {
                          console.log(
                            `[SYNC-D] ✓ Updated local log with student ID`,
                          );
                        }
                        resolveUpdate();
                      },
                    );
                  });

                  // Add updated log to sync list
                  log.student_uuid = studentData.id;
                  processedLogs.push(log);
                } else {
                  // Student not found in cloud, keep as unregistered
                  console.log(
                    `[SYNC-D] ⚠️  RFID ${log.unregistered_rfid_uid} not found in cloud students table`,
                  );
                  processedLogs.push(log);
                }
              } catch (err) {
                console.error(
                  `[SYNC-D] Error processing RFID ${log.unregistered_rfid_uid}:`,
                  err.message,
                );
                processedLogs.push(log);
              }
            }
          }

          // Transform local kiosk_logs for Supabase
          const logsToSync = processedLogs.map((row) => ({
            kiosk_id: KIOSK_ID,
            student_id: row.student_uuid || null, // Use UUID from students_cache or looked-up student
            symptoms_reported: row.symptoms
              ? row.symptoms.split(",").map((s) => s.trim())
              : [],
            pain_scale: row.pain_scale,
            temp_reading: row.temp_reading,
            heart_rate_bpm: row.heart_rate,
            medicine_dispensed: row.medicine_dispensed,
            unregistered_rfid_uid: row.unregistered_rfid_uid || null,
            created_at: row.created_at,
          }));

          console.log(
            `[SYNC-D] 📤 Pushing ${logsToSync.length} log(s) to cloud...`,
          );

          // Insert into Supabase
          const { error } = await supabase
            .from("kiosk_logs")
            .insert(logsToSync);

          if (error) {
            console.error("[SYNC-D] Supabase error:", error.message);
            return resolve();
          }

          // Mark all as synced in local database
          db.run("UPDATE kiosk_logs SET synced = 1 WHERE synced = 0", (err) => {
            if (err) {
              console.error("[SYNC-D] Failed to mark as synced:", err.message);
            } else {
              console.log(
                `[SYNC-D] ✅ Marked ${rows.length} log(s) as synced.`,
              );
            }
            resolve();
          });
        } catch (err) {
          console.error("[SYNC-D] Error:", err.message);
          resolve();
        }
      },
    );
  });
}

// ============================================================================
// STEP E: Push Inventory to Cloud (Local → Cloud)
// The Kiosk is the Source of Truth for stock levels.
// ============================================================================
async function pushInventory() {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT 
        ks.slot_id,
        ks.medicine_name,
        ks.current_stock,
        ks.max_stock
      FROM kiosk_slots ks
    `,
      async (err, rows) => {
        if (err) {
          console.error("[SYNC-E] Database error:", err.message);
          return resolve();
        }

        if (rows.length === 0) {
          console.log("[SYNC-E] ✓ No slots to sync.");
          return resolve();
        }

        console.log(
          `[SYNC-E] 📦 Pushing ${rows.length} slot(s) to cloud (Local → Cloud)...`,
        );

        try {
          // Build payload from local data — exact values, no defaults
          const payload = rows.map((slot) => ({
            kiosk_id: KIOSK_ID,
            slot_id: slot.slot_id,
            medicine_name: slot.medicine_name,
            current_stock: slot.current_stock,
            last_synced: new Date().toISOString(),
          }));

          // Upsert all slots in one call using composite key
          const { error } = await supabase
            .from("kiosk_inventory")
            .upsert(payload, { onConflict: "kiosk_id, slot_id" });

          if (error) {
            console.error("[SYNC-E] Supabase upsert error:", error.message);
          } else {
            rows.forEach((slot) => {
              console.log(
                `[SYNC-E] ✅ Synced Slot ${slot.slot_id}: ${slot.medicine_name} (Stock: ${slot.current_stock})`,
              );
            });
          }

          // Mark slots as synced locally
          db.run(
            "UPDATE kiosk_slots SET synced = 1 WHERE synced = 0",
            (err) => {
              if (err) {
                console.error(
                  "[SYNC-E] Failed to mark slots as synced:",
                  err.message,
                );
              } else {
                console.log("[SYNC-E] ✅ Marked all slots as synced");
              }
              resolve();
            },
          );
        } catch (err) {
          console.error("[SYNC-E] Error:", err.message);
          resolve();
        }
      },
    );
  });
}

// ============================================================================
// START SYNC AGENT
// ============================================================================

(async () => {
  console.log(`\n============================================`);
  console.log(`  🔄 MediSync SYNC AGENT`);
  console.log(`============================================\n`);

  // Initialize database first
  const dbReady = await initializeDatabase();

  if (!dbReady) {
    console.error("❌ Failed to initialize local database. Exiting.");
    process.exit(1);
  }

  console.log(`  Syncing every ${SYNC_INTERVAL / 1000} seconds`);
  console.log(`  Kiosk ID: ${KIOSK_ID}`);
  console.log(`  Supabase: ${supabase ? "✅ Connected" : "⚠️  Offline Mode"}`);
  console.log(`============================================\n`);

  // Run sync immediately on startup, then every SYNC_INTERVAL
  syncData();
  setInterval(syncData, SYNC_INTERVAL);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[SYNC] 🛑 Shutting down sync agent...");
    if (db) db.close();
    process.exit(0);
  });
})();
