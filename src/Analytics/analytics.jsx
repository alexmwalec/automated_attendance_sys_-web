import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ResponsiveContainer,
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/sidebar";

const PRESENT_COLOR = "#10b981";
const ABSENT_COLOR = "#1306069d";

function pct(a, total) {
  return total === 0 ? 0 : Math.round((a / total) * 100);
}

function parseAttendanceDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate;
  
  const normalized = String(value).replace(/\s+/g, "T");
  const altDate = new Date(normalized);
  return Number.isNaN(altDate.getTime()) ? null : altDate;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = (payload[0]?.value ?? 0) + (payload[1]?.value ?? 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-bold">{p.value} ({total > 0 ? pct(p.value, total) : 0}%)</span>
        </p>
      ))}
      <p className="text-gray-400 text-xs mt-1 border-t pt-1">Total: {total}</p>
    </div>
  );
};

function EmptyChartState() {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
      <p className="text-sm font-semibold text-gray-700">No attendance records yet</p>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "courses"), (snap) => {
      setCourses(snap.docs.map(d => ({
        id: d.id, // Document ID (e.g. COM 423)
        courseName: d.data().courseName || d.id,
        department: d.data().department || "Unknown",
      })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map(d => ({
        id: d.id,
        regNo: d.data().regNo || d.id,
        name: `${d.data().name || ""} ${d.data().surname || ""}`.trim(),
        program: d.data().program || "N/A", // Fetching program name field
        coursesStr: d.data().courses || "",
        years: String(d.data().years || d.data().yearss || ""),
        department: d.data().department || "",
      })));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const studentInfoByReg = useMemo(() => {
    return Object.fromEntries(students.map(s => [s.regNo, { ...s }]));
  }, [students]);

  const flatEntries = useMemo(() => {
    const rows = [];
    attendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        rows.push({
          courseCode: doc.courseCode,
          dateObject: parseAttendanceDate(doc.timestamp || doc.date),
          date: doc.date || "Unknown",
          regNo: entry.regNo || "",
          status: entry.status || "Absent",
        });
      });
    });
    return rows;
  }, [attendance]);

  const studentAttendanceData = useMemo(() => {
    const map = {};
    attendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        const regNo = entry.regNo;
        if (!regNo) return;
        const row = map[regNo] ?? { regNo, present: 0, absent: 0, total: 0 };
        if (entry.status === "Present") row.present += 1;
        else row.absent += 1;
        row.total += 1;
        map[regNo] = row;
      });
    });
    return Object.values(map).map(row => {
      const s = studentInfoByReg[row.regNo] || {};
      const rate = row.total ? pct(row.present, row.total) : 0;
      return { 
        ...row, 
        ...s, 
        rate, 
        displayName: s.name && s.name.length > 0 ? s.name : row.regNo,
      };
    });
  }, [attendance, studentInfoByReg]);

  const atRiskStudents = useMemo(() => {
    return studentAttendanceData
      .filter(s => {
        const hasSlash = /\//.test(s.regNo);
        return s.total > 0 && s.rate < 75 && hasSlash;
      })
      .map(s => ({
        ...s,
        riskLevel: s.rate < 50 ? "Critical" : s.rate < 60 ? "High" : "Medium",
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [studentAttendanceData]);

  // Logic to Deduplicate Courses and only show the 6 official courses
  const courseAnalytics = useMemo(() => {
    const courseMap = {};
    
    // Initialize map using official courses to ensure they all appear
    courses.forEach(c => {
      courseMap[c.id.trim().toUpperCase()] = {
        courseCode: c.id,
        totalRecords: 0,
        present: 0,
        absent: 0,
      };
    });

    attendance.forEach(doc => {
      const code = doc.courseCode?.trim().toUpperCase();
      if (!code || !courseMap[code]) return; // Skip if not one of the official courses

      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      courseMap[code].totalRecords += list.length;
      courseMap[code].present += list.filter(e => e.status === "Present").length;
      courseMap[code].absent += list.filter(e => e.status !== "Present").length;
    });

    return Object.values(courseMap)
      .map(c => ({ ...c, avgAttendance: c.totalRecords > 0 ? pct(c.present, c.totalRecords) : 0 }))
      .sort((a, b) => b.avgAttendance - a.avgAttendance);
  }, [attendance, courses]);

  const departmentComparison = useMemo(() => {
    const validDepts = ["Computer Science", "Mathematics", "History"];
    const groups = {};
    
    studentAttendanceData.forEach(student => {
      const label = student.department?.trim();
      if (!label || !validDepts.includes(label)) return;

      const row = groups[label] ?? { label, present: 0, absent: 0, total: 0 };
      row.present += student.present || 0;
      row.absent += student.absent || 0;
      row.total += student.total || 0;
      groups[label] = row;
    });
    return Object.values(groups)
      .filter(g => g.total > 0)
      .map(g => ({ ...g, rate: pct(g.present, g.total) }))
      .sort((a, b) => b.rate - a.rate);
  }, [studentAttendanceData]);

  const hourlyAttendanceData = useMemo(() => {
    const hours = {};
    for (let i = 6; i <= 18; i++) hours[i] = { hour: `${i}:00`, present: 0, absent: 0, total: 0 };
    flatEntries.forEach(entry => {
      const date = entry.dateObject;
      const hour = date ? date.getHours() : (Math.floor(Math.random() * 13) + 6);
      if (hours[hour]) {
        hours[hour].total++;
        if (entry.status === "Present") hours[hour].present++;
        else hours[hour].absent++;
      }
    });
    return Object.values(hours);
  }, [flatEntries]);

  const weekdayAttendanceData = useMemo(() => {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => ({
      day,
      present: 0,
      absent: 0,
      total: 0,
    }));
    flatEntries.forEach(entry => {
      const date = entry.dateObject;
      if (date) {
        const dayIndex = date.getDay();
        if (entry.status === "Present") weekdays[dayIndex].present++;
        else weekdays[dayIndex].absent++;
        weekdays[dayIndex].total++;
      }
    });
    return weekdays.map(d => ({ ...d, rate: d.total > 0 ? pct(d.present, d.total) : 0 }));
  }, [flatEntries]);

  const timeOfDayAnalytics = useMemo(() => {
    const morning = { name: "Morning (6AM-12PM)", present: 0, absent: 0, total: 0 };
    const afternoon = { name: "Afternoon (12PM-6PM)", present: 0, absent: 0, total: 0 };
    flatEntries.forEach(entry => {
      const date = entry.dateObject;
      if (date) {
        const hour = date.getHours();
        const period = (hour >= 12 && hour < 18) ? afternoon : morning;
        period.total++;
        if (entry.status === "Present") period.present++;
        else period.absent++;
      }
    });
    return [
      { ...morning, rate: morning.total > 0 ? pct(morning.present, morning.total) : 0 },
      { ...afternoon, rate: afternoon.total > 0 ? pct(afternoon.present, afternoon.total) : 0 },
    ];
  }, [flatEntries]);

  const hasChartData = flatEntries.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans sm:h-screen sm:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-md">
          <div>
            <h1 className="text-white text-lg tracking-tight font-bold">Advanced Analytics</h1>
          </div>
          <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="rounded-full p-2 text-white hover:bg-teal-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </button>
          {showProfileMenu && (
            <div className="absolute right-0 top-full z-40 mt-2 h-11 w-20 rounded-xl bg-teal-100 text-left shadow-lg">
              <button onClick={() => navigate("/")} className="w-full px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 rounded-lg">Logout</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-800 mb-4 mt-6">Time-Based Attendance Analysis</h2>
            <div className="mb-6 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 text-sm mb-2">Attendance by Hour</h3>
              {hasChartData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={hourlyAttendanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="present" fill={PRESENT_COLOR} name="Present" />
                    <Bar dataKey="absent" fill={ABSENT_COLOR} name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm mb-2">Attendance by Weekday</h3>
                {weekdayAttendanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weekdayAttendanceData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Attendance %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm mb-2">Morning vs Afternoon Attendance</h3>
                {timeOfDayAnalytics.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={timeOfDayAnalytics}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="rate" fill="#10b981" name="Attendance %" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-2 mt-8">Course Analytics</h2>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Course</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Total Records</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Present</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Absent</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Avg Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseAnalytics.length > 0 ? (
                      courseAnalytics.map((course, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{course.courseCode}</td>
                          <td className="px-4 py-3 text-gray-600">{course.totalRecords}</td>
                          <td className="px-4 py-3 text-green-600 font-semibold">{course.present}</td>
                          <td className="px-4 py-3 text-red-600 font-semibold">{course.absent}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              course.avgAttendance >= 80 ? "bg-green-100 text-green-700" :
                              course.avgAttendance >= 60 ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {course.avgAttendance}%
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">No course data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-2 mt-8">Department Performance Analysis</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm mb-4">Department Leaderboard</h3>
                {departmentComparison.length > 0 ? (
                  <div className="space-y-2">
                    {departmentComparison.map((dept, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-gray-800 text-sm">{dept.label}</span>
                            <span className="text-xs font-bold text-teal-600">{dept.rate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${dept.rate}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No department data available</p>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm mb-4">Department Comparison</h3>
                {departmentComparison.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={departmentComparison.map(d => ({ name: d.label, rate: d.rate }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="rate" fill="#10b981" name="Attendance %" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-2 mt-8">At-Risk Students</h2>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
              {atRiskStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-teal-500 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-white text-left font-semibold">Student Name</th>
                        <th className="px-4 py-3 text-white text-left font-semibold">Reg Number</th>
                        <th className="px-4 py-3 text-white text-left font-semibold">Program</th>
                        <th className="px-4 py-3 text-white text-left font-semibold">Year</th>
                        <th className="px-4 py-3 text-white text-left font-semibold">Attendance %</th>
                        <th className="px-4 py-3 text-white text-left font-semibold">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atRiskStudents.slice(0, 25).map((student, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{student.displayName}</td>
                          <td className="px-4 py-3 text-gray-600">{student.regNo}</td>
                          <td className="px-4 py-3 text-gray-600">{student.program}</td>
                          <td className="px-4 py-3 text-gray-600">{student.years}</td>
                          <td className="px-4 py-3 font-bold text-red-600">{student.rate}%</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              student.riskLevel === "Critical" ? "bg-red-100 text-red-700" :
                              student.riskLevel === "High" ? "bg-orange-100 text-orange-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {student.riskLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No at-risk students found.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}