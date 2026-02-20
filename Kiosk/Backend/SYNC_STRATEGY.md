# MediSync Backend Sync Strategy

## Overview

The backend implements a **hybrid sync model** that keeps local kiosk operations independent while maintaining cloud synchronization for reporting and management.

## Sync Flow Diagram

```
Cloud (Supabase)
       ↓↑
   medicines_library ← PULL (Cloud → Local)
   kiosk_inventory ← PULL (Cloud → Local)
       ↓↑
Local (SQLite)
   students_cache (LOCAL ONLY - no cloud pull)
   kiosk_logs → PUSH (Local → Cloud)
   kiosk_inventory → PUSH (Local → Cloud)
   kiosk_students → PUSH (Local → Cloud)
```

## Tables & Sync Strategy

### 1. **medicines_library**
**Direction:** Cloud → Local (PULL)
**Frequency:** Every sync interval
**Purpose:** Keep medicine list up-to-date locally
**Details:**
- Pulled from Supabase `medicines_library` table
- Inserted/replaced locally using `INSERT OR REPLACE`
- Ensures all kiosks have consistent medicine catalog

```sql
-- Local table
CREATE TABLE medicines_library (
  name TEXT PRIMARY KEY,
  description TEXT,
  symptoms_target TEXT,
  image_url TEXT
);
```

### 2. **kiosk_inventory (Slot Configurations)**
**Direction:** Bidirectional
**Pull:** Cloud → Local
**Push:** Local → Cloud

**Pull Purpose:** Update slot medicine assignments and max_stock
**Push Purpose:** Send current stock levels to cloud

```sql
-- Cloud table (Supabase)
CREATE TABLE kiosk_inventory (
  kiosk_id TEXT,
  slot_id INTEGER,
  medicine_name TEXT,
  current_stock INTEGER,
  max_stock INTEGER,
  last_synced TIMESTAMP,
  PRIMARY KEY (kiosk_id, slot_id)
);

-- Local table (SQLite)
CREATE TABLE kiosk_slots (
  slot_id INTEGER PRIMARY KEY,
  medicine_name TEXT,
  current_stock INTEGER,
  max_stock INTEGER,
  synced BOOLEAN
);
```

**Key:** When pulling, local `current_stock` is NOT overwritten (kiosk is source of truth)

### 3. **students_cache**
**Direction:** Local ONLY (No cloud pull)
**Purpose:** Fast RFID lookup for students using THIS kiosk

**Strategy:**
- Only stores students who have physically used this kiosk
- Does NOT pull entire student database from cloud
- New students are registered locally via RFID scan or manual entry
- Reduces local data footprint - each kiosk stays lean

```sql
CREATE TABLE students_cache (
  id INTEGER PRIMARY KEY,
  student_id TEXT UNIQUE,
  student_uuid TEXT,
  rfid_uid TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  age INTEGER,
  grade_level INTEGER,
  section TEXT,
  medical_flags TEXT,
  created_at DATETIME
);
```

### 4. **kiosk_students**
**Direction:** Local → Cloud (PUSH ONLY)
**Purpose:** Track locally registered students in cloud for analytics

**Strategy:**
- Stores references to students registered on THIS kiosk
- Synced to cloud `kiosk_students` table
- Marked as synced after push to cloud
- Provides cloud visibility of local registrations without pulling entire DB

```sql
-- Local table (SQLite)
CREATE TABLE kiosk_students (
  student_id TEXT,
  kiosk_id TEXT,
  rfid_uid TEXT,
  first_name TEXT,
  last_name TEXT,
  age INTEGER,
  grade_level INTEGER,
  section TEXT,
  kiosk_registered BOOLEAN,
  created_at DATETIME,
  synced BOOLEAN,
  UNIQUE(student_id, kiosk_id)
);

-- Cloud table (Supabase)
CREATE TABLE kiosk_students (
  student_id TEXT,
  kiosk_id TEXT,
  rfid_uid TEXT,
  first_name TEXT,
  last_name TEXT,
  age INTEGER,
  grade_level INTEGER,
  section TEXT,
  kiosk_registered BOOLEAN,
  created_at TIMESTAMP
  -- Composite key: (student_id, kiosk_id)
);
```

### 5. **kiosk_logs**
**Direction:** Local → Cloud (PUSH ONLY)
**Purpose:** Send kiosk activity/usage logs to cloud for reporting

