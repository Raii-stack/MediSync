import { useNavigate } from 'react-router';
import { KioskLayout } from '../components/KioskLayout';
import { Check, FileText, Pill, Heart, Thermometer, Clock, User, Building, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ReceiptScreen() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown === 0) {
      navigate('/');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  return (
    <KioskLayout showEmergency={false}>
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto h-full py-6">
        {/* Success Animation */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <div className="relative w-16 h-16 bg-gradient-to-br from-[#2ECC71] to-[#27AE60] rounded-full flex items-center justify-center shadow-2xl">
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-1">Treatment Complete!</h1>
        <p className="text-base text-gray-500 mb-6">Your receipt is ready</p>

        {/* Receipt Card - Compact Version */}
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-200 w-full max-w-3xl mb-6 overflow-hidden">
          {/* Receipt Header */}
          <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-white" />
              <div>
                <h2 className="text-white font-bold text-base">MediSync Kiosk</h2>
                <p className="text-blue-100 text-xs">EMU Health Center</p>
              </div>
            </div>
            <div className="text-right text-white">
              <div className="text-xs opacity-80">March 23, 2024</div>
              <div className="text-xs opacity-80">3:00 PM</div>
            </div>
          </div>

          {/* Receipt Body - Compact Grid */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-6 mb-5">
              {/* Patient Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Patient</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="font-semibold text-gray-800 text-sm">Ryan Santos</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Student No.</div>
                  <div className="font-semibold text-gray-800 text-sm">102456</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Section</div>
                  <div className="font-semibold text-gray-800 text-sm">12-STEM</div>
                </div>
              </div>

              {/* Vital Signs */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Vitals</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-red-50 rounded-lg p-2">
                    <Heart className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">Heart Rate</div>
                      <div className="font-bold text-sm text-gray-800">91 BPM</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                    <Thermometer className="w-4 h-4 text-[#4A90E2] flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">Temp</div>
                      <div className="font-bold text-sm text-gray-800">36.7°C</div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">Pain Level</div>
                    <div className="font-bold text-sm text-yellow-700">5/10 - Moderate</div>
                  </div>
                </div>
              </div>

              {/* Symptoms & Medicine */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Treatment</span>
                </div>
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">Symptoms</div>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">🤧 Colds</span>
                </div>
                
                {/* Medicine - Highlighted */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-[#2ECC71] rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#2ECC71] to-[#27AE60] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Pill className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-600">Dispensed</div>
                      <div className="text-base font-bold text-gray-800 truncate">Bioflu</div>
                      <div className="text-xs text-gray-500">Cold Relief</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions - Compact */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-900 font-medium mb-1">📋 Instructions:</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Take with water as directed. If symptoms persist after 3 days, visit the clinic. Keep this receipt for your records.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/')}
          className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] text-white px-12 py-4 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold text-lg mb-3"
        >
          <Check className="w-5 h-5" />
          Complete Session
        </button>

        <p className="text-gray-400 text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-[#4A90E2] rounded-full animate-pulse"></span>
          Auto-returning to home in {countdown} seconds
        </p>
      </div>
    </KioskLayout>
  );
}