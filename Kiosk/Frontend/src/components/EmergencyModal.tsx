import { AlertCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function EmergencyModal({ isOpen, onClose, onConfirm }: EmergencyModalProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      return;
    }

    if (countdown === 0) {
      onConfirm();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, countdown, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-scale-in">
        {/* Red Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-white font-bold text-2xl">Emergency Alert</h2>
              <p className="text-red-100 text-sm">Contacting school clinic</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Countdown Circle */}
          <div className="mb-6 flex justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#FEE2E2"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#EF4444"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(countdown / 5) * 352} 352`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-5xl font-bold text-red-600">{countdown}</div>
              </div>
            </div>
          </div>

          <p className="text-gray-700 text-lg font-medium mb-2">
            School clinic will be notified in <span className="text-red-600 font-bold">{countdown}</span> seconds
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Press cancel if this was pressed by mistake
          </p>

          {/* Cancel Button */}
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 font-semibold text-lg"
          >
            <X className="w-5 h-5" />
            Cancel Emergency
          </button>
        </div>
      </div>
    </div>
  );
}