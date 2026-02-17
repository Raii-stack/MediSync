# MediSync Kiosk - Implementation Summary

## Overview

This document summarizes all the work completed on the Kiosk subsystem of the MediSync project, including offline mode implementation, database schema updates, and cloud synchronization architecture.

---

## 1. Database Architecture

### Local SQLite Database (`kiosk.db`)

A local SQLite database was created to enable **offline-first** functionality for the Kiosk, allowing it to operate even without cloud connectivity.

#### Schema Tables Created:

**1. `kiosk_config`**

- Stores the specific machine's configuration
- Columns: `kiosk_id` (PK), `room_assigned`
- Purpose: Track which room/location the kiosk is assigned to

**2. `students_cache`**

- Local mirror of student database for offline login
- Columns: `student_id` (PK), `student_uuid`, `rfid_uid`, `first_name`, `last_name`, `section`, `medical_flags`
- Purpose: Enable student authentication without cloud connectivity
- Note: `student_uuid` stores the Supabase UUID for proper cloud sync

**3. `inventory`**

- Tracks local medicine stock
- Columns: `id` (PK), `medicine_name`, `current_stock`
- Purpose: Maintain accurate inventory counts for dispense operations

**4. `kiosk_logs`**

- Stores transaction history with medical data
- Columns: `id` (PK), `student_id`, `symptoms`, `pain_scale`, `temp_reading`, `heart_rate`, `medicine_dispensed`, `synced`, `created_at`
- Foreign Key: References `students_cache(student_id)`
- Purpose: Record all kiosk activities for offline sync and auditing

**5. `emergency_alerts`**

- Stores emergency button press events
- Columns: `id` (PK), `student_id` (NULLABLE), `status`, `synced`, `created_at`
- Purpose: Track emergency situations with sync capability to cloud

---

## 2. Database Initialization

### Files Created:

- **`init-db.js`** - Idempotent database initialization script
  - Creates all tables with `IF NOT EXISTS` clauses
  - Safe to run multiple times without errors
  - Enables foreign key constraints
  - Displays schema verification on completion
  - Usage: `node init-db.js`

- **`migrate-db.js`** - Database migration and schema updates
  - Safely updates existing schemas
  - Used for adding `student_uuid` column to `students_cache`
  - Run when schema changes are needed

### Files Updated:

- **`database.js`** - Updated to:
  - Connect to `kiosk.db` instead of `medisync.db`
  - Seed initial student and inventory data
  - Use new table names (`students_cache`, `kiosk_logs`)

---

## 3. Cloud Synchronization Architecture

### Sync Agent (`sync.js`)

Complete rewrite of the sync module to support offline-first architecture with proper UUID handling.

#### Sync Workflow (5 Steps):

**STEP 0: Ensure Kiosk Record Exists**

- Checks if kiosk exists in Supabase `kiosks` table
- Auto-creates kiosk record on first sync
- Resolves foreign key constraints for inventory sync

**STEP A: Pull Students from Cloud**

- Pulls all students from Supabase `students` table
- Caches them locally in `students_cache` for offline login
- Stores both `student_id` (text) and `student_uuid` (UUID)
- Enables offline-first student authentication

**STEP B: Push Kiosk Logs to Cloud**

- Syncs all unsynced medical records to `kiosk_logs` table
- Transforms local data to Supabase schema:
  - `symptoms` → `symptoms_reported` (JSON array)
  - `pain_scale` → `pain_scale`
  - `temp_reading` → `temp_reading`
  - `heart_rate` → `heart_rate_bpm`
- Uses `student_uuid` for proper foreign key reference
- Marks synced records in local DB

**STEP C: Push Emergency Alerts to Cloud**

- Syncs unsynced alerts to `emergency_alerts` table
- Includes alert status and timestamps
- Uses `student_uuid` for student reference
- Marks synced in local DB

**STEP D: Sync Inventory Levels**

- Upserts current stock levels to `kiosk_inventory`
- Maintains real-time inventory view in cloud
- Uses composite key: `(kiosk_id, medicine_name)`

#### Key Features:

- Runs every 60 seconds (configurable via `SYNC_INTERVAL`)
- Graceful error handling - single sync step failure doesn't block others
- Automatic kiosk record creation for first-time setup
- UUID handling for proper Supabase foreign key constraints
- Offline fallback - continues operating if cloud unavailable

---

## 4. Backend API Updates

### Files Updated:

