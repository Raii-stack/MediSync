import { ReactNode, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { EmergencyButton } from "./EmergencyButton";
import { EmergencyModal } from "./EmergencyModal";

interface KioskLayoutProps {
  children: ReactNode;
  showEmergency?: boolean;
  greeting?: string;
  showVersion?: boolean;
}

export function KioskLayout({
  children,
  showEmergency = true,
  greeting,
  showVersion = false,
}: KioskLayoutProps) {
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  const handleEmergencyClick = () => {
    setIsEmergencyModalOpen(true);
  };

  const handleEmergencyConfirm = async () => {
    setIsEmergencyModalOpen(false);

    try {
      // Get current student_id from session storage if available
      const currentStudent = sessionStorage.getItem("currentStudent");
      const studentData = currentStudent ? JSON.parse(currentStudent) : null;
      const student_id = studentData?.student_id || null;

      console.log("🚨 Sending emergency alert to backend...");
      const response = await axios.post(`${API_BASE_URL}/api/emergency`, {
        student_id,
      });

      if (response.data.success) {
        console.log("✅ Emergency alert sent successfully");
        // Show success message (could replace with toast notification)
        alert(
          "✅ Emergency Alert Sent!\n\nThe school clinic has been notified and will respond shortly.",
        );
      }
    } catch (error) {
      console.error("❌ Failed to send emergency alert:", error);
      alert(
        "⚠️ Failed to send alert. Please contact clinic directly or try again.",
      );
    }
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
          <div className="text-4xl font-medium text-gray-700">{greeting}</div>
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
