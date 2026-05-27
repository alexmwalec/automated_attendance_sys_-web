import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [studentInfo, setStudentInfo] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const regNo = localStorage.getItem("studentRegNo");

  useEffect(() => {
    if (!regNo) {
      navigate("/student-login");
      return;
    }

    // 1. Fetch Student Details (Name and Enrolled Courses)
    const fetchStudent = async () => {
      const sDoc = await getDoc(doc(db, "students", regNo));
      if (sDoc.exists()) {
        setStudentInfo(sDoc.data());
      }
      setLoading(false);
    };
    fetchStudent();

    // 2. Listen for All Attendance Records
    const unsubAtt = onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendanceRecords(snap.docs.map(d => d.data()));
    });

    return () => unsubAtt();
  }, [regNo, navigate]);

  // Logic to find this student's status for every session recorded
  const myAttendance = useMemo(() => {
    if (!studentInfo) return [];

    return attendanceRecords.map(record => {
      const studentEntry = record.fullAttendanceList?.find(
        s => s.regNo.trim().toUpperCase() === regNo.toUpperCase()
      );

      // Only return if this student is actually part of that course's enrollment
      if (studentEntry) {
        return {
          courseCode: record.courseCode,
          sessionType: record.sessionType,
          date: record.date,
          status: studentEntry.status, // "Present" or "Absent"
        };
      }
      return null;
    }).filter(item => item !== null);
  }, [attendanceRecords, studentInfo, regNo]);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex justify-between items-center bg-teal-600 p-6 rounded-3xl text-white shadow-xl">
          <div>
            <h1 className="text-2xl font-black">{studentInfo?.name} {studentInfo?.surname}</h1>
            <p className="text-teal-100 text-sm">{regNo}</p>
          </div>
          <button 
            onClick={() => { localStorage.clear(); navigate("/"); }}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          >
            Exit
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myAttendance.length > 0 ? myAttendance.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold text-slate-700">{item.courseCode}</td>
                  <td className="px-6 py-4 text-slate-500">{item.date}</td>
                  <td className="px-6 py-4 text-slate-500">{item.sessionType}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full font-bold text-[10px] ${
                      item.status === "Present" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="text-center py-20 text-slate-400">No attendance records found for your Reg No.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}