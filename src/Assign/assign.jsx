import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import Sidebar from "../components/sidebar";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "firebase/firestore";

const TOAST_DURATION = 4000;
const UNDO_DURATION  = 5000;

// ── Reusable Toast ────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    setProgress(100);
    const step = 100 / (toast.duration / 50);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) { clearInterval(intervalRef.current); return 0; }
        return next;
      });
    }, 50);
    return () => clearInterval(intervalRef.current);
  }, [toast]);

  if (!toast) return null;

  // Every toast shade is teal — darker for errors/warnings so they still feel distinct
  const bgColors = {
    success: "bg-teal-600",
    error:   "bg-teal-800",
    info:    "bg-teal-500",
    warning: "bg-teal-700",
  };

  const icons = {
    success: (
      // Checkmark
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      // X circle
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M12 3a9 9 0 100 18A9 9 0 0012 3z" />
      </svg>
    ),
    info: (
      // Info circle
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
      </svg>
    ),
    warning: (
      // Exclamation triangle
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm sm:bottom-6 animate-fade-in-up">
      <div className={`rounded-xl ${bgColors[toast.type]} text-white shadow-xl overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            {icons[toast.type]}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
          {toast.onUndo ? (
            <button
              onClick={toast.onUndo}
              className="shrink-0 rounded-full bg-white px-4 py-1 text-sm font-bold text-teal-700 hover:bg-teal-50 transition active:scale-95"
            >
              Undo
            </button>
          ) : (
            <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition ml-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Progress bar */}
        <div className="h-1 w-full bg-white/20">
          <div className="h-1 bg-white/60 transition-none" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function AssignInvigilator() {
  const [formData, setFormData] = useState({
    course: "",
    date: "",
    time: "",
    room: "",
    invigilator: ""
  });

  const [editingId, setEditingId]           = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [assignedInvigilators, setAssignedInvigilators] = useState([]);
  const [allInvigilators, setAllInvigilators] = useState([]);
  const [allCourses, setAllCourses]         = useState([]);
  const [allRooms, setAllRooms]             = useState([]);

  const [loadingInvigilators, setLoadingInvigilators] = useState(true);
  const [loadingCourses, setLoadingCourses]   = useState(true);
  const [loadingRooms, setLoadingRooms]       = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [suggestions, setSuggestions]       = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [invigilatorError, setInvigilatorError] = useState("");

  const [activeToast, setActiveToast]       = useState(null);
  const toastTimerRef                       = useRef(null);

  const [deletedIds, setDeletedIds]         = useState(new Set());
  const undoTimerRef                        = useRef(null);

  const [filterInvigilator]                 = useState("");
  const [filterCourse]                      = useState("");

  const navigate = useNavigate();
  const today    = new Date().toISOString().split("T")[0];

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const parsed = new Date(dateStr);
    return isNaN(parsed) ? new Date(0) : parsed;
  };

  const formatDate = (dateStr) => {
    const date = parseDate(dateStr);
    if (!dateStr || date.getTime() === 0) return dateStr;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const getAssignmentSortTime = (item) => {
    const sortDate = item.createdAt || item.updatedAt || item.date;
    return parseDate(sortDate).getTime();
  };

  // ── Toast helper ──────────────────────────────────────────────────────────────
  const showToast = (type, message, extra = {}) => {
    clearTimeout(toastTimerRef.current);
    const duration = extra.duration || TOAST_DURATION;
    setActiveToast({ type, message, duration, ...extra });
    if (!extra.onUndo) {
      toastTimerRef.current = setTimeout(() => setActiveToast(null), duration);
    }
  };

  // ── Firestore listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setAllInvigilators(snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, name: `${data.name || ""} ${data.surname || ""}`.trim() };
      }));
      setLoadingInvigilators(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "courses"), (snap) => {
      setAllCourses(snap.docs.map((d) => d.id).sort());
      setLoadingCourses(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rooms"), (snap) => {
      setAllRooms(snap.docs.map((d) => d.id).sort());
      setLoadingRooms(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "exam_assignments"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data(), invigilator: d.data().invigilatorName || "" }))
        .sort((a, b) => getAssignmentSortTime(b) - getAssignmentSortTime(a));
      setAssignedInvigilators(data);
      setLoadingAssignments(false);
    });
    return () => unsub();
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────────
  const isValidInvigilator = (name) =>
    allInvigilators.some((u) => u.name.toLowerCase() === name.trim().toLowerCase());

  const isFormValid =
    formData.course && formData.date && formData.time && formData.room &&
    formData.invigilator && isValidInvigilator(formData.invigilator);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === "invigilator") {
      setInvigilatorError("");
      const q = value.trim().toLowerCase();
      setSuggestions(allInvigilators.map((u) => u.name).filter((n) => n.toLowerCase().includes(q)));
      setShowSuggestions(true);
    }
  };

  const resetForm = () => {
    setFormData({ course: "", date: "", time: "", room: "", invigilator: "" });
    setEditingId(null);
    setInvigilatorError("");
    setShowSuggestions(false);
  };

  // ── Assign / Update ───────────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!formData.course || !formData.date || !formData.time || !formData.room || !formData.invigilator) {
      showToast("warning", "Please fill in all fields before assigning.");
      return;
    }
    const selectedUser = allInvigilators.find(
      (u) => u.name.toLowerCase() === formData.invigilator.toLowerCase()
    );
    if (!selectedUser) {
      setInvigilatorError("Please select a valid user from the system.");
      showToast("warning", "Select a valid invigilator from the suggestions.");
      return;
    }

    const payload = {
      course: formData.course,
      date: formData.date,
      time: formData.time,
      room: formData.room,
      invigilatorName: selectedUser.name,
      invigilatorId: selectedUser.id,
      invigilators: [selectedUser.name],
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "exam_assignments", editingId), payload);
        showToast("success", `Assignment for "${formData.course}" updated successfully.`);
      } else {
        await addDoc(collection(db, "exam_assignments"), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        showToast("success", `${selectedUser.name} assigned to "${formData.course}".`);
      }
      resetForm();
    } catch (error) {
      console.error("Error saving:", error);
      showToast("error", "Something went wrong. Please try again.");
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const handleEdit = (item) => {
    setFormData({
      course: item.course,
      date: item.date,
      time: item.time,
      room: item.room,
      invigilator: item.invigilatorName
    });
    setEditingId(item.id);
    showToast("info", `Editing "${item.course}". Update fields above and click Save.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    resetForm();
    showToast("info", "Edit cancelled. Form has been cleared.");
  };

  // ── Delete with Undo ──────────────────────────────────────────────────────────
  const commitDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "exam_assignments", id));
    } catch (e) {
      console.error("Delete error:", e);
      showToast("error", "Failed to delete assignment. Please try again.");
    }
    setDeletedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleDelete = (item) => {
    // Flush any previous pending delete immediately
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      if (activeToast?.pendingDeleteId) commitDelete(activeToast.pendingDeleteId);
    }

    setDeletedIds((prev) => new Set(prev).add(item.id));

    undoTimerRef.current = setTimeout(() => {
      commitDelete(item.id);
      setActiveToast(null);
    }, UNDO_DURATION);

    showToast("success", `Assignment for "${item.course}" removed.`, {
      duration: UNDO_DURATION,
      pendingDeleteId: item.id,
      onUndo: () => {
        clearTimeout(undoTimerRef.current);
        setDeletedIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
        setActiveToast(null);
        showToast("info", `Deletion of "${item.course}" has been undone.`);
      }
    });
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filteredAssignments = assignedInvigilators.filter((item) => {
    if (deletedIds.has(item.id)) return false;
    if (filterInvigilator && !item.invigilator.toLowerCase().includes(filterInvigilator.toLowerCase())) return false;
    if (filterCourse && item.course !== filterCourse) return false;
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gray-100 sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">

        {/* Header */}
        <div className="relative mb-4 flex items-center justify-between rounded-lg bg-teal-500 px-4 py-3 text-white">
          <span className="font-bold">Assign Exam Invigilator</span>
          <button type="button" onClick={() => setShowProfileMenu(!showProfileMenu)} className="rounded-full p-2 hover:bg-teal-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </button>
          {showProfileMenu && (
            <div className="absolute right-4 top-full z-40 mt-2 h-11 w-20 rounded-xl bg-teal-100 text-left shadow-lg ring-1 ring-black ring-opacity-5">
              <button type="button" onClick={() => { setShowProfileMenu(false); navigate("/"); }}
                className="w-full px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 transition-colors rounded-lg">
                Logout
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-4 shadow-md md:p-6">

          {/* Form table */}
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border border-gray-300">
              <thead>
                <tr className="bg-teal-600 text-white text-sm">
                  <th className="p-3 text-left border border-gray-300 whitespace-nowrap">COURSE</th>
                  <th className="p-3 text-left border border-gray-300 whitespace-nowrap">DATE</th>
                  <th className="p-3 text-left border border-gray-300 whitespace-nowrap">TIME</th>
                  <th className="p-3 text-left border border-gray-300 whitespace-nowrap">VENUE</th>
                  <th className="p-3 text-left border border-gray-300 whitespace-nowrap">INVIGILATOR</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="p-2 border border-gray-300">
                    <select name="course" value={formData.course} onChange={handleFormChange} disabled={loadingCourses}
                      className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none">
                      <option value="" disabled hidden>{loadingCourses ? "Loading..." : "Select Course"}</option>
                      {allCourses.map((code) => <option key={code} value={code}>{code}</option>)}
                    </select>
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input type="date" name="date" value={formData.date} onChange={handleFormChange} min={today}
                      className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input type="time" name="time" value={formData.time} onChange={handleFormChange}
                      className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <select name="room" value={formData.room} onChange={handleFormChange} disabled={loadingRooms}
                      className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none">
                      <option value="" disabled hidden>{loadingRooms ? "Loading..." : "Select Room"}</option>
                      {allRooms.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </td>
                  <td className="p-2 border border-gray-300">
                    <div className="relative">
                      <input
                        type="text"
                        name="invigilator"
                        value={formData.invigilator}
                        onChange={handleFormChange}
                        onFocus={() => setShowSuggestions(true)}
                        className={`w-full px-2 py-1 text-sm border rounded ${invigilatorError ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                        placeholder="Search name..."
                        autoComplete="off"
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full min-w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                          {suggestions.map((name, i) => (
                            <button key={i} type="button"
                              onMouseDown={() => { setFormData({ ...formData, invigilator: name }); setShowSuggestions(false); }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2">
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Buttons */}
          <div className="flex justify-end mt-4 gap-3">
            {editingId && (
              <button onClick={handleCancelEdit}
                className="px-6 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50 transition">
                Cancel Edit
              </button>
            )}
            <button onClick={handleAssign} disabled={!isFormValid}
              className={`font-semibold px-8 py-2 rounded-full shadow-md transition-all ${!isFormValid ? "bg-gray-400 text-gray-600" : "bg-teal-600 hover:bg-teal-500 text-white active:scale-95"}`}>
              {editingId ? "Update Assignment" : "Assign Invigilator"}
            </button>
          </div>

          {/* History */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-teal-700 mb-4 border-b pb-2">Assignments History</h3>
            {loadingAssignments ? (
              <p className="text-gray-400 text-sm">Loading tasks...</p>
            ) : assignedInvigilators.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border border-gray-300">
                  <thead>
                    <tr className="bg-teal-600 text-white text-sm">
                      <th className="p-3 text-left border border-gray-300">COURSE</th>
                      <th className="p-3 text-left border border-gray-300">DATE</th>
                      <th className="p-3 text-left border border-gray-300">TIME</th>
                      <th className="p-3 text-left border border-gray-300">VENUE</th>
                      <th className="p-3 text-left border border-gray-300">INVIGILATOR</th>
                      <th className="p-3 text-center border border-gray-300">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50 text-sm"}>
                        <td className="p-2 border border-gray-300 font-medium">{item.course}</td>
                        <td className="p-2 border border-gray-300">{formatDate(item.date)}</td>
                        <td className="p-2 border border-gray-300">{item.time}</td>
                        <td className="p-2 border border-gray-300">{item.room}</td>
                        <td className="p-2 border border-gray-300 font-semibold text-teal-700">{item.invigilatorName}</td>
                        <td className="p-2 border border-gray-300 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => handleEdit(item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-teal-500 transition hover:bg-teal-50 hover:text-teal-700"
                              aria-label="Edit" title="Edit">
                              <FiEdit2 className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 hover:text-red-700"
                              aria-label="Delete" title="Delete">
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No tasks assigned in the system.</p>
            )}
          </div>
        </div>
      </main>

      {/* Unified Teal Toast */}
      <Toast toast={activeToast} onClose={() => setActiveToast(null)} />

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}

export default AssignInvigilator;