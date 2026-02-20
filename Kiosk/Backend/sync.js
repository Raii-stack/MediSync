const { createClient } = require("@supabase/supabase-js");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config(); // Load .env file

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
    const { error } = await supabase
      .from("kiosks")
      .select("kiosk_id")
      .limit(1);

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

  if (!wasOffline) {
    console.log("[SYNC] Cloud online. Sync idle.");
    return;
  }

  wasOffline = false;

  try {
    console.log(
      `\n[SYNC] 🔄 Starting sync cycle at ${new Date().toLocaleTimeString()}...`,
    );

    // =====================================================================
    // STEP 0: ENSURE KIOSK RECORD EXISTS IN CLOUD
    // =====================================================================
    await ensureKioskExists();

    // =====================================================================
    // STEP A: PULL STUDENTS FROM CLOUD FOR OFFLINE LOGIN
    // =====================================================================
    await pullStudents();

    // =====================================================================
    // STEP B: PUSH UNSYNCED KIOSK LOGS TO CLOUD
    // =====================================================================
    await pushKioskLogs();

    // =====================================================================
    // STEP C: UPDATE INVENTORY LEVELS IN CLOUD
    // =====================================================================
    await syncInventory();

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
// STEP A: Pull Students from Cloud to Local Cache (for offline login)
// ============================================================================
async function pullStudents() {
  return new Promise((resolve, reject) => {
    try {
      console.log("[SYNC-A] 📥 Pulling students from cloud...");

      supabase
        .from("students")
        .select("*")
        .then(({ data, error }) => {
          if (error) {
            console.error("[SYNC-A] Supabase error:", error.message);
            return resolve();
          }

          if (!data || data.length === 0) {
            console.log("[SYNC-A] ✓ No students to sync.");
            return resolve();
          }

          console.log(
            `[SYNC-A] 📥 Found ${data.length} student(s). Updating local cache...`,
          );

          // Use INSERT OR REPLACE to preserve cached RFID UIDs and update with real data
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO students_cache 
            (student_id, student_uuid, rfid_uid, first_name, last_name, section, medical_flags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          let matched = 0;
          let added = 0;

          data.forEach((student) => {
            // Check if this student matches any cached RFID UID
            db.get(
              'SELECT student_id FROM students_cache WHERE rfid_uid = ? AND student_id LIKE "UNCACHED_%"',
              [student.rfid_uid],
              (err, row) => {
                if (!err && row) {
                  console.log(
                    `[SYNC-A] 🔗 Matched cached RFID ${student.rfid_uid} with ${student.first_name} ${student.last_name}`,
                  );
                  matched++;
                } else {
                  added++;
                }
              },
            );

            stmt.run(
              student.student_id,
              student.id, // Store the UUID
              student.rfid_uid,
              student.first_name,
              student.last_name,
              student.section || "",
              "", // medical_flags - can be populated from medical_history later
            );
          });

          stmt.finalize((err) => {
            if (err) {
              console.error("[SYNC-A] Failed to update students:", err.message);
            } else {
              console.log(
                `[SYNC-A] ✅ Updated ${data.length} student(s) in local cache.`,
              );
              if (matched > 0) {
                console.log(
                  `[SYNC-A] 🔗 Matched ${matched} previously cached RFID(s) with student data.`,
                );
              }
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
// STEP B: Push Unsynced Kiosk Logs to Cloud
// ============================================================================
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
          console.error("[SYNC-B] Database error:", err.message);
          return resolve();
        }

        if (rows.length === 0) {
          console.log("[SYNC-B] ✓ No kiosk logs to sync.");
          return resolve();
        }

        console.log(
          `[SYNC-B] 📤 Found ${rows.length} unsynced log(s). Pushing to cloud...`,
        );

        try {
          // Transform local kiosk_logs for Supabase
          const logsToSync = rows.map((row) => ({
            kiosk_id: KIOSK_ID,
            student_id: row.student_uuid, // Use UUID from students_cache
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

          // Insert into Supabase
          const { error } = await supabase
            .from("kiosk_logs")
            .insert(logsToSync);

          if (error) {
            console.error("[SYNC-B] Supabase error:", error.message);
            return resolve();
          }

          // Mark all as synced in local database
          db.run("UPDATE kiosk_logs SET synced = 1 WHERE synced = 0", (err) => {
            if (err) {
              console.error("[SYNC-B] Failed to mark as synced:", err.message);
            } else {
              console.log(
                `[SYNC-B] ✅ Marked ${rows.length} log(s) as synced.`,
              );
            }
            resolve();
          });
        } catch (err) {
          console.error("[SYNC-B] Error:", err.message);
          resolve();
        }
      },
    );
  });
}

// ============================================================================
// STEP C: Sync Inventory — ONE-WAY: Local (SQLite) → Cloud (Supabase)
// The Kiosk is the Source of Truth for stock levels.
// ============================================================================
async function syncInventory() {
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
          console.error("[SYNC-D] Database error:", err.message);
          return resolve();
        }

        if (rows.length === 0) {
          console.log("[SYNC-D] ✓ No slots to sync.");
          return resolve();
        }

        console.log(
          `[SYNC-D] 📦 Pushing ${rows.length} slot(s) to cloud (Local → Cloud)...`,
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
            console.error("[SYNC-D] Supabase upsert error:", error.message);
          } else {
            rows.forEach((slot) => {
              console.log(
                `[SYNC-D] ✅ Synced Slot ${slot.slot_id}: ${slot.medicine_name} (Stock: ${slot.current_stock})`,
              );
            });
          }

          // Mark slots as synced locally
          db.run(
            "UPDATE kiosk_slots SET synced = 1 WHERE synced = 0",
            (err) => {
              if (err) {
                console.error(
                  "[SYNC-D] Failed to mark slots as synced:",
                  err.message,
                );
              } else {
                console.log("[SYNC-D] ✅ Marked all slots as synced");
              }
              resolve();
            },
          );
        } catch (err) {
          console.error("[SYNC-D] Error:", err.message);
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
