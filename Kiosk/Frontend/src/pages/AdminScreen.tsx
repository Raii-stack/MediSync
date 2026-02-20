import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Home,
  Pill,
  Droplet,
  Shield,
  ActivitySquare,
  AlertCircle,
  TestTube2,
  Settings,
  Wifi,
  WifiOff,
  Lock,
  RefreshCw,
} from "lucide-react";
import { ConfigureSlotModal } from "../components/ConfigureSlotModal";
import { WiFiSettingsModal } from "../components/WiFiSettingsModal";
import { toast } from "sonner";
import { API_BASE_URL } from "../config/api";
import axios from "axios";

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  description: string;
  type: string;
}

interface SlotConfig {
  id: number;
  medicine: Medicine | null;
  stock: number;
  maxStock: number;
  threshold: number;
}

export function AdminScreen() {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<SlotConfig[]>([]);
  const [testingSlot, setTestingSlot] = useState<number | null>(null);
  const [configuringSlot, setConfiguringSlot] = useState<number | null>(null);
  const [wifiSettingsOpen, setWiFiSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const ensureSlots = (items: SlotConfig[]) => {
    const filled = [...items];
    for (let id = 1; id <= 5; id += 1) {
      if (!filled.find((slot) => slot.id === id)) {
        filled.push({
          id,
          medicine: null,
          stock: 0,
          maxStock: 100,
          threshold: 5,
        });
      }
    }
    return filled.sort((a, b) => a.id - b.id);
  };

  // Fetch slots from backend on mount
  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/admin/slots`);

      if (response.data.success) {
        // Transform backend data to frontend format
        const transformedSlots = response.data.slots.map((slot: any) => ({
          id: slot.slot_id,
          medicine: slot.medicine_name
            ? {
                id: slot.medicine_name.toLowerCase().replace(/\s+/g, "-"),
                name: slot.medicine_name,
                dosage: slot.description || "",
                description: slot.symptoms_target || "",
                type: "tablet", // Default type
              }
            : null,
          stock: slot.current_stock || 0,
          maxStock: slot.max_capacity || 100,
          threshold: 5, // Default threshold
        }));

        setSlots(ensureSlots(transformedSlots));
      }
    } catch (error) {
      console.error("Failed to load slots:", error);
      toast.error("Failed to load slots from backend");
      // Set default empty slots
      setSlots(
        ensureSlots([
          { id: 1, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
          { id: 2, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
          { id: 3, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
          { id: 4, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
        ]),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "pill":
      case "tablet":
        return Pill;
      case "mask":
        return Shield;
      case "syrup":
        return Droplet;
      default:
        return Pill;
    }
  };

  const getStockStatus = (
    stock: number,
    maxStock: number,
    threshold: number,
  ) => {
    if (stock === 0)
      return { color: "bg-red-500", label: "Empty", dotColor: "bg-red-500" };
    if (stock < threshold)
      return { color: "bg-orange-500", label: "Low", dotColor: "bg-red-500" };
    return { color: "bg-green-500", label: "Ready", dotColor: "bg-green-500" };
  };

  const handleTestDispense = async (id: number) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot || !slot.medicine) return;

    setTestingSlot(id);

    try {
      toast.info(`Testing dispense for ${slot.medicine.name}...`);

      // Call hardware test dispense endpoint
      const response = await axios.post(`${API_BASE_URL}/api/test-dispense`, {
        slot_id: id,
      });

      if (response.data.success) {
        toast.success("Test dispense command sent to hardware!");

        // Also decrement stock in database if stock > 0
        if (slot.stock > 0) {
          await axios.post(`${API_BASE_URL}/api/admin/slots`, {
            slot_id: id,
            medicine_name: slot.medicine.name,
            current_stock: slot.stock - 1,
          });

          // Update local state
          setSlots(
            slots.map((s) =>
              s.id === id ? { ...s, stock: Math.max(0, s.stock - 1) } : s,
            ),
          );
        }
      } else {
        toast.error(response.data.message || "Test dispense failed");
      }
    } catch (error) {
      console.error("Test dispense error:", error);
      toast.error("Failed to send test dispense command");
    } finally {
      setTestingSlot(null);
    }
  };

  const handleSaveConfiguration = async (
    medicine: Medicine,
    newStock: number,
  ) => {
    if (configuringSlot === null) return;

    try {
      // Save to backend
      const response = await axios.post(`${API_BASE_URL}/api/admin/slots`, {
        slot_id: configuringSlot,
        medicine_name: medicine.name,
        current_stock: newStock,
      });

      if (response.data.success) {
        // Update local state
        setSlots(
          slots.map((slot) =>
            slot.id === configuringSlot
              ? { ...slot, medicine, stock: newStock }
              : slot,
          ),
        );
        toast.success(`Slot ${configuringSlot} configured successfully`);
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (error) {
      console.error("Save configuration failed:", error);
      toast.error("Failed to save configuration");
    }
  };

  const handleWiFiSettingsOpen = () => {
    setWiFiSettingsOpen(true);
  };

  const handleWiFiSettingsClose = () => {
    setWiFiSettingsOpen(false);
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-xl flex items-center justify-center">
              <ActivitySquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                MediSync Admin
              </h1>
              <p className="text-sm text-gray-500">
                Inventory Management System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleWiFiSettingsOpen}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] rounded-xl transition-all text-white font-medium shadow-lg"
            >
              <Wifi className="w-4 h-4" />
              WiFi Settings
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors text-gray-700 font-medium"
            >
              <Home className="w-4 h-4" />
              Exit Admin
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-[#4A90E2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">Loading slots...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {slots.map((slot) => {
                const Icon = slot.medicine
                  ? getItemIcon(slot.medicine.type)
                  : Pill;
                const status = getStockStatus(
                  slot.stock,
                  slot.maxStock,
                  slot.threshold,
                );
                const stockPercentage = (slot.stock / slot.maxStock) * 100;

                return (
                  <div
                    key={slot.id}
                    className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow"
                  >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg">
                          <span className="text-white font-bold text-sm">
                            SLOT {slot.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${status.dotColor} animate-pulse`}
                          ></div>
                          <span className="text-white text-sm font-medium">
                            {status.label}
                          </span>
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    {/* Configuration Fields */}
                    <div className="p-6 space-y-4">
                      {/* Medicine Info */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Medicine
                        </label>
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3">
                          {slot.medicine ? (
                            <div>
                              <p className="font-bold text-gray-800">
                                {slot.medicine.name} ({slot.medicine.dosage})
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {slot.medicine.description}
                              </p>
                            </div>
                          ) : (
                            <p className="text-gray-400 italic">
                              Not configured
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stock Level */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Stock Level
                        </label>
                        <div className="relative">
                          {/* Progress Bar Background */}
                          <div className="absolute inset-0 rounded-xl overflow-hidden">
                            <div
                              className={`h-full ${status.color} opacity-10 transition-all duration-300`}
                              style={{ width: `${stockPercentage}%` }}
                            ></div>
                          </div>
                          <div className="relative bg-white border-2 border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                            <span className="font-bold text-2xl text-gray-800">
                              {slot.stock}
                            </span>
                            <span className="text-gray-400 font-medium">
                              / {slot.maxStock}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Threshold Warning */}
                      {slot.stock < slot.threshold && slot.medicine && (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span className="text-sm text-orange-700 font-medium">
                            Alert: Stock below threshold ({slot.threshold})
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => setConfiguringSlot(slot.id)}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] text-white rounded-xl font-semibold transition-all shadow-lg col-span-2"
                        >
                          <Settings className="w-4 h-4" />
                          Configure
                        </button>
                        <button
                          onClick={() => handleTestDispense(slot.id)}
                          disabled={
                            testingSlot === slot.id ||
                            slot.stock === 0 ||
                            !slot.medicine
                          }
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-[#4A90E2] rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-200"
                        >
                          <TestTube2
                            className={`w-4 h-4 ${testingSlot === slot.id ? "animate-pulse" : ""}`}
                          />
                          {testingSlot === slot.id ? "Testing..." : "Test"}
                        </button>
                        <button
                          disabled={!slot.medicine}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-400 rounded-xl font-semibold border-2 border-gray-200 cursor-not-allowed"
                          title="Use Configure to manage stock"
                        >
                          Stock: {slot.stock}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Configure Modal */}
      {configuringSlot !== null && (
        <ConfigureSlotModal
          isOpen={configuringSlot !== null}
          onClose={() => setConfiguringSlot(null)}
          slotNumber={configuringSlot}
          currentStock={slots.find((s) => s.id === configuringSlot)?.stock || 0}
          currentMedicine={
            slots.find((s) => s.id === configuringSlot)?.medicine || null
          }
          onSave={handleSaveConfiguration}
        />
      )}

      {/* WiFi Settings Modal */}
      <WiFiSettingsModal
        isOpen={wifiSettingsOpen}
        onClose={handleWiFiSettingsClose}
      />
    </div>
  );
}
