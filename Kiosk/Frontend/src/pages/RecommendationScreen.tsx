import { useNavigate } from "react-router";
import { KioskLayout } from "../components/KioskLayout";
import {
  Pill,
  Check,
  X,
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Loader2,
} from "lucide-react";
import { useKiosk } from "../contexts/KioskContext";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { toast } from "sonner";
import { DispensingModal } from "../components/DispensingModal";

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  description: string;
  type: string;
}

const symptomEmojis: Record<string, string> = {
  fever: "🤒",
  headache: "🤕",
  colds: "🤧",
  abdominal: "😷",
  dysmenorrhea: "😫",
  dehydration: "💧",
  vomiting: "🤮",
  diarrhea: "🚽",
};

export function RecommendationScreen() {
  const navigate = useNavigate();
  const {
    slots,
    setSlots,
    vitalSigns,
    selectedSymptoms,
    painLevel,
    setRecommendedMedicine,
    setDispensingSlot,
    loadSlots,
  } = useKiosk();
  const [recommendation, setRecommendation] = useState<{
    type: "medicine" | "clinic";
    medicine?: Medicine;
    slot?: number;
    reason?: string;
  } | null>(null);
  const [isDispensing, setIsDispensing] = useState(false);
  const [showDispensingModal, setShowDispensingModal] = useState(false);

  useEffect(() => {
    // Reload slots to ensure we have latest inventory
    loadSlots();
  }, []);

  useEffect(() => {
    if (slots.length === 0) return; // Wait for slots to load

    // Find the best available medicine for the symptoms using symptoms_target from database
    let foundMedicine: Medicine | null = null;
    let foundSlot: number | null = null;

    console.log("🔍 Checking available medicines in slots:", slots);
    console.log("🩺 Selected symptoms:", selectedSymptoms);

    // Normalize selected symptoms to lowercase for matching
    const normalizedSelectedSymptoms = selectedSymptoms.map((s) =>
      s.toLowerCase(),
    );

    for (const slot of slots) {
      if (slot.medicine && slot.stock > 0) {
        // Get symptoms_target from medicine description field
        // symptoms_target is stored as comma-separated string like "Fever, Headache, Pain"
        const symptomsTarget = slot.medicine.description || "";

        // Parse symptoms_target and normalize to lowercase
        const targetSymptoms = symptomsTarget
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        console.log(
          `🔍 Checking ${slot.medicine.name}: targets [${targetSymptoms.join(", ")}]`,
        );

        // Check if any of the selected symptoms match the medicine's symptoms_target
        const hasMatch =
          targetSymptoms.length > 0 &&
          normalizedSelectedSymptoms.some((selectedSymptom) =>
            targetSymptoms.some((targetSymptom) => {
              // Check for exact match or partial match
              // e.g., "abdominal" matches "abdominal pain" or "abdominal"
              return (
                targetSymptom.includes(selectedSymptom) ||
                selectedSymptom.includes(targetSymptom)
              );
            }),
          );

        if (hasMatch) {
          foundMedicine = slot.medicine;
          foundSlot = slot.id;
          console.log(
            `✅ Found matching medicine: ${slot.medicine.name} in Slot ${slot.id} (Stock: ${slot.stock})`,
          );
          break;
        }
      }
    }

    if (foundMedicine && foundSlot) {
      // Medicine available in kiosk — dispense even if symptoms are severe
      setRecommendation({
        type: "medicine",
        medicine: foundMedicine,
        slot: foundSlot,
      });
    } else {
      // No suitable medicine available, recommend clinic
      console.log(
        "❌ No suitable medicine available in stock for selected symptoms",
      );
      setRecommendation({
        type: "clinic",
        reason:
          "No medicine available for your symptoms. Please visit the clinic.",
      });
    }
  }, [selectedSymptoms, painLevel, vitalSigns, slots, loadSlots]);

  const handleDispense = async () => {
    if (
      recommendation?.type === "medicine" &&
      recommendation.medicine &&
      recommendation.slot
    ) {
      setIsDispensing(true);
      setRecommendedMedicine(recommendation.medicine);
      setDispensingSlot(recommendation.slot);

      try {
        // Get student info from session storage
        const studentData = sessionStorage.getItem("currentStudent");
        const student = studentData ? JSON.parse(studentData) : null;
        const studentId = student?.student_id || "GUEST";
        const studentName = student
          ? `${student.first_name} ${student.last_name}`
          : "Guest";

        // Call backend dispense API
        const response = await axios.post(`${API_BASE_URL}/api/dispense`, {
          medicine: recommendation.medicine.name,
          student_id: studentId,
          rfid_uid: student?.rfid_uid || null,
          student_name: studentName,
          symptoms: selectedSymptoms.join(","),
          pain_level: painLevel,
          vitals: vitalSigns
            ? {
                temp: vitalSigns.temperature,
                bpm: vitalSigns.heartRate,
              }
            : null,
        });

        if (response.data.success) {
          sessionStorage.setItem("medicineDispensed", "true");
          // Update local stock
          setSlots(
            slots.map((s) =>
              s.id === recommendation.slot
                ? { ...s, stock: Math.max(0, s.stock - 1) }
                : s,
            ),
          );

          // Show dispensing animation modal
          setShowDispensingModal(true);

          toast.success("Medicine dispensed successfully!");
        } else {
          sessionStorage.setItem("medicineDispensed", "false");
          toast.error(response.data.message || "Dispensing failed");
          setIsDispensing(false);
        }
      } catch (error: any) {
        sessionStorage.setItem("medicineDispensed", "false");
        console.error("Dispense error:", error);
        toast.error("Failed to dispense medicine");
        setIsDispensing(false);
      }
    }
  };

  const handleClinicDone = () => {
    setRecommendedMedicine(null);
    setDispensingSlot(null);
    sessionStorage.setItem("medicineDispensed", "false");
    navigate("/receipt");
  };

  const handleDispensingComplete = () => {
    setShowDispensingModal(false);
    navigate("/receipt");
  };

  const getPainStatus = () => {
    if (painLevel <= 3) return { label: "Mild", color: "text-green-600" };
    if (painLevel <= 6) return { label: "Moderate", color: "text-yellow-600" };
    return { label: "Severe", color: "text-red-600" };
  };

  const status = getPainStatus();

  // Derive a severity theme for the medicine card based on reported symptoms + vitals
  const getSeverityTheme = () => {
    const severeSymptoms = ["dehydration", "vomiting", "diarrhea"];
    const moderateSymptoms = ["fever", "abdominal", "dysmenorrhea"];
    const isSevere =
      painLevel >= 8 ||
      (vitalSigns && vitalSigns.temperature >= 38.5) ||
      selectedSymptoms.some((s) => severeSymptoms.includes(s));
    const isModerate =
      painLevel >= 4 ||
      (vitalSigns && vitalSigns.temperature >= 37.5) ||
      selectedSymptoms.some((s) => moderateSymptoms.includes(s));

    if (isSevere) return {
      border: "border-red-500",
      glow: "from-red-500 to-rose-500",
      gradient: "from-red-500 to-rose-500",
      badgeBg: "bg-red-500",
      buttonGradient: "from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600",
      matchBg: "from-red-50 to-rose-50",
      matchBorder: "border-red-200",
      activityColor: "text-red-500",
      label: "Urgent Treatment",
      tagline: "Immediate care recommended",
    };
    if (isModerate) return {
      border: "border-amber-500",
      glow: "from-amber-400 to-orange-500",
      gradient: "from-amber-500 to-orange-500",
      badgeBg: "bg-amber-500",
      buttonGradient: "from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600",
      matchBg: "from-amber-50 to-orange-50",
      matchBorder: "border-amber-200",
      activityColor: "text-amber-500",
      label: "Moderate Treatment",
      tagline: "Monitor symptoms closely",
    };
    return {
      border: "border-blue-500",
      glow: "from-blue-400 to-sky-500",
      gradient: "from-blue-500 to-sky-500",
      badgeBg: "bg-blue-500",
      buttonGradient: "from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600",
      matchBg: "from-blue-50 to-sky-50",
      matchBorder: "border-blue-200",
      activityColor: "text-blue-500",
      label: "Treatment Plan",
      tagline: "Symptoms appear manageable",
    };
  };

  const theme = getSeverityTheme();

  if (!recommendation) {
    return (
      <KioskLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#4A90E2] border-t-transparent"></div>
        </div>
      </KioskLayout>
    );
  }

  return (
    <KioskLayout>
      <div className="flex items-center w-full max-w-6xl mx-auto h-full py-4">
        {/* Title */}
        <div className="w-full">
          <div className="text-center mb-6">
            <div
              className={`inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-lg mb-3`}
            >
              <Activity
                className={`w-4 h-4 ${recommendation.type === "clinic" ? "text-orange-600" : theme.activityColor}`}
              />
              <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                {recommendation.type === "clinic"
                  ? "Medical Attention Required"
                  : theme.label}
              </span>
            </div>
            <h1 className="text-4xl font-bold text-gray-800">
              {recommendation.type === "clinic"
                ? "Please Visit Clinic"
                : "Recommended Treatment"}
            </h1>
          </div>

          <div className="grid grid-cols-5 gap-6 w-full">
            {/* Left Column - Summary */}
            <div className="col-span-2 space-y-3">
              {/* Symptoms Summary */}
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-[#4A90E2] rounded-full"></div>
                  <h3 className="font-semibold text-gray-700 text-sm">
                    Your Symptoms
                  </h3>
                </div>
                <div className="space-y-2">
                  {selectedSymptoms.map((symptom) => (
                    <div
                      key={symptom}
                      className="flex items-center gap-2 text-gray-600"
                    >
                      <span className="text-xl">{symptomEmojis[symptom]}</span>
                      <span className="text-sm capitalize">
                        {symptom.replace("-", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vital Signs */}
              <div className="bg-white rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-2 h-2 rounded-full ${painLevel >= 7 || (vitalSigns && vitalSigns.temperature >= 38) ? "bg-red-500" : "bg-green-500"}`}
                  ></div>
                  <h3 className="font-semibold text-gray-700 text-sm">
                    Vital Signs
                  </h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Pain Level</span>
                    <span className={`font-semibold text-sm ${status.color}`}>
                      {painLevel}/10 ({status.label})
                    </span>
                  </div>
                  {vitalSigns && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          Temperature
                        </span>
                        <span
                          className={`font-semibold text-sm ${vitalSigns.temperature >= 38 ? "text-red-600" : "text-green-600"}`}
                        >
                          {vitalSigns.temperature.toFixed(1)}°C
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          Heart Rate
                        </span>
                        <span className="font-semibold text-green-600 text-sm">
                          {vitalSigns.heartRate} BPM
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Safety Note */}
              <div
                className={`${recommendation.type === "clinic" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"} border-2 rounded-xl p-3`}
              >
                <div className="flex gap-2">
                  <AlertCircle
                    className={`w-4 h-4 ${recommendation.type === "clinic" ? "text-red-600" : "text-amber-600"} flex-shrink-0 mt-0.5`}
                  />
                  <div>
                    <p
                      className={`text-xs ${recommendation.type === "clinic" ? "text-red-800" : "text-amber-800"} font-medium mb-1`}
                    >
                      Important
                    </p>
                    <p
                      className={`text-xs ${recommendation.type === "clinic" ? "text-red-700" : "text-amber-700"} leading-relaxed`}
                    >
                      {recommendation.type === "clinic"
                        ? "Your condition requires professional medical attention. Please proceed to the school clinic immediately."
                        : "If symptoms persist or worsen, please visit the clinic immediately."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Recommendation Card */}
            <div className="col-span-3">
              <div className="relative h-full flex items-center">
                {recommendation.type === "clinic" ? (
                  // Clinic Visit Card
                  <>
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl blur-2xl opacity-20"></div>

                    {/* Main Card */}
                    <div className="relative bg-white rounded-3xl border-4 border-orange-500 p-8 shadow-2xl w-full">
                      {/* Clinic Icon */}
                      <div className="flex justify-center mb-6">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl blur-lg opacity-30"></div>
                          <div className="relative bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 shadow-xl">
                            <Building2
                              className="w-14 h-14 text-white"
                              strokeWidth={2}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Clinic Title */}
                      <h2 className="text-5xl font-bold text-center mb-3 bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                        Visit School Clinic
                      </h2>
                      <p className="text-base text-gray-500 text-center mb-6">
                        Professional medical attention required
                      </p>

                      {/* Reason */}
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 mb-6 border-2 border-orange-200">
                        <div className="flex items-center gap-3 justify-center">
                          <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center">
                            <AlertTriangle
                              className="w-4 h-4 text-white"
                              strokeWidth={3}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-700">
                            {recommendation.reason}
                          </span>
                        </div>
                      </div>

                      {/* Information */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <p className="text-xs text-gray-600 text-center leading-relaxed">
                          <span className="font-semibold">What to do:</span>{" "}
                          Please proceed to the school clinic located at the
                          main building, 2nd floor. A school nurse will assess
                          your condition and provide appropriate care.
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={handleClinicDone}
                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 font-bold text-lg"
                        >
                          <Check className="w-5 h-5" />
                          Done
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  // Medicine Card
                  <>
                    {/* Glow effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} rounded-3xl blur-2xl opacity-20`}></div>

                    {/* Main Card */}
                    <div className={`relative bg-white rounded-3xl border-4 ${theme.border} p-8 shadow-2xl w-full`}>
                      {/* Pill Icon */}
                      <div className="flex justify-center mb-6">
                        <div className="relative">
                          <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} rounded-2xl blur-lg opacity-30`}></div>
                          <div className={`relative bg-gradient-to-br ${theme.gradient} rounded-2xl p-6 shadow-xl transform -rotate-12 hover:rotate-0 transition-transform`}>
                            <Pill
                              className="w-14 h-14 text-white"
                              strokeWidth={2}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Medicine Name */}
                      <h2 className={`text-5xl font-bold text-center mb-3 bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                        {recommendation.medicine?.name}
                      </h2>
                      <p className="text-base text-gray-500 text-center mb-6">
                        {theme.tagline}
                      </p>

                      {/* Match Indicator */}
                      <div className={`bg-gradient-to-r ${theme.matchBg} rounded-xl p-4 mb-6 border-2 ${theme.matchBorder}`}>
                        <div className="flex items-center gap-3 justify-center">
                          <div className={`w-7 h-7 ${theme.badgeBg} rounded-full flex items-center justify-center`}>
                            <Check
                              className="w-4 h-4 text-white"
                              strokeWidth={3}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-700">
                            Best match for:{" "}
                            {selectedSymptoms
                              .map(
                                (s) => s.charAt(0).toUpperCase() + s.slice(1),
                              )
                              .join(", ")}
                          </span>
                        </div>
                      </div>

                      {/* Dosage Info */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-6">
                        <p className="text-xs text-gray-600 text-center">
                          <span className="font-semibold">Dosage:</span>{" "}
                          {recommendation.medicine?.dosage} - Take as directed
                          by healthcare professional
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={handleDispense}
                          disabled={isDispensing}
                          className={`bg-gradient-to-r ${theme.buttonGradient} text-white py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                        >
                          {isDispensing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              DISPENSING...
                            </>
                          ) : (
                            <>
                              <Pill className="w-5 h-5" />
                              DISPENSE MEDICINE
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => navigate("/symptoms")}
                          disabled={isDispensing}
                          className="bg-white hover:bg-gray-50 text-gray-600 py-3 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 font-semibold border-2 border-gray-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                          Go Back
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dispensing Modal */}
      <DispensingModal
        isOpen={showDispensingModal}
        medicineName={recommendation?.medicine?.name || "Medicine"}
        onComplete={handleDispensingComplete}
      />
    </KioskLayout>
  );
}
