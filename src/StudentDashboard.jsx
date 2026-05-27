import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function StudentDashboard() {
  // Store all attendance records fetched from Firestore
  const [myAttendance, setMyAttendance] = useState([]);
  // Show a loading state while we wait for Firestore data
  const [loading, setLoading] = useState(true);
  // Track what the student has selected in each filter dropdown
  const [filters, setFilters] = useState({ courseCode: "", sessionType: "", date: "", status: "" });
  const navigate = useNavigate();

  // Grab the logged-in student's reg number from database
  const regNo = localStorage.getItem("studentRegNo");

  useEffect(() => {
    // If there's no reg number, the student isn't logged in send them to login
    if (!regNo) {
      navigate("/login");
      return;
    }

    // Whenever a lecturer updates attendance, this updates automatically.
    const unsub = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const records = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const studentEntry = data.fullAttendanceList?.find(
          (s) => s.regNo.trim().toUpperCase() === regNo.toUpperCase()
        );

        // If the student was part of this session, save the record
        if (studentEntry) {
          records.push({
            id: doc.id,
            courseCode: data.courseCode,
            sessionType: data.sessionType,
            date: data.date,
            status: studentEntry.status, // either "Present" or "Absent"
          });
        }
      });

      setMyAttendance(records);
      setLoading(false);
    });

    // Clean up the listener when the component unmounts
    return () => unsub();
  }, [regNo, navigate]);

  //the filters always reflect only what this student actually has
  const uniqueCourses = [...new Set(myAttendance.map((r) => r.courseCode).filter(Boolean))];
  const uniqueTypes   = [...new Set(myAttendance.map((r) => r.sessionType).filter(Boolean))];
  const uniqueDates   = [...new Set(myAttendance.map((r) => r.date).filter(Boolean))];

  // Filter the records on the client side
  // An empty string means "no filter applied for this field", then show everything.
  const filteredAttendance = myAttendance.filter((item) =>
    (filters.courseCode  === "" || item.courseCode  === filters.courseCode)  &&
    (filters.sessionType === "" || item.sessionType === filters.sessionType) &&
    (filters.date        === "" || item.date        === filters.date)        &&
    (filters.status      === "" || item.status      === filters.status)
  );

  // When any dropdown changes, update just that one filter field
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Reset all filters back to "show everything"
  const clearFilters = () =>
    setFilters({ courseCode: "", sessionType: "", date: "", status: "" });
  const isFiltered = Object.values(filters).some((v) => v !== "");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Top header bar with student reg number and logout*/}
        <header className="flex justify-between items-center bg-teal-500 mb-8 p-6 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-teal-800">My Attendance</h1>
            {/* Show the student who's currently logged in */}
            <p className="text-white text-xl font-bold">{regNo}</p>
          </div>
          {/* Sign out and go back to the main login page */}
          <button
            onClick={() => { auth.signOut(); navigate("/login"); }}
            className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100"
          >
            Logout
          </button>
        </header>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left">

            <thead>
              <tr>
                {/* COURSE filter lists all unique course codes this student attended */}
                <th className="px-4 py-3 border border-gray-300 bg-teal-500 w-1/4">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                    Course
                  </label>
                  <select
                    name="courseCode"
                    value={filters.courseCode}
                    onChange={handleFilterChange}
                    className="w-full rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <option value="">All Courses</option>
                    {uniqueCourses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </th>

                {/* TYPE filter by Lecture, Lab, Tutorial */}
                <th className="px-4 py-3 border border-gray-300 bg-teal-500 w-1/4">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                    Type
                  </label>
                  <select
                    name="sessionType"
                    value={filters.sessionType}
                    onChange={handleFilterChange}
                    className="w-full rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <option value="">All Types</option>
                    {uniqueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </th>

                {/* DATE filter lists every date a session was recorded for this student */}
                <th className="px-4 py-3 border border-gray-300 bg-teal-500 w-1/4">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                    Date
                  </label>
                  <select
                    name="date"
                    value={filters.date}
                    onChange={handleFilterChange}
                    className="w-full rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <option value="">All Dates</option>
                    {uniqueDates.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </th>

                {/* STATUS filter Present or Absent only.*/}
                <th className="px-4 py-3 border border-gray-300 bg-teal-500 w-1/4">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                    Status
                  </label>
                  <div className="flex gap-2 items-center">
                    <select
                      name="status"
                      value={filters.status}
                      onChange={handleFilterChange}
                      className="flex-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
                    >
                      <option value="">All</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                    </select>
                    {/* Only show this when the student has filtered something */}
                    {isFiltered && (
                      <button
                        onClick={clearFilters}
                        className="shrink-0 text-xs font-bold normal-case tracking-normal text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            {/*Table body renders the filtered attendance rows*/}
            <tbody className="divide-y bg-teal-50 divide-gray-50">
              {filteredAttendance.length > 0 ? (
                filteredAttendance.map((item) => (
                  <tr key={item.id} className="hover:bg-teal-50/30 transition-colors">
                    <td className="border border-gray-300 px-6 py-4 text-gray-700">{item.courseCode}</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-500">{item.sessionType}</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-500">{item.date}</td>
                    <td className="border border-gray-300 px-6 py-4">
                      {/* Green badge for present, red badge for absent */}
                      <span className={`px-3 py-1 rounded-full text-xs ${
                        item.status === "Present"
                          ? "bg-green-200 text-teal-600"
                          : "bg-red-200 text-red-600"
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                // Show a helpful message depending on why the table is empty
                <tr>
                  <td colSpan="4" className="text-center py-20 text-gray-400 italic">
                    {loading
                      ? "Loading records..."           // still waiting on Firestore
                      : isFiltered
                      ? "No records match the selected filters."  // filters are too narrow
                      : "No attendance records found."            // genuinely no records
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}