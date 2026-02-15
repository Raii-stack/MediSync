import { Heart, Thermometer, Activity } from 'lucide-react';
import { useNavigate } from 'react-router';
import { KioskLayout } from '../components/KioskLayout';
import { useEffect, useState } from 'react';

export function VitalSignsScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);

  useEffect(() => {
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // Simulate vital signs appearing
    setTimeout(() => setHeartRate(90), 1000);
    setTimeout(() => setTemperature(90), 1500);

    // Auto-navigate after completion
    setTimeout(() => {
      navigate('/symptoms');
    }, 4000);

    return () => clearInterval(progressInterval);
  }, [navigate]);

  return (
    <KioskLayout greeting="Hello, Ryan!">
      <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto h-full py-6">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg mb-6">
            <Activity className="w-5 h-5 text-[#4A90E2]" />
            <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Health Monitoring</span>
          </div>
          <h1 className="text-5xl font-bold text-gray-800 mb-6">Vital Signs Check</h1>
          
          {/* Progress Bar */}
          <div className="w-full max-w-2xl mx-auto mb-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#4A90E2] to-[#2ECC71] transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Vital Signs Cards */}
        <div className="grid grid-cols-2 gap-8 w-full max-w-4xl mb-6">
          {/* Heart Rate */}
          <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center border border-gray-100">
            <div className="bg-red-100 rounded-full p-6 mb-6">
              <Heart className="w-16 h-16 text-red-500" fill="currentColor" />
            </div>
            <div className="text-gray-500 font-medium mb-4 text-xl">Heart Rate</div>
            <div className="text-8xl font-bold text-red-500 mb-3">
              {heartRate || '90'}
            </div>
            <div className="text-gray-400 font-medium text-lg">BPM</div>
          </div>

          {/* Temperature */}
          <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center border border-gray-100">
            <div className="bg-blue-100 rounded-full p-6 mb-6">
              <Thermometer className="w-16 h-16 text-[#4A90E2]" />
            </div>
            <div className="text-gray-500 font-medium mb-4 text-xl">Temperature</div>
            <div className="text-8xl font-bold text-[#4A90E2] mb-3">
              {temperature || '90'}
            </div>
            <div className="text-gray-400 font-medium text-lg">°C</div>
          </div>
        </div>

        {/* Status Text */}
        <p className="text-gray-400 text-base">
          {progress === 100 ? 'Capturing heart rate and temperature...' : ''}
        </p>
      </div>
    </KioskLayout>
  );
}