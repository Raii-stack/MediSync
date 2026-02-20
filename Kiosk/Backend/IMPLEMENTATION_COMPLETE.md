# Backend Sync Implementation - Complete

## Summary of Changes

This document describes the complete implementation of bidirectional cloud-to-local syncing with a lean kiosk-specific student cache.

## Files Modified

### 1. **init-db.js** - Database Schema
- Added `age` and `grade_level` columns to `students_cache`
- Added `created_at` timestamp to `students_cache`
- Created new `kiosk_students` table for tracking local registrations
- Updated seed data to include age and grade_level for test students

### 2. **database.js** - Seed Data
- Updated sample student data to include age and grade_level fields

### 3. **server.js** - API Endpoints & Logic
- Added **GET /api/students** - Fetch all students from local cache
- Added **POST /api/students/register** - Register new students locally
- Updated POST /api/students/register to also track in `kiosk_students` table
- Changed slot validation from 1-4 to 1-5 for test dispense
- All new students auto-insert into `kiosk_students` for sync tracking

### 4. **sync.js** - Sync Agent (Major Rewrite)
- **Added PULL (Cloud → Local):**
  - `pullMedicines()` - Fetches all medicines from cloud
  - `pullSlotConfigurations()` - Fetches slot configs for this kiosk
  
- **Added PUSH (Local → Cloud):**
  - `pushLocalStudents()` - Pushes only locally registered students
  
- **Removed:**
  - `pullStudents()` - No longer pulls entire student database
  
- **Updated:**
  - Renamed `syncInventory()` to `pushInventory()`
  - Improved logging with clear sync phases
  - Better offline/online detection
  
- **Added documentation:**
  - Comprehensive comment explaining sync strategy

### 5. **SYNC_STRATEGY.md** - New Documentation
- Detailed explanation of sync approach
- Table-by-table sync strategy
- Sync cycle diagram and flow
- API endpoint examples
- Offline behavior
- Monitoring guide

## Sync Architecture

### PULL Operations (Scheduled)
```
Cloud → Local (Every 60 seconds)
├── medicines_library (Keep catalog updated)
└── kiosk_inventory (Keep configs updated)
```

### PUSH Operations (When data changes)
```
Local → Cloud (Every 60 seconds)
├── kiosk_students (Only local registrations)
├── kiosk_logs (Usage analytics)
└── kiosk_inventory (Stock levels)
```

### Student Cache Strategy
```
❌ DO NOT PULL entire students table
✅ DO store registered students locally
✅ DO push local registrations to cloud
✅ KEEP cache lean (only kiosk users)
```

## How It Works

### Data Flow for New Student Registration

1. **Frontend:** Student scans RFID or manually enters data via RfidTestModal
2. **Backend (POST /api/students/register):**
   ```
   Insert into students_cache
   Insert into kiosk_students (for sync tracking)
   Return new student record
   ```
3. **Local Storage:** Student cached in `students_cache` for RFID lookups
4. **Cloud Sync (Next cycle):**
   ```
   SYNC-C checks kiosk_students with synced=0
   Pushes to cloud kiosk_students table
   Marks as synced locally
   ```

### Data Flow for Updated Medicine List

1. **Cloud:** Admin updates medicines in Supabase
2. **Sync Agent (SYNC-A):**
   ```
   Fetches all medicines from cloud
   Uses INSERT OR REPLACE locally
   No local data lost - just updated
   ```
3. **Kiosk:** Next sync cycle, kiosk has latest medicines

### Data Flow for Stock Management

1. **Local Operation:** Dispense medicine from slot
2. **Database:** `kiosk_slots.current_stock` decremented
3. **Sync Agent (SYNC-E):**
   ```
   Fetches local stock levels
   Upserts to cloud kiosk_inventory
   Kiosk is source of truth
   ```
4. **Cloud:** Stock accurately reflects all kiosks

## Key Design Decisions

### ✅ Student Cache is LOCAL ONLY
- **Why:** Each kiosk only needs students who use it
- **Benefit:** Lean database, fast RFID lookups
- **Trade-off:** New students must be registered first time
- **Solution:** Auto-register on RFID + manual registration endpoint

### ✅ Medicines Pulled from Cloud
- **Why:** Consistent catalog across all kiosks
- **Benefit:** Admin can update medicines hospital-wide
- **Automatic:** No manual sync needed

