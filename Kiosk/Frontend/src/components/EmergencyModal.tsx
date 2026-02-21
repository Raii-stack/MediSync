import { AlertCircle, X, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalState = 'countdown' | 'sending' | 'success' | 'error';

export function EmergencyModal({ isOpen, onClose }: EmergencyModalProps) {
  const [countdown, setCountdown] = useState(5);
  const [modalState, setModalState] = useState<ModalState>('countdown');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      setModalState('countdown');
      setErrorMessage('');
      return;
    }

    if (modalState !== 'countdown') return;

    if (countdown === 0) {
      sendEmergencyAlert();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, countdown, modalState]);

  const sendEmergencyAlert = async () => {
    setModalState('sending');

    try {
      const currentStudent = sessionStorage.getItem('currentStudent');
      const studentData = currentStudent ? JSON.parse(currentStudent) : null;
      const student_id = studentData?.student_id || null;

      const response = await axios.post(`${API_BASE_URL}/api/emergency`, {
        student_id,
      });

      if (response.data.success) {
        setModalState('success');
      } else {
        setModalState('error');
        setErrorMessage('Failed to reach the clinic. Please contact staff directly.');
      }
    } catch (error: any) {
      setModalState('error');
      setErrorMessage(
        error.response?.data?.message ||
        'Could not connect to the clinic. Please contact staff directly.'
      );
    }
  };

  const handleClose = () => {
    setCountdown(5);
    setModalState('countdown');
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={modalState === 'countdown' ? handleClose : undefined}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className={`px-8 py-6 flex items-center justify-between bg-gradient-to-r ${
          modalState === 'success' ? 'from-green-500 to-green-600' :
          modalState === 'error' ? 'from-orange-500 to-red-500' :
          'from-red-500 to-red-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              {modalState === 'success' ? (
                <CheckCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
              ) : modalState === 'error' ? (
                <XCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
              ) : (
                <AlertCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-2xl">
                {modalState === 'success' ? 'Alert Sent' :
                 modalState === 'error' ? 'Alert Failed' :
                 'Emergency Alert'}
              </h2>
              <p className="text-white/80 text-sm">
                {modalState === 'success' ? 'Clinic has been notified' :
                 modalState === 'error' ? 'Unable to reach clinic' :
                 'Contacting school clinic'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Countdown State */}
          {modalState === 'countdown' && (
            <>
              <div className="mb-6 flex justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="56" stroke="#FEE2E2" strokeWidth="8" fill="none" />
                    <circle
                      cx="64" cy="64" r="56"
                      stroke="#EF4444" strokeWidth="8" fill="none"
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
              <button
                onClick={handleClose}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 font-semibold text-lg"
              >
                <X className="w-5 h-5" />
                Cancel Emergency
              </button>
            </>
          )}

          {/* Sending State */}
          {modalState === 'sending' && (
            <>
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 border-4 border-red-200 border-t-red-500 rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-700 text-lg font-medium">
                Sending emergency notification to the clinic...
              </p>
            </>
          )}

          {/* Success State */}
          {modalState === 'success' && (
            <>
              <div className="mb-6 flex justify-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-14 h-14 text-green-500" strokeWidth={2} />
                </div>
              </div>
              <p className="text-gray-800 text-xl font-bold mb-2">
                Emergency notification sent to the clinic
              </p>
              <p className="text-gray-500 text-base mb-8">
                Staff has been alerted and will respond shortly. Please stay calm.
              </p>
              <button
                onClick={handleClose}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 font-semibold text-lg"
              >
                OK
              </button>
            </>
          )}

          {/* Error State */}
          {modalState === 'error' && (
            <>
              <div className="mb-6 flex justify-center">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-14 h-14 text-red-500" strokeWidth={2} />
                </div>
              </div>
              <p className="text-gray-800 text-xl font-bold mb-2">
                Failed to send emergency notification
              </p>
              <p className="text-gray-500 text-base mb-8">
                {errorMessage}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setModalState('countdown'); setCountdown(5); }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 font-semibold text-lg"
                >
                  Retry
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 font-semibold text-lg"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}