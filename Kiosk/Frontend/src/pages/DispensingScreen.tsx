import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { KioskLayout } from '../components/KioskLayout';
import { Package, Check } from 'lucide-react';

export function DispensingScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);

  const steps = [
    { label: 'Verifying prescription...', duration: 1500 },
    { label: 'Locating medication...', duration: 2000 },
    { label: 'Dispensing Bioflu...', duration: 3000 },
    { label: 'Preparing receipt...', duration: 1500 },
  ];

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1.25; // 100 / 80 = 1.25% per 100ms = 8 seconds total
      });
    }, 100);

    // Step transitions
    let currentTime = 0;
    steps.forEach((stepItem, index) => {
      setTimeout(() => {
        setStep(index);
      }, currentTime);
      currentTime += stepItem.duration;
    });

    // Navigate to receipt after 8 seconds
    const timeout = setTimeout(() => {
      navigate('/receipt');
    }, 8000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <KioskLayout>
      <div className="flex items-center justify-center w-full max-w-3xl mx-auto h-full">
        <div className="w-full">
          {/* Main Card */}
          <div className="bg-white rounded-3xl p-12 shadow-2xl">
            {/* Animated Package Icon */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                {/* Pulsing background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
                
                {/* Icon container */}
                <div className="relative bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-3xl p-8 shadow-xl">
                  <Package className="w-24 h-24 text-white animate-bounce" strokeWidth={2} />
                  
                  {/* Dispensing indicator */}
                  <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-[#2ECC71] to-[#27AE60] rounded-full flex items-center justify-center shadow-lg animate-pulse">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-center mb-3 text-gray-800">
              Dispensing Medication
            </h1>
            
            {/* Current Step */}
            <p className="text-lg text-center text-gray-600 mb-8 h-7">
              {steps[step]?.label}
            </p>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-[#4A90E2] to-[#2ECC71] rounded-full transition-all duration-100 ease-linear flex items-center justify-end pr-2"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 15 && (
                    <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm"></div>
                  )}
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                {Math.round(progress)}% Complete
              </p>
            </div>

            {/* Steps Checklist */}
            <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
              {steps.map((stepItem, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 transition-all ${
                    index <= step ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      index < step
                        ? 'bg-[#2ECC71]'
                        : index === step
                        ? 'bg-[#4A90E2] animate-pulse'
                        : 'bg-gray-300'
                    }`}
                  >
                    {index < step ? (
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    ) : (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      index <= step ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {stepItem.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Info Message */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Please wait while we prepare your medication
              </p>
            </div>
          </div>
        </div>
      </div>
    </KioskLayout>
  );
}
