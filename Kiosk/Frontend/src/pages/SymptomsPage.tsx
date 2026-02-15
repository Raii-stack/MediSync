import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Activity, Check } from "lucide-react";

export function SymptomsScreen() {
  const navigate = useNavigate();
  const [painLevel, setPainLevel] = useState(5);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(["colds"]);

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
    navigate("/recommendation");
  };

  const status = getPainStatus();

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full justify-center py-6">
      {/* Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg mb-4">
          <Activity className="w-5 h-5 text-[#4A90E2]" />
          <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
            Symptom Assessment
          </span>
        </div>
        <h1 className="text-5xl font-bold text-gray-800">
          How are you feeling?
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-8 w-full">
        {/* Left Column - Pain Scale */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Pain Scale</h2>

          {/* Current Pain Display */}
          <div className="text-center mb-8 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8">
            <div
              className={`text-8xl font-bold bg-gradient-to-br ${getPainColor()} bg-clip-text text-transparent mb-2`}
            >
              {painLevel}
            </div>
            <div className="text-2xl text-gray-400 mb-3">/10</div>
            <div className={`text-xl font-semibold ${status.color}`}>
              {status.label}
            </div>
          </div>

          {/* Pain Scale Buttons */}
          <div className="grid grid-cols-5 gap-3 mb-4">
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
                  className={`aspect-square rounded-xl font-bold text-xl transition-all shadow-lg ${
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
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Select Symptoms
            </h2>
            <div className="bg-blue-50 text-[#4A90E2] px-4 py-2 rounded-full text-sm font-semibold">
              {selectedSymptoms.length} selected
            </div>
          </div>

          {/* Symptoms Grid */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {symptoms.map((symptom) => {
              const isSelected = selectedSymptoms.includes(symptom.id);
              return (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id)}
                  className={`relative py-5 px-3 rounded-2xl transition-all flex flex-col items-center gap-2 shadow-lg ${
                    isSelected
                      ? "bg-white border-3 border-[#4A90E2] scale-105 shadow-xl"
                      : "bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 hover:scale-105 hover:border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </div>
                  )}
                  <span className="text-3xl mb-1">{symptom.emoji}</span>
                  <span
                    className={`text-xs font-semibold text-center leading-tight ${isSelected ? "text-[#4A90E2]" : "text-gray-600"}`}
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
            className="w-full bg-gradient-to-r from-[#4A90E2] to-[#357ABD] hover:from-[#357ABD] hover:to-[#2868A8] disabled:from-gray-300 disabled:to-gray-400 text-white py-5 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 font-semibold text-lg disabled:cursor-not-allowed"
          >
            Get Recommendation
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SymptomsScreen;
