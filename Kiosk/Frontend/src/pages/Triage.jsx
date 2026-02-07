import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SYMPTOMS_LIST = [
  { id: 'fever', label: 'Fever', icon: '🤒' },
  { id: 'headache', label: 'Headache', icon: '🤕' },
  { id: 'colds', label: 'Colds', icon: '🤧' },
  { id: 'abdominal', label: 'Abdominal Pain', icon: '😣' },
  { id: 'dysmenorrhea', label: 'Dysmenorrhea', icon: '💢' },
  { id: 'dehydration', label: 'Dehydration', icon: '💧' },
  { id: 'vomiting', label: 'Vomiting', icon: '🤮' },
  { id: 'diarrhea', label: 'Diarrhea', icon: '🚽' }
];

export default function Triage() {
  const navigate = useNavigate();
  const [pain, setPain] = useState(5);
  const [selectedSymptoms, setSelected] = useState([]);

  const toggleSymptom = (symptom) => {
    if (selectedSymptoms.includes(symptom)) {
      setSelected(selectedSymptoms.filter(s => s !== symptom));
    } else {
      setSelected([...selectedSymptoms, symptom]);
    }
  };

  const handleSubmit = () => {
    if (selectedSymptoms.length === 0) {
      alert("Please select at least one symptom.");
      return;
    }
    navigate('/prescription', { state: { symptoms: selectedSymptoms, pain } });
  };

  const getPainEmoji = () => {
    if (pain <= 3) return '🙂';
    if (pain <= 6) return '😐';
    if (pain <= 8) return '😟';
    return '😢';
  };

  const getPainLabel = () => {
    if (pain <= 3) return 'Mild';
    if (pain <= 6) return 'Moderate';
    if (pain <= 8) return 'Severe';
    return 'Very Severe';
  };

  return (
    <div className="kiosk-container" style={{ justifyContent: 'flex-start', paddingTop: '60px', overflowY: 'auto', paddingBottom: '60px' }}>
      <h2 style={{ fontSize: '36px', marginBottom: '40px' }}>How are you feeling?</h2>
      
      {/* Pain Scale Buttons */}
      <div style={{ width: '80%', marginBottom: '40px', maxWidth: '700px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '20px', fontWeight: 'bold' }}>Pain Scale</label>
          <span style={{ fontSize: '32px' }}>{getPainEmoji()}</span>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#3498db' }}>{pain}</span>
          <span style={{ fontSize: '20px', color: '#7f8c8d' }}> / 10</span>
          <div style={{ fontSize: '16px', color: '#95a5a6', marginTop: '5px' }}>
            {getPainLabel()}
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '10px',
          marginTop: '15px'
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
            const isActive = Number(pain) === value;
            return (
              <button
                key={value}
                onClick={() => setPain(value)}
                style={{
                  padding: '14px 0',
                  fontSize: '18px',
                  borderRadius: '12px',
                  border: `2px solid ${isActive ? '#3498db' : '#bdc3c7'}`,
                  background: isActive ? '#3498db' : 'white',
                  color: isActive ? 'white' : '#2c3e50',
                  fontWeight: 'bold'
                }}
              >
                {value}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '14px', color: '#7f8c8d' }}>
          <span>1-3 Mild</span>
          <span>4-6 Moderate</span>
          <span>7-10 Severe</span>
        </div>
      </div>

      {/* Symptoms Grid */}
      <h3 style={{ fontSize: '24px', marginBottom: '20px' }}>Select Your Symptoms:</h3>
      <div className="symptoms-grid">
        {SYMPTOMS_LIST.map((symptom) => {
          const isSelected = selectedSymptoms.includes(symptom.label);
          return (
            <button
              key={symptom.id}
              onClick={() => toggleSymptom(symptom.label)}
              style={{
                padding: '20px', 
                fontSize: '18px', 
                border: '2px solid #3498db',
                borderRadius: '15px', 
                background: isSelected ? '#3498db' : 'white',
                color: isSelected ? 'white' : '#3498db',
                fontWeight: 'bold',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '32px' }}>{symptom.icon}</span>
              <span>{symptom.label}</span>
            </button>
          );
        })}
      </div>

      <button 
        onClick={handleSubmit}
        style={{ 
          marginTop: '40px', 
          padding: '20px 80px', 
          fontSize: '24px', 
          background: selectedSymptoms.length > 0 ? '#2ecc71' : '#95a5a6',
          color: 'white', 
          border: 'none', 
          borderRadius: '50px',
          fontWeight: 'bold'
        }}
      >
        Get Recommendation →
      </button>
    </div>
  );
}
