import { AlertCircle, X, Bed, Armchair, Check, Loader2, Scan, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useSocket } from '../contexts/SocketContext';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

type EmergencyType = 'wheelchair' | 'stretcher' | null;

export function EmergencyModal({ isOpen, onClose, onConfirm }: EmergencyModalProps) {
  const [step, setStep] = useState<'scan' | 'select' | 'countdown' | 'sending' | 'success' | 'error'>('scan');
  const [selectedType, setSelectedType] = useState<EmergencyType>(null);
  const [countdown, setCountdown] = useState(5);
  const [errorMessage, setErrorMessage] = useState('');
  const [emergencyRfidUid, setEmergencyRfidUid] = useState<string | null>(null);

  const { socket } = useSocket();

  useEffect(() => {
    sessionStorage.setItem("emergencyModalOpen", isOpen ? "true" : "false");
    
    if (!isOpen) {
      // Reset state when modal closes
      setStep('scan');
      setSelectedType(null);
      setCountdown(5);
      setErrorMessage('');
      setEmergencyRfidUid(null);
      return;
    }

    if (step === 'scan') {
      // Explicitly turn on the RFID reader
      axios.post(`${API_BASE_URL}/api/esp32/enable-rfid`).catch(console.error);
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (!socket || !isOpen || step !== 'scan') return;

    const handleRfidScan = (data: { student: any; uid: string }) => {
      console.log("📡 Emergency RFID Scan received:", data);
      
      setEmergencyRfidUid(data.uid);
      setStep('select');

      // Once scanned, turn off the explicit emergency reading mode 
      axios.post(`${API_BASE_URL}/api/esp32/disable-rfid`).catch(console.error);
    };

    socket.on("rfid-scan", handleRfidScan);

    return () => {
      socket.off("rfid-scan", handleRfidScan);
    };
  }, [socket, isOpen, step]);

  useEffect(() => {
    if (step !== 'countdown') return;

    if (countdown === 0) {
      sendEmergencyAlert();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [step, countdown, onConfirm]);

  const sendEmergencyAlert = async () => {
    setStep('sending');
    onConfirm(); // Trigger whatever external hook the parent wants

    try {
      const currentStudent = sessionStorage.getItem('currentStudent');
      const studentData = currentStudent ? JSON.parse(currentStudent) : null;
      const student_id = studentData?.student_id || null;

      const response = await axios.post(`${API_BASE_URL}/api/emergency`, {
        student_id,
        rfid_uid: emergencyRfidUid,
        equipment: selectedType
      }, { timeout: 10000 }); // 10 second timeout

      if (response.data.success) {
        setStep('success');
      } else {
        setStep('error');
        setErrorMessage('Failed to reach the clinic. Please contact staff directly.');
      }
    } catch (error: any) {
      setStep('error');
      
      if (error.code === 'ECONNABORTED') {
        setErrorMessage('Connection timed out. The school clinic is unreachable.');
      } else {
        setErrorMessage(
          error.response?.data?.message ||
          'Could not connect to the clinic. Please contact staff directly.'
        );
      }
    }
  };

  const handleSelectType = (type: EmergencyType) => {
    setSelectedType(type);
    setStep('countdown');
  };

  const handleClose = () => {
    if (step === 'scan') {
      axios.post(`${API_BASE_URL}/api/esp32/disable-rfid`).catch(console.error);
    }
    setStep('scan');
    setSelectedType(null);
    setCountdown(5);
    setErrorMessage('');
    setEmergencyRfidUid(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={(step === 'countdown' || step === 'scan') ? handleClose : undefined}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Changes color based on state */}
        <div className={`
          px-8 py-6 flex items-center justify-between transition-colors duration-500
          ${step === 'success' ? 'bg-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}
        `}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              {step === 'success' ? (
                <Check className="w-7 h-7 text-white" strokeWidth={3} />
              ) : step === 'scan' ? (
                 <Scan className="w-7 h-7 text-white" strokeWidth={2.5} />
              ) : (
                <AlertCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-2xl">
                {step === 'success' ? 'Alert Sent' : step === 'scan' ? 'Verify Identity' : step === 'error' ? 'Alert Failed' : 'Emergency Alert'}
              </h2>
              <p className={`${step === 'success' ? 'text-green-100' : 'text-red-100'} text-sm`}>
                {step === 'success' ? 'Clinic has been notified' : step === 'scan' ? 'Scan ID to continue' : step === 'error' ? 'Unable to reach clinic' : 'Contacting school clinic'}
              </p>
            </div>
          </div>
          {(step === 'scan' || step === 'select' || step === 'countdown' || step === 'success' || step === 'error') && (
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-8">

          {step === 'scan' && (
            <div className="text-center animate-in slide-in-from-right-8 duration-300">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                 <div className="absolute inset-0 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                 <Scan className="w-10 h-10 text-red-600 animate-pulse" />
               </div>

               <h3 className="text-xl font-bold text-gray-800 mb-2">Authentication Required</h3>
               <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                 Please tap your Student or Staff ID card to activate the emergency alert system.
               </p>

               <div className="bg-red-50 text-red-700 py-3 px-4 rounded-xl font-medium text-sm mb-4 border border-red-100">
                 Scanner Active. Waiting for card...
               </div>

               <button
                onClick={handleClose}
                className="w-full mt-4 py-2 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          
          {step === 'select' && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-2">What assistance is needed?</h3>
                <p className="text-gray-500">Select the required equipment for transport</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSelectType('wheelchair')}
                  className="group relative flex flex-col items-center justify-center gap-4 p-6 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-red-500 hover:bg-red-50 transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
                    <Armchair className="w-8 h-8 text-gray-600 group-hover:text-red-500 transition-colors" />
                  </div>
                  <span className="font-bold text-lg text-gray-700 group-hover:text-red-600">Wheelchair</span>
                </button>

                <button
                  onClick={() => handleSelectType('stretcher')}
                  className="group relative flex flex-col items-center justify-center gap-4 p-6 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-red-500 hover:bg-red-50 transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
                    <Bed className="w-8 h-8 text-gray-600 group-hover:text-red-500 transition-colors" />
                  </div>
                  <span className="font-bold text-lg text-gray-700 group-hover:text-red-600">Stretcher</span>
                </button>
              </div>

              <button
                onClick={handleClose}
                className="w-full mt-4 py-4 text-gray-500 hover:text-gray-700 font-medium hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel Emergency
              </button>
            </div>
          )}

          {step === 'countdown' && (
            <div className="text-center animate-in slide-in-from-right-8 duration-300">
              {/* Selected Option Indicator */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-full font-medium text-sm mb-8 animate-in fade-in zoom-in duration-300">
                {selectedType === 'wheelchair' ? <Armchair className="w-4 h-4" /> : <Bed className="w-4 h-4" />}
                <span>Requesting {selectedType === 'wheelchair' ? 'Wheelchair' : 'Stretcher'}</span>
              </div>

              {/* Countdown Circle */}
              <div className="relative w-40 h-40 mx-auto mb-8">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#FEE2E2"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#EF4444"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * countdown) / 5}
                    className="transition-all duration-1000 ease-linear"
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Number Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-bold text-red-600 tabular-nums">
                    {countdown}
                  </span>
                  <span className="text-xs font-bold text-red-400 uppercase tracking-widest mt-1">Seconds</span>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <p className="text-xl font-bold text-gray-800">
                  Alerting School Clinic...
                </p>
                <p className="text-gray-500">
                  Help is on the way. Please stay calm.
                </p>
              </div>

              {/* Cancel Button */}
              <button
                onClick={handleClose}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Cancel Emergency
              </button>
            </div>
          )}

          {step === 'sending' && (
            <div className="text-center animate-in zoom-in-95 duration-300">
              <div className="mb-6 flex justify-center">
                <Loader2 className="w-20 h-20 text-red-500 animate-spin" strokeWidth={1.5} />
              </div>
              <p className="text-gray-700 text-lg font-medium">
                Sending emergency notification to the clinic...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <Check className="w-12 h-12 text-green-600" strokeWidth={3} />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Help is on the way!</h3>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                The school clinic has received your request for a <span className="font-semibold text-gray-700">{selectedType}</span> and is dispatching assistance.
              </p>

              <button
                onClick={handleClose}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl font-bold text-lg transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
              >
                Close Window
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-red-500" strokeWidth={2.5} />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Failed to send alert</h3>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                {errorMessage}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('countdown'); setCountdown(5); }}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}