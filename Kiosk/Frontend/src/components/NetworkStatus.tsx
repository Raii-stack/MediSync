import { useEffect, useRef, useState } from "react";

const RELOAD_THRESHOLD_MS = 10000;

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const offlineSinceRef = useRef<number | null>(
    navigator.onLine ? null : Date.now()
  );

  useEffect(() => {
    const handleOffline = () => {
      if (!offlineSinceRef.current) {
        offlineSinceRef.current = Date.now();
      }
      setIsOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      const offlineSince = offlineSinceRef.current;
      offlineSinceRef.current = null;

      if (offlineSince && Date.now() - offlineSince > RELOAD_THRESHOLD_MS) {
        window.location.reload();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-6">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <p className="text-3xl font-bold text-slate-800">
          Reconnecting to System...
        </p>
      </div>
    </div>
  );
}
