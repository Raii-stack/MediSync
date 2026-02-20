import { useState, useEffect } from "react";
import {
  X,
  Scan,
  User,
  Hash,
  School,
  Loader2,
  CheckCircle2,
  Save,
  ArrowLeft,
  Lock,
  UserPlus,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { useSocket } from "../contexts/SocketContext";

interface Student {
  id: string;
  student_id: string;
  rfid_uid: string;
  first_name: string;
  last_name: string;
  age: number;
  grade_level: number;
  section: string;
  created_at: string;
  lastScanned?: string;
}

interface RfidTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to generate random hex byte
const randomByte = () =>
  Math.floor(Math.random() * 256)
    .toString(16)
    .toUpperCase()
    .padStart(2, "0");

// Helper to generate random RFID UID
const generateRfidUid = () =>
  `${randomByte()}:${randomByte()}:${randomByte()}:${randomByte()}`;

export function RfidTestModal({ isOpen, onClose }: RfidTestModalProps) {
  const { socket } = useSocket();
  const [students, setStudents] = useState<Student[]>([]);
  const [scannedStudentId, setScannedStudentId] = useState<string | null>(null);
  const [scannedUid, setScannedUid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationForm, setRegistrationForm] = useState<Partial<Student>>(
    {},
  );

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});

  // Load students from backend on modal open
  useEffect(() => {
    if (isOpen) {
      loadStudents();
      startTestMode();
    } else {
      setScannedStudentId(null);
      setScannedUid(null);
      setIsRegistering(false);
      setIsEditing(false);
      setIsLoading(false);
      stopTestMode();
    }
  }, [isOpen]);

  // Listen for RFID test scans via socket
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleRfidTestScan = (data: {
      student: Student | null;
      uid: string;
    }) => {
      console.log("[RFID TEST] Received scan event:", data);
      setScannedUid(data.uid);

      if (data.student) {
        // Student found - display their info
        const foundStudent = students.find((s) => s.rfid_uid === data.uid);
        if (foundStudent) {
          setScannedStudentId(foundStudent.id);
          setIsRegistering(false);
          toast.success(
            `RFID Found: ${data.student.first_name} ${data.student.last_name}`,
          );
        } else {
          // Student exists but not in local list - add it
          setStudents((prev) => [...prev, data.student]);
          setScannedStudentId(data.student.id);
          setIsRegistering(false);
          toast.success(
            `RFID Found: ${data.student.first_name} ${data.student.last_name}`,
          );
        }
      } else {
        // Unknown card - prompt for registration
        setScannedStudentId(null);
        setIsRegistering(true);
        setRegistrationForm({
          rfid_uid: data.uid,
          first_name: "",
          last_name: "",
          student_id: "",
          age: undefined,
          grade_level: undefined,
          section: "",
        });
        toast.info("Unknown RFID Tag - Please register");
      }
    };

    socket.on("rfid-test-scan", handleRfidTestScan);

    return () => {
      socket.off("rfid-test-scan", handleRfidTestScan);
    };
  }, [socket, isOpen, students]);

  const startTestMode = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/rfid-test/start`);
      if (response.data.success) {
        console.log("✅ RFID test mode enabled");
        toast.success("RFID test mode enabled");
      }
    } catch (error) {
      console.error("Failed to start test mode:", error);
      toast.error("Failed to start test mode");
    }
  };

  const stopTestMode = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/rfid-test/stop`);
      if (response.data.success) {
        console.log("✅ RFID test mode disabled");
      }
    } catch (error) {
      console.error("Failed to stop test mode:", error);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/students`);
      if (response.data.success && response.data.students) {
        setStudents(response.data.students);
      }
    } catch (error) {
      console.error("Failed to load students:", error);
      toast.error("Failed to load students from backend");
      setStudents([]);
    }
  };

  const handleTestScan = async (rfid_uid: string) => {
    setIsLoading(true);
    try {
      console.log(`🧪 Testing RFID: ${rfid_uid}`);
      const response = await axios.post(
        `${API_BASE_URL}/api/rfid-test/simulate`,
        {
          rfid_uid,
        },
      );

      if (response.data.success) {
        if (response.data.student) {
          // Found student
          const foundStudent = students.find((s) => s.rfid_uid === rfid_uid);
          if (foundStudent) {
            setScannedStudentId(foundStudent.id);
            setScannedUid(rfid_uid);
            toast.success(
              `RFID Found: ${response.data.student.first_name} ${response.data.student.last_name}`,
            );
          }
        } else {
          // Unknown card - prompt for registration
          setScannedUid(rfid_uid);
          setScannedStudentId(null);
          setIsRegistering(true);
          setRegistrationForm({
            rfid_uid,
            first_name: "",
            last_name: "",
            student_id: "",
            age: undefined,
            grade_level: undefined,
            section: "",
          });
          toast.info("Unknown RFID Tag - Please register");
        }
      }
    } catch (error) {
      console.error("Test scan error:", error);
      toast.error("Failed to test RFID");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registrationForm.rfid_uid) return;

    if (
      !registrationForm.first_name ||
      !registrationForm.last_name ||
      !registrationForm.student_id ||
      !registrationForm.age ||
      !registrationForm.grade_level ||
      !registrationForm.section
    ) {
      toast.error("Missing fields", {
        description: "Please fill in all required fields",
      });
      return;
    }

    // Check for Student ID collision
    if (students.some((s) => s.student_id === registrationForm.student_id)) {
      toast.error("Student ID already exists", {
        description: "Please use a unique School ID",
      });
      return;
    }

    try {
      // Save to backend
      const response = await axios.post(
        `${API_BASE_URL}/api/students/register`,
        {
          student_id: registrationForm.student_id,
          rfid_uid: registrationForm.rfid_uid,
          first_name: registrationForm.first_name,
          last_name: registrationForm.last_name,
          age: Number(registrationForm.age),
          grade_level: Number(registrationForm.grade_level),
          section: registrationForm.section,
        },
      );

      if (response.data.success) {
        const newStudent = response.data.student;
        setStudents((prev) => [...prev, newStudent]);
        setScannedStudentId(newStudent.id);
        setIsRegistering(false);
        toast.success("Student Registered Successfully");
      } else {
        toast.error(response.data.message || "Failed to register student");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register student");
    }
  };

  const handleEdit = () => {
    if (!scannedStudent) return;
    setIsEditing(true);
    setEditForm({
      ...scannedStudent,
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;

    if (
      !editForm.first_name ||
      !editForm.last_name ||
      !editForm.student_id ||
      !editForm.age ||
      !editForm.grade_level ||
      !editForm.section
    ) {
      toast.error("Missing fields", {
        description: "Please fill in all required fields",
      });
      return;
    }

    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/students/${editForm.id}`,
        {
          student_id: editForm.student_id,
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          age: Number(editForm.age),
          grade_level: Number(editForm.grade_level),
          section: editForm.section,
        },
      );

      if (response.data.success) {
        // Update local state
        setStudents((prev) =>
          prev.map((s) => (s.id === editForm.id ? { ...s, ...editForm } : s)),
        );
        setIsEditing(false);
        toast.success("Student updated successfully");
      } else {
        toast.error(response.data.message || "Failed to update student");
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update student");
    }
  };

  const scannedStudent = students.find((s) => s.id === scannedStudentId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] px-6 py-5 rounded-t-3xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Scan className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-2xl">
                RFID Test Console
              </h2>
              <p className="text-blue-100 text-sm">
                Monitor and test RFID reader connectivity
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
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Controls Panel */}
          <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50 flex flex-col">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Reader Status
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>
                </div>
                <span className="font-medium text-green-700">
                  Online & Ready
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Device: PN532 NFC/RFID Controller
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Port: COM3 (9600 baud)
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">
                Enter RFID UID to Test
              </label>
              <input
                type="text"
                placeholder="e.g. 12:34:56:78"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    handleTestScan(e.currentTarget.value.trim());
                    e.currentTarget.value = "";
                  }
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-blue-100 text-sm font-mono"
              />
              <p className="text-xs text-gray-500">
                Enter RFID UID and press Enter to test
              </p>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
            {/* Registration Form Overlay */}
            {isRegistering && (
              <div className="absolute inset-0 z-10 bg-white flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsRegistering(false)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-[#4A90E2]" />
                      Register New Student
                    </h3>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="space-y-4 max-w-lg mx-auto">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                      <div className="bg-yellow-100 p-2 rounded-lg">
                        <Scan className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-yellow-800 text-sm">
                          New RFID Tag Detected
                        </h4>
                        <p className="text-yellow-700 text-xs mt-1">
                          This tag is not associated with any student. Please
                          enter student details to register.
                        </p>
                        <p className="font-mono text-xs bg-white/50 inline-block px-2 py-1 rounded mt-2 border border-yellow-200 text-yellow-800">
                          UID: {registrationForm.rfid_uid}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={registrationForm.first_name || ""}
                          onChange={(e) =>
                            setRegistrationForm({
                              ...registrationForm,
                              first_name: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-blue-100"
                          placeholder="e.g. John"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={registrationForm.last_name || ""}
                          onChange={(e) =>
                            setRegistrationForm({
                              ...registrationForm,
                              last_name: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-blue-100"
                          placeholder="e.g. Doe"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Student ID (School ID)
                        </label>
                        <input
                          type="text"
                          value={registrationForm.student_id || ""}
                          onChange={(e) =>
                            setRegistrationForm({
                              ...registrationForm,
                              student_id: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-blue-100"
                          placeholder="e.g. 2024-001"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          RFID UID{" "}
                          <span className="text-gray-400 font-normal ml-1">
                            (Detected from Reader)
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={registrationForm.rfid_uid || ""}
                            readOnly
                            disabled
                            className="w-full p-3 pl-10 border border-gray-200 bg-gray-50 text-gray-500 rounded-xl focus:outline-none font-mono cursor-not-allowed"
                          />
                          <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Age
                        </label>
                        <input
                          type="number"
                          value={registrationForm.age || ""}
                          onChange={(e) =>
                            setRegistrationForm({
                              ...registrationForm,
                              age: parseInt(e.target.value) || undefined,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-blue-100"
                          placeholder="e.g. 15"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Grade Level
                        </label>
                        <input
                          type="number"
                          value={registrationForm.grade_level || ""}
                          onChange={(e) =>
                            setRegistrationForm({
                              ...registrationForm,
                              grade_level:
                                parseInt(e.target.value) || undefined,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-blue-100"
                          placeholder="e.g. 10"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Section
                        </label>
                        <input
                          type="text"
                          value={registrationForm.section || ""}
                          onChange={(e) =>
                            setRegistrationForm({
                              ...registrationForm,
                              section: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-blue-100"
                          placeholder="e.g. A"
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={handleRegister}
                        className="flex-1 bg-[#4A90E2] text-white py-3 rounded-xl font-semibold hover:bg-[#357ABD] transition-colors flex items-center justify-center gap-2"
                      >
                        <Save className="w-5 h-5" />
                        Register Student
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scan Result View */}
            {!isRegistering && (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Scan className="w-5 h-5 text-[#4A90E2]" />
                    Scan Result
                  </h3>
                  {scannedStudentId && (
                    <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-1 rounded">
                      {new Date().toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <div className="flex-1 p-8 flex items-center justify-center bg-gray-50/30">
                  {isRegistering ? (
                    // Registration form overlay
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full animate-in zoom-in-95 duration-300">
                      <h2 className="text-xl font-bold text-gray-800 mb-6">
                        Register New Student
                      </h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            RFID UID
                          </label>
                          <input
                            type="text"
                            value={registrationForm.rfid_uid}
                            disabled
                            className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-600 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            First Name
                          </label>
                          <input
                            type="text"
                            value={registrationForm.first_name}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                first_name: e.target.value,
                              })
                            }
                            placeholder="Enter first name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={registrationForm.last_name}
                            onChange={(e) =>
                              setRegistrationForm({
                                ...registrationForm,
                                last_name: e.target.value,
                              })
                            }
                            placeholder="Enter last name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Student ID
                            </label>
                            <input
                              type="text"
                              value={registrationForm.student_id}
                              onChange={(e) =>
                                setRegistrationForm({
                                  ...registrationForm,
                                  student_id: e.target.value,
                                })
                              }
                              placeholder="ID"
                              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Grade
                            </label>
                            <input
                              type="number"
                              value={registrationForm.grade_level}
                              onChange={(e) =>
                                setRegistrationForm({
                                  ...registrationForm,
                                  grade_level: parseInt(e.target.value) || 0,
                                })
                              }
                              placeholder="Grade"
                              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Section
                            </label>
                            <input
                              type="text"
                              value={registrationForm.section}
                              onChange={(e) =>
                                setRegistrationForm({
                                  ...registrationForm,
                                  section: e.target.value,
                                })
                              }
                              placeholder="Section"
                              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Age
                            </label>
                            <input
                              type="number"
                              value={registrationForm.age}
                              onChange={(e) =>
                                setRegistrationForm({
                                  ...registrationForm,
                                  age: parseInt(e.target.value) || 0,
                                })
                              }
                              placeholder="Age"
                              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={() => {
                            setIsRegistering(false);
                            setScannedUid("");
                            setRegistrationForm({
                              rfid_uid: "",
                              first_name: "",
                              last_name: "",
                              student_id: "",
                              grade_level: 0,
                              section: "",
                              age: 0,
                            });
                          }}
                          className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-xl font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleRegister}
                          disabled={isLoading}
                          className="flex-1 px-4 py-2 bg-[#4A90E2] hover:bg-[#357ABD] disabled:bg-gray-400 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Registering...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Register
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : scannedStudent ? (
                    isEditing ? (
                      // Edit student form
                      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full animate-in zoom-in-95 duration-300">
                        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                          <Edit className="w-5 h-5 text-[#4A90E2]" />
                          Edit Student Info
                        </h2>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                First Name
                              </label>
                              <input
                                type="text"
                                value={editForm.first_name || ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    first_name: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Last Name
                              </label>
                              <input
                                type="text"
                                value={editForm.last_name || ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    last_name: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Student ID
                            </label>
                            <input
                              type="text"
                              value={editForm.student_id || ""}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  student_id: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              RFID UID{" "}
                              <span className="text-gray-400 font-normal">
                                (Read-only)
                              </span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={editForm.rfid_uid || ""}
                                readOnly
                                disabled
                                className="w-full px-4 py-2 pl-10 border border-gray-200 bg-gray-50 text-gray-500 rounded-xl font-mono cursor-not-allowed"
                              />
                              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Age
                              </label>
                              <input
                                type="number"
                                value={editForm.age || ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    age: parseInt(e.target.value) || undefined,
                                  })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Grade
                              </label>
                              <input
                                type="number"
                                value={editForm.grade_level || ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    grade_level:
                                      parseInt(e.target.value) || undefined,
                                  })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Section
                              </label>
                              <input
                                type="text"
                                value={editForm.section || ""}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    section: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-xl font-semibold transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-[#4A90E2] hover:bg-[#357ABD] disabled:bg-gray-400 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Save Changes
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Scanned student display
                      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-20 h-20 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {scannedStudent.first_name.charAt(0)}
                            {scannedStudent.last_name.charAt(0)}
                          </div>
                          <button
                            onClick={handleEdit}
                            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#4A90E2] rounded-xl font-semibold transition-colors flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-1">
                          {scannedStudent.first_name}{" "}
                          {scannedStudent.last_name}
                        </h2>
                        <p className="text-gray-500 mb-6 flex items-center gap-2">
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-sm font-mono">
                            ID: {scannedStudent.student_id}
                          </span>
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                              Details
                            </p>
                            <p className="font-semibold text-gray-800 flex items-center gap-2">
                              <School className="w-4 h-4 text-[#4A90E2]" />
                              Grade {scannedStudent.grade_level} -{" "}
                              {scannedStudent.section}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                              Age
                            </p>
                            <p className="font-semibold text-gray-800 flex items-center gap-2">
                              <User className="w-4 h-4 text-[#4A90E2]" />
                              {scannedStudent.age} years old
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                              RFID UID
                            </p>
                            <p className="font-semibold text-gray-800 flex items-center gap-2 font-mono text-sm">
                              <Hash className="w-4 h-4 text-[#4A90E2]" />
                              {scannedStudent.rfid_uid}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-3 rounded-xl border border-green-100">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">Identity Verified</span>
                        </div>
                      </div>
                    )
                  ) : (
                    // Empty state - ready to scan
                    <div className="text-center text-gray-600 flex flex-col items-center justify-center">
                      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <Scan className="w-10 h-10 text-gray-300" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        Ready to Scan
                      </h3>
                      <p className="text-sm text-gray-500 mb-6">
                        Scan an RFID card or enter its UID using the input field
                        on the left
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-sm text-left">
                        <p className="text-xs text-blue-900 font-semibold mb-2">
                          How to test:
                        </p>
                        <ul className="text-xs text-blue-800 space-y-1">
                          <li>• Enter RFID UID in the left input field</li>
                          <li>• Press Enter to test the scan</li>
                          <li>• Student info will appear here if registered</li>
                          <li>• Or register a new student</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
