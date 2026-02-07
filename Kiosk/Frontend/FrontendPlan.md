
### **Chunk 1: Project Initialization & Setup**

We will use **Vite** for a fast, modern React setup.

1. **Open VS Code Terminal** and navigate to your main project folder.
2. **Create the Frontend:**
```bash
npm create vite@latest . -- --template react
cd Frontend
npm install

```


3. **Install Required Libraries:**
* `react-router-dom`: For navigation.
* `axios`: To talk to your backend API.
* `socket.io-client`: For live sensor data.
* `framer-motion`: For smooth page transitions (optional but looks great).


```bash
npm install react-router-dom axios socket.io-client framer-motion

```


4. **Clean Up:**
* Delete `src/App.css` and `src/index.css` content (start fresh).
* Add this basic CSS to `src/index.css` to make it look like a kiosk:


```css
body {
  margin: 0;
  font-family: 'Arial', sans-serif;
  background-color: #f0f4f8; /* Light medical blue */
  overflow: hidden; /* Hide scrollbars for kiosk feel */
  user-select: none; /* Prevent highlighting text */
}
.kiosk-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
button { cursor: pointer; }

```



---

### **Chunk 2: Asset Management**

Organize the images you provided so the code can find them.

1. **Create Folder:** `src/assets/images`
2. **Move Files:** Place your uploaded images here and rename them for clarity:
* `image_00c540.png`  `bg-welcome.png`
* `image_00c55c.png`  `bg-vitals.png`
* `image_00c578.png`  `bg-symptoms.png` (or just use the icons if you crop them)
* `image_00c5d6.png`  `pill-neozep.png`
* (Add a generic `logo.png` if you have one)



---

### **Chunk 3: The Layout & Emergency Button**

We need a "Wrapper" that keeps the **Red Emergency Button** visible on every page, except maybe the login screen.

**Create `src/components/EmergencyBtn.jsx`:**

```jsx
import axios from 'axios';

export default function EmergencyBtn() {
  const handleEmergency = async () => {
    const confirm = window.confirm("Are you sure you want to call the Clinic?");
    if (!confirm) return;

    try {
      // Connects to your running Backend
      await axios.post('http://localhost:3001/api/emergency', { room_number: "KIOSK-01" });
      alert("ALARM SENT! The Nurse has been notified.");
    } catch (err) {
      alert("Error: Backend not connected.");
    }
  };

  return (
    <button 
      onClick={handleEmergency}
      style={{ 
        position: 'absolute', top: '20px', right: '20px', 
        backgroundColor: '#e74c3c', color: 'white', 
        padding: '15px 30px', borderRadius: '50px', 
        fontSize: '18px', fontWeight: 'bold', border: 'none', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.2)', zIndex: 1000
      }}
    >
      🚨 EMERGENCY
    </button>
  );
}

```

**Update `src/App.jsx`:**

```jsx
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import EmergencyBtn from './components/EmergencyBtn';
import Home from './pages/Home';
import Vitals from './pages/Vitals';
import Triage from './pages/Triage';
import Prescription from './pages/Prescription';

function Layout({ children }) {
  const location = useLocation();
  return (
    <div className="kiosk-wrapper">
      {/* Show button on all pages */}
      <EmergencyBtn />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vitals" element={<Vitals />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="/prescription" element={<Prescription />} />
        </Routes>
      </Layout>
    </Router>
  );
}

```

---

### **Chunk 4: The Pages (Step-by-Step)**

**1. Create `src/pages/Home.jsx` (Attract Screen)**

* **Goal:** Simulate the RFID Tap.

```jsx
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  const simulateTap = () => {
    console.log("💳 RFID Tapped!");
    navigate('/vitals');
  };

  return (
    <div className="kiosk-container" style={{ textAlign: 'center' }}>
      <img src="/src/assets/images/bg-welcome.png" alt="Welcome" style={{ width: '300px' }} />
      <h1>Welcome to MediSync</h1>
      <p style={{ fontSize: '20px', color: '#555' }}>Tap your Student ID to begin</p>
      
      {/* Debug Button */}
      <button 
        onClick={simulateTap}
        style={{ marginTop: '50px', padding: '20px', fontSize: '24px', background: '#3498db', color: 'white', border: 'none', borderRadius: '10px' }}
      >
        [DEBUG] Tap ID Card
      </button>
    </div>
  );
}

```

**2. Create `src/pages/Vitals.jsx` (Live Data)**

* **Goal:** Show the `socket.io` stream from your backend simulation.

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:3001'); // Ensure this matches your backend port

