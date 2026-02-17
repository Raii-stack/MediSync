export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  description: string;
  type: string;
}

export const approvedMedicines: Medicine[] = [
  {
    id: "biogesic-500mg",
    name: "Biogesic",
    dosage: "500mg",
    description: "For fever and pain relief",
    type: "tablet",
  },
  {
    id: "neozep-forte",
    name: "Neozep Forte",
    dosage: "500mg",
    description: "For colds and flu symptoms",
    type: "tablet",
  },
  {
    id: "buscopan-10mg",
    name: "Buscopan",
    dosage: "10mg",
    description: "For stomach cramps and abdominal pain",
    type: "tablet",
  },
  {
    id: "cetirizine-10mg",
    name: "Cetirizine",
    dosage: "10mg",
    description: "For allergies and allergic rhinitis",
    type: "tablet",
  },
  {
    id: "bioflu",
    name: "Bioflu",
    dosage: "500mg",
    description: "For flu, fever, body aches, and colds",
    type: "tablet",
  },
  {
    id: "mefenamic-acid-500mg",
    name: "Mefenamic Acid",
    dosage: "500mg",
    description: "For pain relief and dysmenorrhea",
    type: "tablet",
  },
  {
    id: "loperamide-2mg",
    name: "Loperamide",
    dosage: "2mg",
    description: "For diarrhea relief",
    type: "tablet",
  },
  {
    id: "antacid",
    name: "Antacid",
    dosage: "500mg",
    description: "For heartburn and acid reflux",
    type: "tablet",
  },
  {
    id: "ibuprofen-200mg",
    name: "Ibuprofen",
    dosage: "200mg",
    description: "For pain, fever, and inflammation",
    type: "tablet",
  },
  {
    id: "amoxicillin-500mg",
    name: "Amoxicillin",
    dosage: "500mg",
    description: "Antibiotic for bacterial infections",
    type: "tablet",
  },
  {
    id: "carbocisteine-500mg",
    name: "Carbocisteine",
    dosage: "500mg",
    description: "For phlegm and mucus relief",
    type: "tablet",
  },
  {
    id: "ascorbic-acid-500mg",
    name: "Ascorbic Acid",
    dosage: "500mg",
    description: "Vitamin C supplement",
    type: "tablet",
  },
  {
    id: "oral-rehydration-salts",
    name: "Oral Rehydration Salts",
    dosage: "1 sachet",
    description: "For dehydration treatment",
    type: "powder",
  },
  {
    id: "dolo-650mg",
    name: "Dolo",
    dosage: "650mg",
    description: "For fever and mild to moderate pain",
    type: "tablet",
  },
  {
    id: "tempra-500mg",
    name: "Tempra",
    dosage: "500mg",
    description: "Paracetamol for fever and pain",
    type: "tablet",
  },
];
