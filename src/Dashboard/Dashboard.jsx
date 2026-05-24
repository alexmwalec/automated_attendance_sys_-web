import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
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

export default function Dashboard({ analyticsMode = false }) {
  // Raw Firestore data
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);   
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [selYear, setSelYear] = useState("all");
  const [selDept, setSelDept] = useState("");
  const [selProgram, setSelProgram] = useState("");
  const [selStudent, setSelStudent] = useState(""); // Student RegNo string

  // Fetch: courses 
  useEffect(() => {
    return onSnapshot(collection(db, "courses"), snap => {
      setCourses(snap.docs.map(d => ({
        id: d.id,
        name: d.data().courseName || d.id,
        department: d.data().department || "",
        program: d.data().program || "",
      })));
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
  const uniqueDepts = useMemo(() => [...new Set(students.map(s => s.department))].filter(Boolean).sort(), [students]);
  const uniqueProgs = useMemo(() => [...new Set(students.map(s => s.program))].filter(Boolean).sort(), [students]);

  // Logic: Filter students list based on Dept/Program/Year selection
  const filteredStudentOptions = useMemo(() => {
    return students.filter(s => {
      const matchDept = selDept ? s.department === selDept : true;
      const matchProg = selProgram ? s.program === selProgram : true;
      const matchYear = selYear !== "all" ? String(s.year) === selYear : true;
      return matchDept && matchProg && matchYear;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selDept, selProgram, selYear]);

  // ── Filtering Attendance Data ──
  const flatEntries = useMemo(() => {
    let docs = attendance;

    // Filter by Dept/Program (Mapping via courses)
    if (selDept || selProgram) {
      const validCourseIds = new Set(
        courses
          .filter(c => (selDept ? c.department === selDept : true) && (selProgram ? c.program === selProgram : true))
          .map(c => c.id)
      );
      docs = docs.filter(d => validCourseIds.has(d.courseCode));
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

    // Final filter by Student or Year
    let result = rows;
    if (selStudent) {
      result = result.filter(r => r.regNo === selStudent);
    } else if (selYear !== "all" || selDept || selProgram) {
      // If no specific student, filter rows by students who match the current criteria
      const validRegNos = new Set(filteredStudentOptions.map(s => s.regNo));
      result = result.filter(r => validRegNos.has(r.regNo));
    }

    return result;
  }, [attendance, selDept, selProgram, selStudent, selYear, courses, filteredStudentOptions]);

  // Stats
  const totalPresent = flatEntries.filter(e => e.status === "Present").length;
  const totalAbsent  = flatEntries.filter(e => e.status !== "Present").length;
  const total        = flatEntries.length;
  const attendanceRate = pct(totalPresent, total);

  // Charts
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
    setSelYear("all"); setSelDept("");
    setSelProgram(""); setSelStudent("");
  }, []);

  const hasFilter = selDept || selProgram || selStudent || selYear !== "all";
  const selectClass = "w-full rounded-xl border border-teal-400 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer appearance-none";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {/* Header */}
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-md">
          <div>
            <h1 className="text-white text-lg tracking-tight font-bold">
              Attendance Analytics
            </h1>
            <p className="text-teal-100 text-xs">Live tracking and student performance</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            {hasFilter && (
              <button onClick={clearAll} className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition font-medium">
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Data Filters</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            
            {/* Dept Dropdown */}
            <select value={selDept} onChange={e => {setSelDept(e.target.value); setSelStudent("");}} className={selectClass}>
              <option value="">All Departments</option>
              {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Program Dropdown */}
            <select value={selProgram} onChange={e => {setSelProgram(e.target.value); setSelStudent("");}} className={selectClass}>
              <option value="">All Programs</option>
              {uniqueProgs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* Year Dropdown */}
            <select value={selYear} onChange={e => {setSelYear(e.target.value); setSelStudent("");}} className={selectClass}>
              <option value="all">All Years</option>
              {["1","2","3","4","5"].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>

            {/* Student Dropdown (Dynamically Filtered) */}
            <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className={selectClass}>
              <option value="">{selDept ? `All Students in ${selDept}` : "All Students (Across Uni)"}</option>
              {filteredStudentOptions.map(s => (
                <option key={s.regNo} value={s.regNo}>{s.name} ({s.regNo})</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Records" value={total.toLocaleString()} accent="#0d9488" />
              <StatCard label="Present" value={totalPresent.toLocaleString()} accent="#10b981" />
              <StatCard label="Absent" value={totalAbsent.toLocaleString()} accent="#f43f5e" />
              <StatCard label="Attendance Rate" value={`${attendanceRate}%`} accent={attendanceRate >= 75 ? "#10b981" : "#f97316"} />
            </div>

            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
              {/* Engagement Pie */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                <h3 className="font-bold text-gray-700 text-sm mb-3 self-start">Engagement Ratio</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={[{name:"Present", value:totalPresent}, {name:"Absent", value:totalAbsent}]} innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                      <Cell fill={PRESENT_COLOR} /><Cell fill={ABSENT_COLOR} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Timeline Chart */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
                <h3 className="font-bold text-gray-700 text-sm mb-4">Historical Timeline</h3>
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

            {/* Course Breakdown */}
            <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-700 text-sm mb-4">Distribution by Course</h3>
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
