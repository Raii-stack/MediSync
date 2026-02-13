import { useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../lib/socket';

const imgSvg = "https://www.figma.com/api/mcp/asset/ed05af8b-7ff7-45f9-83cf-74e02bea59c1";

export default function Home() {
  const navigate = useNavigate();
  const [adminClickCount, setAdminClickCount] = useState(0);
  const adminTimeoutRef = useRef(null);

  const handleLogoClick = () => {
    if (adminTimeoutRef.current) {
      clearTimeout(adminTimeoutRef.current);
    }

    const newCount = adminClickCount + 1;
    setAdminClickCount(newCount);

    if (newCount >= 5) {
      console.log('🔐 Admin panel unlocked!');
      setAdminClickCount(0);
      navigate('/admin');
      return;
    }

    adminTimeoutRef.current = setTimeout(() => {
      setAdminClickCount(0);
    }, 1500);
  };

  const handleEmergency = async () => {
    const confirm = window.confirm("Are you sure you want to call the Clinic?");
    if (!confirm) return;

    try {
      await axios.post(`${getBackendUrl()}/api/emergency`, { 
        room_number: "KIOSK-01" 
      });
      alert("ALARM SENT! The Nurse has been notified.");
    } catch (err) {
      console.error('Emergency alert error:', err);
      alert("Error: Backend not connected. Please check if server is running.");
    }
  };

  const simulateTap = async () => {
    console.log('💳 RFID Tapped!');
    try {
      const res = await axios.post(`${getBackendUrl()}/api/login`, {
        student_id: '123456',
      });

      if (res.data.success) {
        console.log('✅ Login successful:', res.data.student);
        navigate('/vitals', { state: { student: res.data.student } });
      }
    } catch (err) {
      console.error('❌ Login Error:', err);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#f9fafb] flex flex-col items-center justify-center overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* Emergency Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={handleEmergency}
          className="bg-[#ef4444] text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-red-600 transition-colors uppercase tracking-wide text-sm"
        >
          <span className="material-icons animate-pulse">warning</span>
          EMERGENCY
        </button>
      </div>

      {/* Logo Section */}
      <div className="-translate-y-20 pt-8 pb-12 flex flex-col items-center z-90">
        <div className="relative flex items-center justify-center cursor-pointer" onClick={handleLogoClick}>
          {/* Outer Ring - border-2, inset -32px from logo */}
          <div className="absolute border-2 border-[#bfdbfe] rounded-full opacity-60" style={{ inset: '-32px' }}></div>
          {/* Inner Dashed Ring - border, inset -16px from logo */}
          <div className="absolute border border-[#93c5fd] border-dashed rounded-full opacity-40" style={{ inset: '-16px' }}></div>
          
          {/* Main Icon Container - 192x192 */}
          <div className="relative w-[182px] h-[182px] bg-[#3b82f6] rounded-[32px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] flex items-center justify-center overflow-hidden transition-transform active:scale-95">
            <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(45deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.2) 100%)" }}></div>
            <img src={imgSvg} alt="MediSync Logo" className="w-[96px] h-[96px] relative z-10" />
          </div>
        </div>
      </div>

      {/* Headings */}
      <div className="-translate-y-15 flex flex-col items-center gap-[23.5px] px-4 pb-16 max-w-[672px]">
        <h1 className="text-[60px] leading-[60px] font-bold text-[#111827] tracking-[-1.5px] text-center">
          Welcome to <span className="text-[#3b82f6]">MediSync</span>
        </h1>
        <p className="-translate-y-7 text-[24px] leading-[32px] font-light text-[#6b7280] text-center">
          Your Smart Health Kiosk
        </p>
      </div>

      {/* Action Section */}
      <div className="flex flex-col items-center w-full px-[288px] max-w-full">
        {/* Instruction Text */}
        <p className="text-[16px] pb-[10px] leading-[24px] font-medium text-[#9ca3af] uppercase tracking-[3.2px] text-center mb-8">
          Tap your Student ID to begin
        </p>
        
        {/* Button */}
        <button
          id="debug-btn"
          onClick={simulateTap}
          className="h-[70px] w-full max-w-[520px] bg-[#3b82f6] text-white rounded-[24px] py-[40px] px-[80px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] flex items-center justify-center gap-4 hover:bg-blue-600 transition-all transform hover:-translate-y-1 overflow-hidden"
        >
          <span className="material-icons text-[30px] leading-[36px]">nfc</span>
          <span className="text-[24px] font-semibold tracking-[0.6px] leading-[32px]">
            Tap ID Card
          </span>
        </button>

        {/* Footer Text */}
        <div className="fixed bottom-8 flex flex-col items-center gap-2 pt-8 max-w-[320px] px-4">
          <p className="text-[12px] text-[#878d99] opacity-70 leading-[16px] text-center" style={{ fontFamily: "'Liberation Mono', monospace" }}>
        v3.0.1
          </p>
        </div>
      </div>
    </div>
  );
}
