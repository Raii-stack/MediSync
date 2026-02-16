import { useEffect, useState } from "react";
import { X, Zap, Wifi, User, Heart } from "lucide-react";
import { API_BASE_URL } from "../config/api";

export function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [rfidUid, setRfidUid] = useState(`TEST_${Date.now()}`);
  const [bpm, setBpm] = useState(75);
  const [temp, setTemp] = useState(37.0);
  const [duration, setDuration] = useState(5);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Toggle debug panel with Ctrl+Alt+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const simulateRfid = async () => {
    setLoading(true);
    setStatus("Simulating RFID tap...");
    try {
      console.log(`📡 Sending RFID request to: ${API_BASE_URL}/api/debug/rfid`);
      const res = await fetch(`${API_BASE_URL}/api/debug/rfid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid_uid: rfidUid }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setStatus(`✅ ${data.message}`);
      console.log("RFID Debug Response:", data);
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      console.error("RFID error:", err);
      setStatus(
        `❌ ${(err as Error).message || "Failed to connect to backend"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const sendFakeRFIDToESP32 = async () => {
    setLoading(true);
    setStatus("Sending fake RFID to ESP32...");
    try {
      console.log(
        `📡 Sending fake RFID to ESP32: ${API_BASE_URL}/api/debug/esp32-rfid`,
      );
      const res = await fetch(`${API_BASE_URL}/api/debug/esp32-rfid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: rfidUid }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setStatus(`✅ ${data.message} (${data.mode})`);
      console.log("ESP32 RFID Debug Response:", data);
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      console.error("ESP32 RFID error:", err);
      setStatus(
        `❌ ${(err as Error).message || "Failed to connect to backend"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const simulateVitals = async () => {
    setLoading(true);
    setStatus("Simulating vitals data...");
    try {
      console.log(
        `📡 Sending vitals request to: ${API_BASE_URL}/api/debug/vitals`,
      );
      const res = await fetch(`${API_BASE_URL}/api/debug/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bpm, temp, duration }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setStatus(`✅ ${data.message}`);
      console.log("Vitals Debug Response:", data);
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      console.error("Vitals error:", err);
      setStatus(
        `❌ ${(err as Error).message || "Failed to connect to backend"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const generateRandomRfid = () => {
    setRfidUid(`TEST_${Math.random().toString(16).slice(2, 10).toUpperCase()}`);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-6 z-[999] bg-gray-900 text-white p-6 rounded-2xl shadow-2xl w-96 max-h-[80vh] overflow-y-auto border-2 border-yellow-400">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold">Debug Panel</h3>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close debug panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="h-px bg-gray-700 my-4" />

      {/* API URL Info */}
      <div className="mb-4 p-2 bg-gray-800 rounded text-xs">
        <p className="text-gray-300 font-mono break-all">API: {API_BASE_URL}</p>
      </div>

      {/* Status Section */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Wifi className="w-4 h-4 text-green-400" />
          <span className="text-sm">Backend Connected</span>
        </div>
        <div className="inline-block px-2 py-1 bg-yellow-900 text-yellow-200 text-xs rounded">
          Debug Mode Active
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div className="bg-blue-900 p-3 rounded-lg mb-4 text-sm font-mono">
          {status}
        </div>
      )}

      {/* RFID Section */}
      <div className="mb-6">
        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-red-400" />
          RFID Simulation
        </h4>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="RFID UID"
              value={rfidUid}
              onChange={(e) => setRfidUid(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:border-yellow-400 transition-colors"
            />
            <button
              onClick={generateRandomRfid}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors"
            >
              Random
            </button>
          </div>
          <button
            onClick={simulateRfid}
            disabled={loading}
            className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-colors"
          >
            {loading ? "Sending..." : "Tap RFID"}
          </button>
          <button
            onClick={sendFakeRFIDToESP32}
            disabled={loading}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {loading ? "Sending..." : "Send to ESP32 (Trigger Vitals)"}
          </button>
        </div>
      </div>

      <div className="h-px bg-gray-700 my-4" />

      {/* Vitals Section */}
      <div className="mb-4">
        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Heart className="w-4 h-4 text-blue-400" />
          Vitals Simulation
        </h4>
        <div className="space-y-3">
          {/* BPM */}
          <div>
            <label className="block text-xs font-bold mb-1">BPM: {bpm}</label>
            <input
              type="number"
              min="40"
              max="120"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value) || 75)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-xs font-bold mb-1">
              Temp (°C): {temp.toFixed(1)}
            </label>
            <input
              type="number"
              min="35"
              max="40"
              step="0.1"
              value={temp}
              onChange={(e) => setTemp(parseFloat(e.target.value) || 37.0)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-bold mb-1">
              Duration (s): {duration}
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 5)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          <button
            onClick={simulateVitals}
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-colors"
          >
            {loading ? "Sending..." : "Send Vitals"}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="h-px bg-gray-700 my-4" />
      <p className="text-xs text-gray-400 text-center">
        Press{" "}
        <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-yellow-400 font-mono">
          Ctrl+Alt+Shift+D
        </kbd>{" "}
        to toggle
      </p>
    </div>
  );
}
