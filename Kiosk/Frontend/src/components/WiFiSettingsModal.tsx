import { useState, useEffect } from "react";
import {
  X,
  Wifi,
  Lock,
  RefreshCw,
  Loader2,
  WifiOff,
  Signal,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../config/api";
import axios from "axios";

interface WiFiNetwork {
  ssid: string;
  signalStrength: number;
  security: "WPA2" | "WPA3" | "Open" | "WEP";
  isConnected: boolean;
}

interface WiFiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WiFiSettingsModal({ isOpen, onClose }: WiFiSettingsModalProps) {
  const [networks, setNetworks] = useState<WiFiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<WiFiNetwork | null>(
    null,
  );
  const [password, setPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Auto-scan when modal opens
      handleScan();
    }
  }, [isOpen]);

  const handleScan = async () => {
    setIsScanning(true);

    try {
      const response = await axios.get(`${API_BASE_URL}/api/scan`);

      if (response.data.success && response.data.networks) {
        setNetworks(response.data.networks);
        toast.success("Network scan complete", {
          description: `Found ${response.data.networks.length} networks`,
        });
      } else {
        toast.error("Failed to scan networks");
        setNetworks([]);
      }
    } catch (error) {
      console.error("WiFi scan error:", error);
      toast.error("Failed to scan for networks", {
        description: "Please check your connection",
      });
      setNetworks([]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleNetworkClick = (network: WiFiNetwork) => {
    if (network.security === "Open") {
      // Directly connect to open networks
      handleConnect(network, "");
    } else {
      // Open password modal for secured networks
      setSelectedNetwork(network);
      setPassword("");
    }
  };

  const handleConnect = async (network: WiFiNetwork, pwd: string) => {
    setIsConnecting(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/connect`, {
        ssid: network.ssid,
        password: pwd,
      });

      if (response.data.success) {
        // Update networks to show new connection
        setNetworks(
          networks.map((n) => ({
            ...n,
            isConnected: n.ssid === network.ssid,
          })),
        );

        toast.success("Connected successfully", {
          description: `Connected to ${network.ssid}`,
        });

        setSelectedNetwork(null);
        setPassword("");
      } else {
        toast.error("Connection failed", {
          description:
            response.data.error || "Please check your password and try again",
        });
      }
    } catch (error: any) {
      console.error("WiFi connect error:", error);
      toast.error("Connection failed", {
        description:
          error.response?.data?.error ||
          "Please check your password and try again",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNetwork && password) {
      handleConnect(selectedNetwork, password);
    }
  };

  const getSignalIcon = (strength: number) => {
    if (strength >= 80) return <Signal className="w-5 h-5 text-green-600" />;
    if (strength >= 60) return <Signal className="w-5 h-5 text-yellow-600" />;
    if (strength >= 40) return <Signal className="w-5 h-5 text-orange-600" />;
    return <Signal className="w-5 h-5 text-red-600" />;
  };

  const getSignalBars = (strength: number) => {
    const bars = Math.ceil(strength / 25);
    return (
      <div className="flex items-end gap-0.5 h-4">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`w-1 rounded-sm transition-all ${
              bar <= bars
                ? strength >= 80
                  ? "bg-green-600"
                  : strength >= 60
                    ? "bg-yellow-600"
                    : strength >= 40
                      ? "bg-orange-600"
                      : "bg-red-600"
                : "bg-gray-300"
            }`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] px-6 py-5 rounded-t-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Wifi className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-2xl">WiFi Settings</h2>
              <p className="text-blue-100 text-sm">
                Configure network connection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Scan Button */}
          <div className="mb-6">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold transition-all shadow-lg disabled:cursor-not-allowed"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Scan for Networks
                </>
              )}
            </button>
          </div>

          {/* Network List */}
          {networks.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Available Networks ({networks.length})
              </h3>
              {networks.map((network) => (
                <button
                  key={network.ssid}
                  onClick={() => handleNetworkClick(network)}
                  disabled={network.isConnected}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    network.isConnected
                      ? "bg-green-50 border-green-500 cursor-default"
                      : "bg-white border-gray-200 hover:border-[#4A90E2] hover:shadow-md cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {network.isConnected ? (
                        <Wifi className="w-5 h-5 text-green-600" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800">
                          {network.ssid}
                        </p>
                        {network.isConnected && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">
                            Connected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-500">
                          {network.security}
                        </p>
                        {network.security !== "Open" && (
                          <Lock className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Signal</p>
                      {getSignalBars(network.signalStrength)}
                    </div>
                    <p className="text-sm font-semibold text-gray-600 min-w-[45px] text-right">
                      {network.signalStrength}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <WifiOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No networks found</p>
              <p className="text-gray-400 text-sm mt-1">
                Click "Scan for Networks" to search
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Password Modal */}
      {selectedNetwork && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <form onSubmit={handleSubmit}>
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-white" />
                  <h3 className="text-white font-bold text-lg">
                    Enter Password
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNetwork(null)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Network</p>
                  <p className="font-bold text-gray-800">
                    {selectedNetwork.ssid}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Security: {selectedNetwork.security}
                  </p>
                </div>

                <div className="mb-6">
                  <label
                    htmlFor="wifi-password"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="wifi-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter network password"
                    autoFocus
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] transition-colors"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedNetwork(null)}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isConnecting || !password}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold transition-all shadow-lg disabled:cursor-not-allowed"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Wifi className="w-5 h-5" />
                        Connect
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
