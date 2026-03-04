"use strict";

/**
 * =============================================================================
 * MediSync Edge-to-Cloud Sync Service  (syncService.js)
 * =============================================================================
 *
 * Designed to run INSIDE the server process (imported by server.js) so it
 * shares the same SQLite db handle and Supabase client.
 *
 * SYNC CYCLE ORDER
 * ─────────────────
 *  0. Ensure kiosk record exists in cloud
 *  A. PUSH kiosk_logs      (local → cloud)   upward
 *  B. PUSH kiosk_slots     (local → cloud)   upward  (kiosk is SoT for stock)
 *  C. PUSH new students    (local → cloud)   upward  (sync local registrations)
 *  D. PULL medicines_library (cloud → local)  downward
 *  E. PULL cloud students  (cloud → local)   downward + RFID Reconciliation
 *     - Upsert into students_cache
 *     - If a pulled student's rfid_uid matches an unregistered_rfid_uid in
 *       kiosk_logs → insert that student into kiosk_students
 *
 * DATA OWNERSHIP
 * ──────────────
 *  Source of truth  LOCAL  : kiosk_slots (stock levels + assignments), kiosk_logs, initial student registrations
 *  Source of truth  CLOUD  : generic clinic students, medicines_library
 *
 * USAGE
 * ──────
 *  const syncService = require('./syncService');
 *  syncService.start(db, supabase, { kioskId, intervalMs });
 *  syncService.stop();
 */

const DEFAULTS = {
  INTERVAL_MS: 60_000,   // 1 minute
  KIOSK_ID: "kiosk-001",
};

let _db        = null;
let _supabase  = null;
let _kioskId   = DEFAULTS.KIOSK_ID;
let _intervalMs = DEFAULTS.INTERVAL_MS;
let _timer     = null;
let _running   = false;
let _wasOffline = false;

// ─── helpers ────────────────────────────────────────────────────────────────

/** Wraps db.all() in a Promise. */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    _db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

/** Wraps db.run() in a Promise. */
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    _db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    });
  });
}

function normalizeSymptomsTargetForStorage(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeSymptomsReported(value) {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item).trim())
            .filter(Boolean);
        }
      } catch {
      }
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
}

function toNullableInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableDecimal(value, fractionDigits = 1) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(fractionDigits));
}

