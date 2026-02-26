import { Building2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { KioskLayout } from "../components/KioskLayout";
import { useSocket } from "../contexts/SocketContext";
import { useEffect, useState, useRef } from "react";
import { AdminPasswordModal } from "../components/AdminPasswordModal";

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);
  const [unregisteredUid, setUnregisteredUid] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for RFID scan events from the backend
    const handleRfidScan = (data: { student: any; uid: string }) => {
      // Ignore if the emergency modal is currently capturing the scanner
      if (sessionStorage.getItem("emergencyModalOpen") === "true") {
        console.log("📡 Welcome Screen ignored RFID scan (Emergency Modal active)");
        return;
      }

      console.log("📡 RFID Scan received:", data);

      // Store student data in sessionStorage for use in other screens
      if (data.student) {
        sessionStorage.setItem("currentStudent", JSON.stringify(data.student));
        sessionStorage.setItem(
          "studentName",
          `${data.student.first_name} ${data.student.last_name}`,
        );
        // Navigate to vitals screen
        navigate("/vitals");
      } else {
        // Unregistered user
        setUnregisteredUid(data.uid || null);
        setShowUnregisteredModal(true);
        setTimeout(() => setShowUnregisteredModal(false), 5000); // Auto close after 5s
      }
    };

    socket.on("rfid-scan", handleRfidScan);

    // Cleanup listener on unmount
    return () => {
      socket.off("rfid-scan", handleRfidScan);
    };
  }, [socket, navigate]);

  // Secret admin access via 5 rapid clicks on logo
  const handleLogoClick = () => {
    const now = Date.now();

    // Reset counter if more than 1 second since last click
    if (now - lastClickTime > 1000) {
      setLogoClickCount(1);
    } else {
      const newCount = logoClickCount + 1;
      setLogoClickCount(newCount);

      if (newCount === 5) {
        // Show admin password modal after 5 clicks
        setShowAdminModal(true);
        setLogoClickCount(0);
      }
    }

    setLastClickTime(now);
  };

  // Handle successful password entry
  const handleAdminSuccess = () => {
    setShowAdminModal(false);
    sessionStorage.setItem("adminAccessGranted", "true");
    navigate("/admin");
  };

  // Fullscreen on double-click title
  const handleTitleDoubleClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <KioskLayout showVersion={true}>
      <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto">
        {/* Logo with animated gradient */}
        <div
          className="relative mb-10 animate-fade-in-down"
          onClick={handleLogoClick}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-[2.5rem] blur-2xl opacity-30 scale-110 animate-pulse-slow"></div>
          <div className="relative bg-gradient-to-br from-[#4A90E2] via-[#5B9FE3] to-[#357ABD] rounded-[2.5rem] p-12 shadow-2xl animate-float">
            <Building2 className="w-24 h-24 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Welcome Text */}
        <h1
          className="text-6xl font-bold text-gray-800 mb-4 text-center tracking-tight animate-fade-in-up animation-delay-200 cursor-pointer select-none"
          onDoubleClick={handleTitleDoubleClick}
        >
          Welcome to{" "}
          <span className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] bg-clip-text text-transparent animate-gradient">
            MediSync
          </span>
        </h1>
        <p className="text-2xl text-gray-500 mb-20 flex items-center gap-2 animate-fade-in-up animation-delay-400">
          <Sparkles className="w-5 h-5 text-[#4A90E2] animate-sparkle" />
          Symptoms gone in a blink
        </p>

        {/* Instruction */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-8 py-3 mb-6 shadow-lg border border-white animate-fade-in-up animation-delay-600">
          <p className="text-gray-500 uppercase tracking-widest text-sm font-medium">
            Tap your student ID to begin
          </p>
        </div>

        {/* Connection Status */}
        {!isConnected ? (
          <div className="w-[450px] justify-center bg-orange-100 border-2 border-orange-300 text-orange-700 py-6 rounded-2xl shadow-2xl flex items-center gap-4 text-xl font-semibold animate-fade-in-up animation-delay-800">
            <div className="w-7 h-7 relative">
              <div className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-75"></div>
              <div className="relative rounded-full w-7 h-7 bg-orange-600"></div>
            </div>
            <span>Connecting to kiosk hardware...</span>
          </div>
        ) : (
          <div className="w-[450px] justify-center bg-blue-100 border-2 border-blue-300 text-blue-700 py-6 rounded-2xl shadow-2xl flex items-center gap-4 text-xl font-semibold animate-fade-in-up animation-delay-800 animate-pulse">
            <div className="w-7 h-7 relative">
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75"></div>
              <div className="relative rounded-full w-7 h-7 bg-blue-600"></div>
            </div>
            <span>Waiting for card scan...</span>
          </div>
        )}

        {/* Decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Admin Password Modal */}
      <AdminPasswordModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={handleAdminSuccess}
      />

      {/* Unregistered User Modal */}
      {showUnregisteredModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center border-2 border-red-500 animate-zoom-in">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Access Denied
            </h2>
            <p className="text-xl text-gray-600 mb-6">
              This card is not registered in the system. Please proceed to the clinic admin to register.
            </p>
            {unregisteredUid && (
              <p className="text-sm font-mono text-gray-400 mb-8 bg-gray-50 py-2 rounded-xl">
                UID: {unregisteredUid}
              </p>
            )}
            <button
              onClick={() => setShowUnregisteredModal(false)}
              className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </KioskLayout>
  );
}
