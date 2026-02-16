# RFID + Vitals Integration Guide

## Overview

This guide explains how the RFID card scanning and real-time vitals monitoring integration works between the backend (ESP32 hardware) and frontend (React UI).

## Architecture

### Flow Diagram

```
1. RFID Card Tap → ESP32 → Backend (serial.js) → Socket.IO → Frontend (WelcomeScreen)
2. Navigate to VitalSignsScreen
3. Frontend calls /api/scan/start → Backend → ESP32 starts scanning
4. ESP32 sends vitals → Backend → Socket.IO → Frontend (VitalSignsScreen updates in real-time)
5. After 35 seconds or completion → Backend → Socket.IO → Frontend navigates to SymptomsScreen
```

## Backend Components

### 1. Serial/Hardware Layer (`serial.js`)

- Connects to ESP32 via serial port or runs in simulation mode
- **RFID Detection**: Listens for `LOGIN:uid` messages from ESP32
- **Vitals Streaming**: Listens for `VITALS:{json}` messages from ESP32
- **Commands**:
  - `startScan()` - Tells ESP32 to start measuring vitals
  - `stopScan()` - Tells ESP32 to stop measuring vitals
  - `dispense(servoId)` - Triggers medicine dispensing

### 2. Socket.IO Server (`server.js`)

Emits the following events:

- **`rfid-scan`**: When RFID card is detected
  ```javascript
  { student: {...}, uid: "RFID001" }
  ```
- **`vitals-progress`**: Real-time vitals updates (every 2 seconds in simulation)
  ```javascript
  { bpm: 75, temp: 37.2, progress: 5.5 }
  ```
- **`vitals-complete`**: Final averaged vitals
  ```javascript
  { avg_bpm: 76, temp: 37.1 }
  ```

### 3. REST API Endpoints

- **POST `/api/scan/start`**: Starts vitals scanning on ESP32
- **POST `/api/scan/stop`**: Stops vitals scanning
- **POST `/api/debug/rfid`**: Simulate RFID tap (for testing without hardware)
- **POST `/api/debug/vitals`**: Simulate vitals data (for testing without hardware)

## Frontend Components

### 1. Socket Context (`SocketContext.tsx`)

- Maintains persistent Socket.IO connection to backend
- Provides `socket` and `isConnected` to all components
- Automatically reconnects on disconnection

### 2. Welcome Screen (`WelcomeScreen.tsx`)

**Listens for**: `rfid-scan` socket event

**On RFID Scan**:

1. Stores student info in sessionStorage
2. Navigates to `/vitals`

**Features**:

- Shows connection status indicator
- Shows "waiting for card" indicator when button is clicked
- Includes 1-second fallback for manual testing without hardware

### 3. Vital Signs Screen (`VitalSignsScreen.tsx`)

**Flow**:

1. On mount → Calls `POST /api/scan/start`
2. Listens for `vitals-progress` events → Updates progress bar and readings
3. Listens for `vitals-complete` event → Shows final results
4. After 1.5 seconds → Navigates to `/symptoms`
5. On unmount → Calls `POST /api/scan/stop`

**Features**:

- Real-time progress bar (0-100%)
- Real-time heart rate display
- Real-time temperature display
- Opacity effect when no data yet
- Dynamic status text

## Testing Methods

### Option 1: With Real Hardware (ESP32)

1. **Start Backend**:

   ```bash
   cd Kiosk/Backend
   npm start
   ```

2. **Start Frontend**:

   ```bash
   cd Kiosk/Frontend
   npm run dev
   ```

3. **Connect ESP32**:
   - Ensure ESP32 is connected to correct COM port (check `serial.js` PORT_PATH)
   - ESP32 should send:
     - `LOGIN:RFID001` when card is tapped
     - `VITALS:{"bpm":75,"temp":37.2}` every 2 seconds during scan

4. **Test Flow**:
   - Open `http://localhost:5173`
   - Tap RFID card on reader
   - Watch vitals screen update in real-time

### Option 2: With Simulation Mode (No Hardware)

1. **Enable Simulation** (already default if no hardware detected)

2. **Start Backend & Frontend** (same as above)

3. **Test Flow**:
   - Open `http://localhost:5173`
   - Click "Tap ID Card" button
   - Wait 1 second for auto-navigation
   - Watch simulated vitals data stream

### Option 3: Manual Testing with Debug Endpoints

Open a new terminal and use curl or PowerShell:

**Simulate RFID Tap**:

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/rfid" -ContentType "application/json" -Body '{"rfid_uid":"RFID001"}'
```

**Simulate Vitals Data** (5 second simulation):

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/vitals" -ContentType "application/json" -Body '{"bpm":75,"temp":37.0,"duration":5}'
```

**Check Status**:

```powershell
Invoke-RestMethod -Method GET -Uri "http://localhost:3001/api/debug/status"
```

## Test Students in Database

The following test students are seeded in the `students_cache` table:

| Student ID | RFID UID | Name           | Section  |
| ---------- | -------- | -------------- | -------- |
| 123456     | RFID001  | Ryan Dela Cruz | 12-STEM  |
| TEST-001   | RFID002  | Juan Reyes     | 11-ICT   |
| TEST-002   | RFID003  | Maria Santos   | 12-ABM   |
| TEST-003   | RFID004  | Pedro Garcia   | 11-HUMSS |

## Troubleshooting

### Socket.IO Not Connecting

- Check if backend is running on port 3001
- Check browser console for connection errors
- Look for `✅ Connected to Socket.IO server` in console

### RFID Not Detected

- Check ESP32 serial connection
- Verify `PORT_PATH` in `serial.js`
- Try simulation mode or debug endpoint

### Vitals Not Updating

- Check browser console for `vitals-progress` events
- Verify backend is emitting events (check backend console)
- Ensure `/api/scan/start` was called successfully

### Progress Bar Not Moving

- Check if `progress` value is being received in `vitals-progress` event
- Backend calculates progress as `sampleCount / 5` (max 10)
- Frontend converts to percentage: `progress * 10`

## SessionStorage Data

The integration stores the following data for use across screens:

- **`currentStudent`**: Full student object from database
- **`studentName`**: Display name (e.g., "Ryan Dela Cruz")
- **`vitals`**: Final vitals object `{ bpm: 76, temp: 37.1 }`

## Expected Timeline

In simulation mode:

- RFID detection: Instant
- Vitals scanning: ~35 seconds (17 samples @ 2s each)
- Auto-complete: After 17 samples or 35 seconds (whichever comes first)
- Navigate to symptoms: 1.5 seconds after completion

## Browser Console Logs

**Expected logs during successful flow**:

```
✅ Connected to Socket.IO server: abc123
📡 RFID Scan received: {student: {...}, uid: "RFID001"}
🟢 Starting vitals scan...
📊 Vitals progress: {bpm: 75, temp: 37.2, progress: 2}
📊 Vitals progress: {bpm: 76, temp: 37.1, progress: 4}
...
✅ Vitals scan complete: {avg_bpm: 76, temp: 37.1}
```

## Next Steps

After vitals screen completes, the user proceeds to:

1. **SymptomsScreen** - Select symptoms
2. **RecommendationScreen** - Get medicine recommendation
3. **DispensingScreen** - Dispense medicine
4. **ReceiptScreen** - Show transaction receipt

The vitals data stored in sessionStorage is used for the dispensing log.
