import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import Sidebar from "../components/sidebar";

// Palette 
const PRESENT_COLOR = "#10b981";  
const ABSENT_COLOR  = "#ef4444";  
const TEAL          = "#0d9488";

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

export default function Dashboard({ analyticsMode = false }) {
  const navigate = useNavigate();

  // Raw Firestore data
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);   
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // ── Filters ──
  const [selCourse, setSelCourse] = useState("");   // Course ID string
  const [selYear, setSelYear] = useState("all");
  const [selDept, setSelDept] = useState("");
  const [selProgram, setSelProgram] = useState("");
  const [selStudent, setSelStudent] = useState(""); // Student RegNo string

  // Fetch: courses 
  useEffect(() => {
    return onSnapshot(collection(db, "courses"), snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().courseName || d.id,
        department: d.data().department || "",
        program: d.data().program || "",
        year: d.data().year || "",
      }));
      setCourses(list);
    });
  }, []);

  // Fetch: students
  useEffect(() => {
    return onSnapshot(collection(db, "students"), snap => {
      setStudents(snap.docs.map(d => ({
        id: d.id,
        regNo: d.data().regNo || d.id,
        name: `${d.data().name || ""} ${d.data().surname || ""}`.trim(),
        year: d.data().year || d.data().years || "",
        department: d.data().department || "",
        program: d.data().program || "",
        courses: d.data().courses || "" // CSV string: "CS101, MAT202"
      })));
    });
  }, []);

  // Fetch: attendance
  useEffect(() => {
    setLoading(true);
    return onSnapshot(collection(db, "attendance"), snap => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // ── Logic: Derived Data for Dropdowns ──
  const uniqueDepts = useMemo(() => [...new Set(courses.map(c => c.department))].filter(Boolean).sort(), [courses]);
  const uniqueProgs = useMemo(() => [...new Set(courses.map(c => c.program))].filter(Boolean).sort(), [courses]);

  // Logic: Filter courses based on Dept/Program selection
  const filteredCourseOptions = useMemo(() => {
    return courses.filter(c => {
      const matchDept = selDept ? c.department === selDept : true;
      const matchProg = selProgram ? c.program === selProgram : true;
      return matchDept && matchProg;
    });
  }, [courses, selDept, selProgram]);

  // Logic: Filter students based on selected course
  const eligibleStudents = useMemo(() => {
    if (!selCourse) return [];
    return students.filter(s => 
      s.courses.split(',').map(c => c.trim().toLowerCase()).includes(selCourse.toLowerCase())
    );
  }, [students, selCourse]);

  // ── Logic: Auto-fill Year when course is selected ──
  const handleCourseChange = (courseId) => {
    setSelCourse(courseId);
    setSelStudent(""); // Reset student when course changes
    if (courseId) {
      const courseObj = courses.find(c => c.id === courseId);
      if (courseObj && courseObj.year) {
        setSelYear(String(courseObj.year));
      }
    } else {
      setSelYear("all");
    }
  };

  // ── Filtering Attendance Data ──
  const flatEntries = useMemo(() => {
    let docs = attendance;

    if (selCourse) docs = docs.filter(d => d.courseCode === selCourse);
    if (selDept) {
      const deptCourseIds = new Set(courses.filter(c => c.department === selDept).map(c => c.id));
      docs = docs.filter(d => deptCourseIds.has(d.courseCode));
    }
    if (selProgram) {
      const progCourseIds = new Set(courses.filter(c => c.program === selProgram).map(c => c.id));
      docs = docs.filter(d => progCourseIds.has(d.courseCode));
    }

    const rows = [];
    docs.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        rows.push({
          courseCode: doc.courseCode,
          date: doc.date || "",
          regNo: entry.regNo || "",
          status: entry.status || "Absent",
        });
      });
    });

    if (selStudent) return rows.filter(r => r.regNo === selStudent);
    if (selYear !== "all") {
      const regNosInYear = new Set(students.filter(s => String(s.year) === String(selYear)).map(s => s.regNo));
      return rows.filter(r => regNosInYear.has(r.regNo));
    }

    return rows;
  }, [attendance, selCourse, selDept, selProgram, selStudent, selYear, courses, students]);

  // Stats
  const totalPresent = flatEntries.filter(e => e.status === "Present").length;
  const totalAbsent  = flatEntries.filter(e => e.status !== "Present").length;
  const total        = flatEntries.length;
  const attendanceRate = pct(totalPresent, total);

  // Charts mapping (Simplified version for space)
  const trendData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      const key = e.date || "Unknown";
      if (!map[key]) map[key] = { date: key, Present: 0, Absent: 0 };
      e.status === "Present" ? map[key].Present++ : map[key].Absent++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [flatEntries]);

  const byCourseData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      if (!map[e.courseCode]) map[e.courseCode] = { course: e.courseCode, Present: 0, Absent: 0 };
      e.status === "Present" ? map[e.courseCode].Present++ : map[e.courseCode].Absent++;
    });
    return Object.values(map).slice(0, 10);
  }, [flatEntries]);

  const clearAll = useCallback(() => {
    setSelCourse(""); setSelYear("all"); setSelDept("");
    setSelProgram(""); setSelStudent("");
  }, []);

  const hasFilter = selCourse || selDept || selProgram || selStudent || selYear !== "all";

  // Dropdown style class
  const selectClass = "w-full rounded-xl border border-teal-400 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer appearance-none";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {/* Header */}
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h1 className="text-white text-lg tracking-tight font-bold">
              {analyticsMode ? "Attendance Analytics" : "Attendance Dashboard"}
            </h1>
            <p className="text-teal-100 text-xs">Real-time data synchronization</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            {hasFilter && (
              <button onClick={clearAll} className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition">
                Reset All
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Filters</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            
            {/* Dept Dropdown */}
            <div className="relative">
              <select value={selDept} onChange={e => {setSelDept(e.target.value); setSelCourse("");}} className={selectClass}>
                <option value="">All Departments</option>
                {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Program Dropdown */}
            <div className="relative">
              <select value={selProgram} onChange={e => {setSelProgram(e.target.value); setSelCourse("");}} className={selectClass}>
                <option value="">All Programs</option>
                {uniqueProgs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Course Dropdown */}
            <div className="relative">
              <select value={selCourse} onChange={e => handleCourseChange(e.target.value)} className={selectClass}>
                <option value="">Select Course</option>
                {filteredCourseOptions.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
              </select>
            </div>

            {/* Year Dropdown (Disabled if course selected as it's auto-filled) */}
            <div className="relative">
              <select 
                value={selYear} 
                onChange={e => setSelYear(e.target.value)} 
                className={`${selectClass} ${selCourse ? 'bg-gray-50 border-teal-200' : ''}`}
              >
                <option value="all">All Years</option>
                {["1","2","3","4","5"].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>

            {/* Student Dropdown (Dependent on Course) */}
            <div className="relative">
              <select 
                value={selStudent} 
                onChange={e => setSelStudent(e.target.value)} 
                disabled={!selCourse}
                className={`${selectClass} ${!selCourse ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
              >
                <option value="">{selCourse ? "All Students in Course" : "Select Course First"}</option>
                {eligibleStudents.map(s => <option key={s.regNo} value={s.regNo}>{s.name} ({s.regNo})</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : !hasFilter ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
            <p className="text-base font-medium">Select a filter to begin analysis</p>
          </div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Records" value={total.toLocaleString()} accent="#0d9488" />
              <StatCard label="Present" value={totalPresent.toLocaleString()} accent="#10b981" />
              <StatCard label="Absent" value={totalAbsent.toLocaleString()} accent="#f43f5e" />
              <StatCard label="Attendance Rate" value={`${attendanceRate}%`} accent={attendanceRate >= 75 ? "#10b981" : "#f97316"} />
            </div>

            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                <h3 className="font-bold text-gray-700 text-sm mb-3 self-start">Engagement Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={[{name:"Present", value:totalPresent}, {name:"Absent", value:totalAbsent}]} innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                      <Cell fill={PRESENT_COLOR} /><Cell fill={ABSENT_COLOR} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
                <h3 className="font-bold text-gray-700 text-sm mb-4">Attendance Timeline</h3>
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

            <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-700 text-sm mb-4">Performance by Component</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byCourseData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="course" tick={{fontSize: 11}} />
                  <YAxis tick={{fontSize: 11}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Present" fill={PRESENT_COLOR} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Absent" fill={ABSENT_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </main>
    </div>
  );
}