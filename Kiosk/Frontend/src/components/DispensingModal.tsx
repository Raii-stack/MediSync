import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface DispensingModalProps {
  isOpen: boolean;
  medicineName: string;
  onComplete: () => void;
}

export function DispensingModal({ isOpen, medicineName, onComplete }: DispensingModalProps) {
  const [dispensed, setDispensed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Trigger pill drop animation after a brief delay
    const dropTimeout = setTimeout(() => {
      setDispensed(true);
    }, 800);

    // Complete after 4 seconds
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(dropTimeout);
      clearTimeout(completeTimeout);
    };
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-8 shadow-2xl max-w-xl w-full mx-4"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Dispensing Medicine</h2>
          <p className="text-lg text-gray-600">{medicineName}</p>
        </div>

        {/* Animated Dispenser */}
        <div className="flex justify-center mb-8 h-80 relative">
          {/* Dispenser Machine */}
          <div className="relative w-56 h-full">
            {/* Machine Body */}
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#4A90E2] to-[#357ABD] rounded-t-3xl shadow-2xl">
              {/* Machine Front Panel */}
              <div className="absolute inset-2 bg-gradient-to-b from-[#357ABD] to-[#2868A8] rounded-t-2xl">
                {/* Window */}
                <div className="absolute top-6 left-6 right-6 h-28 bg-white/20 backdrop-blur-sm rounded-xl border-2 border-white/30 overflow-hidden">
                  {/* Pills inside machine */}
                  <div className="absolute inset-0 flex items-start justify-center pt-3 gap-2 flex-wrap px-2">
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="w-4 h-4 bg-gradient-to-br from-red-400 to-orange-500 rounded-full shadow-lg"
                      />
                    ))}
                  </div>
                </div>
                
                {/* LED Indicator */}
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute top-40 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-400 rounded-full shadow-lg shadow-green-400/50"
                />
              </div>
            </div>

            {/* Dispenser Slot */}
            <div className="absolute inset-x-0 top-48 h-10 bg-gradient-to-b from-gray-700 to-gray-800 shadow-inner">
              <div className="absolute inset-x-6 top-2 bottom-2 bg-black/50 rounded-sm overflow-hidden">
                {/* Dispensing pill animation */}
                {dispensed && (
                  <motion.div
                    initial={{ y: -140, x: '50%', translateX: '-50%', opacity: 1, scale: 1 }}
                    animate={{ 
                      y: 10, 
                      opacity: [1, 1, 1, 0],
                      scale: [1, 1, 1, 0.8]
                    }}
                    transition={{ duration: 1.8, ease: "easeIn" }}
                    className="absolute left-1/2 w-6 h-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-full shadow-xl"
                  />
                )}
              </div>
            </div>

            {/* Collection Tray */}
            <div className="absolute inset-x-0 top-58 h-20 bg-gradient-to-b from-gray-300 to-gray-400 rounded-b-3xl shadow-xl">
              <div className="absolute inset-x-8 top-4 bottom-8 bg-gradient-to-b from-gray-400 to-gray-500 rounded-xl shadow-inner">
                {/* Collected pill */}
                {dispensed && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.5, duration: 0.3 }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-gradient-to-br from-red-500 to-orange-500 rounded-full shadow-lg"
                  />
                )}
              </div>
              
              {/* Tray Label */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-600 tracking-wider">
                COLLECT HERE
              </div>
            </div>

            {/* Glow effect when dispensing */}
            {dispensed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ duration: 2 }}
                className="absolute inset-0 bg-gradient-to-b from-green-400 to-transparent rounded-3xl blur-2xl"
              />
            )}
          </div>
        </div>

        {/* Info Message */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-gray-600"
          >
            Please collect your medication from the tray below
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
