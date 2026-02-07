import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  const simulateTap = () => {
    console.log("💳 RFID Tapped!");
    navigate('/vitals');
  };

  return (
    <div className="kiosk-container" style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: '40px' }}>
        <div 
          style={{ 
            width: '200px', 
            height: '200px', 
            margin: '0 auto 20px',
            backgroundColor: '#3498db',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '80px'
          }}
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
