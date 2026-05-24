import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/sidebar";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot
} from "firebase/firestore";

function AssignInvigilator() {
  const [formData, setFormData] = useState({
    course: "",
    date: "",
    time: "",
    room: "",
    invigilator: ""
  });
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
  const successToastTimerRef = useRef(null);
  const errorToastTimerRef = useRef(null);
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

  // Pull all users from the "users" collection — only these people can be assigned
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const names = snapshot.docs.map((d) => {
        const data = d.data();
        return `${data.firstName} ${data.surname}`.trim();
      });
      setAllInvigilators(names);
      setLoadingInvigilators(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoadingInvigilators(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "courses"), (snapshot) => {
      const codes = snapshot.docs.map((d) => d.id).sort();
      setAllCourses(codes);
      setLoadingCourses(false);
    }, (error) => {
      console.error("Error fetching courses:", error);
      setLoadingCourses(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const names = snapshot.docs.map((d) => d.id).sort();
      setAllRooms(names);
      setLoadingRooms(false);
    }, (error) => {
      console.error("Error fetching rooms:", error);
      setLoadingRooms(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to exam assignments in real time, newest dates first
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "exam_assignments"), (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const docData = d.data();
        return {
          id: d.id,
          course: docData.course,
          date: docData.date,
          time: docData.time,
          room: docData.room,
          invigilator: docData.invigilatorName || docData.invigilator || ""
        };
      });
      data.sort((a, b) => parseDate(b.date) - parseDate(a.date));
      setAssignedInvigilators(data);
      setLoadingAssignments(false);
    }, (error) => {
      console.error("exam_assignments snapshot error:", error);
      setLoadingAssignments(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(successToastTimerRef.current);
      clearTimeout(errorToastTimerRef.current);
    };
  }, []);

  // Only allow names that exactly match someone in the users collection
  const isValidInvigilator = (name) =>
    allInvigilators.some(
      (n) => n.toLowerCase() === name.trim().toLowerCase()
    );

  const filteredAssignments = assignedInvigilators.filter((item) => {
    if (filterInvigilator && !item.invigilator.toLowerCase().includes(filterInvigilator.toLowerCase())) return false;
    if (filterCourse && item.course !== filterCourse) return false;
    return true;
  });

  const hasActiveFilters = filterInvigilator || filterCourse;

  const clearFilters = () => {
    setFilterInvigilator("");
    setFilterCourse("");
  };

  const recentInvigilators = [
    ...new Map(
      [...assignedInvigilators].reverse().map((a) => [a.invigilator, a.invigilator])
    ).values(),
  ].slice(0, 5);

  const triggerSuccessToast = (message) => {
    if (successToastTimerRef.current) clearTimeout(successToastTimerRef.current);
    setSuccessToast({ message });
    successToastTimerRef.current = setTimeout(() => setSuccessToast(null), 4000);
  };

  const triggerErrorToast = (message) => {
    if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current);
    setErrorToast({ message });
    errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 5000);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "invigilator") {
      setInvigilatorError("");
      const q = value.trim().toLowerCase();
      if (q === "") {
        setSuggestions(recentInvigilators.length > 0 ? recentInvigilators : allInvigilators.slice(0, 5));
      } else {
        setSuggestions(allInvigilators.filter((n) => n.toLowerCase().includes(q)));
      }
      setShowSuggestions(true);
    }
  };

  const handleInvigilatorBlur = () => {
    if (!formData.invigilator.trim()) {
      setInvigilatorError("");
      return;
    }
    if (!isValidInvigilator(formData.invigilator)) {
      setInvigilatorError("This person is not in the system. Please select a valid user.");
    } else {
      setInvigilatorError("");
    }
  };

  const handleInvigilatorFocus = () => {
    const q = formData.invigilator.trim().toLowerCase();
    if (q === "") {
      setSuggestions(recentInvigilators.length > 0 ? recentInvigilators : allInvigilators.slice(0, 5));
    } else {
      setSuggestions(allInvigilators.filter((n) => n.toLowerCase().includes(q)));
    }
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (name) => {
    setFormData({ ...formData, invigilator: name });
    setInvigilatorError("");
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAssign = async () => {
    if (!formData.course || !formData.date || !formData.time || !formData.room || !formData.invigilator) {
      alert("Please fill in all fields before assigning.");
      return;
    }

    // Block if the typed name isn't a real user
    if (!isValidInvigilator(formData.invigilator)) {
      setInvigilatorError("This person is not in the system. Please select a valid user.");
      return;
    }

    const invigilatorBusy = assignedInvigilators.find(
      (a) =>
        a.invigilator.toLowerCase() === formData.invigilator.toLowerCase() &&
        a.date === formData.date &&
        a.time === formData.time
    );
    if (invigilatorBusy) {
      triggerErrorToast(`${formData.invigilator} is already assigned to ${invigilatorBusy.course} at ${invigilatorBusy.time} on ${invigilatorBusy.date}.`);
      return;
    }

    const exactDuplicate = assignedInvigilators.find(
      (a) =>
        a.invigilator.toLowerCase() === formData.invigilator.toLowerCase() &&
        a.course === formData.course &&
        a.date === formData.date
    );
    if (exactDuplicate) {
      triggerErrorToast(`${formData.invigilator} is already assigned to ${formData.course} on ${formData.date}.`);
      return;
    }

    try {
      await addDoc(collection(db, "exam_assignments"), {
        course: formData.course,
        date: formData.date,
        time: formData.time,
        room: formData.room,
        invigilatorName: formData.invigilator
      });
      setFormData({ course: "", date: "", time: "", room: "", invigilator: "" });
      setInvigilatorError("");
      setShowSuggestions(false);
      triggerSuccessToast(`${formData.invigilator} assigned to ${formData.course} successfully.`);
    } catch (error) {
      console.error("Error saving assignment:", error);
      triggerErrorToast("Something went wrong. Please try again.");
    }
  };

  const isFormValid =
    formData.course &&
    formData.date &&
    formData.time &&
    formData.room &&
    formData.invigilator &&
    isValidInvigilator(formData.invigilator);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="relative mb-4 flex items-center justify-between rounded-lg bg-teal-500 px-4 py-3 text-white">
          <span>Assign Invigilator</span>
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
                  <select name="course" value={formData.course} onChange={handleFormChange} disabled={loadingCourses} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100">
                    <option value="" disabled hidden>{loadingCourses ? "Loading..." : "Select Course"}</option>
                    {allCourses.map((code) => (<option key={code} value={code}>{code}</option>))}
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <input type="date" name="date" value={formData.date} onChange={handleFormChange} min={today} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
                </td>
                <td className="p-2 border border-gray-300">
                  <input type="time" name="time" value={formData.time} onChange={handleFormChange} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
                </td>
                <td className="p-2 border border-gray-300">
                  <select name="room" value={formData.room} onChange={handleFormChange} disabled={loadingRooms} className="w-full px-2 py-1 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100">
                    <option value="" disabled hidden>{loadingRooms ? "Loading..." : "Select Room"}</option>
                    {allRooms.map((name) => (<option key={name} value={name}>{name}</option>))}
                  </select>
                </td>

                <td className="p-2 border border-gray-300">
                  <div className="relative" ref={suggestionRef}>
                    <input
                      type="text"
                      name="invigilator"
                      value={formData.invigilator}
                      onChange={handleFormChange}
                      onFocus={handleInvigilatorFocus}
                      onBlur={handleInvigilatorBlur}
                      className={`w-full px-2 py-1 text-sm border rounded transition-colors ${
                        invigilatorError ? "border-red-400 bg-red-50" : "border-gray-200"
                      }`}
                      placeholder={loadingInvigilators ? "Loading..." : allInvigilators.length === 0 ? "No users found" : "Search name..."}
                      autoComplete="off"
                      disabled={loadingInvigilators}
                    />

                    {invigilatorError && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        {invigilatorError}
                      </p>
                    )}

                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full min-w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {formData.invigilator.trim() === "" && recentInvigilators.length > 0 && (
                          <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">Recent</div>
                        )}
                        {suggestions.map((name, i) => (
                          <button key={i} type="button" onMouseDown={() => handleSelectSuggestion(name)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-300 shrink-0">
                              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                            </svg>
                            {formData.invigilator.trim() === "" ? (
                              <span>{name}</span>
                            ) : (
                              <span dangerouslySetInnerHTML={{
                                __html: name.replace(new RegExp(`(${formData.invigilator.trim()})`, "gi"),
                                  '<mark class="bg-teal-100 text-teal-800 rounded px-0.5">$1</mark>')
                              }} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {showSuggestions && suggestions.length === 0 && formData.invigilator.trim() !== "" && !loadingInvigilators && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400 shadow-lg">
                        No user found matching that name
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          <p className="text-gray-600 text-sm mb-2 mt-3">
            Before confirming ensure that the exam details are correct, the invigilator is available at the selected time, the venue is correct, and no scheduling conflict exists.{" "}
            <span className="text-red-600 font-semibold">Assign the Invigilator only after verifying all information.</span>
          </p>

          <div className="flex justify-end mt-4">
            <button onClick={handleAssign} disabled={!isFormValid}
              className={`font-semibold px-8 py-2 rounded-full shadow-md transition-colors ${!isFormValid ? "bg-gray-400 text-gray-600 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"}`}>
              Assign
            </button>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-teal-700">Assigned Invigilators</h3>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold underline underline-offset-2 transition-colors">
                  Clear Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100">
                <option value="">All Courses</option>
                {[...new Set(assignedInvigilators.map((a) => a.course))].sort().map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <input type="text" value={filterInvigilator} onChange={(e) => setFilterInvigilator(e.target.value)}
                placeholder="Search invigilator..."
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
            </div>

            {loadingAssignments ? (
              <p className="text-gray-400 text-sm">Loading assignments...</p>
            ) : filteredAssignments.length > 0 ? (
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
                  {filteredAssignments.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 border border-gray-300">{item.course}</td>
                      <td className="p-2 border border-gray-300">{formatDate(item.date)}</td>
                      <td className="p-2 border border-gray-300">{item.time}</td>
                      <td className="p-2 border border-gray-300">{item.room}</td>
                      <td className="p-2 border border-gray-300">{item.invigilator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                {hasActiveFilters ? "No assignments match the selected filters." : "No invigilators assigned yet."}
              </p>
            )}
          </div>
        </div>
      </main>

      {successToast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl bg-teal-700 px-4 py-3 text-white shadow-xl animate-fade-in-up sm:bottom-6 sm:w-auto sm:px-5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-teal-200 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-sm">{successToast.message}</span>
          <button type="button" onClick={() => { clearTimeout(successToastTimerRef.current); setSuccessToast(null); }}
            className="text-teal-200 hover:text-teal-100 transition-colors ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-0 left-0 h-1 bg-teal-300 rounded-b-xl animate-shrink-bar" style={{ animationDuration: "4000ms" }} />
        </div>
      )}

      {errorToast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-white shadow-xl animate-fade-in-up sm:bottom-6 sm:w-auto sm:px-5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-red-200 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span className="text-sm">{errorToast.message}</span>
          <button type="button" onClick={() => { clearTimeout(errorToastTimerRef.current); setErrorToast(null); }}
            className="text-red-200 hover:text-teal-100 transition-colors ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-0 left-0 h-1 bg-red-400 rounded-b-xl animate-shrink-bar" style={{ animationDuration: "5000ms" }} />
        </div>
      )}

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes shrink-bar {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
        .animate-shrink-bar { animation: shrink-bar linear forwards; }
      `}</style>
    </div>
  );
}

export default AssignInvigilator;
