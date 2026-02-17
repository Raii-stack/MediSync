import { motion } from "motion/react";
import { Heart } from "lucide-react";

interface SensorPromptModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function SensorPromptModal({
  isOpen,
  onComplete,
}: SensorPromptModalProps) {
  // Modal stays open until parent explicitly closes it (when sensor data received)
  // No auto-close timer

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-10 shadow-2xl max-w-lg w-full mx-4"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            Place Your Finger
          </h2>
          <p className="text-lg text-gray-600 mt-2">On the heart rate sensor</p>
        </div>

        {/* Animated Sensor Illustration */}
        <div className="flex justify-center mb-8 relative h-64">
          {/* Sensor Device */}
          <div className="relative">
            {/* Sensor Base */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-40 h-48 bg-gradient-to-b from-gray-200 to-gray-300 rounded-3xl shadow-2xl relative"
            >
              {/* Sensor Window */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-gradient-to-br from-red-500 to-pink-600 rounded-full shadow-inner">
                {/* Pulsing Light Effect */}
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.6, 0.2, 0.6],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 bg-gradient-to-br from-red-400 to-pink-500 rounded-full blur-md"
                />

                {/* Heart Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "easeInOut",
                    }}
                  >
                    <Heart className="w-12 h-12 text-white fill-white" />
                  </motion.div>
                </div>
              </div>

              {/* LED Indicator */}
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"
              />

              {/* Device Label */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-600 tracking-wider">
                SENSOR
              </div>
            </motion.div>

            {/* Animated Hand/Finger */}
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: [80, 0, 80], opacity: [0, 1, 0] }}
              transition={{
                delay: 0.5,
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute top-32 left-1/2 -translate-x-1/2"
            >
              {/* Simple finger representation */}
              <div className="relative w-16 h-24">
                {/* Finger */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-20 bg-gradient-to-b from-[#ffd4b5] to-[#ffc4a0] rounded-t-full shadow-lg">
                  {/* Fingernail */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-8 bg-gradient-to-b from-[#ffe4d4] to-[#ffd4b5] rounded-t-full" />
                </div>
              </div>

              {/* Pointing Arrow */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
                className="absolute -top-10 left-1/2 -translate-x-1/2"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-[#4A90E2]"
                >
                  <path
                    d="M12 19V5M12 5L6 11M12 5L18 11"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            </motion.div>

            {/* Glow Effect */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.1, 1],
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut",
              }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-gradient-to-br from-red-400 to-pink-500 rounded-full blur-3xl opacity-40"
            />
          </div>
        </div>

        {/* Instruction Text */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-base text-gray-700 font-medium"
          >
            Position your index finger on the sensor
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-gray-500 mt-2"
          >
            Keep still for accurate readings
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
