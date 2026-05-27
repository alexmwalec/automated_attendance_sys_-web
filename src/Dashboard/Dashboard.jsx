import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ResponsiveContainer
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/sidebar";

const PRESENT_COLOR = "#10b981";
const ABSENT_COLOR  = "#1306069d";   

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

  useEffect(() => {
    return onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map(d => ({
        id: d.id,
        regNo: d.data().regno || d.data().regNo || d.id, 
        name: `${d.data().name || ""} ${d.data().surname || ""}`.trim(),
        program: d.data().program || "", // String matching program collection name
        years: String(d.data().years || d.data().yearss || ""),
        department: d.data().department || "",
        enrolledCourses: d.data().assignedCourses || d.data().courses || [], 
      })));
    });
  }, []);

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

  useEffect(() => {
    return onSnapshot(collection(db, "programs"), (snap) => {
      if (!snap.empty) {
        setPrograms(snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id, // Using 'name' field from programs collection
        })));
      } else {
        const uniqueProgs = [...new Set(students.map(s => s.program).filter(Boolean))];
        setPrograms(uniqueProgs.map(p => ({ id: p, name: p })));
      }
    });
  }, [students]);

  useEffect(() => {
    setLoading(true);
    return onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

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

  const studentMap = useMemo(() => {
    return Object.fromEntries(students.map(s => [s.regNo, s]));
  }, [students]);

  const flatEntries = useMemo(() => {
    const rows = [];
    const filteredDocs = attendance.filter(doc => {
      if (selSession && doc.sessionType !== selSession) return false;
      if (selCourse && doc.courseCode !== selCourse) return false;
      if (selDept && !selCourse) {
        const deptCourseIds = new Set(courses.filter(c => c.department === selDept).map(c => c.id));
        if (!deptCourseIds.has(doc.courseCode)) return false;
      }
      return true;
    });

    filteredDocs.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        const sInfo = studentMap[entry.regNo];
        if (selStudent && entry.regNo !== selStudent) return;
        if (selProgram && sInfo?.program !== selProgram) return;
        if (selyears !== "all" && sInfo?.years !== selyears) return;

        rows.push({
          courseCode: doc.courseCode,
          date: doc.date || "Unknown",
          regNo: entry.regNo || "",
          status: entry.status || "Absent",
          sessionType: doc.sessionType,
        });
      });
    });
    return rows;
  }, [attendance, selCourse, selDept, selStudent, selyears, selSession, selProgram, courses, studentMap]);

  const stats = useMemo(() => {
    const total = flatEntries.length;
    const present = flatEntries.filter(e => e.status === "Present").length;
    return { 
        total, 
        present, 
        absent: total - present, 
        rate: pct(present, total) 
    };
  }, [flatEntries]);

  const todayStats = useMemo(() => {
    const todayRows = flatEntries.filter(e => e.date === todayStr);
    const total = todayRows.length;
    const present = todayRows.filter(e => e.status === "Present").length;
    return { 
        total, 
        present, 
        absent: total - present, 
        rate: pct(present, total) 
    };
  }, [flatEntries, todayStr]);

  const studentAttendanceData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      const row = map[e.regNo] ?? { regNo: e.regNo, present: 0, absent: 0, total: 0 };
      if (e.status === "Present") row.present += 1;
      else row.absent += 1;
      row.total += 1;
      map[e.regNo] = row;
    });

    return Object.values(map).map(row => {
      const s = studentMap[row.regNo] || {};
      const rate = row.total ? pct(row.present, row.total) : 0;
      return { ...row, ...s, rate };
    });
  }, [flatEntries, studentMap]);

  const buildGroupMetrics = (field) => {
    const groups = {};
    studentAttendanceData.forEach(student => {
      const label = student[field] || "Unknown";
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
  };

  const institutionalComparison = useMemo(() => {
      const metrics = buildGroupMetrics("department");
      return metrics.filter(m => 
        m.label.trim() === "Computer Science" || 
        m.label.trim() === "History"
      );
  }, [studentAttendanceData]);

  const trendData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      if (!map[e.date]) map[e.date] = { date: e.date, Present: 0, Absent: 0 };
      e.status === "Present" ? map[e.date].Present++ : map[e.date].Absent++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [flatEntries]);

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

  const clearAll = useCallback(() => {
    setSelyears("all"); setSelDept("");
    setSelProgram(""); setSelSession("");
    setSelCourse(""); setSelStudent("");
  }, []);

  const hasActiveFilters = !!(selSession || selProgram || selDept || selCourse || selyears !== "all" || selStudent);
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
                  {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                  {filteredCourseOptions.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Years</label>
                <select value={selyears} onChange={e => setSelyears(e.target.value)} className={selectClass}>
                  <option value="all">All Years</option>
                  {["1","2","3","4","5"].map(y => <option key={y} value={y}>Year {y}</option>)}
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
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Student Metrics</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <StatCard label="Selected Entries"    value={flatEntries.length}                                                   accent={PRESENT_COLOR} />
                <StatCard label="Present (Selected)"  value={stats.present}                                                        accent={PRESENT_COLOR} />
                <StatCard label="Attendance"          value={stats.rate}                                                           accent={PRESENT_COLOR} />
                <StatCard label="Absent (Selected)"   value={stats.absent}                                                         accent={ABSENT_COLOR}  />
                <StatCard label="At Risk entries"     value={studentAttendanceData.filter(s => s.rate < 75).length}                accent={ABSENT_COLOR}  />
                <StatCard label="Today's Entries"     value={todayStats.total}                                                     accent={ABSENT_COLOR}  />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Institutional Metrics</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <StatCard
                  label="Top Segment"
                  value={institutionalComparison.length > 0 ? institutionalComparison[0].label : "N/A"}
                  sub={institutionalComparison.length > 0 ? "Highest Attendance" : ""}
                  accent={PRESENT_COLOR}
                />
                <StatCard
                  label="Segment Average"
                  value={stats.rate}
                  accent={PRESENT_COLOR}
                />
                <StatCard
                  label="Lowest Segment"
                  value={institutionalComparison.length > 1 ? institutionalComparison[institutionalComparison.length - 1].label : "N/A"}
                  sub={institutionalComparison.length > 1 ? "Lowest Attendance" : ""}
                  accent={ABSENT_COLOR}
                />
              </div>
            </div>

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

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-2">Semester Performance Trends</h2>
                {semesterTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={semesterTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={45} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="rate" stroke={PRESENT_COLOR} strokeWidth={3} dot={{ r: 4 }} name="Attendance" />
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