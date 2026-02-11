import { useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../lib/socket';

export default function Home() {
  const navigate = useNavigate();
  const [adminClickCount, setAdminClickCount] = useState(0);
  const adminTimeoutRef = useRef(null);

  const handleLogoClick = () => {
    // Clear previous timeout
    if (adminTimeoutRef.current) {
      clearTimeout(adminTimeoutRef.current);
    }

    // Increment counter
    const newCount = adminClickCount + 1;
    setAdminClickCount(newCount);

    // If 5 clicks, navigate to admin
    if (newCount >= 5) {
      console.log('🔐 Admin panel unlocked!');
      setAdminClickCount(0);
      navigate('/admin');
      return;
    }

    // Reset counter after 1.5 seconds of inactivity
    adminTimeoutRef.current = setTimeout(() => {
      setAdminClickCount(0);
    }, 1500);
  };

  const simulateTap = async () => {
    console.log("💳 RFID Tapped!");
    
    try {
      // Simulate ID "123456" (Ryan Dela Cruz)
      const res = await axios.post(`${getBackendUrl()}/api/login`, { 
        student_id: "123456" 
      });
      
      if (res.data.success) {
        console.log("✅ Login successful:", res.data.student);
        // Pass student info to the next page
        navigate('/vitals', { state: { student: res.data.student } });
      }
    } catch (err) {
      console.error("❌ Login Error:", err);
      alert("Login Error: Is Backend running?");
    }
  };

  return (
    <div className="kiosk-container" style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: '40px' }}>
        <div 
          onClick={handleLogoClick}
          style={{ 
            width: '200px', 
            height: '200px', 
            margin: '0 auto 20px',
            backgroundColor: '#3498db',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '80px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            transform: adminClickCount > 0 ? 'scale(0.97)' : 'scale(1)'
          }}
          title="MediSync"
        >
          🏥
        </div>
      </div>
      
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Welcome to MediSync</h1>
      <p style={{ fontSize: '24px', color: '#555', marginBottom: '60px' }}>
        Your Smart Health Kiosk
      </p>
      <p style={{ fontSize: '20px', color: '#777', marginBottom: '40px' }}>
        Tap your Student ID to begin
      </p>
      
      {/* Debug Button */}
      <button 
        onClick={simulateTap}
        style={{ 
          marginTop: '50px', 
          padding: '20px 60px', 
          fontSize: '24px', 
          background: '#3498db', 
          color: 'white', 
          border: 'none', 
          borderRadius: '50px',
          fontWeight: 'bold'
        }}
      >
        [DEBUG] Tap ID Card
      </button>
      
      <p style={{ fontSize: '14px', color: '#999', marginTop: '100px' }}>
        For actual use, RFID reader will be connected
      </p>
    </div>
  );
}