```sql
-- Local table (SQLite)
CREATE TABLE kiosk_logs (
  id INTEGER PRIMARY KEY,
  student_id TEXT,
  unregistered_rfid_uid TEXT,
  symptoms TEXT,
  pain_scale INTEGER,
  temp_reading DECIMAL,
  heart_rate INTEGER,
  medicine_dispensed TEXT,
  slot_used INTEGER,
  synced BOOLEAN,
  created_at DATETIME
);

-- Cloud table (Supabase - kiosk_logs)
CREATE TABLE kiosk_logs (
  id UUID PRIMARY KEY,
  kiosk_id TEXT,
  student_id UUID,
  symptoms_reported TEXT[],
  pain_scale INTEGER,
  temp_reading DECIMAL,
  heart_rate_bpm INTEGER,
  medicine_dispensed TEXT,
  unregistered_rfid_uid TEXT,
  created_at TIMESTAMP
);
```

## Sync Cycle (Every 60 seconds by default)

### Phase 1: Prepare
- Check cloud availability
- Go to offline mode if cloud unavailable
- Resume sync when cloud comes back online

### Phase 2: Ensure Kiosk Record
- Create/update kiosk record in cloud
- Register this kiosk instance with the clinic system

### Phase 3: Pull Phase (Cloud → Local)
1. **Pull Medicines** (SYNC-A)
   - Fetch all medicines from cloud
   - Update local `medicines_library` table
   - Ensures consistent medicine catalog

2. **Pull Slot Configs** (SYNC-B)
   - Fetch slot assignments for this kiosk from cloud
   - Update medicine names and max_stock locally
   - Preserve local current_stock values

### Phase 4: Push Phase (Local → Cloud)
1. **Push Local Students** (SYNC-C)
   - Get unsynced entries from `kiosk_students`
   - Push locally registered students to cloud
   - Mark as synced locally

2. **Push Kiosk Logs** (SYNC-D)
   - Get unsynced logs from `kiosk_logs`
   - Transform and push to cloud
   - Mark as synced locally

3. **Push Inventory** (SYNC-E)
   - Push current stock levels to cloud
   - Kiosk is source of truth for stock
   - Upsert using composite key (kiosk_id, slot_id)

## Offline Behavior

- Log all activity locally (students, logs, inventory changes)
- Mark new data as `synced = 0`
- Queue all changes for cloud
- When cloud is available again, push all queued changes

## Error Handling

- If any sync step fails, log the error and continue
- Partial syncs are allowed (don't block on individual failures)
- Retry on next sync cycle
- Data integrity is maintained locally regardless of cloud status

## API Endpoints for Testing

### GET /api/students
Fetch all students from local cache
```bash
curl http://localhost:3001/api/students
```

### POST /api/students/register
Register a new student locally (also syncs to cloud)
```bash
curl -X POST http://localhost:3001/api/students/register \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024-001",
    "rfid_uid": "AA:BB:CC:DD",
    "first_name": "John",
    "last_name": "Doe",
    "age": 15,
    "grade_level": 10,
    "section": "A"
  }'
```

### GET /api/admin/slots
Fetch current slot configuration
```bash
curl http://localhost:3001/api/admin/slots
```

### POST /api/admin/slots
Update slot configuration
```bash
curl -X POST http://localhost:3001/api/admin/slots \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": 1,
    "medicine_name": "Biogesic",
    "current_stock": 45
  }'
```

## Best Practices

1. **Always keep source of truth clear:**
   - Kiosk = Source of truth for stock levels
   - Cloud = Source of truth for medicines & configs

2. **Don't pull entire databases:**
   - Small cache per kiosk
   - Only sync what's needed

3. **Monitor sync logs:**
   - Check backend logs for sync errors
   - Look for [SYNC-A], [SYNC-B], etc. messages

4. **Test offline scenarios:**
   - Disconnect from cloud
   - Verify local operations work
   - Reconnect and verify sync completes

5. **Handle conflicts gracefully:**
   - Use upsert for inventory updates
   - Use INSERT OR REPLACE for medicines
   - Use proper unique constraints

## Monitoring

Watch backend logs during sync:
```
[SYNC] 🔄 Starting sync cycle at 10:30:45...
[SYNC-A] 📥 Pulling medicines from cloud...
[SYNC-A] ✅ Updated 6 medicine(s) in local database.
[SYNC-B] 📥 Pulling slot configurations from cloud...
[SYNC-B] ✅ Updated Slot 1: Biogesic
[SYNC-C] 📤 Checking for locally registered students to push...
[SYNC-C] ✅ Synced local student: John Doe
[SYNC-D] 📤 Found 3 unsynced log(s). Pushing to cloud...
[SYNC-D] ✅ Marked 3 log(s) as synced.
[SYNC-E] 📦 Pushing 5 slot(s) to cloud (Local → Cloud)...
[SYNC-E] ✅ Synced Slot 1: Biogesic (Stock: 42)
[SYNC] ✅ Sync cycle complete.
```

