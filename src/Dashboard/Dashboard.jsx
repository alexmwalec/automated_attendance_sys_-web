import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/sidebar";

// Palette 
const PRESENT_COLOR = "#10b981";  
const ABSENT_COLOR  = "#ef4444";  

// Helpers
function pct(a, total) {
  return total === 0 ? 0 : Math.round((a / total) * 100);
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
          <span className="font-bold">{p.value} ({pct(p.value, total)}%)</span>
        </p>
      ))}
      <p className="text-gray-400 text-xs mt-1 border-t pt-1">Total: {total}</p>
    </div>
  );
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1 shadow-sm border"
      style={{ borderColor: accent + "33", background: accent + "0d" }}
    >
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>{label}</span>
      <span className="text-3xl font-black text-gray-800">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Raw Firestore data
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);   
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Filters
  const [selYear, setSelYear] = useState("all");
  const [selDept, setSelDept] = useState("");
  const [selProgram, setSelProgram] = useState("");
  const [selCourse, setSelCourse] = useState(""); 
  const [selStudent, setSelStudent] = useState(""); 

  // 1. Fetch Courses
  useEffect(() => {
    return onSnapshot(collection(db, "courses"), (snap) => {
      setCourses(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        courseName: d.data().courseName || d.id,
        department: d.data().department || "Unassigned",
      })));
    });
  }, []);

  // 2. Fetch Students
  useEffect(() => {
    return onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map(d => ({
        id: d.id,
        regNo: d.data().regNo || d.id,
        name: `${d.data().name || ""} ${d.data().surname || ""}`.trim(),
        year: String(d.data().year || d.data().years || ""),
        department: d.data().department || "",
        program: d.data().program || "",
        enrolledCourses: d.data().assignedCourses || d.data().courses || [], // Expecting array or comma string
      })));
    });
  }, []);

  // 3. Fetch Attendance
  useEffect(() => {
    setLoading(true);
    return onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Logic: Derived Filter Options
  const uniqueDepts = useMemo(() => {
    const depts = courses.map(c => c.department).filter(d => d && d !== "Unassigned");
    return [...new Set(depts)].sort();
  }, [courses]);

  const filteredCourseOptions = useMemo(() => {
    return courses.filter(c => {
      if (selDept && c.department !== selDept) return false;
      return true;
    });
  }, [courses, selDept]);

  // Logic: Filter students list based on Course, Dept, and Year selection
  const filteredStudentOptions = useMemo(() => {
    return students.filter(s => {
      if (selDept && s.department !== selDept) return false;
      if (selYear !== "all" && s.year !== selYear) return false;
      
      // Filter students by course enrollment
      if (selCourse) {
        const studentCourses = Array.isArray(s.enrolledCourses) 
            ? s.enrolledCourses 
            : String(s.enrolledCourses).split(',').map(c => c.trim());
        if (!studentCourses.includes(selCourse)) return false;
      }
      
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selDept, selYear, selCourse]);

  // Main Data Processing
  const flatEntries = useMemo(() => {
    let filteredAttendance = attendance;

    // Filter by Course first
    if (selCourse) {
      filteredAttendance = filteredAttendance.filter(d => d.courseCode === selCourse);
    } else if (selDept) {
        const deptCourseIds = new Set(courses.filter(c => c.department === selDept).map(c => c.id));
        filteredAttendance = filteredAttendance.filter(d => deptCourseIds.has(d.courseCode));
    }

    const rows = [];
    filteredAttendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        rows.push({
          courseCode: doc.courseCode,
          date: doc.date || "Unknown",
          regNo: entry.regNo || "",
          status: entry.status || "Absent",
        });
      });
    });

    // Final filter for Student
    if (selStudent) {
      return rows.filter(r => r.regNo === selStudent);
    }
    
    // Filter by Year (since year is student metadata, not in attendance doc)
    if (selYear !== "all") {
        const validRegNos = new Set(students.filter(s => s.year === selYear).map(s => s.regNo));
        return rows.filter(r => validRegNos.has(r.regNo));
    }

    return rows;
  }, [attendance, selCourse, selDept, selStudent, selYear, courses, students]);

  // Analytics
  const stats = useMemo(() => {
    const total = flatEntries.length;
    const present = flatEntries.filter(e => e.status === "Present").length;
    const absent = total - present;
    return { total, present, absent, rate: pct(present, total) };
  }, [flatEntries]);

  const trendData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      const key = e.date;
      if (!map[key]) map[key] = { date: key, Present: 0, Absent: 0 };
      e.status === "Present" ? map[key].Present++ : map[key].Absent++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [flatEntries]);

  const clearAll = useCallback(() => {
    setSelYear("all"); setSelDept("");
    setSelCourse(""); setSelStudent("");
  }, []);

  const selectClass = "w-full rounded-xl border border-teal-400 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer appearance-none";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-md">
          <div>
            <h1 className="text-white text-lg tracking-tight font-bold">Attendance Insights</h1>
            <p className="text-teal-100 text-xs">Monitoring {courses.length} courses and {students.length} students</p>
          </div>
          <div className="relative flex items-center gap-2 self-start sm:self-auto">
            <button onClick={clearAll} className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition font-medium">
              Reset Filters
            </button>
            <button type="button" onClick={() => setShowProfileMenu(!showProfileMenu)} className="rounded-full p-2 text-white hover:bg-teal-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full z-40 mt-2 h-11 w-20 rounded-xl bg-teal-100 text-left shadow-lg ring-1 ring-black ring-opacity-5">
                <button type="button" onClick={() => { setShowProfileMenu(false); navigate("/"); }}
                  className="w-full px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 transition-colors rounded-lg">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            
            {/* Department */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Department</label>
              <select value={selDept} onChange={e => {setSelDept(e.target.value); setSelCourse(""); setSelStudent("");}} className={selectClass}>
                <option value="">All Departments</option>
                {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Course */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Course</label>
              <select value={selCourse} onChange={e => {setSelCourse(e.target.value); setSelStudent("");}} className={selectClass}>
                <option value="">All Courses</option>
                {filteredCourseOptions.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Academic Year</label>
              <select value={selYear} onChange={e => {setSelYear(e.target.value); setSelStudent("");}} className={selectClass}>
                <option value="all">All Years</option>
                {["1","2","3","4","5"].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>

            {/* Student */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Student</label>
              <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className={selectClass}>
                <option value="">{selCourse ? "All Students in Course" : "Search Student"}</option>
                {filteredStudentOptions.map(s => (
                  <option key={s.regNo} value={s.regNo}>{s.name} ({s.regNo})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Records" value={stats.total} accent="#0d9488" />
              <StatCard label="Present" value={stats.present} accent="#10b981" />
              <StatCard label="Absent" value={stats.absent} accent="#f43f5e" />
              <StatCard label="Rate" value={`${stats.rate}%`} accent={stats.rate >= 75 ? "#10b981" : "#f97316"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Gauge / Pie */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                    <h3 className="font-bold text-gray-700 text-sm mb-3 self-start">Engagement Ratio</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={[{name:"Present", value:stats.present}, {name:"Absent", value:stats.absent}]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                <Cell fill={PRESENT_COLOR} /><Cell fill={ABSENT_COLOR} />
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Trend */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 text-sm mb-4">Historical Trend</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{fontSize: 10}} />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="Present" stroke={PRESENT_COLOR} fill={PRESENT_COLOR} fillOpacity={0.1} />
                            <Area type="monotone" dataKey="Absent" stroke={ABSENT_COLOR} fill={ABSENT_COLOR} fillOpacity={0.1} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
