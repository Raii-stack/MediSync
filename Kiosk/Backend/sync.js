const { createClient } = require('@supabase/supabase-js');
const db = require('./database');
require('dotenv').config(); // Load .env file

// Initialize Supabase (using environment variables)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not found in .env');
  console.warn('   Sync agent will run in offline mode. Syncing disabled.');
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const KIOSK_ID = process.env.KIOSK_ID || 'kiosk-001';
const SYNC_INTERVAL = (process.env.SYNC_INTERVAL || 60) * 1000; // Default 60 seconds

// ============================================================================
// SYNC AGENT: Runs every SYNC_INTERVAL milliseconds
// ============================================================================

async function syncData() {
  if (!supabase) {
    console.log('[SYNC] Supabase not configured. Skipping sync.');
    return;
  }

  try {
    console.log(`\n[SYNC] 🔄 Starting sync cycle at ${new Date().toLocaleTimeString()}...`);

    // =====================================================================
    // STEP A: PUSH UNSYNCED TRANSACTIONS TO SUPABASE
    // =====================================================================
    await pushTransactions();

    // =====================================================================
    // STEP B: UPDATE INVENTORY LEVELS IN SUPABASE
    // =====================================================================
    await syncInventory();

    // =====================================================================
    // STEP C: RETRY EMERGENCY ALERTS
    // =====================================================================
    // (To be implemented with persistent storage)

    console.log('[SYNC] ✅ Sync cycle complete.\n');
  } catch (err) {
    console.error('[SYNC] ❌ Sync error:', err.message);
  }
}

// ============================================================================
// STEP A: Push Unsynced Transactions
// ============================================================================
async function pushTransactions() {
  return new Promise((resolve, reject) => {
    // Get all unsynced transactions from local SQLite
    db.all(
      "SELECT * FROM transactions WHERE synced = 0 ORDER BY timestamp DESC",
      async (err, rows) => {
        if (err) {
          console.error('[SYNC-A] Database error:', err.message);
          return resolve(); // Don't fail the entire sync
        }

        if (rows.length === 0) {
          console.log('[SYNC-A] ✓ No transactions to sync.');
          return resolve();
        }

        console.log(`[SYNC-A] 📤 Found ${rows.length} unsynced transaction(s). Pushing to Supabase...`);

        try {
          // Transform local data for Supabase
          const clinicVisits = rows.map((row) => ({
            kiosk_id: KIOSK_ID,
            student_id: row.student_id,
            symptoms: row.symptoms,
            pain_level: row.pain_level,
            medicine_dispensed: row.medicine_dispensed,
            dispensed_at: row.timestamp
          }));

          // Insert into Supabase
          const { error } = await supabase
            .from('clinic_visits')
            .insert(clinicVisits);

          if (error) {
            console.error('[SYNC-A] Supabase error:', error.message);
            return resolve(); // Don't fail the entire sync
          }

          // Mark all as synced in local database
          db.run(
            "UPDATE transactions SET synced = 1 WHERE synced = 0",
            (err) => {
              if (err) {
                console.error('[SYNC-A] Failed to mark as synced:', err.message);
              } else {
                console.log(`[SYNC-A] ✅ Marked ${rows.length} transaction(s) as synced.`);
              }
              resolve();
            }
          );
        } catch (err) {
          console.error('[SYNC-A] Error:', err.message);
          resolve(); // Don't fail the entire sync
        }
      }
    );
  });
}

// ============================================================================
// STEP B: Sync Current Inventory Levels
// ============================================================================
async function syncInventory() {
  return new Promise((resolve, reject) => {
    // Get current inventory from local SQLite
    db.all("SELECT * FROM inventory", async (err, rows) => {
      if (err) {
        console.error('[SYNC-B] Database error:', err.message);
        return resolve();
      }

      if (rows.length === 0) {
        console.log('[SYNC-B] ✓ No inventory to sync.');
        return resolve();
      }

      console.log(`[SYNC-B] 📦 Syncing ${rows.length} medicine(s) inventory...`);

      try {
        // For each medicine, upsert into Supabase
        for (const medicine of rows) {
          const { error } = await supabase
            .from('kiosk_inventory')
            .upsert(
              {
                medicine_name: medicine.name,
                current_stock: medicine.current_stock,
                max_stock: medicine.max_stock,
                kiosk_id: KIOSK_ID
              },
              { onConflict: 'medicine_name' }
            );

          if (error) {
            console.error(`[SYNC-B] Failed to sync ${medicine.name}:`, error.message);
          }
        }

        console.log(`[SYNC-B] ✅ Inventory synced.`);
        resolve();
      } catch (err) {
        console.error('[SYNC-B] Error:', err.message);
        resolve();
      }
    });
  });
}

// ============================================================================
// START SYNC AGENT
// ============================================================================

console.log(`\n============================================`);
console.log(`  🔄 MediSync SYNC AGENT`);
console.log(`  Syncing every ${SYNC_INTERVAL / 1000} seconds`);
console.log(`  Kiosk ID: ${KIOSK_ID}`);
console.log(`  Supabase: ${supabase ? '✅ Connected' : '⚠️  Offline Mode'}`);
console.log(`============================================\n`);

// Run sync immediately on startup, then every SYNC_INTERVAL
syncData();
setInterval(syncData, SYNC_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SYNC] 🛑 Shutting down sync agent...');
  process.exit(0);
});
