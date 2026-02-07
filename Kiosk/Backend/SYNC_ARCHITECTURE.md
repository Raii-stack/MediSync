# MediSync Backend: Store-and-Forward Sync Architecture

## 📋 Overview

The backend uses a **Store-and-Forward** strategy to ensure the kiosk works offline. All medicine dispensing is recorded locally first, then synced to Supabase in the background.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP REST + Socket.io
┌────────────────────────▼────────────────────────────────────┐
│              SERVER.JS (Port 3001)                           │
│  • Handles medicine dispensing requests                      │
│  • Moves motors via ESP32                                    │
│  • Writes transactions to SQLite with synced = 0            │
│  • Streams vitals via Socket.io                              │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────▼───────────────┐
         │    LOCAL SQLITE DATABASE      │
         │  (inventory + transactions)   │
         │  (synced = 0 = needs upload)  │
         └───────────────┬───────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              SYNC.JS (Background)                            │
│  • Runs every 60 seconds (configurable)                      │
│  • Pushes unsynced transactions to Supabase                  │
│  • Updates inventory levels in Supabase                      │
│  • Marks transactions as synced = 1                          │
│  • Retries on network failure                                │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────▼───────────────┐
         │   SUPABASE CLOUD (Remote)     │
         │  • clinic_visits table        │
         │  • kiosk_inventory table      │
         │  • emergency_alerts table     │
         └───────────────────────────────┘
```

---

## ⚙️ Setup Instructions

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier available)
2. Create a new project (choose a region near you)
3. Wait for the project to initialize (2-3 minutes)

### Step 2: Create Cloud Database Schema

1. In Supabase Dashboard, go to **SQL Editor** → **New Query**
2. Copy the entire contents of `SUPABASE_SETUP.sql`
3. Paste into the SQL editor and click **Run**
4. Verify that 3 tables were created:
   - `clinic_visits` - logs of medicine dispensed
   - `kiosk_inventory` - current stock levels
   - `emergency_alerts` - emergency notifications

### Step 3: Add Environment Variables

1. In Supabase, go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **Anon Public Key** (starts with `eyJ...`)
3. In your backend folder, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Open `.env` and paste your values:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   KIOSK_ID=kiosk-001
   SYNC_INTERVAL=60
   ```

---

## 🚀 Running the Backend

### Option A: Two Terminals (Easiest for Development)

**Terminal 1 - The Server (Handles Requests):**

```bash
npm run server
```

**Terminal 2 - The Sync Agent (Background Uploads):**

```bash
npm run sync
```

### Option B: Single Command (Best for Raspberry Pi)

```bash
npm start
```

or

```bash
npm run dev
```

This will start **both** the server and sync agent simultaneously.

---

## 📊 Data Flow Example

### Example: Student Gets Medicine

```
1. React Frontend sends:
   POST /api/dispense
   { medicine: "Biogesic", student_id: "2024-001", pain_level: 5 }

2. server.js immediately:
   ✓ Checks SQLite inventory
   ✓ Activates ESP32 motor (or simulates)
   ✓ Deducts from stock locally
   ✓ Logs to transactions table with synced = 0
   ✓ Returns success to frontend (INSTANT - no network wait!)

3. sync.js (running every 60 seconds):
   [At next sync interval]
   ✓ Checks SQLite: "Give me all WHERE synced = 0"
   ✓ Sends to Supabase clinic_visits table
   ✓ Updates kiosk_inventory in Supabase
   ✓ Marks row as synced = 1 in local SQLite
   ✓ Logs "✅ Synced to cloud"

4. Nurse's Dashboard:
   [Refreshes page]
   ✓ Sees new clinic visit
   ✓ Sees updated stock count
   ✓ Can respond to emergency alerts
```

---

## 🔄 Sync Agent Details

### What It Does (Every Cycle)

**STEP A: Push Transactions**

- Reads local `transactions` WHERE `synced = 0`
- Sends each row to Supabase `clinic_visits` table
- Marks them as `synced = 1` locally
- If network fails, retries next cycle

**STEP B: Update Inventory**

- Reads current `inventory` table
- Upserts each medicine into Supabase `kiosk_inventory`
- Nurse can see which medicines are running low

**STEP C: Emergency Alerts**

- Future: Retry failed emergency alerts

### Configuration

Edit in `.env`:

```bash
# Sync every 30 seconds (for testing)
SYNC_INTERVAL=30

# Sync every 5 minutes
SYNC_INTERVAL=300

# Default: 60 seconds
SYNC_INTERVAL=60
```

---

## 🛡️ Offline-First Benefits

✅ **No network = No problem**

- Medicine still dispenses instantly
- All transactions logged locally
- UI never freezes waiting for internet

✅ **Network comes back**

- sync.js automatically uploads everything
- No data loss
- Nurse dashboard auto-updates

✅ **Multiple kiosks**

- Each kiosk has unique `KIOSK_ID`
- All sync to same Supabase project
- Teacher/Nurse sees consolidated view

---

## 📁 File Structure

```
Backend/
├── server.js                 # Main API + Socket.io
├── sync.js                   # Background sync agent
├── serial.js                 # Hardware / Simulation layer
├── database.js               # SQLite setup
├── package.json              # Scripts & dependencies
├── .env.example              # Template for env vars
├── SUPABASE_SETUP.sql        # Create cloud tables
└── medisync.db               # Local SQLite database
```

---

## 🔧 Troubleshooting

### Sync Agent Not Starting

```bash
# Check if .env exists
ls .env

# If not, create it from template
cp .env.example .env
# Then fill in your Supabase credentials
```

### "SUPABASE_URL not found" Warning

This is **normal** if you haven't set up Supabase yet.

- Sync will skip and run in offline mode
- Once you add `.env`, sync will activate automatically

### Transactions Not Syncing

1. Check Supabase is reachable: `curl https://your-project.supabase.co`
2. Verify credentials in `.env`
3. Check Sync Agent logs for errors
4. Manually test with:
   ```bash
   # In Supabase SQL Editor, query:
   SELECT * FROM clinic_visits;
   ```

---

## 📝 API Endpoints (Handled by server.js)

```
GET  /api/inventory              → Get current stock
POST /api/dispense               → Request medicine
POST /api/emergency              → Send emergency alert
WS   [Socket.io]                 → Stream vitals in real-time
```

---

## 🎯 Next Steps

1. ✅ Backend running locally - DONE
2. ⏳ Set up Supabase (Steps 1-3 above)
3. ⏳ Build React Frontend to consume API
4. ⏳ Connect actual ESP32 hardware
5. ⏳ Deploy to Raspberry Pi

---

**Questions?** Check the error logs:

- Server logs: Show in Terminal 1
- Sync logs: Show in Terminal 2
- Supabase logs: Check Supabase Dashboard → Logs
