import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { socket, getBackendUrl } from '../lib/socket';
import EmergencyBtn from '../components/EmergencyBtn';

const imgHeartWithPulse = "https://www.figma.com/api/mcp/asset/b03a635a-4426-452b-86ad-691c07250801";
const imgTemperature = "https://www.figma.com/api/mcp/asset/fac53357-7104-4b42-9a04-1fa91096a7b0";

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
    <div
      className="relative w-full h-screen bg-[#f5f5f5] overflow-hidden"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#f5f5f5] md:hidden">
        <p className="text-[22px] font-medium text-[#2b2828]">Tablet or desktop required</p>
        <p className="text-[14px] font-medium text-[rgba(43,40,40,0.49)] text-center max-w-[260px]">
          This kiosk experience is not available on phones. Please use a larger screen.
        </p>
      </div>

      <div className="hidden h-full md:flex md:flex-col">
        <div className="flex items-center justify-between px-10 lg:px-[38px] pt-8">
          <p className="text-[32px] lg:text-[36px] font-semibold text-[rgba(43,40,40,0.85)]">
            Hello, {student.first_name}!
          </p>
        </div>

        <div className="hidden md:block">
          <EmergencyBtn />
        </div>

        <div className="mt-6 flex flex-col items-center">
          <p className="text-[32px] lg:text-[36px] font-semibold text-[rgba(43,40,40,0.85)]">
            Vital Signs Check
          </p>
          <p className="mt-2 text-[14px] lg:text-[16px] font-medium text-[rgba(43,40,40,0.49)] text-center">
            {isFinalized
              ? 'Average captured. Proceeding to triage...'
              : scanStarted
              ? `Collecting for accuracy... ${remainingSeconds}s`
              : 'Waiting for sensor data...'}
          </p>
        </div>

        <div className="flex-1 flex items-start justify-center">
          <div className="mt-10 flex gap-10 lg:gap-[120px]">
            <div className="bg-[#f8f8f8] grid grid-rows-[repeat(4,minmax(0,1fr))] gap-[6px] h-[420px] lg:h-[449px] w-[280px] lg:w-[320px] px-[21px] py-[26px] rounded-[24px] shadow-[3px_4px_13.1px_0px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-center -mb-[2px]">
                <img alt="" src={imgHeartWithPulse} className="w-[80px] h-[80px] lg:w-[90px] lg:h-[90px]" />
              </div>
              <div className="flex items-center justify-center">
                <p className="text-[28px] lg:text-[32px] font-medium text-[#7f8c8d] text-center">Heart Rate</p>
              </div>
              <div className="flex items-center justify-center">
                <p className="text-[96px] lg:text-[112px] font-medium text-[#eb3223] leading-[1] text-center">
                  {vitals.bpm}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <p className="text-[20px] lg:text-[24px] font-medium text-[#7f8c8d] text-center">BPM</p>
              </div>
            </div>

            <div className="bg-[#f8f8f8] grid grid-rows-[repeat(4,minmax(0,1fr))] gap-[6px] h-[420px] lg:h-[449px] w-[280px] lg:w-[320px] px-[21px] py-[26px] rounded-[24px] shadow-[3px_4px_13.1px_0px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-center -mb-[2px]">
                <img alt="" src={imgTemperature} className="w-[80px] h-[80px] lg:w-[90px] lg:h-[90px]" />
              </div>
              <div className="flex items-center justify-center">
                <p className="text-[28px] lg:text-[32px] font-medium text-[#7f8c8d] text-center">Temperature</p>
              </div>
              <div className="flex items-center justify-center">
                <p className="text-[88px] lg:text-[96px] font-medium text-[#3b82f6] leading-[1] text-center">
                  {vitals.temp}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <p className="text-[20px] lg:text-[24px] font-medium text-[#7f8c8d] text-center">°C</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pb-10 flex justify-center">
          <p className="text-[14px] lg:text-[16px] font-medium text-[rgba(43,40,40,0.49)] text-center">
            {isFinalized
              ? 'Vitals locked. Moving to triage.'
              : scanStarted
              ? 'Capturing heart rate and temperature...'
              : 'Place your finger on the sensor...'}
          </p>
        </div>
      </div>
    </div>
  );
}
