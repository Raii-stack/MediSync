import { useState } from "react";
import { useNavigate } from "react-router";
import { KioskLayout } from "../components/KioskLayout";
import { ArrowRight, Activity, Check } from "lucide-react";
import { useKiosk } from "../contexts/KioskContext";

export function SymptomsScreen() {
  const navigate = useNavigate();
  const { setSelectedSymptoms: saveSymptoms, setPainLevel: savePainLevel } =
    useKiosk();
  const [painLevel, setPainLevel] = useState(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const symptoms = [
    {
      id: "fever",
      label: "Fever",
      emoji: "🤒",
      color: "from-red-500 to-orange-500",
    },
    {
      id: "headache",
      label: "Headache",
      emoji: "🤕",
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "colds",
      label: "Colds",
      emoji: "🤧",
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "abdominal",
      label: "Abdominal Pain",
      emoji: "😷",
      color: "from-orange-500 to-yellow-500",
    },
    {
      id: "dysmenorrhea",
      label: "Dysmenorrhea",
      emoji: "🩺",
      color: "from-pink-500 to-rose-500",
    },
    {
      id: "dehydration",
      label: "Dehydration",
      emoji: "💧",
      color: "from-cyan-500 to-blue-500",
    },
    {
      id: "vomiting",
      label: "Vomiting",
      emoji: "🤮",
      color: "from-green-500 to-emerald-500",
    },
    {
      id: "diarrhea",
      label: "Diarrhea",
      emoji: "🚽",
      color: "from-amber-500 to-orange-500",
    },
  ];

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const getPainColor = () => {
    if (painLevel <= 3) return "from-green-500 to-emerald-600";
    if (painLevel <= 6) return "from-yellow-500 to-orange-500";
    return "from-orange-500 to-red-600";
  };

  const getPainStatus = () => {
    if (painLevel <= 3) return { label: "Mild", color: "text-green-600" };
    if (painLevel <= 6) return { label: "Moderate", color: "text-yellow-600" };
    return { label: "Severe", color: "text-red-600" };
  };

  const handleGetRecommendation = () => {
    saveSymptoms(selectedSymptoms);
    savePainLevel(painLevel);
    navigate("/recommendation");
  };

  const status = getPainStatus();

  return (
    <KioskLayout>
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full justify-center py-4 mt-15">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-lg mb-3">
            <Activity className="w-4 h-4 text-[#4A90E2]" />
            <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Symptom Assessment
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800">
            How are you feeling?
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-6 w-full flex-1 h-full min-h-0">
          {/* Left Column - Pain Scale */}
          <div className="bg-white rounded-3xl shadow-xl p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Pain Scale</h2>

            {/* Current Pain Display */}
            <div className="text-center mb-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6">
              <div
                className={`text-7xl font-bold bg-gradient-to-br ${getPainColor()} bg-clip-text text-transparent mb-1`}
              >
                {painLevel}
              </div>
              <div className="text-xl text-gray-400 mb-2">/10</div>
              <div className={`text-lg font-semibold ${status.color}`}>
                {status.label}
              </div>
            </div>

            {/* Pain Scale Buttons */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isSelected = painLevel === num;
                let colorClass = "bg-white hover:bg-gray-50";

                if (isSelected) {
                  if (num <= 3)
                    colorClass =
                      "bg-gradient-to-br from-green-500 to-emerald-600";
                  else if (num <= 6)
                    colorClass =
                      "bg-gradient-to-br from-yellow-500 to-orange-500";
                  else
                    colorClass = "bg-gradient-to-br from-orange-500 to-red-600";
                }

                return (
                  <button
                    key={num}
                    onClick={() => setPainLevel(num)}
                    className={`aspect-square rounded-xl font-bold text-lg transition-all shadow-lg ${
                      isSelected
                        ? `${colorClass} text-white scale-110 shadow-2xl`
                        : "bg-white text-gray-700 hover:scale-105"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            {/* Pain Scale Legend */}
            <div className="flex items-center justify-between text-xs text-gray-500 px-2">
              <span>😊 Mild</span>
              <span>😐 Moderate</span>
              <span>😰 Severe</span>
            </div>
          </div>

          {/* Right Column - Symptoms */}
          <div className="bg-white rounded-3xl shadow-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Select Symptoms
              </h2>
              <div className="bg-blue-50 text-[#4A90E2] px-3 py-1 rounded-full text-xs font-semibold">
                {selectedSymptoms.length} selected
              </div>
            </div>

            {/* Symptoms Grid */}
            <div className="grid grid-cols-4 gap-x-3 gap-y-3 mb-4">
              {symptoms.map((symptom) => {
                const isSelected = selectedSymptoms.includes(symptom.id);
                return (
                  <button
                    key={symptom.id}
                    onClick={() => toggleSymptom(symptom.id)}
                    className={`aspect-square relative rounded-xl transition-all flex flex-col items-center justify-center gap-1 shadow-lg ${
                      isSelected
                        ? "bg-white border-3 border-[#4A90E2] scale-105 shadow-xl"
                        : "bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 hover:scale-105 hover:border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                    <span className="text-5xl">{symptom.emoji}</span>
                    <span
                      className={`text-sm font-semibold text-center align-middle leading-tight px-1 py-2 ${isSelected ? "text-[#4A90E2]" : "text-gray-600"}`}
                    >
                      {symptom.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Get Recommendation Button */}
            <button
              onClick={handleGetRecommendation}
              disabled={selectedSymptoms.length === 0}
              className="w-full bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] disabled:from-gray-300 disabled:to-gray-400 text-white py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 font-semibold text-base disabled:cursor-not-allowed"
            >
              Get Recommendation
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </KioskLayout>
  );
}
