import { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  Pill,
  Droplet,
  Shield,
  Package,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import axios from "axios";

interface Medicine {
  id: string;
  name: string;
  dosage?: string;
  description: string;
  type: string;
  symptoms_target?: string;
}

interface ConfigureSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotNumber: number;
  currentStock: number;
  currentMedicine?: Medicine | null;
  onSave: (medicine: Medicine, newStock: number) => void;
}

export function ConfigureSlotModal({
  isOpen,
  onClose,
  slotNumber,
  currentStock,
  currentMedicine,
  onSave,
}: ConfigureSlotModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(
    currentMedicine || null,
  );
  const [addQuantity, setAddQuantity] = useState(0);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState(true);
  const [initialMedicineId, setInitialMedicineId] = useState<string | null>(
    null,
  );

  // Load medicines from backend
  useEffect(() => {
    const loadMedicines = async () => {
      if (!isOpen) return;

      try {
        setLoadingMedicines(true);
        const response = await axios.get(`${API_BASE_URL}/api/admin/medicines`);

        if (response.data.success) {
          // Transform backend data to frontend format
          const transformedMedicines = response.data.medicines.map(
            (med: any) => ({
              id: med.id.toString(),
              name: med.name,
              dosage: med.description?.match(/\d+mg/)
                ? med.description.match(/\d+mg/)[0]
                : "",
              description: med.description || med.symptoms_target || "",
              type: "tablet",
              symptoms_target: med.symptoms_target,
            }),
          );

          setMedicines(transformedMedicines);
        }
      } catch (error) {
        console.error("Failed to load medicines:", error);
      } finally {
        setLoadingMedicines(false);
      }
    };

    loadMedicines();
  }, [isOpen]);

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMedicine(currentMedicine || null);
      setInitialMedicineId(currentMedicine?.id || null);
      setAddQuantity(0);
      setSearchQuery("");
    }
  }, [isOpen, currentMedicine]);

  // Determine if we're changing medicines (compare to initial medicine, not current)
  const isChangingMedicine = selectedMedicine?.id !== initialMedicineId;
  const displayCurrentStock = isChangingMedicine ? 0 : currentStock;

  const filteredMedicines = useMemo(() => {
    return medicines.filter(
      (med) =>
        med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (med.dosage &&
          med.dosage.toLowerCase().includes(searchQuery.toLowerCase())) ||
        med.description.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, medicines]);

  const getIcon = (type: string) => {
    switch (type) {
      case "pill":
      case "tablet":
        return Pill;
      case "mask":
        return Shield;
      case "syrup":
        return Droplet;
      default:
        return Package;
    }
  };

  const newTotal = displayCurrentStock + addQuantity;

  const handleSave = () => {
    if (selectedMedicine) {
      onSave(selectedMedicine, newTotal);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-scale-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-2xl">
                Configure Slot {slotNumber}
              </h2>
              <p className="text-blue-100 text-sm">
                Select medicine and set quantity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex-shrink-0 p-6 pb-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medicines (e.g., Para, Biogesic, Neozep)..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] transition-colors"
            />
          </div>
        </div>

        {/* Medicine List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingMedicines ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-[#4A90E2] animate-spin mb-3" />
              <p className="text-gray-500">Loading medicines...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMedicines.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No medicines found</p>
                </div>
              ) : (
                filteredMedicines.map((medicine) => {
                  const Icon = getIcon(medicine.type);
                  const isSelected = selectedMedicine?.id === medicine.id;

                  return (
                    <button
                      key={medicine.id}
                      onClick={() => setSelectedMedicine(medicine)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-[#4A90E2] bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-[#4A90E2]" : "bg-gray-100"
                          }`}
                        >
                          <Icon
                            className={`w-6 h-6 ${isSelected ? "text-white" : "text-gray-600"}`}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-800">
                              {medicine.name}{" "}
                              {medicine.dosage && `(${medicine.dosage})`}
                            </h3>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-[#4A90E2] flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {medicine.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Stock Input Section */}
        {selectedMedicine && (
          <div className="flex-shrink-0 border-t-2 border-gray-100 bg-gray-50 px-8 py-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Current Stock
                </label>
                <div className="bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-center relative">
                  <span className="text-2xl font-bold text-gray-800">
                    {displayCurrentStock}
                  </span>
                  {isChangingMedicine && (
                    <span className="absolute top-1 right-2 text-xs text-orange-600 font-semibold">
                      New Med
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Add Quantity
                </label>
                <input
                  type="number"
                  value={addQuantity}
                  onChange={(e) =>
                    setAddQuantity(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  min={0}
                  placeholder="0"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] transition-colors font-bold text-2xl text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  New Total
                </label>
                <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] rounded-xl px-4 py-3 text-center">
                  <span className="text-2xl font-bold text-white">
                    {newTotal}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedMedicine}
                className="flex-1 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] text-white py-3 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}

        {/* No medicine selected state */}
        {!selectedMedicine && (
          <div className="flex-shrink-0 border-t-2 border-gray-100 bg-gray-50 px-8 py-6">
            <p className="text-center text-gray-500 mb-4">
              Please select a medicine to continue
            </p>
            <button
              onClick={onClose}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
