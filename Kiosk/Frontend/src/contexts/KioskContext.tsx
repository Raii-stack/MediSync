import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

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

interface VitalSigns {
  heartRate: number;
  temperature: number;
  oxygenLevel: number;
}

interface KioskContextType {
  // Slots
  slots: SlotConfig[];
  setSlots: (slots: SlotConfig[]) => void;
  loadSlots: () => Promise<void>;

  // Vital Signs
  vitalSigns: VitalSigns | null;
  setVitalSigns: (vitals: VitalSigns | null) => void;

  // Symptoms
  selectedSymptoms: string[];
  setSelectedSymptoms: (symptoms: string[]) => void;
  painLevel: number;
  setPainLevel: (level: number) => void;

  // Recommendation
  recommendedMedicine: Medicine | null;
  setRecommendedMedicine: (medicine: Medicine | null) => void;
  dispensingSlot: number | null;
  setDispensingSlot: (slot: number | null) => void;
  resetSessionState: () => void;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export function KioskProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<SlotConfig[]>([]);
  const [vitalSigns, setVitalSigns] = useState<VitalSigns | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState(5);
  const [recommendedMedicine, setRecommendedMedicine] =
    useState<Medicine | null>(null);
  const [dispensingSlot, setDispensingSlot] = useState<number | null>(null);

  const resetSessionState = () => {
    setVitalSigns(null);
    setSelectedSymptoms([]);
    setPainLevel(5);
    setRecommendedMedicine(null);
    setDispensingSlot(null);
  };

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

  // Load slots from backend
  const loadSlots = async () => {
    try {
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
                type: "tablet",
              }
            : null,
          stock: slot.current_stock || 0,
          maxStock: slot.max_capacity || 100,
          threshold: 5,
        }));

        setSlots(ensureSlots(transformedSlots));
      }
    } catch (error) {
      console.error("Failed to load slots:", error);
      // Set default empty slots on error
      setSlots(
        ensureSlots([
          { id: 1, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
          { id: 2, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
          { id: 3, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
          { id: 4, medicine: null, stock: 0, maxStock: 100, threshold: 5 },
        ]),
      );
    }
  };

  // Load slots on mount
  useEffect(() => {
    loadSlots();
  }, []);

  return (
    <KioskContext.Provider
      value={{
        slots,
        setSlots,
        loadSlots,
        vitalSigns,
        setVitalSigns,
        selectedSymptoms,
        setSelectedSymptoms,
        painLevel,
        setPainLevel,
        recommendedMedicine,
        setRecommendedMedicine,
        dispensingSlot,
        setDispensingSlot,
        resetSessionState,
      }}
    >
      {children}
    </KioskContext.Provider>
  );
}

export function useKiosk() {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error("useKiosk must be used within a KioskProvider");
  }
  return context;
}