export default function Vitals() {
  const [vitals, setVitals] = useState({ temp: '--', bpm: '--' });
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('vitals-update', (data) => {
      setVitals(data);
    });
    return () => socket.off('vitals-update');
  }, []);

  return (
    <div className="kiosk-container">
      <h2>Vital Signs Check</h2>
      <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
        
        {/* Heart Rate Card */}
        <div style={{ padding: '40px', background: 'white', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3>Heart Rate</h3>
          <h1 style={{ fontSize: '60px', color: '#e74c3c', margin: '10px 0' }}>{vitals.bpm}</h1>
          <span>BPM</span>
        </div>

        {/* Temperature Card */}
        <div style={{ padding: '40px', background: 'white', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3>Temperature</h3>
          <h1 style={{ fontSize: '60px', color: '#3498db', margin: '10px 0' }}>{vitals.temp}</h1>
          <span>°C</span>
        </div>

      </div>

      <button 
        onClick={() => navigate('/triage')}
        style={{ marginTop: '50px', padding: '20px 60px', fontSize: '24px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '50px' }}
      >
        Next Step
      </button>
    </div>
  );
}

```

**3. Create `src/pages/Triage.jsx` (The Form)**

* **Goal:** Replicate your "How are you feeling" image.

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SYMPTOMS_LIST = [
  "Fever", "Headache", "Colds", "Abdominal Pain", 
  "Dysmenorrhea", "Dehydration", "Vomiting", "Diarrhea"
];

export default function Triage() {
  const navigate = useNavigate();
  const [pain, setPain] = useState(5);
  const [selectedSymptoms, setSelected] = useState([]);

  const toggleSymptom = (sym) => {
    if (selectedSymptoms.includes(sym)) {
      setSelected(selectedSymptoms.filter(s => s !== sym));
    } else {
      setSelected([...selectedSymptoms, sym]);
    }
  };

  const handleSubmit = () => {
    if (selectedSymptoms.length === 0) return alert("Please select at least one symptom.");
    navigate('/prescription', { state: { symptoms: selectedSymptoms, pain } });
  };

  return (
    <div className="kiosk-container" style={{ justifyContent: 'flex-start', paddingTop: '80px' }}>
      <h2>How are you feeling?</h2>
      
      {/* Pain Scale Slider */}
      <div style={{ width: '80%', marginBottom: '30px' }}>
        <label>Pain Scale: {pain} / 10</label>
        <input 
          type="range" min="1" max="10" value={pain} 
          onChange={(e) => setPain(e.target.value)}
          style={{ width: '100%', height: '20px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>🙂 Good</span><span>😐 Okay</span><span>😢 Worst</span>
        </div>
      </div>

      {/* Symptoms Grid */}
      <h3>Select Symptoms:</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '80%' }}>
        {SYMPTOMS_LIST.map((sym) => (
          <button
            key={sym}
            onClick={() => toggleSymptom(sym)}
            style={{
              padding: '20px', fontSize: '18px', border: '2px solid #3498db',
              borderRadius: '15px', background: selectedSymptoms.includes(sym) ? '#3498db' : 'white',
              color: selectedSymptoms.includes(sym) ? 'white' : '#3498db'
            }}
          >
            {sym}
          </button>
        ))}
      </div>

      <button 
        onClick={handleSubmit}
        style={{ marginTop: '30px', padding: '20px 80px', fontSize: '24px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '50px' }}
      >
        Get Recommendation
      </button>
    </div>
  );
}

```

**4. Create `src/pages/Prescription.jsx` (Dispense Logic)**

* **Goal:** Send the API command to move the motor.

```jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Prescription() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [med, setMed] = useState(null);
  const [loading, setLoading] = useState(false);

  // Simple Logic Engine
  useEffect(() => {
    if (!state) return navigate('/');

    const s = state.symptoms;
    if (s.includes("Fever") || s.includes("Headache")) {
      setMed({ name: "Biogesic", desc: "Take 1 tablet every 4 hours for fever." });
    } else if (s.includes("Colds") || s.includes("Rhinitis")) {
      setMed({ name: "Neozep", desc: "Take 1 tablet every 6 hours for relief." });
    } else if (s.includes("Abdominal Pain") || s.includes("Dysmenorrhea")) {
      setMed({ name: "Buscopan", desc: "Take 1 tablet for cramps." });
    } else {
      setMed({ name: "Clinic Consult", desc: "Please proceed to the clinic for checkup." });
    }
  }, []);

  const handleDispense = async () => {
    if (med.name === "Clinic Consult") return;

    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3001/api/dispense', {
        medicine: med.name,
        student_id: "SIMULATED-ID",
        symptoms: state.symptoms,
        pain_level: state.pain
      });
      alert(res.data.message); // Success!
      setTimeout(() => navigate('/'), 3000); // Return to home
    } catch (err) {
      alert("Dispense Error: " + (err.response?.data?.message || "Server Offline"));
      setLoading(false);
    }
  };

  if (!med) return <div>Analyzing...</div>;

  return (
    <div className="kiosk-container">
      <h2>Recommended Medication</h2>
      
      <div style={{ border: '3px solid #3498db', padding: '30px', borderRadius: '20px', background: 'white', width: '60%', textAlign: 'center' }}>
        <h1 style={{ color: '#2c3e50', fontSize: '48px' }}>{med.name}</h1>
        <p style={{ fontSize: '20px', color: '#7f8c8d' }}>{med.desc}</p>
      </div>

      <button 
        onClick={handleDispense}
        disabled={loading || med.name === "Clinic Consult"}
        style={{ 
          marginTop: '40px', padding: '25px 50px', fontSize: '24px', 
          background: med.name === "Clinic Consult" ? '#95a5a6' : '#2ecc71', 
          color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer'
        }}
      >
        {loading ? "Dispensing..." : "DISPENSE NOW"}
      </button>
    </div>
  );
}

```

---

### **Chunk 5: Connecting & Testing**

1. **Start Backend:** In Terminal 1 (`medisync-backend`), run `node server.js`.
2. **Start Frontend:** In Terminal 2 (`medisync-frontend`), run `npm run dev`.
3. **Open Browser:** Go to the Localhost URL provided by Vite.
4. **Test Loop:**
* Click "[DEBUG] Tap ID Card".
* Watch Vitals change (from your `serial.js` simulation).
* Click Next.
* Select "Fever".
* Click "Get Recommendation".
* See "Biogesic".
* Click "DISPENSE NOW".
* **Check Backend Terminal:** You should see `[SIM] 💊 Dispensing Servo 1`.

