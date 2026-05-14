import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/sidebar";

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
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const suggestionRef = useRef(null);
  const successToastTimerRef = useRef(null);
  const errorToastTimerRef = useRef(null);
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];

  const allInvigilators = [
    "Alice Banda",
    "Harris Zintambila",
    "King Nasimba",
    "Alex Mwale",
    "Gabriel Moyo",
    "Francis Gondwe",
  ];

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
      const query = value.trim().toLowerCase();
      if (query === "") {
        setSuggestions(recentInvigilators.length > 0 ? recentInvigilators : allInvigilators.slice(0, 5));
      } else {
        const matched = allInvigilators.filter((n) =>
          n.toLowerCase().includes(query)
        );
        setSuggestions(matched);
      }
      setShowSuggestions(true);
    }
  };

  const handleInvigilatorFocus = () => {
    const query = formData.invigilator.trim().toLowerCase();
    if (query === "") {
      setSuggestions(recentInvigilators.length > 0 ? recentInvigilators : allInvigilators.slice(0, 5));
    } else {
      const matched = allInvigilators.filter((n) => n.toLowerCase().includes(query));
      setSuggestions(matched);
    }
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (name) => {
    setFormData({ ...formData, invigilator: name });
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

  useEffect(() => {
    return () => {
      clearTimeout(successToastTimerRef.current);
      clearTimeout(errorToastTimerRef.current);
    };
  }, []);

  const handleAssign = () => {
    if (!formData.course || !formData.date || !formData.time || !formData.room || !formData.invigilator) {
      alert("Please fill in all fields before assigning.");
      return;
    }

    // Check 1: invigilator already assigned somewhere at the same date & time
    const invigilatorBusy = assignedInvigilators.find(
      (a) =>
        a.invigilator.toLowerCase() === formData.invigilator.toLowerCase() &&
        a.date === formData.date &&
        a.time === formData.time
    );
    if (invigilatorBusy) {
      triggerErrorToast(
        `${formData.invigilator} is already assigned to ${invigilatorBusy.course} at ${invigilatorBusy.time} on ${invigilatorBusy.date}.`
      );
      return;
    }

    // Check 2: exact duplicate — same invigilator, same course, same date
    const exactDuplicate = assignedInvigilators.find(
      (a) =>
        a.invigilator.toLowerCase() === formData.invigilator.toLowerCase() &&
        a.course === formData.course &&
        a.date === formData.date
    );
    if (exactDuplicate) {
      triggerErrorToast(
        `${formData.invigilator} is already assigned to ${formData.course} on ${formData.date}.`
      );
      return;
    }

    // All checks passed — assign
    setAssignedInvigilators([
      ...assignedInvigilators,
      { ...formData, status: "Pending" }
    ]);
    setFormData({ course: "", date: "", time: "", room: "", invigilator: "" });
    setShowSuggestions(false);
    triggerSuccessToast(`${formData.invigilator} assigned to ${formData.course} successfully.`);
  };

  const handleMarkDone = (index) => {
    setAssignedInvigilators((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, status: "Done" } : item
      )
    );
    triggerSuccessToast(`${assignedInvigilators[index].course} invigilation marked as done.`);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="bg-teal-500 text-white px-4 py-3 rounded-lg mb-4 flex justify-between items-center relative">
          <span>Assign Invigilator</span>
          <button type="button" onClick={() => setShowProfileMenu(!showProfileMenu)} className="rounded-full p-2 hover:bg-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </button>
          {showProfileMenu && (
            <div className="absolute right-4 top-full mt-2 w-20 h-11 rounded-xl bg-teal-100 text-left shadow-lg ring-1 ring-black ring-opacity-5">
              <button type="button" onClick={() => { setShowProfileMenu(false); navigate("/"); }} className="w-full px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 transition-colors rounded-lg">
                Logout
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <table className="w-full min-w-full border border-gray-300">
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
                  <select name="course" value={formData.course} onChange={handleFormChange} className="w-full px-2 py-1 text-sm">
                    <option value="" disabled hidden>Select Course</option>
                    <option>COM411</option>
                    <option>COM412</option>
                    <option>COM413</option>
                    <option>COM414</option>
                    <option>COM415</option>
                    <option>COM421</option>
                    <option>COM422</option>
                    <option>COM423</option>
                    <option>COM424</option>
                    <option>COM425</option>
                    <option>COM432</option>
                    <option>INF423</option>
                    <option>SCE411</option>
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleFormChange}
                    min={today}
                    className="w-full px-2 py-1 text-sm"
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input type="time" name="time" value={formData.time} onChange={handleFormChange} className="w-full px-2 py-1 text-sm" />
                </td>
                <td className="p-2 border border-gray-300">
                  <select name="room" value={formData.room} onChange={handleFormChange} className="w-full px-2 py-1 text-sm">
                    <option value="" disabled hidden>Select Room</option>
                    <option>CK1</option>
                    <option>CK2</option>
                    <option>COMLAB1</option>
                    <option>COMLAB2</option>
                    <option>ROOM A</option>
                    <option>ROOM B</option>
                    <option>GREAT HALL</option>
                    <option>MW1</option>
                    <option>MW2</option>
                    <option>WADONDA</option>
                  </select>
                </td>

                {/* Invigilator with autocomplete */}
                <td className="p-2 border border-gray-300">
                  <div className="relative" ref={suggestionRef}>
                    <input
                      type="text"
                      name="invigilator"
                      value={formData.invigilator}
                      onChange={handleFormChange}
                      onFocus={handleInvigilatorFocus}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                      placeholder="Search name..."
                      autoComplete="off"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {formData.invigilator.trim() === "" && recentInvigilators.length > 0 && (
                          <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                            Recent
                          </div>
                        )}
                        {suggestions.map((name, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => handleSelectSuggestion(name)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-300 shrink-0">
                              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                            </svg>
                            {formData.invigilator.trim() === "" ? (
                              <span>{name}</span>
                            ) : (
                              <span dangerouslySetInnerHTML={{
                                __html: name.replace(
                                  new RegExp(`(${formData.invigilator.trim()})`, "gi"),
                                  '<mark class="bg-teal-100 text-teal-800 rounded px-0.5">$1</mark>'
                                )
                              }} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <p className="text-gray-600 text-sm mb-2 mt-3">
            Before confirming ensure that the exam details are correct, the invigilator is available at the selected time, the venue is correct, and no scheduling conflict exists.{" "}
            <span className="text-red-600 font-semibold">Assign the Invigilator only after verifying all information.</span>
          </p>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleAssign}
              disabled={!formData.course || !formData.date || !formData.time || !formData.room || !formData.invigilator}
              className={`font-semibold px-8 py-2 rounded-full shadow-md transition-colors ${
                !formData.course || !formData.date || !formData.time || !formData.room || !formData.invigilator
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
              }`}
            >
              Assign
            </button>
          </div>

          {/* Assigned Invigilators Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-teal-700 mb-3">Assigned Invigilators</h3>
            {assignedInvigilators.length > 0 ? (
              <table className="w-full min-w-full border border-gray-300">
                <thead>
                  <tr className="bg-teal-600 text-white text-sm">
                    <th className="p-3 text-left border border-gray-300 whitespace-nowrap">COURSE</th>
                    <th className="p-3 text-left border border-gray-300 whitespace-nowrap">DATE</th>
                    <th className="p-3 text-left border border-gray-300 whitespace-nowrap">TIME</th>
                    <th className="p-3 text-left border border-gray-300 whitespace-nowrap">VENUE</th>
                    <th className="p-3 text-left border border-gray-300 whitespace-nowrap">INVIGILATOR</th>
                    <th className="p-3 text-center border border-gray-300 whitespace-nowrap">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedInvigilators.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 border border-gray-300">{item.course}</td>
                      <td className="p-2 border border-gray-300">{item.date}</td>
                      <td className="p-2 border border-gray-300">{item.time}</td>
                      <td className="p-2 border border-gray-300">{item.room}</td>
                      <td className="p-2 border border-gray-300">{item.invigilator}</td>
                      <td className="p-2 border border-gray-300 text-center">
                        {item.status === "Done" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Done
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkDone(index)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            Pending
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">No invigilators assigned yet.</p>
            )}
          </div>
        </div>
      </main>

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-teal-700 text-white px-5 py-3 rounded-xl shadow-xl animate-fade-in-up">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-teal-200 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-sm">{successToast.message}</span>
          <button type="button" onClick={() => { clearTimeout(successToastTimerRef.current); setSuccessToast(null); }} className="text-teal-200 hover:text-white transition-colors ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-0 left-0 h-1 bg-teal-300 rounded-b-xl animate-shrink-bar" style={{ animationDuration: "4000ms" }} />
        </div>
      )}

      {/* Error Toast */}
      {errorToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl animate-fade-in-up">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-red-200 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span className="text-sm">{errorToast.message}</span>
          <button type="button" onClick={() => { clearTimeout(errorToastTimerRef.current); setErrorToast(null); }} className="text-red-200 hover:text-white transition-colors ml-1">
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
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
        .animate-shrink-bar {
          animation: shrink-bar linear forwards;
        }
      `}</style>
    </div>
  );
}

export default AssignInvigilator;