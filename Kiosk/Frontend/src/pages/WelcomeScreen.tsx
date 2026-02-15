import { Building2, CreditCard, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { KioskLayout } from '../components/KioskLayout';

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <KioskLayout showVersion={true}>
      <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto">
        {/* Logo with animated gradient */}
        <div className="relative mb-10 animate-fade-in-down">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-[2.5rem] blur-2xl opacity-30 scale-110 animate-pulse-slow"></div>
          <div className="relative bg-gradient-to-br from-[#4A90E2] via-[#5B9FE3] to-[#357ABD] rounded-[2.5rem] p-12 shadow-2xl animate-float">
            <Building2 className="w-24 h-24 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Welcome Text */}
        <h1 className="text-6xl font-bold text-gray-800 mb-4 text-center tracking-tight animate-fade-in-up animation-delay-200">
          Welcome to{' '}
          <span className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] bg-clip-text text-transparent animate-gradient">
            MediSync
          </span>
        </h1>
        <p className="text-2xl text-gray-500 mb-20 flex items-center gap-2 animate-fade-in-up animation-delay-400">
          <Sparkles className="w-5 h-5 text-[#4A90E2] animate-sparkle" />
          Your Smart Health Kiosk
        </p>

        {/* Instruction */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-8 py-3 mb-6 shadow-lg border border-white animate-fade-in-up animation-delay-600">
          <p className="text-gray-500 uppercase tracking-widest text-sm font-medium">
            Tap your student ID to begin
          </p>
        </div>

        {/* Tap ID Button */}
        <button
          onClick={() => navigate('/vitals')}
          className="group bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] text-white px-38 py-6 rounded-2xl shadow-2xl transition-all hover:scale-105 hover:shadow-3xl active:scale-95 flex items-center gap-4 text-xl font-semibold relative overflow-hidden animate-fade-in-up animation-delay-800"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <CreditCard className="w-7 h-7 relative z-10 group-hover:rotate-6 transition-transform" />
          <span className="relative z-10">Tap ID Card</span>
        </button>

        {/* Decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
    </KioskLayout>
  );
}