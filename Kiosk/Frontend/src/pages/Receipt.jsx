import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Receipt() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);
  
  // Data passed from Prescription page
  const { student, medicine, vitals, timestamp } = state || {};

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  if (!state) {
    return (
      <div className="kiosk-container">
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <h2>Generating receipt...</h2>
      </div>
    );
  }

  return (
    <div className="kiosk-container" style={{ background: 'white' }}>
      <div style={{ 
        border: '2px solid #333', 
        padding: '40px', 
        width: '400px', 
        fontFamily: 'Courier New, monospace', 
        textAlign: 'left',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        background: 'white'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          borderBottom: '2px dashed #333', 
          paddingBottom: '20px',
          fontFamily: 'Arial, sans-serif',
          marginBottom: '20px'
        }}>
          🏥 MediSync Receipt
        </h2>

        <p><strong>Date:</strong> {timestamp || new Date().toLocaleString()}</p>
        <p><strong>Student No:</strong> {student?.student_id || 'N/A'}</p>
        <p><strong>Name:</strong> {student?.first_name} {student?.last_name}</p>
        <p><strong>Section:</strong> {student?.section || 'N/A'}</p>

        <div style={{ 
          margin: '20px 0', 
          borderTop: '1px solid #ccc', 
          borderBottom: '1px solid #ccc', 
          padding: '10px 0' 
        }}>
          <p><strong>Vitals Recorded:</strong></p>
          <p>Temperature: {vitals?.temp || '--'}°C</p>
          <p>Heart Rate: {vitals?.bpm || '--'} bpm</p>
        </div>

        <p style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          marginTop: '20px',
          textAlign: 'center',
          padding: '15px',
          background: '#f0f0f0',
          borderRadius: '8px'
        }}>
          💊 Dispensed: {medicine}
        </p>

        <p style={{ 
          marginTop: '30px', 
          textAlign: 'center', 
          fontSize: '12px',
          color: '#666',
          lineHeight: '1.6'
        }}>
          Take care and drink water! <br/>
          If symptoms persist, visit the clinic.<br/>
          <strong>- NEU Clinic -</strong>
        </p>
      </div>

      <button 
        onClick={() => navigate('/')} 
        style={{ 
          marginTop: '30px', 
          padding: '15px 40px', 
          background: '#3498db', 
          color: 'white', 
          border: 'none',
          borderRadius: '50px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        ✓ Finish
      </button>

      <p style={{ fontSize: '14px', color: '#999', marginTop: '20px' }}>
        Auto-reset in {countdown} second{countdown !== 1 ? 's' : ''}...
      </p>
    </div>
  );
}
