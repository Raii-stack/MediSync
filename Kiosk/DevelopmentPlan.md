
### **Phase 1: Project Setup & Database Schema**

Before writing code, we must define **where data lives**.

* **Kiosk (Offline-First):** Uses **SQLite** (fast, works without internet).
* **Clinic (Cloud):** Uses **Supabase** (PostgreSQL, real-time, easy to use).

#### **Step 1.1: Define Data Structure**

**A. Local SQLite (On Raspberry Pi)**
You need 3 tables in your local database:

1. `inventory`: `id`, `medicine_name`, `stock_count`, `max_stock`.
2. `transactions`: `id`, `student_id`, `symptoms`, `medicine_given`, `timestamp`.
3. `students_cache`: `student_id`, `name`, `section` (A local copy of student data for fast login).

**B. Cloud Supabase (For Clinic Dashboard)**
Create a project on Supabase and create these tables:

1. `students`: `id` (PK), `student_id` (RFID UID), `name`, `medical_history`, `guardian_contact`.
2. `kiosk_inventory`: `kiosk_id`, `medicine_name`, `current_stock`.
3. `clinic_visits`: `id`, `student_id`, `reason`, `treatment`, `date`.
4. `emergency_alerts`: `id`, `kiosk_location`, `status` (PENDING/RESOLVED), `created_at`.
5. `prescriptions`: `id`, `student_id`, `medicine`, `dosage`, `notes`, `doctor_name`.

---

### **Phase 2: The Kiosk Backend (Node.js)**

This runs on the Raspberry Pi. It controls the hardware and talks to the React frontend.

#### **Step 2.1: Initialize Server**

1. Create folder `medisync-kiosk-backend`.
2. Run `npm init -y`.
3. Install: `npm install express sqlite3 serialport socket.io cors`.

#### **Step 2.2: Create API Endpoints**

Create `server.js`. You need these specific routes:

* `POST /api/rfid-login`: Accepts an RFID tag. Checks `students_cache`. Returns "Welcome, [Name]".
* `POST /api/vitals`: Receives `{ bpm: 98, temp: 36.5 }` from the ESP32 (via Serial) and sends it to the Frontend.
* `POST /api/dispense`:
* **Input:** `{ medicine: "Neozep" }`.
* **Logic:** Check stock in SQLite. If > 0, send command to ESP32 to move servo. Decrement stock. Log transaction.


* `POST /api/emergency`:
* **Logic:** Insert a row into the Supabase `emergency_alerts` table immediately.



#### **Step 2.3: Hardware Bridge (Serial Port)**

In `server.js`, setup the listener for the ESP32:

```javascript
const { SerialPort, ReadlineParser } = require('serialport');
const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// Read data from ESP32 (Sensors)
parser.on('data', (data) => {
    // data comes in as JSON string: '{"temp": 36.5, "bpm": 80}'
    io.emit('vitals-update', JSON.parse(data)); // Send to React Frontend
});

// Function to dispense (Write to ESP32)
function dispenseMedicine(servoId) {
    port.write(JSON.stringify({ action: "dispense", servo: servoId }) + '\n');
}

```

---

### **Phase 3: The Kiosk Frontend (React)**

This is the UI shown on the 7-inch screen.

#### **Step 3.1: Setup**

1. `npx create-react-app medisync-kiosk`.
2. Install Router: `npm install react-router-dom axios socket.io-client`.

#### **Step 3.2: Build the Pages (Based on your images)**

* **Component 1: `GlobalEmergencyBtn.js**`
* A red button fixed to the top-right corner.
* **Action:** `axios.post('/api/emergency')`. Shows "Alert Sent! Nurse is coming."


* **Page 1: `Home.js` (Attract Screen)**
* Big "MediSync" logo.
* Text: "Tap ID to Start".
* **Logic:** Listens for socket event `rfid-read` from backend. Redirects to `/triage` on success.


* **Page 2: `Vitals.js**`
* Show instructions: "Place finger on sensor."
* **Logic:** Display live data from `socket.on('vitals-update')`. Once stable, "Next" button appears.


* **Page 3: `Triage.js` (The Feeling Scale)**
* 3 Big Emoji Buttons: 😢 (Bad), 😐 (Okay), 🙂 (Good).
* Checkbox List: Fever, Headache, Colds, Dysmenorrhea (Menstrual Pain).
* "Next" button sends this data to the Recommendation Engine.


* **Page 4: `Prescription.js` (Recommendation)**
* **Logic:**
* `if (symptoms.includes('Fever')) return 'Biogesic'`.
* `if (symptoms.includes('Colds')) return 'Neozep'`.


* Display: Large image of the pill + Usage Text.
* "Dispense" Button: Calls `axios.post('/api/dispense')`.



---

### **Phase 4: The Clinic Dashboard (Web)**

This is for the nurses/admins on their laptop.

#### **Step 4.1: Dashboard Home (Inventory)**

* **View:** A grid showing "Room 301 Kiosk", "Room 302 Kiosk".
* **Data:** Fetch from Supabase `kiosk_inventory` table.
* **Visual:** Show stock bars. If "Biogesic" < 5, turn the bar **Red**.

#### **Step 4.2: Emergency Listener (The Alarm)**

* Use **Supabase Realtime**. This is critical.
* In your main `App.js`:

```javascript
supabase
  .channel('emergency-room')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_alerts' }, (payload) => {
      // 1. Play Alarm Sound
      new Audio('/alarm.mp3').play();
      // 2. Show Pop-up
      alert(`EMERGENCY IN ROOM: ${payload.new.kiosk_location}`);
  })
  .subscribe();

```

#### **Step 4.3: Student Database & E-Prescription**

* **Search Bar:** Search by Student ID or Name.
* **Profile View:**
* Left Column: Personal Info (Age, Blood Type, History).
* Right Column: Visit History (Table of past transactions).


* **"Generate Prescription" Button:**
* Opens a form (Medicine, Dosage, Doctor Notes).
* **"Print" Button:** Uses `window.print()` with a specific CSS `@media print` layout to look like a formal prescription paper.



---

### **Phase 5: Integration & Sync Strategy**

**The "Internet Cut-Off" Problem:**
What if the school Wi-Fi goes down? The Kiosk must still work.

**The Solution:**

1. **Dispense Logic:** The Kiosk *always* checks the **SQLite (Local)** database for stock, not the Cloud. This ensures dispensing is instant and offline-capable.
2. **Background Sync:**
* Create a simple timer in your Node.js backend (e.g., every 5 minutes).
* It checks for "unsynced" transactions in SQLite.
* It pushes them to Supabase `clinic_visits`.
* It updates Supabase `kiosk_inventory` with the new stock levels.
