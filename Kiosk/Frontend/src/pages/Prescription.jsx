import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../lib/socket';

export default function Prescription() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [med, setMed] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispenseLoading, setDispenseLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch medicine library on mount
  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        const res = await axios.get(`${getBackendUrl()}/api/admin/medicines`);
        setMedicines(res.data.medicines || []);
      } catch (err) {
        console.error('❌ Failed to fetch medicines:', err);
        setError('Could not load medicine library');
      }
    };

    fetchMedicines();
  }, []);

  // Matching algorithm - finds best medicine based on symptoms
  useEffect(() => {
    if (!state || medicines.length === 0) {
      if (medicines.length > 0 && !state) {
        navigate('/');
      }
      return;
    }

    const userSymptoms = state.symptoms || [];

    // Find medicine that matches any of the user's symptoms
    const matchedMedicine = medicines.find(med => {
      if (!med.symptoms_target) return false;

      // Parse comma-separated symptoms from backend
      const medicineSymptoms = med.symptoms_target
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

      // Check if any user symptom matches any medicine symptom
      return medicineSymptoms.some(medSymptom =>
        userSymptoms.some(userSymptom =>
          userSymptom.toLowerCase() === medSymptom.toLowerCase()
        )
      );
    });

    if (matchedMedicine) {
      setMed(matchedMedicine.name);
    } else {
      // No match found - show fallback
      setMed(null);
    }

    setLoading(false);
  }, [medicines, state, navigate]);

  const handleDispense = async () => {
    setDispenseLoading(true);
    try {
      const res = await axios.post(`${getBackendUrl()}/api/dispense`, {
        medicine: med,
        student_id: state.student?.student_id || 'ANON',
        student_name: state.student ? `${state.student.first_name} ${state.student.last_name}` : 'Unknown',
        symptoms: state.symptoms,
        pain_level: state.pain,
        vitals: state.vitals || { temp: '--', bpm: '--' }
      });

      console.log('✅ Dispense successful:', res.data);

      // Navigate to receipt page with all the data
      navigate('/receipt', {
        state: {
          student: state.student,
          medicine: med,
          vitals: state.vitals,
          timestamp: res.data.timestamp
        }
      });
    } catch (err) {
      console.error('❌ Dispense error:', err);
      const errorMsg = err.response?.data?.message || 'Server Offline or Medicine Out of Stock';
      alert(`Dispense Error: ${errorMsg}`);
      setDispenseLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="kiosk-container">
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <h2>Loading medicine library...</h2>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="kiosk-container">
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h2>{error}</h2>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '40px',
            padding: '15px 40px',
            fontSize: '16px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer'
          }}
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  // No match found - fallback screen
  if (med === null) {
    return (
      <div className="kiosk-container">
        <h2 style={{ fontSize: '36px', marginBottom: '40px', color: '#e74c3c' }}>
          Please Consult the Nurse
        </h2>

        <div style={{
          border: '3px solid #e74c3c',
          padding: '60px 40px',
          borderRadius: '20px',
          background: 'white',
          width: '80%',
          maxWidth: '600px',
          textAlign: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>🏥</div>

          <h1 style={{ color: '#e74c3c', fontSize: '44px', marginBottom: '20px' }}>
            Medical Consultation Required
          </h1>

          <p style={{ fontSize: '18px', color: '#7f8c8d', lineHeight: '1.8', marginBottom: '30px' }}>
            The symptoms you reported require professional medical evaluation.
            <br />
            <br />
            <strong>Please proceed to the clinic to see the nurse for proper assessment and treatment.</strong>
          </p>

          {/* Symptoms Summary */}
          <div style={{
            background: '#ecf0f1',
            padding: '20px',
            borderRadius: '15px',
            marginBottom: '30px'
          }}>
            <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '10px' }}>
              <strong>Reported symptoms:</strong>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {state.symptoms.map((symptom, idx) => (
                <span key={idx} style={{
                  background: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  color: '#2c3e50'
                }}>
                  {symptom}
                </span>
              ))}
            </div>
            {state.pain && (
              <p style={{ fontSize: '13px', color: '#7f8c8d', marginTop: '10px' }}>
                Pain Level: <strong>{state.pain}/10</strong>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '40px',
            padding: '25px 60px',
            fontSize: '24px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🏥 Go to Clinic
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
            borderRadius: '50px',
            cursor: 'pointer'
          }}
        >
          ← Cancel
        </button>
      </div>
    );
  }

  // Get matched medicine details
  const matchedMedicine = medicines.find(m => m.name === med);

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
        border: '3px solid #2ecc71',
        padding: '40px',
        borderRadius: '20px',
        background: 'white',
        width: '80%',
        maxWidth: '600px',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '80px', marginBottom: '20px' }}>💊</div>
        <h1 style={{ color: '#2ecc71', fontSize: '48px', marginBottom: '20px' }}>
          {med}
        </h1>

        {matchedMedicine?.description && (
          <p style={{ fontSize: '16px', color: '#7f8c8d', marginBottom: '15px' }}>
            {matchedMedicine.description}
          </p>
        )}

        <div style={{
          background: '#f0f9f7',
          padding: '15px',
          borderRadius: '10px',
          marginTop: '20px',
          fontSize: '14px',
          color: '#27ae60'
        }}>
          <p style={{ margin: '0' }}>
            <strong>✓ Matched for:</strong> {matchedMedicine?.symptoms_target}
          </p>
        </div>
      </div>

      {/* Dispense Button */}
      <button
        onClick={handleDispense}
        disabled={dispenseLoading}
        style={{
          marginTop: '40px',
          padding: '25px 60px',
          fontSize: '24px',
          background: dispenseLoading ? '#95a5a6' : '#2ecc71',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          fontWeight: 'bold',
          opacity: dispenseLoading ? 0.7 : 1,
          cursor: dispenseLoading ? 'not-allowed' : 'pointer'
        }}
      >
        {dispenseLoading ? '⏳ Dispensing...' : '💊 DISPENSE NOW'}
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
          borderRadius: '50px',
          cursor: 'pointer'
        }}
      >
        ← Cancel
      </button>

      <p style={{ fontSize: '14px', color: '#999', marginTop: '40px' }}>
        Medicine will be dispensed from the kiosk
      </p>
    </div>
  );
}
