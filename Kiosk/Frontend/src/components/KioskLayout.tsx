import { ReactNode, useState } from 'react';
import { EmergencyButton } from './EmergencyButton';
import { EmergencyModal } from './EmergencyModal';

interface KioskLayoutProps {
  children: ReactNode;
  showEmergency?: boolean;
  greeting?: string;
  showVersion?: boolean;
}

export function KioskLayout({ children, showEmergency = true, greeting, showVersion = false }: KioskLayoutProps) {
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  const handleEmergencyClick = () => {
    setIsEmergencyModalOpen(true);
  };

  const handleEmergencyConfirm = () => {
    setIsEmergencyModalOpen(false);
    // TODO: Implement actual emergency contact logic here
    alert('Emergency services contacted!');
  };

  const handleEmergencyCancel = () => {
    setIsEmergencyModalOpen(false);
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col overflow-hidden relative">
      {/* Emergency Button Overlay */}
      {showEmergency && (
        <div className="fixed top-6 right-6 z-50">
          <EmergencyButton onClick={handleEmergencyClick} />
        </div>
      )}

      {/* Emergency Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={handleEmergencyCancel}
        onConfirm={handleEmergencyConfirm}
      />

      {/* Greeting */}
      {greeting && (
        <div className="flex-shrink-0 px-6 py-6">
          <div className="text-xl font-medium text-gray-700">{greeting}</div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-6 overflow-hidden">
        {children}
      </main>

      {/* Footer - Only show version if specified */}
      {showVersion && (
        <footer className="flex-shrink-0 text-center py-4 text-gray-400 text-sm">
          v3.0.1
        </footer>
      )}
    </div>
  );
}