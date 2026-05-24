import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/sidebar";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";

function AssignInvigilator() {
  const [formData, setFormData] = useState({
    course: "",
    date: "",
    time: "",
    room: "",
    invigilator: ""
  });
  
  const [editingId, setEditingId] = useState(null); 
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [assignedInvigilators, setAssignedInvigilators] = useState([]);
  const [allInvigilators, setAllInvigilators] = useState([]); 
  const [allCourses, setAllCourses] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  
  const [loadingInvigilators, setLoadingInvigilators] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [invigilatorError, setInvigilatorError] = useState("");
  const [successToast, setSuccessToast] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const [filterInvigilator, setFilterInvigilator] = useState("");
  const [filterCourse, setFilterCourse] = useState("");

  const suggestionRef = useRef(null);
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];

  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const parsed = new Date(dateStr);
    return isNaN(parsed) ? new Date(0) : parsed;
  };

  const formatDate = (dateStr) => {
    const date = parseDate(dateStr);
    if (!dateStr || date.getTime() === 0) return dateStr;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  // Fetch Users (Name + Surname)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = snapshot.docs.map((d) => {
        const data = d.data();
        const fullName = `${data.name || ""} ${data.surname || ""}`.trim();
        return { id: d.id, name: fullName };
      });
      setAllInvigilators(users);
      setLoadingInvigilators(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Courses
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "courses"), (snapshot) => {
      const codes = snapshot.docs.map((d) => d.id).sort();
      setAllCourses(codes);
      setLoadingCourses(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Rooms
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const names = snapshot.docs.map((d) => d.id).sort();
      setAllRooms(names);
      setLoadingRooms(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync with exam_assignments
  useEffect(() => {
    const q = query(collection(db, "exam_assignments"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        invigilator: d.data().invigilatorName || ""
      }));
      setAssignedInvigilators(data);
      setLoadingAssignments(false);
    });
    return () => unsubscribe();
  }, []);

  const isValidInvigilator = (name) =>
    allInvigilators.some((u) => u.name.toLowerCase() === name.trim().toLowerCase());

  const handleAssign = async () => {
    if (!formData.course || !formData.date || !formData.time || !formData.room || !formData.invigilator) {
      alert("Please fill in all fields.");
      return;
    }

    const selectedUser = allInvigilators.find(u => u.name.toLowerCase() === formData.invigilator.toLowerCase());
    if (!selectedUser) {
      setInvigilatorError("Please select a valid user from the system.");
      return;
    }

    const payload = {
      course: formData.course,
      date: formData.date,
      time: formData.time,
      room: formData.room,
      invigilatorName: selectedUser.name,
      invigilatorId: selectedUser.id,
      invigilators: [selectedUser.name], // Crucial for Flutter 'arrayContains' query
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "exam_assignments", editingId), payload);
        triggerSuccessToast("Assignment updated successfully.");
      } else {
        await addDoc(collection(db, "exam_assignments"), {
          ...payload,
          createdAt: new Date().toISOString() // Crucial for Flutter 'orderBy'
        });
        triggerSuccessToast("Invigilator assigned successfully.");
      }
      resetForm();
    } catch (error) {
      console.error("Error saving: ", error);
      triggerErrorToast("Something went wrong. Please try again.");
    }
  };

  const resetForm = () => {
    setFormData({ course: "", date: "", time: "", room: "", invigilator: "" });
    setEditingId(null);
    setInvigilatorError("");
    setShowSuggestions(false);
  };

  const handleEdit = (item) => {
    setFormData({
      course: item.course,
      date: item.date,
      time: item.time,
      room: item.room,
      invigilator: item.invigilatorName
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // FIXED: Delete functionality
  const handleDelete = async (id) => {
    if (window.confirm("Delete this assignment?")) {
      try {
        const docRef = doc(db, "exam_assignments", id);
        await deleteDoc(docRef);
        triggerSuccessToast("Assignment removed.");
      } catch (e) {
        console.error("Delete error: ", e);
        triggerErrorToast("Failed to delete.");
      }
    }
  };

  const triggerSuccessToast = (message) => {
    setSuccessToast({ message });
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const triggerErrorToast = (message) => {
    setErrorToast({ message });
    setTimeout(() => setErrorToast(null), 5000);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "invigilator") {
      setInvigilatorError("");
      const q = value.trim().toLowerCase();
      const userNames = allInvigilators.map(u => u.name);
      setSuggestions(userNames.filter((n) => n.toLowerCase().includes(q)));
      setShowSuggestions(true);
    }
  };

  const filteredAssignments = assignedInvigilators.filter((item) => {
    if (filterInvigilator && !item.invigilator.toLowerCase().includes(filterInvigilator.toLowerCase())) return false;
    if (filterCourse && item.course !== filterCourse) return false;
    return true;
  });

  const hasActiveFilters = filterInvigilator || filterCourse;

  const isFormValid =
    formData.course && formData.date && formData.time && formData.room &&
    formData.invigilator && isValidInvigilator(formData.invigilator);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
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
                  <select name="course" value={formData.course} onChange={handleFormChange} disabled={loadingCourses} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none">
                    <option value="" disabled hidden>{loadingCourses ? "Loading..." : "Select Course"}</option>
                    {allCourses.map((code) => (<option key={code} value={code}>{code}</option>))}
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <input type="date" name="date" value={formData.date} onChange={handleFormChange} min={today} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                </td>
                <td className="p-2 border border-gray-300">
                  <input type="time" name="time" value={formData.time} onChange={handleFormChange} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none" />
                </td>
                <td className="p-2 border border-gray-300">
                  <select name="room" value={formData.room} onChange={handleFormChange} disabled={loadingRooms} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none">
                    <option value="" disabled hidden>{loadingRooms ? "Loading..." : "Select Room"}</option>
                    {allRooms.map((name) => (<option key={name} value={name}>{name}</option>))}
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
                          <button key={i} type="button" onMouseDown={() => {setFormData({...formData, invigilator: name}); setShowSuggestions(false);}}
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

          <div className="flex justify-end mt-4 gap-3">
            {editingId && (
              <button onClick={resetForm} className="px-6 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50 transition">Cancel Edit</button>
            )}
            <button onClick={handleAssign} disabled={!isFormValid}
              className={`font-semibold px-8 py-2 rounded-full shadow-md transition-all ${!isFormValid ? "bg-gray-400 text-gray-600" : "bg-teal-600 hover:bg-teal-500 text-white active:scale-95"}`}>
              {editingId ? "Update Assignment" : "Assign Invigilator"}
            </button>
          </div>

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
                        <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-700 mr-3 text-xs font-bold uppercase transition">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase transition">Delete</button>
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

      {/* Toasts */}
      {(successToast || errorToast) && (
        <div className={`fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-white shadow-xl animate-fade-in-up sm:bottom-6 sm:w-auto ${successToast ? 'bg-teal-700' : 'bg-red-600'}`}>
          <span className="text-sm font-bold uppercase tracking-wider">{successToast?.message || errorToast?.message}</span>
        </div>
      )}

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