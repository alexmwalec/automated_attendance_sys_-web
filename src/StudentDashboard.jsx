import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function StudentDashboard() {
  const [myAttendance, setMyAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const regNo = localStorage.getItem("studentRegNo");

  useEffect(() => {
    if (!regNo) {
      navigate("/student-login");
      return;
    }

    // Real-time listener for attendance collection
    const unsub = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const records = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        // Check if current student is in the list for this session
        const studentEntry = data.fullAttendanceList?.find(
          (s) => s.regNo.trim().toUpperCase() === regNo.toUpperCase()
        );

        if (studentEntry) {
          records.push({
            id: doc.id,
            courseCode: data.courseCode,
            sessionType: data.sessionType,
            date: data.date,
            status: studentEntry.status, // "Present" or "Absent"
          });
        }
      });
      setMyAttendance(records);
      setLoading(false);
    });

    return () => unsub();
  }, [regNo, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-gray-800">My Attendance</h1>
            <p className="text-teal-600 font-bold">{regNo}</p>
          </div>
          <button 
            onClick={() => { auth.signOut(); navigate("/student-login"); }}
            className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100"
          >
            Logout
          </button>
        </header>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Course</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {myAttendance.length > 0 ? (
                myAttendance.map((item) => (
                  <tr key={item.id} className="hover:bg-teal-50/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-700">{item.courseCode}</td>
                    <td className="px-6 py-4 text-gray-500">{item.date}</td>
                    <td className="px-6 py-4 text-gray-500">{item.sessionType}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        item.status === "Present" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-20 text-gray-400 italic">
                    {loading ? "Loading records..." : "No attendance records found."}
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