import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/sidebar";

//Semantic color palette
const PRESENT_COLOR = "#10b981";
const ABSENT_COLOR  = "#1306069d";   

// Helper functions
function pct(a, total) {
  return total === 0 ? 0 : Math.round((a / total) * 100);
}

function getISOWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target - firstThursday;
  return 1 + Math.round(diff / 604800000);
}

function getWeekdayLabel(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
}

function getWeekLabel(date) {
  const week = String(getISOWeek(date)).padStart(2, "0");
  return `${date.getUTCFullYear()}-W${week}`;
}

function getMonthLabel(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function parseAttendanceDate(value) {
  if (!value) return null;
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate;
  const normalized = String(value).replace(/\s+/g, "T");
  const altDate = new Date(normalized);
  return Number.isNaN(altDate.getTime()) ? null : altDate;
}

function normalizeCourseList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(/[,;]+/).map(item => item.trim()).filter(Boolean);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = (payload[0]?.value ?? 0) + (payload[1]?.value ?? 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill || p.stroke }} className="flex justify-between gap-4">
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

function EmptyChartState({ filtered }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125C16.5 3.504 17.004 3 17.625 3h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700">
        {filtered ? "No records match these filters" : "No attendance records yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-gray-500">
        {filtered ? "Try a different department, course, years, or student." : "Charts will appear here after attendance is captured."}
      </p>
    </div>
  );
}

