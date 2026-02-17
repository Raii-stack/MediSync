# 🚀 Quick Start Guide - RFID + Vitals Integration

## Start the System

### Terminal 1 - Backend

```bash
cd Kiosk/Backend
npm start
```

Expected output:

```
✅ MediSync Backend running on http://localhost:3001
🔌 Socket.IO: Available at ws://localhost:3001
✅ Listening to Real ESP32... (or) [SIM] Starting Fake Sensor Data Generator...
```

### Terminal 2 - Frontend

```bash
cd Kiosk/Frontend
npm run dev
```

Expected output:

```
VITE v7.x ready in XXX ms
➜  Local:   http://localhost:5173/
```

### Terminal 3 - Testing (Optional)

```powershell
cd Kiosk
.\test-integration.ps1 -TestType all
```

## Test the Flow

### Option 1: With Hardware (ESP32)

1. Open `http://localhost:5173`
2. Tap your RFID card on the reader
3. Watch the screen automatically navigate to vitals
4. Watch real-time vitals data stream for ~35 seconds
5. Automatic navigation to symptoms screen

### Option 2: Without Hardware (Simulation)

1. Open `http://localhost:5173`
2. Click "Tap ID Card" button
3. Wait 1 second for auto-navigation
4. Watch simulated vitals data stream for ~35 seconds
5. Automatic navigation to symptoms screen

### Option 3: Manual Control (Debug Endpoints)

1. Open `http://localhost:5173`
2. In a new PowerShell terminal:

   ```powershell
   # Trigger RFID scan
   Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/rfid" `
     -ContentType "application/json" -Body '{"rfid_uid":"RFID001"}'

   # Wait for navigation, then trigger vitals
   Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/vitals" `
     -ContentType "application/json" -Body '{"bpm":75,"temp":37.0,"duration":10}'
   ```

## Expected Behavior

### WelcomeScreen

- ✅ Shows "Welcome to MediSync"
- ✅ Connection indicator (if backend is off, shows orange warning)
- ✅ When card tapped or button clicked → "Waiting for card scan" appears
- ✅ On RFID detection → Instant navigation to vitals

### VitalSignsScreen

- ✅ Shows greeting: "Hello, [Student Name]!"
- ✅ Progress bar starts at 0% and grows
- ✅ Heart rate updates in real-time (shows `--` until first reading)
- ✅ Temperature updates in real-time (shows `--` until first reading)
- ✅ Status text changes from "Starting scan..." → "Capturing..." → "Scan complete!"
- ✅ After completion → Navigates to symptoms screen

## Browser Console (Expected Logs)

```
✅ Connected to Socket.IO server: abc123def456
📡 RFID Scan received: {student: {…}, uid: 'RFID001'}
🟢 Starting vitals scan...
📊 Vitals progress: {bpm: 75.2, temp: 37.1, progress: 2}
📊 Vitals progress: {bpm: 76.4, temp: 37.3, progress: 4}
...
✅ Vitals scan complete: {avg_bpm: 76, temp: 37.1}
```

## Test Students

| Student ID | RFID UID | Name           | Section  |
| ---------- | -------- | -------------- | -------- |
| 123456     | RFID001  | Ryan Dela Cruz | 12-STEM  |
| TEST-001   | RFID002  | Juan Reyes     | 11-ICT   |
| TEST-002   | RFID003  | Maria Santos   | 12-ABM   |
| TEST-003   | RFID004  | Pedro Garcia   | 11-HUMSS |

## Quick Test Commands

### Check if backend is running

```powershell
Invoke-RestMethod http://localhost:3001/api/debug/status
```

### Simulate RFID for different students

```powershell
# Ryan
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/rfid" `
  -ContentType "application/json" -Body '{"rfid_uid":"RFID001"}'

# Juan
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/rfid" `
  -ContentType "application/json" -Body '{"rfid_uid":"RFID002"}'
```

### Simulate vitals with custom values

```powershell
# High heart rate
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/vitals" `
  -ContentType "application/json" -Body '{"bpm":95,"temp":37.5,"duration":5}'

# Low heart rate
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/debug/vitals" `
  -ContentType "application/json" -Body '{"bpm":60,"temp":36.8,"duration":5}'
```

## Troubleshooting Quick Fixes

### ❌ "Backend not connecting"

- Check if backend is running on port 3001
- Run: `Get-Process node` to see if Node.js is running
- Restart backend

### ❌ "RFID not detected"

- Backend automatically switches to simulation mode
- Just click the button to test manually
- Or use debug endpoint

### ❌ "Vitals not updating"

- Open browser console (F12)
- Look for Socket.IO connection errors
- Check if you see `vitals-progress` events
- Backend console should show "Sent to ESP32" or simulation logs

### ❌ "Page not navigating"

- Check sessionStorage in browser DevTools
- Should contain `studentName` and `vitals` keys
- Clear sessionStorage and try again

## ESP32 Serial Messages (Reference)

If using real hardware, ESP32 should send:

### RFID Detection

```
LOGIN:RFID001
```

### Vitals Reading

```
VITALS:{"bpm":75,"temp":37.2}
```

The backend automatically parses these and converts to socket events.

## Files to Check

- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend API**: `http://localhost:3001` (Express server)
- **Backend Logs**: Terminal 1 output
- **Frontend Logs**: Browser Console (F12 → Console tab)
- **Database**: `Kiosk/Backend/kiosk.db` (SQLite)

## Next Steps After Vitals

After the vitals screen completes:

1. User proceeds to **Symptoms Screen**
2. User selects symptoms
3. System recommends medicine
4. System dispenses medicine
5. Receipt is printed

The vitals data (`bpm`, `temp`) is stored in sessionStorage and will be included in the final transaction log.

---

## Need More Help?

See detailed documentation:

- `RFID_VITALS_INTEGRATION_GUIDE.md` - Full technical guide
- `IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `Backend/BACKEND_SUMMARY.md` - Backend architecture
