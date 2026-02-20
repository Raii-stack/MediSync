import { useEffect, useRef } from "react";

type WakeLockSentinel = {
  release: () => Promise<void>;
};

export default function WakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    if (!("wakeLock" in navigator)) {
      return;
    }

    if (document.visibilityState !== "visible") {
      return;
    }

    try {
      const wakeLock = await (navigator as Navigator & {
        wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }).wakeLock.request("screen");
      wakeLockRef.current = wakeLock;
    } catch (error) {
      console.warn("Wake lock request failed", error);
    }
  };

  useEffect(() => {
    void requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  return null;
}
