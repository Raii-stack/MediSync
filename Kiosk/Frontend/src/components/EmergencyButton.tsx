import { AlertCircle } from 'lucide-react';

interface EmergencyButtonProps {
  onClick: () => void;
}

export function EmergencyButton({ onClick }: EmergencyButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-4 rounded-full flex items-center gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95 font-semibold text-base border-2 border-red-400"
    >
      <AlertCircle className="w-6 h-6" strokeWidth={2.5} />
      EMERGENCY
    </button>
  );
}