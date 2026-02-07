import axios from 'axios';
import { getBackendUrl } from '../lib/socket';

export default function EmergencyBtn() {
  const handleEmergency = async () => {
    const confirm = window.confirm("Are you sure you want to call the Clinic?");
    if (!confirm) return;

    try {
      // Connects to your running Backend
      await axios.post(`${getBackendUrl()}/api/emergency`, { 
        room_number: "KIOSK-01" 
      });
      alert("ALARM SENT! The Nurse has been notified.");
    } catch (err) {
      console.error('Emergency alert error:', err);
      alert("Error: Backend not connected. Please check if server is running.");
    }
  };

  return (
    <button 
      onClick={handleEmergency}
      style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px', 
        backgroundColor: '#e74c3c', 
        color: 'white', 
        padding: '15px 30px', 
        borderRadius: '50px', 
        fontSize: '18px', 
        fontWeight: 'bold', 
        border: 'none', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.2)', 
        zIndex: 1000,
        cursor: 'pointer'
      }}
    >
      🚨 EMERGENCY
    </button>
  );
}
