# MediSync Kiosk Backend Summary

This document summarizes the backend services, data model, and operational scripts located in the Kiosk backend.

## Overview

The backend is a Node.js (CommonJS) application that provides:

- REST APIs for kiosk actions and admin functions.
- Real-time vitals streaming to the frontend via Socket.IO.
- Hardware integration (ESP32 or simulation) for vitals and dispensing.
- A local SQLite database for offline operation.
- A sync agent that pushes/pulls data to Supabase.

## Key Files and Responsibilities

### API Server and WebSocket

- **[server.js](server.js)**
  - Express server with JSON parsing and CORS enabled.
  - Socket.IO server for real-time streaming of vitals (`vitals-update`).
  - Uses `database.js` for SQLite access and `serial.js` for hardware I/O.
  - Exposes endpoints for login, inventory, admin slot/medicine management, scan start/stop, dispensing, and emergency alerts.

### Hardware and Simulation

- **[serial.js](serial.js)**
  - Integrates with an ESP32 over serial (configurable `PORT_PATH`).
  - Supports simulation mode to generate fake vitals.
  - Exposes:
    - `onData(callback)` to stream vitals (real or simulated).
    - `dispense(servoId)` to trigger a servo slot dispense.
    - `startScan()` and `stopScan()` to control sensor scanning.
  - Includes a 35-second auto-stop timer for scan safety.

### Local Database

- **[database.js](database.js)**
  - Creates and opens a local SQLite database `kiosk.db`.
  - Seeds a minimal `students_cache` set when empty.

- **[init-db.js](init-db.js)**
  - Creates local tables and seeds initial data:
    - `kiosk_config`
    - `students_cache`
    - `medicines_library`
    - `kiosk_slots`
    - `kiosk_logs`
    - `emergency_alerts`
  - Seeds medicines and default slot assignments if tables are empty.

### Supabase Schema

- **[SUPABASE_SETUP.sql](SUPABASE_SETUP.sql)**
  - Defines the Supabase schema used by the sync agent.
  - Includes core identity tables (`students`, `clinic_staff`, `medical_history`, `kiosks`).
  - Includes transactional tables (`kiosk_inventory`, `kiosk_logs`, `emergency_alerts`, `clinic_visits`).
  - Enables RLS and creates permissive policies for MVP.

### Sync Agent

- **[sync.js](sync.js)**
  - Runs on an interval (default 60 seconds).
  - Uses Supabase credentials from `.env`.
  - Sync workflow:
    1. Ensure kiosk record exists in Supabase.
    2. Pull students into local `students_cache`.
    3. Push unsynced `kiosk_logs` to Supabase.
    4. Push unsynced `emergency_alerts` to Supabase.
    5. Push local `kiosk_slots` inventory to Supabase (local is source of truth).

### Runtime and Tooling

- **[package.json](package.json)**
  - `start`/`dev` runs both `server.js` and `sync.js` concurrently.
  - Dependencies include Express, Socket.IO, SQLite, Supabase client, and SerialPort.

- **[nodemon.json](nodemon.json)**
  - Watches JavaScript and JSON files.
  - Ignores DB files and node modules.

- **[Dockerfile](Dockerfile)**
  - Development container build for the backend.
  - Exposes port `3001` and runs `npm start`.

## API Endpoints (server.js)

### Public/Kiosk

- `POST /api/login`
  - Looks up `students_cache` by `student_id`.
  - Returns student info or a Guest record if not found.

- `GET /api/inventory`
  - Returns slot inventory joined with medicine details.

- `POST /api/dispense`
  - Dispenses medicine by looking up its slot.
  - Decrements stock, logs the transaction, and returns the result.

- `POST /api/scan/start`
  - Starts hardware scanning and emits vitals updates.

- `POST /api/scan/stop`
  - Stops scanning.

- `POST /api/emergency`
  - Logs an emergency alert message (cloud sync handled by `sync.js`).

### Admin

- `GET /api/admin/medicines`
  - Returns the medicines library.

- `POST /api/admin/medicines`
  - Adds a new medicine to the library.

- `GET /api/admin/slots`
  - Returns slot configuration with medicine details.

- `POST /api/admin/slots`
  - Updates a slot assignment and optionally its stock.

## Data Model (Local SQLite)

- `students_cache`: local cache of student records for offline login.
- `medicines_library`: list of available medicines with description and symptoms.
- `kiosk_slots`: slot inventory with stock levels and sync status.
- `kiosk_logs`: dispense and vitals history.
- `emergency_alerts`: emergency alerts queued for sync.

## Operational Notes

- Real hardware requires configuring `PORT_PATH` in [serial.js](serial.js).
- The backend defaults to simulation mode if hardware is unavailable.
- Supabase sync requires `.env` values:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - Optional: `DB_PATH`, `KIOSK_ID`, `SYNC_INTERVAL`, `ROOM_ASSIGNED`.

## Known Limitations

- The emergency endpoint currently logs locally and relies on the sync agent for cloud updates.
- RLS policies in Supabase are permissive for MVP and should be tightened before production.
