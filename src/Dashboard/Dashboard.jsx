import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  RadialBarChart, RadialBar, AreaChart, Area
} from "recharts";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/sidebar";

// Palette 
const PRESENT_COLOR = "#10b981";  // emerald-500
const ABSENT_COLOR  = "#f43f5e";  // rose-500
const TEAL          = "#0d9488";
const TEAL_LIGHT    = "#ccfbf1";

//Helpers
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

// Stat Card
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

//Search Combobox
function Combobox({ placeholder, value, onChange, onSelect, results, loading }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-1 min-w-[160px]">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full border border-teal-400 focus:border-teal-600 rounded-xl px-3 py-2 text-sm outline-none transition-all bg-white shadow-sm"
      />
      {loading && <span className="absolute right-3 top-2.5 text-xs text-gray-400">…</span>}
      {open && results.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 max-h-52 overflow-auto shadow-xl">
          {results.map((r, i) => (
            <li
              key={i}
              onMouseDown={() => { onSelect(r); setOpen(false); }}
              className="px-3 py-2 hover:bg-teal-50 cursor-pointer text-sm flex flex-col"
            >
              <span className="font-medium text-gray-800">{r.label}</span>
              {r.sub && <span className="text-xs text-gray-400">{r.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

//  Main Dashboard 
export default function Dashboard() {
  // Raw Firestore data
  const [courses,    setCourses]    = useState([]);
  const [students,   setStudents]   = useState([]);
  const [programs,   setPrograms]   = useState([]);
  const [departments,setDepartments]= useState([]);
  const [attendance, setAttendance] = useState([]);   // all attendance docs
  const [loading,    setLoading]    = useState(true);

  // ── Filters ──
  const [selCourse,     setSelCourse]     = useState(null);   // {id, label}
  const [selYear,       setSelYear]       = useState("");
  const [selDept,       setSelDept]       = useState(null);
  const [selProgram,    setSelProgram]    = useState(null);
  const [selStudent,    setSelStudent]    = useState(null);   // {regNo, label}

  // Search strings 
  const [courseQ,   setCourseQ]   = useState("");
  const [deptQ,     setDeptQ]     = useState("");
  const [programQ,  setProgramQ]  = useState("");
  const [studentQ,  setStudentQ]  = useState("");

  // Fetch: courses 
  useEffect(() => {
    return onSnapshot(collection(db, "courses"), snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().courseName || d.id,
        department: d.data().department || "",
        program: d.data().program || "",
        year: d.data().year || "",
        enrolled: d.data().enrolledStudents || []
      }));
      setCourses(list);
      const depts = [...new Set(list.map(c => c.department).filter(Boolean))];
      const progs = [...new Set(list.map(c => c.program).filter(Boolean))];
      setDepartments(depts);
      setPrograms(progs);
    });
  }, []);

  // Fetch: students
  useEffect(() => {
    return onSnapshot(collection(db, "students"), snap => {
      setStudents(snap.docs.map(d => ({
        id: d.id,
        regNo: d.data().regNo || d.id,
        name: `${d.data().name || ""} ${d.data().surname || ""}`.trim(),
        year: d.data().years || d.data().year || "",
        department: d.data().department || "",
        program: d.data().program || "",
        courses: d.data().courses || ""
      })));
    });
  }, []);

  // Fetch: attendance (all, then filter client-side for flexibility)
  useEffect(() => {
    setLoading(true);
    return onSnapshot(collection(db, "attendance"), snap => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Derived: filter attendance
  const filteredAttendance = useMemo(() => {
    let docs = attendance;

    // filter by course
    if (selCourse) docs = docs.filter(d => d.courseCode === selCourse.id);

    // filter by department: only docs whose courseCode belongs to a course in that dept
    if (selDept) {
      const deptCourseIds = new Set(courses.filter(c => c.department === selDept.id).map(c => c.id));
      docs = docs.filter(d => deptCourseIds.has(d.courseCode));
    }

    // filter by program
    if (selProgram) {
      const progCourseIds = new Set(courses.filter(c => c.program === selProgram.id).map(c => c.id));
      docs = docs.filter(d => progCourseIds.has(d.courseCode));
    }

    return docs;
  }, [attendance, selCourse, selDept, selProgram, courses]);

  // Derived: flatten fullAttendanceList entries
  const flatEntries = useMemo(() => {
    const rows = [];
    filteredAttendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        rows.push({
          courseCode: doc.courseCode,
          date: doc.date || "",
          regNo: entry.regNo || "",
          name: entry.name || "",
          surname: entry.surname || "",
          status: entry.status || "Absent",
        });
      });
    });

    // filter by student
    if (selStudent) {
      return rows.filter(r => r.regNo === selStudent.id);
    }

    // filter by year: match student year
    if (selYear) {
      const regNosInYear = new Set(students.filter(s => String(s.year) === String(selYear)).map(s => s.regNo));
      return rows.filter(r => regNosInYear.has(r.regNo));
    }

    return rows;
  }, [filteredAttendance, selStudent, selYear, students]);

  // Stats: totals
  const totalPresent = flatEntries.filter(e => e.status === "Present").length;
  const totalAbsent  = flatEntries.filter(e => e.status !== "Present").length;
  const total        = flatEntries.length;
  const attendanceRate = pct(totalPresent, total);

  // Chart 1: by date (trend) 
  const trendData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      const key = e.date || "Unknown";
      if (!map[key]) map[key] = { date: key, Present: 0, Absent: 0 };
      e.status === "Present" ? map[key].Present++ : map[key].Absent++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [flatEntries]);

  //Chart 2: by course
  const byCourseData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      if (!map[e.courseCode]) map[e.courseCode] = { course: e.courseCode, Present: 0, Absent: 0 };
      e.status === "Present" ? map[e.courseCode].Present++ : map[e.courseCode].Absent++;
    });
    return Object.values(map).sort((a, b) => (b.Present + b.Absent) - (a.Present + a.Absent)).slice(0, 10);
  }, [flatEntries]);

  // Chart 3: pie
  const pieData = [
    { name: "Present", value: totalPresent },
    { name: "Absent",  value: totalAbsent  },
  ];

  // Student profile view
  const studentProfile = selStudent
    ? students.find(s => s.regNo === selStudent.id)
    : null;

  const studentTrend = useMemo(() => {
    if (!selStudent) return [];
    const map = {};
    flatEntries.forEach(e => {
      const key = e.date || "Unknown";
      if (!map[key]) map[key] = { date: key, Present: 0, Absent: 0 };
      e.status === "Present" ? map[key].Present++ : map[key].Absent++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [flatEntries, selStudent]);

  //Combobox result builders
  const courseResults = useMemo(() => {
    if (!courseQ) return [];
    const q = courseQ.toLowerCase();
    return courses
      .filter(c => c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map(c => ({ id: c.id, label: c.id, sub: c.name + (c.department ? ` · ${c.department}` : "") }));
  }, [courseQ, courses]);

  const deptResults = useMemo(() => {
    if (!deptQ) return [];
    return departments
      .filter(d => d.toLowerCase().includes(deptQ.toLowerCase()))
      .slice(0, 8)
      .map(d => ({ id: d, label: d }));
  }, [deptQ, departments]);

  const programResults = useMemo(() => {
    if (!programQ) return [];
    return programs
      .filter(p => p.toLowerCase().includes(programQ.toLowerCase()))
      .slice(0, 8)
      .map(p => ({ id: p, label: p }));
  }, [programQ, programs]);

  const studentResults = useMemo(() => {
    if (!studentQ) return [];
    const q = studentQ.toLowerCase();
    return students
      .filter(s => s.name.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q))
      .slice(0, 8)
      .map(s => ({ id: s.regNo, label: s.name, sub: s.regNo + (s.year ? ` · Year ${s.year}` : "") }));
  }, [studentQ, students]);

  // Clear all filters
  const clearAll = useCallback(() => {
    setSelCourse(null); setSelYear(""); setSelDept(null);
    setSelProgram(null); setSelStudent(null);
    setCourseQ(""); setDeptQ(""); setProgramQ(""); setStudentQ("");
  }, []);

  // Active chips
  const chips = [
    selCourse   && { key: "course",   label: `Course: ${selCourse.id}`,     clear: () => { setSelCourse(null);   setCourseQ("");  } },
    selYear     && { key: "year",     label: `Year: ${selYear}`,             clear: () => setSelYear("") },
    selDept     && { key: "dept",     label: `Dept: ${selDept.label}`,       clear: () => { setSelDept(null);     setDeptQ("");    } },
    selProgram  && { key: "program",  label: `Program: ${selProgram.label}`, clear: () => { setSelProgram(null);  setProgramQ(""); } },
    selStudent  && { key: "student",  label: `Student: ${selStudent.label}`, clear: () => { setSelStudent(null);  setStudentQ(""); } },
  ].filter(Boolean);

  const hasFilter = chips.length > 0;

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-5">
        {/*Header */}
        <div
          className="rounded-2xl px-5 py-4 mb-5 bg-teal-500 flex justify-between items-center">
          <div>
            <h1 className="text-white text-lg  tracking-tight">Attendance Analytics</h1>
            <p className="text-teal-100 text-xs mt-0.5">Real-time attendance insights</p>
          </div>
          <div className="flex items-center gap-2">
            {hasFilter && (
              <button
                onClick={clearAll}
                className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
              >
                Clear filters
              </button>
            )}
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/*Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Filters</p>
          <div className="flex flex-wrap gap-3">

            {/* Course */}
            <Combobox
              placeholder="🔍 Search course…"
              value={selCourse ? selCourse.id : courseQ}
              onChange={v => { if (selCourse) setSelCourse(null); setCourseQ(v); }}
              onSelect={r => { setSelCourse(r); setCourseQ(""); }}
              results={courseResults}
              loading={false}
            />

            {/* Year — auto-paired with course */}
            <select
              value={selYear}
              onChange={e => setSelYear(e.target.value)}
              className="flex-1 min-w-[130px] border border-teal-400 rounded-xl px-3 py-2 text-sm outline-none bg-white shadow-sm"
            >
              <option value="">All Years</option>
              {["1","2","3","4","5"].map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>

            {/* Department */}
            <Combobox
              placeholder="🏛 Department…"
              value={selDept ? selDept.label : deptQ}
              onChange={v => { if (selDept) setSelDept(null); setDeptQ(v); }}
              onSelect={r => { setSelDept(r); setDeptQ(""); }}
              results={deptResults}
              loading={false}
            />

            {/* Program */}
            <Combobox
              placeholder="📚 Program…"
              value={selProgram ? selProgram.label : programQ}
              onChange={v => { if (selProgram) setSelProgram(null); setProgramQ(v); }}
              onSelect={r => { setSelProgram(r); setProgramQ(""); }}
              results={programResults}
              loading={false}
            />

            {/* Student */}
            <Combobox
              placeholder="👤 Student name / reg…"
              value={selStudent ? selStudent.label : studentQ}
              onChange={v => { if (selStudent) setSelStudent(null); setStudentQ(v); }}
              onSelect={r => { setSelStudent(r); setStudentQ(""); }}
              results={studentResults}
              loading={false}
            />
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {chips.map(chip => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold px-3 py-1 rounded-full"
                >
                  {chip.label}
                  <button onClick={chip.clear} className="text-teal-500 hover:text-rose-500 transition">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !hasFilter ? (
          /*Empty state */
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-2xl">
            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-base font-medium">Select a filter to view analytics</p>
            <p className="text-gray-300 text-sm mt-1">Course, Department, Program, Year or Student</p>
          </div>
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <StatCard
                label="Total Records"
                value={total.toLocaleString()}
                sub="attendance entries"
                accent="#0d9488"
              />
              <StatCard
                label="Present"
                value={totalPresent.toLocaleString()}
                sub={`${pct(totalPresent, total)}% of total`}
                accent="#10b981"
              />
              <StatCard
                label="Absent"
                value={totalAbsent.toLocaleString()}
                sub={`${pct(totalAbsent, total)}% of total`}
                accent="#f43f5e"
              />
              <StatCard
                label="Attendance Rate"
                value={`${attendanceRate}%`}
                sub={total > 0 ? (attendanceRate >= 75 ? "✓ Good standing" : "⚠ Below threshold") : "No data"}
                accent={attendanceRate >= 75 ? "#10b981" : "#f97316"}
              />
            </div>

            {/* ── Student profile panel (only when student selected) ── */}
            {selStudent && studentProfile && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 shrink-0">
                    {(studentProfile.name[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-gray-800 text-lg leading-tight">{studentProfile.name}</h2>
                    <p className="text-sm text-gray-500">{studentProfile.regNo}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {studentProfile.year && (
                        <span className="bg-teal-50 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-teal-200">
                          Year {studentProfile.year}
                        </span>
                      )}
                      {studentProfile.department && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                          {studentProfile.department}
                        </span>
                      )}
                      {studentProfile.program && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                          {studentProfile.program}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(studentProfile.courses || "").split(",").map(c => c.trim()).filter(Boolean).map(code => (
                        <span key={code} className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-2 py-0.5 rounded-full">{code}</span>
                      ))}
                    </div>
                  </div>
                  {/* Attendance rate gauge */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-black"
                      style={{
                        background: `conic-gradient(${PRESENT_COLOR} ${attendanceRate * 3.6}deg, #e5e7eb ${attendanceRate * 3.6}deg)`,
                      }}
                    >
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-700">{attendanceRate}%</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 mt-1">Attendance</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              {/* Pie Chart */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                <h3 className="font-bold text-gray-700 text-sm mb-3 self-start">Present vs Absent</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill={PRESENT_COLOR} />
                      <Cell fill={ABSENT_COLOR} />
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [`${v} (${pct(v, total)}%)`, n]}
                      contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* centre label */}
                <div className="flex gap-4 text-sm mt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: PRESENT_COLOR }} />
                    Present <strong>{totalPresent}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: ABSENT_COLOR }} />
                    Absent <strong>{totalAbsent}</strong>
                  </span>
                </div>
              </div>

              {/* Daily Trend Area */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm mb-4">Attendance Trend by Date</h3>
                {trendData.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center mt-10">No data for selected filters</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PRESENT_COLOR} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={PRESENT_COLOR} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ABSENT_COLOR} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={ABSENT_COLOR} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Present" stroke={PRESENT_COLOR} fill="url(#presentGrad)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Absent"  stroke={ABSENT_COLOR}  fill="url(#absentGrad)"  strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* By-Course Bar Chart (hidden if filtering by single student only) */}
            {byCourseData.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
                <h3 className="font-bold text-gray-700 text-sm mb-4">
                  {selStudent ? "Attendance by Course (this student)" : "Present vs Absent by Course"}
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byCourseData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="course" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Present" fill={PRESENT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Absent"  fill={ABSENT_COLOR}  radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Student-level table (top absentees)*/}
            {!selStudent && flatEntries.length > 0 && (() => {
              const stuMap = {};
              flatEntries.forEach(e => {
                const key = e.regNo;
                if (!stuMap[key]) stuMap[key] = { regNo: key, name: `${e.name} ${e.surname}`.trim(), present: 0, absent: 0 };
                e.status === "Present" ? stuMap[key].present++ : stuMap[key].absent++;
              });
              const rows = Object.values(stuMap)
                .map(r => ({ ...r, total: r.present + r.absent, rate: pct(r.present, r.present + r.absent) }))
                .sort((a, b) => a.rate - b.rate)
                .slice(0, 10);
              return (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 text-sm mb-4">Students with Lowest Attendance Rate</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 uppercase border-b">
                          <th className="text-left pb-2 font-semibold">Student</th>
                          <th className="text-left pb-2 font-semibold">Reg No</th>
                          <th className="text-right pb-2 font-semibold text-emerald-600">Present</th>
                          <th className="text-right pb-2 font-semibold text-rose-500">Absent</th>
                          <th className="text-right pb-2 font-semibold">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={row.regNo} className="border-b border-gray-50 hover:bg-gray-50 transition">
                            <td className="py-2 font-medium text-gray-700">{row.name || "—"}</td>
                            <td className="py-2 text-gray-400 text-xs">{row.regNo}</td>
                            <td className="py-2 text-right text-emerald-600 font-semibold">{row.present}</td>
                            <td className="py-2 text-right text-rose-500 font-semibold">{row.absent}</td>
                            <td className="py-2 text-right">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  background: row.rate >= 75 ? "#d1fae5" : row.rate >= 50 ? "#fef3c7" : "#fee2e2",
                                  color:      row.rate >= 75 ? "#065f46" : row.rate >= 50 ? "#92400e" : "#991b1b"
                                }}
                              >
                                {row.rate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}