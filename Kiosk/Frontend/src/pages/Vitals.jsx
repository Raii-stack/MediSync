import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { socket, getBackendUrl } from '../lib/socket';

export default function Vitals() {
  const { state } = useLocation(); // Get student data passed from Home
  const student = state?.student || { first_name: "Guest" };
  const [vitals, setVitals] = useState({ temp: '--', bpm: '--' });
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [isFinalized, setIsFinalized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [scanStarted, setScanStarted] = useState(false);
  const navigate = useNavigate();
  const samplesRef = useRef({ temps: [], bpms: [] });
  const finalizedRef = useRef(false);
  const scanStartedRef = useRef(false);
  const countdownIntervalRef = useRef(null);
  const finalizeTimeoutRef = useRef(null);

  useEffect(() => {
    const API_BASE = getBackendUrl();
    // Log the API base
    console.log('[Vitals] Using API_BASE:', API_BASE);
    
    // START_SCAN on mount
    console.log('[Vitals] Starting scan with URL:', `${API_BASE}/api/scan/start`);
    axios.post(`${API_BASE}/api/scan/start`).catch(err => {
      console.error('Failed to start scan:', err);
    });

    socket.off('connect');
    socket.off('disconnect');
    socket.off('vitals-update');

    socket.on('connect', () => {
      console.log('✅ Connected to backend');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Disconnected from backend');
      setConnected(false);
    });

    socket.on('vitals-update', (data) => {
      if (finalizedRef.current) return;

      // Start countdown and timer when first sensor data arrives
      if (!scanStartedRef.current) {
        scanStartedRef.current = true;
        setScanStarted(true);
        
        // Start countdown
        countdownIntervalRef.current = setInterval(() => {
          setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        // Set finalize timeout
        finalizeTimeoutRef.current = setTimeout(() => {
          const temps = samplesRef.current.temps;
          const bpms = samplesRef.current.bpms;

          const avgTemp = temps.length
            ? (temps.reduce((sum, val) => sum + val, 0) / temps.length).toFixed(1)
            : '--';
          const avgBpm = bpms.length
            ? Math.round(bpms.reduce((sum, val) => sum + val, 0) / bpms.length)
            : '--';

          setVitals({ temp: avgTemp, bpm: avgBpm });
          finalizedRef.current = true;
          setIsFinalized(true);

          socket.off('vitals-update');

          // STOP_SCAN before navigating
          axios.post(`${getBackendUrl()}/api/scan/stop`).catch(err => {
            console.error('Failed to stop scan:', err);
          });

          // Pass both student and vitals to next page
          setTimeout(() => navigate('/triage', { 
            state: { student, vitals: { temp: avgTemp, bpm: avgBpm } } 
          }), 800);
        }, 30000);
      }

      const temp = Number.parseFloat(data.temp);
      const bpm = Number.parseFloat(data.bpm);
      if (!Number.isNaN(temp)) samplesRef.current.temps.push(temp);
      if (!Number.isNaN(bpm)) samplesRef.current.bpms.push(bpm);

      setVitals({
        temp: Number.isNaN(temp) ? data.temp : temp.toFixed(1),
        bpm: Number.isNaN(bpm) ? data.bpm : Math.round(bpm)
      });
    });

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (finalizeTimeoutRef.current) clearTimeout(finalizeTimeoutRef.current);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('vitals-update');
    };
  }, [navigate]);

  return (
    <div className="kiosk-container">
      {/* GREETING HEADER */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '20px', 
        fontSize: '24px', 
        fontWeight: 'bold', 
        color: '#2c3e50' 
      }}>
        Hello, {student.first_name} 👋
      </div>

      <h2 style={{ fontSize: '36px', marginBottom: '10px' }}>Vital Signs Check</h2>
      <p style={{ fontSize: '16px', color: '#7f8c8d', marginBottom: '40px' }}>
        {isFinalized
          ? '✅ Average captured. Proceeding to triage...'
          : scanStarted
          ? `Collecting for accuracy... ${remainingSeconds}s`
          : 'Waiting for sensor data...'}
      </p>

      <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
        
        {/* Heart Rate Card */}
        <div style={{ 
          padding: '40px', 
          background: 'white', 
          borderRadius: '20px', 
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)', 
          textAlign: 'center',
          minWidth: '250px'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>❤️</div>
          <h3 style={{ fontSize: '20px', color: '#7f8c8d', marginBottom: '10px' }}>Heart Rate</h3>
          <h1 style={{ fontSize: '60px', color: '#e74c3c', margin: '10px 0' }}>
            {vitals.bpm}
          </h1>
          <span style={{ fontSize: '18px', color: '#95a5a6' }}>BPM</span>
        </div>

        {/* Temperature Card */}
        <div style={{ 
          padding: '40px', 
          background: 'white', 
          borderRadius: '20px', 
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)', 
          textAlign: 'center',
          minWidth: '250px'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🌡️</div>
          <h3 style={{ fontSize: '20px', color: '#7f8c8d', marginBottom: '10px' }}>Temperature</h3>
          <h1 style={{ fontSize: '60px', color: '#3498db', margin: '10px 0' }}>
            {vitals.temp}
          </h1>
          <span style={{ fontSize: '18px', color: '#95a5a6' }}>°C</span>
        </div>

      </div>

      <p style={{ fontSize: '14px', color: '#999', marginTop: '40px' }}>
        {isFinalized
          ? 'Vitals locked. Moving to triage.'
          : scanStarted
          ? 'Capturing heart rate and temperature...'
          : 'Place your finger on the sensor...'}
      </p>
    </div>
  );
}
