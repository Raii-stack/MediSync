import { Heart, Thermometer, Activity } from "lucide-react";
import { useNavigate } from "react-router";
import { KioskLayout } from "../components/KioskLayout";
import { useEffect, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import axios from "axios";
import imgHeartWithPulse from "../assets/heart-icon.png";
import imgTemperature from "../assets/temp-icon.png";
import { API_BASE_URL } from "../config/api";

const API_BASE = API_BASE_URL;

export function VitalSignsScreen() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [progress, setProgress] = useState(0);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("Starting scan...");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Start the vitals scan when component mounts
    const startScan = async () => {
      try {
        console.log("🟢 Starting vitals scan...");
        await axios.post(`${API_BASE}/api/scan/start`);
        setIsScanning(true);
        setStatusText("Measuring heart rate and temperature...");
      } catch (error) {
        console.error("❌ Error starting scan:", error);
        setStatusText("Error starting scan. Please try again.");
      }
    };

    startScan();

    // Cleanup: stop scan when component unmounts
    return () => {
      if (isScanning) {
        axios.post(`${API_BASE}/api/scan/stop`).catch(console.error);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;

    // Listen for real-time vitals progress updates
    const handleVitalsProgress = (data: {
      bpm: number;
      temp: number;
      progress: number;
    }) => {
      console.log("📊 Vitals progress:", data);

      // Update heart rate and temperature with real data
      if (data.bpm) {
        setHeartRate(Math.round(data.bpm));
      }
      if (data.temp) {
        setTemperature(parseFloat(data.temp.toFixed(1)));
      }

      // Update progress bar (convert to percentage 0-100)
      if (data.progress !== undefined) {
        const progressPercent = Math.min(100, data.progress * 10);
        setProgress(progressPercent);
      }

      setStatusText("Capturing heart rate and temperature...");
    };

    // Listen for scan completion with averaged results
    const handleVitalsComplete = (data: { avg_bpm: number; temp: number }) => {
      console.log("✅ Vitals scan complete:", data);

      // Set final averaged values
      setHeartRate(Math.round(data.avg_bpm));
      setTemperature(parseFloat(data.temp.toFixed(1)));
      setProgress(100);
      setStatusText("Scan complete!");

      // Store vitals in sessionStorage for use in other screens
      sessionStorage.setItem(
        "vitals",
        JSON.stringify({
          bpm: Math.round(data.avg_bpm),
          temp: parseFloat(data.temp.toFixed(1)),
        }),
      );

      // Navigate to symptoms screen after a short delay
      setTimeout(() => {
        navigate("/symptoms");
      }, 1500);
    };

    socket.on("vitals-progress", handleVitalsProgress);
    socket.on("vitals-complete", handleVitalsComplete);

    // Cleanup listeners on unmount
    return () => {
      socket.off("vitals-progress", handleVitalsProgress);
      socket.off("vitals-complete", handleVitalsComplete);
    };
  }, [socket, navigate]);

  return (
    <KioskLayout
      greeting={`Hello, ${sessionStorage.getItem("studentName") || "Guest"}!`}
    >
      <div className="relative w-full h-full">
        {/* Title Badge */}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-[calc(50%-296.51px)] bg-white/80 backdrop-blur-sm flex gap-3 items-center px-6 py-3 rounded-full shadow-lg">
          <Activity className="w-5 h-5 text-[#4A90E2]" />
          <span className="text-sm font-normal text-[#4a5565] uppercase tracking-wide">
            Health Monitoring
          </span>
        </div>

        {/* Title */}
        <h1 className="absolute left-1/2 -translate-x-1/2 top-[calc(50%-258.5px)] text-5xl font-bold text-[#1e2939] text-center leading-[48px]">
          Vital Signs Check
        </h1>

        {/* Progress Bar */}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-[calc(50%-155.5px)] w-[576px] h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#4A90E2] to-[#2ECC71] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Heart Rate Card */}
        <div className="absolute left-[calc(50%-212px)] -translate-x-1/2 -translate-y-1/2 top-[calc(50%+97.5px)] w-[310px] h-[422px] bg-[#f8f8f8] rounded-3xl shadow-[0px_8px_10px_0px_rgba(235,50,35,0.1),0px_20px_25px_0px_rgba(235,50,35,0.1)] px-[21px] py-[26px]">
          <div className="grid grid-rows-4 gap-3 h-full">
            {/* Icon */}
            <div className="flex items-center justify-center">
              <img
                src={imgHeartWithPulse}
                alt=""
                className="w-[90px] h-[90px] object-contain"
              />
            </div>

            {/* Label */}
            <div className="flex items-center justify-center">
              <p className="font-bold text-[32px] text-[#7f8c8d] text-center">
                Heart Rate
              </p>
            </div>

            {/* Value */}
            <div className="flex items-center justify-center">
              <p
                className={`font-bold text-[112px] text-[#eb3223] leading-none transition-all ${heartRate ? "opacity-100" : "opacity-30"}`}
              >
                {heartRate || "--"}
              </p>
            </div>

            {/* Unit */}
            <div className="flex items-center justify-center">
              <p className="font-semibold text-2xl text-[#7f8c8d]">BPM</p>
            </div>
          </div>
        </div>

        {/* Temperature Card */}
        <div className="absolute left-[calc(50%+212px)] -translate-x-1/2 -translate-y-1/2 top-[calc(50%+97.5px)] w-[310px] h-[422px] bg-[#f8f8f8] rounded-3xl shadow-[0px_8px_10px_0px_rgba(39,174,96,0.1),0px_20px_25px_0px_rgba(0,166,62,0.1)] px-[21px] py-[26px]">
          <div className="grid grid-rows-4 gap-3 h-full">
            {/* Icon */}
            <div className="flex items-center justify-center">
              <img
                src={imgTemperature}
                alt=""
                className="w-[90px] h-[90px] object-contain"
              />
            </div>

            {/* Label */}
            <div className="flex items-center justify-center">
              <p className="font-bold text-[32px] text-[#7f8c8d] text-center">
                Temperature
              </p>
            </div>

            {/* Value */}
            <div className="flex items-center justify-center">
              <p
                className={`font-bold text-[112px] text-[#3b82f6] leading-none transition-all ${temperature ? "opacity-100" : "opacity-30"}`}
              >
                {temperature || "--"}
              </p>
            </div>

            {/* Unit */}
            <div className="flex items-center justify-center">
              <p className="font-semibold text-2xl text-[#7f8c8d]">°C</p>
            </div>
          </div>
        </div>

        {/* Status Text */}
        <p className="absolute left-1/2 -translate-x-1/2 top-[calc(50%+325.5px)] text-base font-medium text-[rgba(43,40,40,0.49)] text-center">
          {statusText}
        </p>
      </div>
    </KioskLayout>
  );
}
