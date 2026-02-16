import { useNavigate } from 'react-router';
import { KioskLayout } from '../components/KioskLayout';
import { Pill, Check, X, Activity, AlertCircle } from 'lucide-react';

export function RecommendationScreen() {
  const navigate = useNavigate();

  return (
    <KioskLayout>
      <div className="flex items-center w-full max-w-5xl mx-auto h-full py-4">
        {/* Title */}
        <div className="w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-lg mb-3">
              <Activity className="w-4 h-4 text-[#2ECC71]" />
              <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Treatment Plan</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-800">Recommended Treatment</h1>
          </div>

          <div className="grid grid-cols-5 gap-6 w-full">
            {/* Left Column - Summary */}
            <div className="col-span-2 space-y-3">
              {/* Symptoms Summary */}
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-[#4A90E2] rounded-full"></div>
                  <h3 className="font-semibold text-gray-700 text-sm">Your Symptoms</h3>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-xl">🤧</span>
                  <span className="text-sm">Colds</span>
                </div>
              </div>

              {/* Vital Signs */}
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <h3 className="font-semibold text-gray-700 text-sm">Vital Signs</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Pain Level</span>
                    <span className="font-semibold text-yellow-600 text-sm">5/10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Temperature</span>
                    <span className="font-semibold text-green-600 text-sm">36.7°C</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Heart Rate</span>
                    <span className="font-semibold text-green-600 text-sm">91 BPM</span>
                  </div>
                </div>
              </div>

              {/* Safety Note */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-800 font-medium mb-1">Important</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      If symptoms persist or worsen, please visit the clinic immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Medication Card */}
            <div className="col-span-3">
              <div className="relative h-full flex items-center">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#2ECC71] to-[#27AE60] rounded-3xl blur-2xl opacity-20"></div>
                
                {/* Main Card */}
                <div className="relative bg-white rounded-3xl border-4 border-[#2ECC71] p-8 shadow-2xl w-full">
                  {/* Pill Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-orange-500 rounded-2xl blur-lg opacity-30"></div>
                      <div className="relative bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-6 shadow-xl transform -rotate-12 hover:rotate-0 transition-transform">
                        <Pill className="w-14 h-14 text-white" strokeWidth={2} />
                      </div>
                    </div>
                  </div>

                  {/* Medicine Name */}
                  <h2 className="text-5xl font-bold text-center mb-3 bg-gradient-to-r from-[#2ECC71] to-[#27AE60] bg-clip-text text-transparent">
                    Bioflu
                  </h2>
                  <p className="text-base text-gray-500 text-center mb-6">Multi-symptom Cold Relief</p>

                  {/* Match Indicator */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-6 border-2 border-green-200">
                    <div className="flex items-center gap-3 justify-center">
                      <div className="w-7 h-7 bg-[#2ECC71] rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">Best match for: Flu, Colds</span>
                    </div>
                  </div>

                  {/* Dosage Info */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-6">
                    <p className="text-xs text-gray-600 text-center">
                      <span className="font-semibold">Recommended Dosage:</span> Take 1 tablet every 6 hours
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => navigate('/dispensing')}
                      className="bg-gradient-to-r from-[#2ECC71] to-[#27AE60] hover:from-[#27AE60] hover:to-[#229954] text-white py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 font-bold text-lg"
                    >
                      <Pill className="w-5 h-5" />
                      DISPENSE MEDICINE
                    </button>

                    <button
                      onClick={() => navigate('/symptoms')}
                      className="bg-white hover:bg-gray-50 text-gray-600 py-3 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 font-semibold border-2 border-gray-200 text-sm"
                    >
                      <X className="w-4 h-4" />
                      Go Back
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </KioskLayout>
  );
}