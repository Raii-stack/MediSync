import { useNavigate } from "react-router";
import { KioskLayout } from "../components/KioskLayout";
import {
  Check,
  FileText,
  Pill,
  Heart,
  Thermometer,
  Clock,
  User,
  Building,
  Activity,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKiosk } from "../contexts/KioskContext";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

export function ReceiptScreen() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);
  const {
    recommendedMedicine,
    resetSessionState,
    selectedSymptoms,
    painLevel,
    vitalSigns,
  } = useKiosk();
  const sessionEndedRef = useRef(false);
  const medicineDispensed =
    sessionStorage.getItem("medicineDispensed") === "true";

  // Get student info from session storage
  const studentData = sessionStorage.getItem("currentStudent");
  const student = studentData ? JSON.parse(studentData) : null;

  // Format date and time
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Get pain status
  const getPainStatus = () => {
    if (painLevel <= 3) return { label: "Mild", color: "text-green-600" };
    if (painLevel <= 6) return { label: "Moderate", color: "text-yellow-600" };
    return { label: "Severe", color: "text-red-600" };
  };

  const painStatus = getPainStatus();

  const endSession = useCallback(async () => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    try {
      await axios.post(`${API_BASE_URL}/api/session/end`);
    } catch (error) {
      console.error("Session end error:", error);
    }
  }, []);

  const handleComplete = useCallback(() => {
    resetSessionState();
    sessionStorage.removeItem("medicineDispensed");
    endSession().finally(() => navigate("/"));
  }, [endSession, navigate, resetSessionState]);

  useEffect(() => {
    if (countdown === 0) {
      handleComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, handleComplete]);

  return (
    <KioskLayout showEmergency={false}>
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto h-full py-6">
        {/* Success Animation */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <div className="relative w-16 h-16 bg-gradient-to-br from-[#2ECC71] to-[#27AE60] rounded-full flex items-center justify-center shadow-2xl">
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-1">
          Treatment Complete!
        </h1>
        <p className="text-base text-gray-500 mb-6">Your receipt is ready</p>

        {/* Receipt Card - Compact Version */}
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-200 w-full max-w-3xl mb-6 overflow-hidden">
          {/* Receipt Header */}
          <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-white" />
              <div>
                <h2 className="text-white font-bold text-base">
                  MediSync Kiosk
                </h2>
                <p className="text-blue-100 text-xs">EMU Health Center</p>
              </div>
            </div>
            <div className="text-right text-white">
              <div className="text-xs opacity-80">{dateStr}</div>
              <div className="text-xs opacity-80">{timeStr}</div>
            </div>
          </div>

          {/* Receipt Body - Compact Grid */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-6 mb-5">
              {/* Patient Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Patient
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {student
                      ? `${student.first_name} ${student.last_name}`
                      : "Guest"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Student No.</div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {student?.student_id || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Section</div>
                  <div className="font-semibold text-gray-800 text-sm">
                    {student?.section || "N/A"}
                  </div>
                </div>
              </div>

              {/* Vital Signs */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Vitals
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-red-50 rounded-lg p-2">
                    <Heart className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">Heart Rate</div>
                      <div className="font-bold text-sm text-gray-800">
                        {vitalSigns?.heartRate || "N/A"}{" "}
                        {vitalSigns?.heartRate && "BPM"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                    <Thermometer className="w-4 h-4 text-[#4A90E2] flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">Temp</div>
                      <div className="font-bold text-sm text-gray-800">
                        {vitalSigns?.temperature || "N/A"}
                        {vitalSigns?.temperature && "°C"}
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">Pain Level</div>
                    <div className={`font-bold text-sm ${painStatus.color}`}>
                      {painLevel}/10 - {painStatus.label}
                    </div>
                  </div>
                </div>
              </div>

              {/* Symptoms & Medicine */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Treatment
                  </span>
                </div>
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">Symptoms</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedSymptoms.length > 0 ? (
                      selectedSymptoms.map((symptom) => (
                        <span
                          key={symptom}
                          className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium capitalize"
                        >
                          {symptom.replace("-", " ")}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </div>
                </div>

                {/* Medicine - Highlighted */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-[#2ECC71] rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#2ECC71] to-[#27AE60] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Pill className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-600">Dispensed</div>
                      <div className="text-base font-bold text-gray-800 truncate">
                        {medicineDispensed
                          ? recommendedMedicine?.name || "Medicine"
                          : "No medicine dispensed"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {medicineDispensed
                          ? recommendedMedicine?.dosage ||
                            recommendedMedicine?.description ||
                            ""
                          : "Clinic recommendation / non-dispense flow"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions - Compact */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-900 font-medium mb-1">
                📋 Instructions:
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Take with water as directed. If symptoms persist after 3 days,
                visit the clinic. Keep this receipt for your records.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleComplete}
          className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] text-white px-12 py-4 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-bold text-lg mb-3"
        >
          <Check className="w-5 h-5" />
          Complete Session
        </button>

        <p className="text-gray-400 text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-[#4A90E2] rounded-full animate-pulse"></span>
          Auto-returning to home in {countdown} seconds
        </p>
      </div>
    </KioskLayout>
  );
}