/** Basic cloud connectivity probe. */
async function isCloudAvailable() {
  if (!_supabase) return false;
  try {
    const { error } = await _supabase
      .from("kiosks")
      .select("kiosk_id")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

// ─── Step 0: Ensure kiosk record ────────────────────────────────────────────

async function ensureKioskExists() {
  console.log("[SYNC-0] Checking kiosk record in cloud...");
  const { data, error } = await _supabase
    .from("kiosks")
    .select("kiosk_id")
    .eq("kiosk_id", _kioskId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("[SYNC-0] Could not check kiosk record:", error.message);
    return;
  }

  if (data) {
    console.log("[SYNC-0] ✓ Kiosk record exists");
    return;
  }

  const { error: insertErr } = await _supabase.from("kiosks").insert({
    kiosk_id: _kioskId,
    room_assigned: process.env.ROOM_ASSIGNED || "Room TBD",
    status: "Online",
  });

  if (insertErr) {
    console.warn("[SYNC-0] Could not create kiosk record:", insertErr.message);
  } else {
    console.log("[SYNC-0] ✅ Kiosk record created");
  }
}

// ─── Step A: PUSH kiosk_logs ─────────────────────────────────────────────────

async function pushKioskLogs() {
  console.log("[SYNC-A] Pushing unsynced kiosk_logs...");

  const rows = await dbAll(
    `SELECT kl.*
     FROM   kiosk_logs kl
     WHERE  kl.synced = 0
     ORDER  BY kl.created_at ASC`,
  );

  if (!rows.length) {
    console.log("[SYNC-A] ✓ No unsynced logs");
    return;
  }

  console.log(`[SYNC-A] Found ${rows.length} unsynced log(s)`);

  let successCount = 0;
  let failureCount = 0;

  for (const row of rows) {
    const payload = {
      kiosk_id: _kioskId,
      rfid_uid: row.rfid_uid || row.unregistered_rfid_uid || null,
      symptoms_reported: normalizeSymptomsReported(row.symptoms),
      pain_scale: toNullableInteger(row.pain_scale),
      temp_reading: toNullableDecimal(row.temp_reading, 1),
      heart_rate_bpm: toNullableInteger(row.heart_rate),
      medicine_dispensed: row.medicine_dispensed || null,
      created_at: row.created_at,
    };

    const { error } = await _supabase.from("kiosk_logs").insert(payload);
    if (error) {
      failureCount++;
      console.error(
        `[SYNC-A] ❌ Failed log id=${row.id}:`,
        error.message,
      );
      continue;
    }

    await dbRun("UPDATE kiosk_logs SET synced = 1 WHERE id = ?", [row.id]);
    successCount++;
  }

  console.log(
    `[SYNC-A] ✅ Synced ${successCount} log(s), failed ${failureCount} log(s)`,
  );
}

// ─── Step B: PUSH kiosk_slots stock levels ───────────────────────────────────

async function pushInventory() {
  console.log("[SYNC-B] Pushing kiosk_slots stock levels to cloud...");

  const slots = await dbAll(
    "SELECT slot_id, medicine_name, current_stock, max_stock FROM kiosk_slots",
  );

  if (!slots.length) {
    console.log("[SYNC-B] ✓ No slots to push");
    return;
  }

  const payload = slots.map(s => ({
    kiosk_id: _kioskId,
    slot_id: s.slot_id,
    medicine_name: s.medicine_name,
    current_stock: s.current_stock,
    max_stock: s.max_stock,
    last_synced: new Date().toISOString(),
  }));

  const { error } = await _supabase
    .from("kiosk_inventory")
    .upsert(payload, { onConflict: "kiosk_id,slot_id" });

  if (error) {
    console.error("[SYNC-B] ❌ Upsert failed:", error.message);
    return;
  }

  await dbRun("UPDATE kiosk_slots SET synced = 1");
  console.log(`[SYNC-B] ✅ Pushed ${slots.length} slot(s) to cloud`);
}

// ─── Step C: PUSH new students (Local → Cloud) ───────────────────────────────

/**
 * Pushes any student from the local `students_cache` that does not exist 
 * in the cloud `students` table.
 */
async function pushLocalStudents() {
  console.log("[SYNC-C] Pushing offline student registrations to cloud...");

  // 1. Fetch all local students
  const localStudents = await dbAll(
    "SELECT * FROM students_cache WHERE student_id IS NOT NULL",
  );

  if (!localStudents.length) {
    console.log("[SYNC-C] ✓ No local students found");
    return;
  }

  // 2. Fetch all cloud student IDs
  const { data: cloudStudents, error } = await _supabase
    .from("students")
    .select("student_id");

  if (error) {
    console.error("[SYNC-C] ❌ Fetch cloud students failed:", error.message);
    return;
  }

  const cloudIds = new Set(cloudStudents.map((s) => s.student_id));
  const newStudents = [];

  // 3. See which local ones are missing in the cloud
  localStudents.forEach((ls) => {
    // Only push if it doesn't exist in the cloud AND isn't our placeholder Guest
    if (!cloudIds.has(ls.student_id) && !ls.student_id.startsWith("UNCACHED_")) {
      newStudents.push({
        student_id: ls.student_id,
        rfid_uid: ls.rfid_uid || null,
        first_name: ls.first_name || "",
        last_name: ls.last_name || "",
        age: ls.age || null,
        grade_level: ls.grade_level || null,
        section: ls.section || "",
      });
    }
  });

  if (!newStudents.length) {
    console.log("[SYNC-C] ✓ No new local students to push");
    return;
  }

  console.log(`[SYNC-C] Pushing ${newStudents.length} new student(s) to cloud...`);

  // 4. Batch push to cloud
  const { error: insertErr } = await _supabase
    .from("students")
    .insert(newStudents);

  if (insertErr) {
    console.error("[SYNC-C] ❌ Push failed:", insertErr.message);
  } else {
    console.log(`[SYNC-C] ✅ Successfully pushed ${newStudents.length} student(s)`);
  }
}

// ─── Step D: PULL medicines_library ──────────────────────────────────────────

async function pullMedicines() {
  console.log("[SYNC-D] Pulling medicines_library from cloud...");

  const { data, error } = await _supabase.from("medicines_library").select("*");

  if (error) {
    console.error("[SYNC-C] ❌ Fetch failed:", error.message);
    return;
  }
  if (!data?.length) {
    console.log("[SYNC-C] ✓ No medicines in cloud (empty table)");
    return;
  }

  // Upsert each medicine; name is the unique key
  await new Promise((resolve, reject) => {
    const stmt = _db.prepare(
      `INSERT OR REPLACE INTO medicines_library
         (name, description, symptoms_target, image_url, cooldown_hours)
       VALUES (?, ?, ?, ?, ?)`,
    );
    data.forEach(m =>
      stmt.run(
        m.name,
        m.description ?? "",
        normalizeSymptomsTargetForStorage(m.symptoms_target),
        m.image_url ?? "",
        m.cooldown_hours ?? 0
      ),
    );
    stmt.finalize(err => (err ? reject(err) : resolve()));
  });

  console.log(`[SYNC-C] ✅ Synced ${data.length} medicine(s) to local library`);
}

// ─── Step D: PULL slot configurations (assignment + max_stock only) ──────────

async function pullSlotConfigurations() {
  console.log("[SYNC-D] Pulling slot configurations from cloud...");

  const { data, error } = await _supabase
    .from("kiosk_inventory")
    .select("slot_id, medicine_name, max_stock")
    .eq("kiosk_id", _kioskId);

  if (error) {
    console.error("[SYNC-D] ❌ Fetch failed:", error.message);
    return;
  }
  if (!data?.length) {
    console.log("[SYNC-D] ✓ No slot config in cloud for this kiosk");
    return;
  }

  for (const slot of data) {
    // Only update medicine assignment and max_stock; leave current_stock alone
    await dbRun(
      `UPDATE kiosk_slots
       SET    medicine_name = ?, max_stock = ?, synced = 1
       WHERE  slot_id = ?`,
      [slot.medicine_name, slot.max_stock ?? 15, slot.slot_id],
    );
  }

  console.log(`[SYNC-D] ✅ Applied ${data.length} slot configuration(s)`);
}

// ─── Step E: PULL cloud students + RFID Reconciliation ───────────────────────

/**
 * Pulls all students from the cloud `students` table and:
 *   1. Upserts them into the local `students_cache`.
 *   2. For each pulled student whose rfid_uid appears in any local
 *      `kiosk_logs.unregistered_rfid_uid` row, inserts that student into
 *      `kiosk_students` — officially registering them on this kiosk.
 */
async function pullStudentsAndReconcile() {
  console.log("[SYNC-E] Pulling students from cloud + running RFID reconciliation...");

  const { data: cloudStudents, error } = await _supabase
    .from("students")
    .select("*");

  if (error) {
    console.error("[SYNC-E] ❌ Fetch failed:", error.message);
    return;
  }
  if (!cloudStudents?.length) {
    console.log("[SYNC-E] ✓ No students in cloud yet");
    return;
  }

  console.log(`[SYNC-E] Pulled ${cloudStudents.length} student(s) from cloud`);

  // --- E.1 Upsert into students_cache ---
  await new Promise((resolve, reject) => {
    const stmt = _db.prepare(
      `INSERT OR REPLACE INTO students_cache
         (student_id, student_uuid, rfid_uid, first_name, last_name,
          age, grade_level, section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    cloudStudents.forEach(s =>
      stmt.run(
        s.student_id,
        s.id ?? null,              // Supabase UUID row id → student_uuid
        s.rfid_uid ?? null,
        s.first_name ?? "",
        s.last_name ?? "",
        s.age ?? null,
        s.grade_level ?? null,
        s.section ?? "",
      ),
    );
    stmt.finalize(err => (err ? reject(err) : resolve()));
  });

  console.log(`[SYNC-E] ✅ Upserted ${cloudStudents.length} student(s) into students_cache`);

  // --- E.2 RFID Reconciliation ---
  // Fetch all RFIDs that have used the kiosk but aren't registered to it as "students" yet.
  const unregisteredRows = await dbAll(
    `SELECT DISTINCT rfid_uid
     FROM   kiosk_logs
     WHERE  rfid_uid IS NOT NULL
       AND  rfid_uid != ''
       AND  rfid_uid NOT IN (
         SELECT rfid_uid FROM kiosk_students WHERE rfid_uid IS NOT NULL
       )`,
  );

  if (!unregisteredRows.length) {
    console.log("[SYNC-E] ✓ No unregistered RFIDs in local logs — reconciliation skipped");
    return;
  }

  const unregisteredUids = new Set(unregisteredRows.map(r => r.rfid_uid));
  console.log(`[SYNC-E] 🔍 Checking ${unregisteredUids.size} unregistered RFID(s) against pulled students...`);

  let reconciled = 0;

  for (const student of cloudStudents) {
    if (!student.rfid_uid || !unregisteredUids.has(student.rfid_uid)) continue;

    console.log(
      `[SYNC-E] 🎯 Match! RFID ${student.rfid_uid} → ${student.first_name} ${student.last_name} — registering on this kiosk`,
    );

    // Insert into kiosk_students (marks student as registered on this kiosk)
    try {
      await dbRun(
        `INSERT OR IGNORE INTO kiosk_students
           (student_id, kiosk_id, rfid_uid, first_name, last_name,
            age, grade_level, section, kiosk_registered, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          student.student_id,
          _kioskId,
          student.rfid_uid,
          student.first_name ?? "",
          student.last_name ?? "",
          student.age ?? null,
          student.grade_level ?? null,
          student.section ?? "",
        ],
      );
      reconciled++;
    } catch (insertErr) {
      console.warn(
        `[SYNC-E] Could not insert student ${student.student_id}:`,
        insertErr.message,
      );
    }
  }

  if (reconciled > 0) {
    console.log(`[SYNC-E] ✅ Reconciled and registered ${reconciled} previously-unregistered student(s)`);
  } else {
    console.log("[SYNC-E] ✓ No new RFID reconciliations needed");
  }
}

// ─── Main sync cycle ─────────────────────────────────────────────────────────

async function runSyncCycle() {
  if (_running) {
    console.log("[SYNC] ⏭  Previous cycle still in progress — skipping");
    return;
  }

  _running = true;
  const now = new Date().toLocaleTimeString();

  try {
    const cloudOk = await isCloudAvailable();

    if (!cloudOk) {
      if (!_wasOffline) {
        console.warn("[SYNC] ⚠️  Cloud unreachable — entering offline mode");
        _wasOffline = true;
      }
      return;
    }

    if (_wasOffline) {
      console.log("[SYNC] ✅ Cloud is back online — starting catch-up sync");
      _wasOffline = false;
    } else {
      console.log(`\n[SYNC] 🔄 Sync cycle starting at ${now}...`);
    }

    // ── Step 0 ─────────────────────────────────────────────────────────────
    await ensureKioskExists();

    // ── Upward (Local → Cloud) ─────────────────────────────────────────────
    await pushKioskLogs();          // Step A
    await pushInventory();          // Step B
    await pushLocalStudents();      // Step C (Conditional offline registration sync)

    // ── Downward (Cloud → Local) ───────────────────────────────────────────
    await pullMedicines();          // Step D
    await pullStudentsAndReconcile(); // Step E  (includes RFID reconciliation)

    console.log(`[SYNC] ✅ Cycle complete at ${new Date().toLocaleTimeString()}\n`);
  } catch (err) {
    console.error("[SYNC] ❌ Unhandled error in sync cycle:", err.message);
  } finally {
    _running = false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the sync service.
 *
 * @param {import('sqlite3').Database} db        - The shared SQLite database handle
 * @param {import('@supabase/supabase-js').SupabaseClient|null} supabase - Supabase client (null = offline)
 * @param {{ kioskId?: string, intervalMs?: number }} [opts]
 */
function start(db, supabase, opts = {}) {
  if (_timer) {
    console.warn("[SYNC] Already running — call stop() first");
    return;
  }

  _db        = db;
  _supabase  = supabase;
  _kioskId   = opts.kioskId   ?? process.env.KIOSK_ID   ?? DEFAULTS.KIOSK_ID;
  _intervalMs = opts.intervalMs ?? (Number(process.env.SYNC_INTERVAL) || 60) * 1000;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`  🔄 MediSync Sync Service`);
  console.log(`  Kiosk ID  : ${_kioskId}`);
  console.log(`  Interval  : ${_intervalMs / 1000}s`);
  console.log(`  Supabase  : ${_supabase ? "✅ Configured" : "⚠️  Offline mode"}`);
  console.log(`${"=".repeat(50)}\n`);

  // Run immediately on startup, then on interval
  runSyncCycle();
  _timer = setInterval(runSyncCycle, _intervalMs);
}

/** Stop the sync service (clears the interval). */
function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log("[SYNC] 🛑 Sync service stopped");
  }
}

module.exports = { start, stop };
