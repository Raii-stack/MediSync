import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../lib/socket';

const MEDICINE_INFO = {
  'Biogesic': { icon: '💊', color: '#e74c3c', desc: 'Take 1 tablet every 4 hours for fever and pain relief.' },
  'Neozep': { icon: '💊', color: '#3498db', desc: 'Take 1 tablet every 6 hours for colds and flu relief.' },
  'Buscopan': { icon: '💊', color: '#9b59b6', desc: 'Take 1 tablet for abdominal cramps and pain relief.' },
  'Cetirizine': { icon: '💊', color: '#1abc9c', desc: 'Take 1 tablet daily for allergy relief.' },
  'Clinic Consult': { icon: '🏥', color: '#95a5a6', desc: 'Please proceed to the clinic for a proper checkup.' }
};

export default function Prescription() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [med, setMed] = useState(null);
  const [loading, setLoading] = useState(false);

  // Simple Logic Engine - Determines medicine based on symptoms
  useEffect(() => {
    if (!state) {
      navigate('/');
      return;
    }

    const s = state.symptoms;
    let recommendedMed = 'Clinic Consult';

    // Fever or Headache → Biogesic
    if (s.includes('Fever') || s.includes('Headache')) {
      recommendedMed = 'Biogesic';
    } 
    // Colds → Neozep
    else if (s.includes('Colds')) {
      recommendedMed = 'Neozep';
    } 
    // Abdominal Pain or Dysmenorrhea → Buscopan
    else if (s.includes('Abdominal Pain') || s.includes('Dysmenorrhea')) {
      recommendedMed = 'Buscopan';
    }
    // Dehydration, Vomiting, Diarrhea → Clinic Consult
    else if (s.includes('Dehydration') || s.includes('Vomiting') || s.includes('Diarrhea')) {
      recommendedMed = 'Clinic Consult';
    }

    setMed(recommendedMed);
  }, [state, navigate]);

  const handleDispense = async () => {
    if (med === 'Clinic Consult') {
      alert('Please visit the school clinic for proper medical attention.');
      navigate('/');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${getBackendUrl()}/api/dispense`, {
        medicine: med,
        student_id: 'SIMULATED-ID',
        symptoms: state.symptoms,
        pain_level: state.pain
      });
      
      console.log('✅ Dispense successful:', res.data);
      alert(res.data.message || `✅ ${med} dispensed successfully!`);
      
      // Return to home after 2 seconds
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      console.error('❌ Dispense error:', err);
      const errorMsg = err.response?.data?.message || 'Server Offline or Medicine Out of Stock';
      alert(`Dispense Error: ${errorMsg}`);
      setLoading(false);
    }
  };

  if (!med) {
    return (
      <div className="kiosk-container">
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <h2>Analyzing symptoms...</h2>
      </div>
    );
  }

  const medInfo = MEDICINE_INFO[med];

  return (
    <div className="kiosk-container">
      <h2 style={{ fontSize: '36px', marginBottom: '40px' }}>Recommended Treatment</h2>
      
      {/* Symptoms Summary */}
      <div style={{ 
        background: '#ecf0f1', 
        padding: '20px', 
        borderRadius: '15px', 
        marginBottom: '30px',
        maxWidth: '600px'
      }}>
        <p style={{ fontSize: '16px', color: '#7f8c8d', marginBottom: '10px' }}>
          <strong>Your symptoms:</strong>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {state.symptoms.map((symptom, idx) => (
            <span key={idx} style={{ 
              background: 'white', 
              padding: '8px 16px', 
              borderRadius: '20px',
              fontSize: '14px',
              color: '#2c3e50'
            }}>
              {symptom}
            </span>
          ))}
        </div>
        <p style={{ fontSize: '14px', color: '#7f8c8d', marginTop: '10px' }}>
          Pain Level: <strong>{state.pain}/10</strong>
        </p>
      </div>

      {/* Medicine Card */}
      <div style={{ 
        border: `3px solid ${medInfo.color}`, 
        padding: '40px', 
        borderRadius: '20px', 
        background: 'white', 
        width: '80%',
        maxWidth: '600px',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '80px', marginBottom: '20px' }}>{medInfo.icon}</div>
        <h1 style={{ color: medInfo.color, fontSize: '48px', marginBottom: '20px' }}>
          {med}
        </h1>
        <p style={{ fontSize: '18px', color: '#7f8c8d', lineHeight: '1.6' }}>
          {medInfo.desc}
        </p>
      </div>

      {/* Dispense Button */}
      <button 
        onClick={handleDispense}
        disabled={loading}
        style={{ 
          marginTop: '40px', 
          padding: '25px 60px', 
          fontSize: '24px', 
          background: loading ? '#95a5a6' : (med === 'Clinic Consult' ? '#e67e22' : '#2ecc71'), 
          color: 'white', 
          border: 'none', 
          borderRadius: '50px',
          fontWeight: 'bold',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? '⏳ Dispensing...' : (med === 'Clinic Consult' ? 'Go to Clinic' : '💊 DISPENSE NOW')}
      </button>

      <button 
        onClick={() => navigate('/')}
        style={{ 
          marginTop: '20px', 
          padding: '15px 40px', 
          fontSize: '16px', 
          background: 'transparent', 
          color: '#7f8c8d', 
          border: '2px solid #bdc3c7', 
          borderRadius: '50px'
        }}
      >
        ← Cancel
      </button>

      <p style={{ fontSize: '14px', color: '#999', marginTop: '40px' }}>
        {med !== 'Clinic Consult' && 'Medicine will be dispensed from the kiosk'}
      </p>
    </div>
  );
}