export default function Dashboard({ analyticsMode = false }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);  
  const [students, setStudents] = useState([]); 
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [selyears, setSelyears] = useState("all");
  const [selDept, setSelDept] = useState("");
  const [selProgram, setSelProgram] = useState("");
  const [selSession, setSelSession] = useState("");
  const [selCourse, setSelCourse] = useState(""); 
  const [selStudent, setSelStudent] = useState(""); 

  // 1. Fetch Course Data
  useEffect(() => {
    return onSnapshot(collection(db, "courses"), (snap) => {
      setCourses(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        courseName: d.data().courseName || d.id,
        department: d.data().department || "Unknown",
      })));
    });
  }, []);

  // 2. Fetch Student Data
  useEffect(() => {
    return onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map(d => ({
        id: d.id,
        regNo: d.data().regNo || d.id,
        name: `${d.data().name || ""} ${d.data().surname || ""}`.trim(),
        program: d.data().program || "",
        years: String(d.data().years || d.data().yearss || ""),
        department: d.data().department || "",
        enrolledCourses: d.data().assignedCourses || d.data().courses || [], 
      })));
    });
  }, []);

  // 3. Fetch Sessions
  useEffect(() => {
    return onSnapshot(collection(db, "sessions"), (snap) => {
        if (!snap.empty) {
            setSessions(snap.docs.map(d => ({
                id: d.id,
                name: d.data().name || d.id,
            })));
        } else {
            setSessions([
                { id: "Class", name: "Class" },
                { id: "Lab", name: "Lab" },
                { id: "Exam", name: "Exam" }
            ]);
        }
    });
  }, []);

  // 4. Fetch Programs
  useEffect(() => {
    return onSnapshot(collection(db, "programs"), (snap) => {
      if (!snap.empty) {
        setPrograms(snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id,
        })));
      } else {
        const uniqueProgs = [...new Set(students.map(s => s.program).filter(Boolean))];
        setPrograms(uniqueProgs.map(p => ({ id: p, name: p })));
      }
    });
  }, [students]);

  // 5. Fetch Attendance Data
  useEffect(() => {
    setLoading(true);
    return onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Derived Filter Options
  const uniqueDepts = useMemo(() => {
    const depts = courses.map(c => c.department).filter(d => d && d !== "Unassigned" && d !== "Unknown");
    return [...new Set(depts)].sort();
  }, [courses]);

  const filteredCourseOptions = useMemo(() => {
    return courses.filter(c => {
      if (selDept && c.department !== selDept) return false;
      return true;
    });
  }, [courses, selDept]);

  const filteredStudentOptions = useMemo(() => {
    return students.filter(s => {
      if (selDept && s.department !== selDept) return false;
      if (selProgram && s.program !== selProgram) return false;
      if (selyears !== "all" && s.years !== selyears) return false;
      if (selCourse) {
        const studentCourses = normalizeCourseList(s.enrolledCourses);
        if (!studentCourses.includes(selCourse)) return false;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selDept, selProgram, selyears, selCourse]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Process Flat Data for Charts
  const flatEntries = useMemo(() => {
    let filteredAttendance = attendance;

    if (selSession) {
      filteredAttendance = filteredAttendance.filter(doc => doc.sessionType === selSession);
    }

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
        const sInfo = students.find(s => s.regNo === entry.regNo);
        
        if (selProgram && sInfo?.program !== selProgram) return;
        if (selyears !== "all" && sInfo?.years !== selyears) return;
        if (selStudent && entry.regNo !== selStudent) return;

        rows.push({
          courseCode: doc.courseCode,
          date: doc.date || "Unknown",
          regNo: entry.regNo || "",
          status: entry.status || "Absent",
        });
      });
    });

    return rows;
  }, [attendance, selCourse, selDept, selStudent, selyears, selSession, selProgram, courses, students]);

  const studentInfoByReg = useMemo(() => {
    return Object.fromEntries(students.map(s => [s.regNo, { ...s }]));
  }, [students]);

  const studentAttendanceData = useMemo(() => {
    const map = {};
    attendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        const regNo = entry.regNo;
        if (!regNo) return;
        const row = map[regNo] ?? { regNo, present: 0, absent: 0, total: 0, courses: new Set() };
        if (entry.status === "Present") row.present += 1;
        else row.absent += 1;
        row.total += 1;
        row.courses.add(doc.courseCode);
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
        riskScore: row.total ? Math.round(100 - rate) : 0,
      };
    });
  }, [attendance, studentInfoByReg]);

  // Analytics Calculations
  const stats = useMemo(() => {
    const total = flatEntries.length;
    const present = flatEntries.filter(e => e.status === "Present").length;
    return { total, present, absent: total - present, rate: pct(present, total) };
  }, [flatEntries]);

  const todayStats = useMemo(() => {
    const todayRows = flatEntries.filter(e => e.date === todayStr);
    const total = todayRows.length;
    const present = todayRows.filter(e => e.status === "Present").length;
    return { total, present, absent: total - present, rate: pct(present, total) };
  }, [flatEntries, todayStr]);

  const buildGroupMetrics = (field) => {
    const groups = {};
    studentAttendanceData.forEach(student => {
      const label = student[field] || "Unknown";
      const row = groups[label] ?? { label, present: 0, absent: 0, total: 0, students: 0 };
      row.present += student.present || 0;
      row.absent += student.absent || 0;
      row.total += student.total || 0;
      row.students += 1;
      groups[label] = row;
    });
    return Object.values(groups)
      .filter(g => g.total > 0)
      .map(g => ({ ...g, rate: pct(g.present, g.total) }))
      .sort((a, b) => b.rate - a.rate);
  };

  const facultyComparison = useMemo(() => buildGroupMetrics("faculty"), [studentAttendanceData]);
  const departmentComparison = useMemo(() => buildGroupMetrics("department"), [studentAttendanceData]);

  const semesterAttendanceAverage = useMemo(() => {
    if (stats.total === 0) return 0;
    return stats.rate;
  }, [stats]);

  const weeklyAttendanceData = useMemo(() => {
    const map = {};
    flatEntries.forEach(entry => {
      const date = parseAttendanceDate(entry.date);
      if (!date || Number.isNaN(date.getTime())) return;
      const period = getWeekLabel(date);
      if (!map[period]) map[period] = { period, Present: 0, Absent: 0, total: 0 };
      map[period][entry.status === "Present" ? "Present" : "Absent"]++;
      map[period].total++;
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  }, [flatEntries]);

  const monthlyAttendanceData = useMemo(() => {
    const map = {};
    flatEntries.forEach(entry => {
      const date = parseAttendanceDate(entry.date);
      if (!date || Number.isNaN(date.getTime())) return;
      const period = getMonthLabel(date);
      if (!map[period]) map[period] = { period, Present: 0, Absent: 0, total: 0 };
      map[period][entry.status === "Present" ? "Present" : "Absent"]++;
      map[period].total++;
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  }, [flatEntries]);

  const semesterTrendData = useMemo(() => {
    return monthlyAttendanceData.map(item => ({
      period: item.period,
      rate: pct(item.Present, item.total),
      Present: item.Present,
      Absent: item.Absent,
    }));
  }, [monthlyAttendanceData]);

  const hasActiveFilters = !!(selSession || selProgram || selDept || selCourse || selyears !== "all" || selStudent);
  const lateArrivalsToday = todayStats.total;

  const atRiskStudents = useMemo(() => {
    return studentAttendanceData
      .filter(s => s.total > 0 && s.rate < 75)
      .map(s => ({
        ...s,
        riskLevel: s.rate < 50 ? "Critical" : s.rate < 60 ? "High" : "Medium",
        consecutiveAbsences: 0,
      }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 20);
  }, [studentAttendanceData]);

  const courseAnalytics = useMemo(() => {
    const courseMap = {};
    attendance.forEach(doc => {
      if (!courseMap[doc.courseCode]) {
        courseMap[doc.courseCode] = {
          courseCode: doc.courseCode,
          courseName: courses.find(c => c.id === doc.courseCode)?.courseName || doc.courseCode,
          totalRecords: 0,
          present: 0,
          absent: 0,
          dates: [],
        };
      }
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      courseMap[doc.courseCode].totalRecords += list.length;
      courseMap[doc.courseCode].present += list.filter(e => e.status === "Present").length;
      courseMap[doc.courseCode].absent += list.filter(e => e.status !== "Present").length;
      courseMap[doc.courseCode].dates.push(doc.date);
    });

    return Object.values(courseMap)
      .map(c => ({
        ...c,
        avgAttendance: c.totalRecords > 0 ? pct(c.present, c.totalRecords) : 0,
      }))
      .sort((a, b) => b.avgAttendance - a.avgAttendance);
  }, [attendance, courses]);

  const weekdayAttendanceData = useMemo(() => {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => ({
      day,
      present: 0,
      absent: 0,
      total: 0,
    }));

    flatEntries.forEach(entry => {
      const date = parseAttendanceDate(entry.date);
      if (date && !Number.isNaN(date.getTime())) {
        const dayIndex = date.getDay();
        if (entry.status === "Present") weekdays[dayIndex].present++;
        else weekdays[dayIndex].absent++;
        weekdays[dayIndex].total++;
      }
    });

    return weekdays.map(d => ({
      ...d,
      rate: d.total > 0 ? pct(d.present, d.total) : 0,
    }));
  }, [flatEntries]);

  const clearAll = useCallback(() => {
    setSelyears("all"); setSelDept("");
    setSelProgram(""); setSelSession("");
    setSelCourse(""); setSelStudent("");
  }, []);

  const trendData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      if (!map[e.date]) map[e.date] = { date: e.date, Present: 0, Absent: 0 };
      e.status === "Present" ? map[e.date].Present++ : map[e.date].Absent++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [flatEntries]);

  const hasChartData = stats.total > 0;
  const selectClass = "w-full rounded-xl border border-teal-400 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer appearance-none";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-md">
          <div>
            <h1 className="text-white text-lg tracking-tight font-bold">Attendance Insights</h1>
            <p className="text-teal-100 text-sm">Monitoring {courses.length} courses and {students.length} students</p>
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

        {/* Filter Section */}
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm overflow-x-auto">
            <div className="min-w-[1200px] grid grid-cols-6 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Session Type</label>
                <select value={selSession} onChange={e => setSelSession(e.target.value)} className={selectClass}>
                  <option value="">All Types</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Program</label>
                <select value={selProgram} onChange={e => setSelProgram(e.target.value)} className={selectClass}>
                  <option value="">All Programs</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Department</label>
                <select value={selDept} onChange={e => setSelDept(e.target.value)} className={selectClass}>
                  <option value="">All Departments</option>
                  {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Course</label>
                <select value={selCourse} onChange={e => setSelCourse(e.target.value)} className={selectClass}>
                  <option value="">All Courses</option>
                  {filteredCourseOptions.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">years</label>
                <select value={selyears} onChange={e => setSelyears(e.target.value)} className={selectClass}>
                  <option value="all">All years</option>
                  {["1","2","3","4","5"].map(y => <option key={y} value={y}>years {y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Student</label>
                <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className={selectClass}>
                  <option value="">Search Student</option>
                  {filteredStudentOptions.map(s => <option key={s.regNo} value={s.regNo}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={clearAll} className="text-xs bg-teal-500 text-white px-3 py-1.5 rounded-lg font-medium">Reset Filters</button>
            </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* STUDENT METRICS */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Student Metrics</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {/*Green cards first*/}
                <StatCard label="Total Registered"  value={filteredStudentOptions.length}                                         accent={PRESENT_COLOR} />
                <StatCard label="Present Today"      value={todayStats.present}                                                   accent={PRESENT_COLOR} />
                <StatCard label="Attendance %"       value={`${stats.rate}%`}                                                     accent={PRESENT_COLOR} />
                {/*Red cards grouped*/}
                <StatCard label="Absent Today"       value={todayStats.absent}                                                    accent={ABSENT_COLOR}  />
                <StatCard label="At Risk (<75%)"     value={studentAttendanceData.filter(s => s.rate < 75 && s.total > 0).length} accent={ABSENT_COLOR}  />
                <StatCard label="Late Arrivals"      value={lateArrivalsToday}                                                    accent={ABSENT_COLOR}  />
              </div>
            </div>

            {/* INSTITUTIONAL METRICS */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Institutional Metrics</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {/*Green cards first*/}
                <StatCard
                  label="Best Department"
                  value={departmentComparison.length > 0 ? departmentComparison[0].label : "N/A"}
                  sub={departmentComparison.length > 0 ? `${departmentComparison[0].rate}% attendance` : ""}
                  accent={PRESENT_COLOR}
                />
                <StatCard
                  label="Semester Average"
                  value={`${semesterAttendanceAverage}%`}
                  accent={PRESENT_COLOR}
                />
                {/*Red card last*/}
                <StatCard
                  label="Lowest Department"
                  value={departmentComparison.length > 0 ? departmentComparison[departmentComparison.length - 1].label : "N/A"}
                  sub={departmentComparison.length > 0 ? `${departmentComparison[departmentComparison.length - 1].rate}% attendance` : ""}
                  accent={ABSENT_COLOR}
                />
              </div>
            </div>

            {/* DAILY TREND CHART */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-2">Daily Attendance Trends</h2>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="Present" stroke={PRESENT_COLOR} strokeWidth={3} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Absent"  stroke={ABSENT_COLOR}  strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState filtered={hasActiveFilters} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-6">
              {/* WEEKLY & MONTHLY */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-2">Weekly and Monthly Attendance</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Weekly Attendance</h3>
                    {weeklyAttendanceData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={weeklyAttendanceData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={45} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Line type="monotone" dataKey="Present" stroke={PRESENT_COLOR} strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="Absent"  stroke={ABSENT_COLOR}  strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChartState filtered={hasActiveFilters} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Monthly Attendance</h3>
                    {monthlyAttendanceData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={monthlyAttendanceData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={45} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Line type="monotone" dataKey="Present" stroke={PRESENT_COLOR} strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="Absent"  stroke={ABSENT_COLOR}  strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChartState filtered={hasActiveFilters} />
                    )}
                  </div>
                </div>
              </div>

              {/* SEMESTER TREND */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-2">Semester Performance Trends</h2>
                {semesterTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={semesterTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={45} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="rate" stroke={PRESENT_COLOR} strokeWidth={3} dot={{ r: 4 }} name="Attendance %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState filtered={hasActiveFilters} />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}