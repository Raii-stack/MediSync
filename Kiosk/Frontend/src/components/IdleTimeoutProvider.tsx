import React, { useEffect, useState, useRef, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { AlertCircle } from "lucide-react";

interface IdleTimeoutProviderProps {
  children: ReactNode;
  timeoutMs?: number; // Time until warning modal appears
  warningMs?: number; // Time user has to click "I'm here"
}

export function IdleTimeoutProvider({
  children,
  timeoutMs = 60000, // 60 seconds
  warningMs = 15000, // 15 seconds
}: IdleTimeoutProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(Math.ceil(warningMs / 1000));

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pages where idle timeout should NOT apply
  const excludedPaths = ["/", "/admin", "/vitals"];
  const isExcluded = excludedPaths.includes(location.pathname);

  const clearAllTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleTimeout = () => {
    clearAllTimers();
    setShowWarning(false);
    
    console.log("⚠️ Idle timeout reached, resetting session.");
    sessionStorage.removeItem("currentStudent");
    sessionStorage.removeItem("studentName");
    sessionStorage.removeItem("vitals");
    
    // Attempt backend session end call (optional)
    try {
      // Just do a relative or dynamic fetch so it doesn't hit the tablet's localhost
      fetch("/api/session/end", { method: "POST" }).catch(() => {});
    } catch(e) {}
    
    navigate("/", { replace: true });
    // Fallback hard redirect for aggressive mobile browsers
    setTimeout(() => {
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }, 100);
  };

  // 1) Countdown the remaining time while the warning is shown
  useEffect(() => {
    if (showWarning && remainingTime > 0) {
      const timer = setTimeout(() => setRemainingTime((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [showWarning, remainingTime]);

  // 2) Trigger timeout when remainingTime hits 0
  useEffect(() => {
    if (showWarning && remainingTime <= 0) {
      handleTimeout();
    }
  }, [showWarning, remainingTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIdleWarning = () => {
    if (isExcluded) return;
    setShowWarning(true);
    setRemainingTime(Math.ceil(warningMs / 1000));
  };

  const resetTimeout = () => {
    if (isExcluded) return;
    clearAllTimers();
    setShowWarning(false);
    timeoutRef.current = setTimeout(handleIdleWarning, timeoutMs);
  };

  // Attach event listeners for activity
  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    const handleActivity = () => {
      if (!showWarning && !isExcluded) {
        resetTimeout();
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [showWarning, isExcluded]);

  return (
    <>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl scale-100 opacity-100 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-orange-50">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <h2 className="text-3xl font-bold text-[#1e2939] mb-3 text-center">
              Are you still there?
            </h2>
            
            <p className="text-gray-500 text-center mb-6 text-lg">
              Your session will automatically end in{" "}
              <span className="font-bold text-orange-600">{remainingTime} seconds</span>{" "}
              due to inactivity.
            </p>

            <div className="flex w-full gap-4">
              <button
                onClick={resetTimeout}
                className="flex-1 bg-[#4A90E2] text-white py-4 rounded-xl font-bold text-lg hover:bg-opacity-90 active:scale-95 transition-all shadow-md"
              >
                Yes, I'm here
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