- **`server.js`** - Updated endpoints to use new schema:
  - **`POST /api/login`** - Now queries `students_cache` instead of `students`
  - **`POST /api/dispense`** - Updated inventory queries to use `medicine_name` column
  - **`GET /api/inventory`** - Queries updated `inventory` table
  - **`POST /api/scan/start`** - Unchanged (hardware interface)
  - **`POST /api/scan/stop`** - Unchanged (hardware interface)
  - **`POST /api/emergency`** - Can now log to local `emergency_alerts` table

### Key Changes:

- All database queries use offline-first local database
- Proper column name mappings (e.g., `name` → `medicine_name`)
- Synced data automatically pushed to cloud during sync cycles

---

## 5. Configuration

### Environment Variables:

```
SUPABASE_URL          # Supabase project URL
SUPABASE_ANON_KEY     # Supabase anonymous key
KIOSK_ID              # Unique identifier (default: kiosk-001)
ROOM_ASSIGNED         # Room/location assignment (auto-created in cloud)
SYNC_INTERVAL         # Sync frequency in seconds (default: 60)
DB_PATH               # SQLite database path (default: ./kiosk.db)
```

### Docker Setup:

- Updated `docker-compose.yml` to exclude `kiosk.db` files from hot-reload
- Backend-db volume persists database across container restarts
- Both backend and frontend services in shared `medisync-network`

---

## 6. Current Status

### ✅ Completed:

- [x] Local SQLite database with offline schema
- [x] Bi-directional cloud sync architecture
- [x] Student data caching for offline auth
- [x] Transaction logging with cloud sync
- [x] Emergency alert tracking
- [x] Inventory management and sync
- [x] UUID/TEXT student_id mapping
- [x] Automatic kiosk registration
- [x] Idempotent database initialization
- [x] Docker integration with persistent volumes
- [x] Graceful error handling in sync

### 🔄 Sync Status:

- Every 60 seconds:
  - ✅ Kiosk record verified/created
  - ✅ Students pulled from cloud
  - ✅ Logs pushed with UUID references
  - ✅ Alerts pushed with UUID references
  - ✅ Inventory synced

### 🚀 Ready for:

- [x] Offline operation without cloud
- [x] Cloud sync when connection available
- [x] Raspberry Pi deployment
- [x] Multi-kiosk deployments
- [x] Production-grade data consistency

---

## 7. Deployment Instructions

### First-Time Setup (Local):

```bash
# Initialize database
node init-db.js

# Start development environment
./dev.sh up

# Initialize database in container
docker exec medisync-backend node init-db.js
```

### Raspberry Pi Deployment:

```bash
# Copy backend directory to Pi
scp -r Kiosk/Backend pi@<pi-ip>:/path/to/app

# SSH into Pi and run
node init-db.js

# Start the application
npm start
```

### Environment Configuration:

1. Create `.env` file in `Kiosk/Backend/` with Supabase credentials
2. Set `KIOSK_ID` to unique identifier
3. Optional: Configure `SYNC_INTERVAL` for different sync frequencies

---

## 8. Files Modified/Created

### New Files:

- `init-db.js` - Database initialization
- `migrate-db.js` - Schema migration utility
- `SUMMARY.md` - This documentation

### Modified Files:

- `sync.js` - Complete rewrite for offline-first sync
- `server.js` - Updated API endpoints for new schema
- `database.js` - Updated table references and seeding
- `docker-compose.yml` - Updated volume exclusions
- `.env.docker` - Docker environment configuration (if needed)

---

## 9. Technical Highlights

### Offline-First Architecture:

- All critical operations work without cloud connection
- Data queued locally for sync when connection available
- Students and inventory cached for instant access

### UUID Handling:

- SQLite stores text `student_id` for local operations
- Automatically fetches and stores `student_uuid` from cloud
- Uses UUID for cloud references, avoiding mismatch errors

### Sync Reliability:

- Individual sync steps don't block others
- Failed syncs are retried in next cycle
- Marked-as-synced pattern prevents duplicates
- Foreign key constraints enforced

### Scalability:

- Supports multiple kiosks with unique IDs
- Kiosk auto-registration in cloud
- Inventory management per kiosk
- Independent sync cycles per instance

---

## 10. Next Steps (Future Work)

- [ ] Add offline student registration
- [ ] Implement local backup/recovery
- [ ] Add sync conflict resolution
- [ ] Medical history integration
- [ ] Staff dashboard sync
- [ ] Enhanced audit logging
- [ ] Data encryption for sensitive fields
- [ ] Rate limiting and queue management

---

## Summary

The MediSync Kiosk subsystem now operates as a robust **offline-first medical kiosk** with:

- Complete offline functionality
- Automatic cloud synchronization
- Proper data consistency with UUID references
- Docker-based deployment
- Production-ready error handling

The system is ready for Raspberry Pi deployment and multi-kiosk scaling.