### ✅ Stock Levels are LOCAL TRUTH
- **Why:** Each kiosk manages its own inventory
- **Benefit:** Accurate per-kiosk stock tracking
- **Sync Behavior:** Pushed up, never overwritten

### ✅ Student Registrations Tracked Locally
- **Why:** Know which students used which kiosk
- **Benefit:** Cloud analytics without storing entire DB
- **Sync:** Only local registrations pushed to cloud

## Testing the Sync

### Test 1: Student Registration
```bash
# Register a new student
curl -X POST http://localhost:3001/api/students/register \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024-999",
    "rfid_uid": "FF:EE:DD:CC",
    "first_name": "Test",
    "last_name": "User",
    "age": 16,
    "grade_level": 11,
    "section": "B"
  }'

# Check it was cached locally
curl http://localhost:3001/api/students

# In sync logs (next cycle):
# [SYNC-C] 📤 Found 1 locally registered student(s)...
# [SYNC-C] ✅ Synced local student: Test User
```

### Test 2: Medicine Updates
```bash
# Cloud: Update a medicine
# Local sync will pull it automatically

# Check sync logs:
# [SYNC-A] 📥 Found 6 medicine(s)...
# [SYNC-A] ✅ Updated 6 medicine(s) in local database.
```

### Test 3: Offline/Online
```bash
# Disconnect network
# Create/dispense medicines - logged locally
# Reconnect network
# Auto-sync on next cycle

# Check logs:
# [SYNC] ✅ Cloud is back online! Starting sync...
```

### Test 4: Slot 5 Test Dispense
```bash
# Test dispense from slot 5
curl -X POST http://localhost:3001/api/test-dispense \
  -H "Content-Type: application/json" \
  -d '{"slot_id": 5}'

# Check sync logs for inventory:
# [SYNC-E] ✅ Synced Slot 5: Bioflu (Stock: 29)
```

## Monitoring Sync Health

### Check sync logs regularly:
```bash
# Watch backend output for [SYNC-*] messages
# Each letter = a phase:
# [SYNC-A] = Pull medicines
# [SYNC-B] = Pull slot configs
# [SYNC-C] = Push students
# [SYNC-D] = Push logs
# [SYNC-E] = Push inventory
```

### Database checks:
```sql
-- Check synced flag on students
SELECT COUNT(*) FROM kiosk_students WHERE synced = 0;

-- Check synced flag on logs
SELECT COUNT(*) FROM kiosk_logs WHERE synced = 0;

-- Check synced flag on slots
SELECT COUNT(*) FROM kiosk_slots WHERE synced = 0;

-- View local student cache
SELECT * FROM students_cache;
```

## Troubleshooting

| Issue | Check | Solution |
|-------|-------|----------|
| Students not appearing in cache | Check `/api/students` response | Register user first via `/api/students/register` |
| Medicines not updating | Check sync logs [SYNC-A] | Verify Supabase connection, medicines_library table exists |
| Stock not syncing to cloud | Check sync logs [SYNC-E] | Verify kiosk_inventory table exists in cloud |
| Students not in kiosk_students | Check database | Verify kiosk_students table created |
| Sync stuck in offline | Check network | Restart backend, verify Supabase credentials |

## Migration Guide (If Upgrading Existing Setup)

1. **Run init-db.js** to create new tables and columns
   ```bash
   node init-db.js
   ```

2. **Restart backend**
   ```bash
   npm start
   ```

3. **First sync will:**
   - Pull medicines from cloud
   - Pull slot configs from cloud
   - Begin tracking new student registrations

4. **Verify:**
   - Check sync logs
   - Register test student
   - Verify in kiosk_students table

## Performance Considerations

- **Sync interval:** 60 seconds (configurable via `SYNC_INTERVAL`)
- **Student cache:** No limit (grows with kiosk usage)
- **Batch operations:** All data upserted in single cloud call
- **Offline support:** All operations work with SQL only

## Security Considerations

- ✅ Uses Supabase RLS (Row Level Security) for cloud tables
- ✅ KIOSK_ID used to isolate kiosk-specific data
- ✅ No passwords stored locally
- ✅ RFID UIDs treated as identifiers (not secrets)
- ⚠️ Ensure `.env` file is protected with credentials

## Future Enhancements

- Conflict resolution for simultaneous edits
- Delta sync (only changed records)
- Compression for large sync payloads
- Sync statistics/dashboard
- Audit logging of all syncs
- Partial sync recovery

