import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
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

function getISOWeek(date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );

  const dayNr = (target.getUTCDay() + 6) % 7;

  target.setUTCDate(target.getUTCDate() - dayNr + 3);

  const firstThursday = new Date(
    Date.UTC(target.getUTCFullYear(), 0, 4)
  );

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

  return String(value || "")
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeProgram(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload || {};
  const present = row.Present ?? 0;
  const absent = row.Absent ?? 0;
  const total = present + absent;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">Date: {label}</p>

      <p className="flex justify-between gap-4" style={{ color: PRESENT_COLOR }}>
        <span>Present</span>
        <span className="font-bold">
          {present} ({pct(present, total)}%)
        </span>
      </p>

      <p className="flex justify-between gap-4" style={{ color: ABSENT_COLOR }}>
        <span>Absent</span>
        <span className="font-bold">
          {absent} ({pct(absent, total)}%)
        </span>
      </p>

      <p className="text-gray-400 text-xs mt-1 border-t pt-1">
        Total: {total}
      </p>
    </div>
  );
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1 shadow-sm border min-h-[120px]"
      style={{
        borderColor: accent + "33",
        background: accent + "0d",
      }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {label}
      </span>

      <span className="text-3xl font-black text-gray-800 break-words">
        {value}
      </span>

      {sub && (
        <span className="text-xs text-gray-500">{sub}</span>
      )}
    </div>
  );
}

function EmptyChartState({ filtered }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125C16.5 3.504 17.004 3 17.625 3h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          />
        </svg>
      </div>

      <p className="text-sm font-semibold text-gray-700">
        {filtered
          ? "No records for these selected filters"
          : "No attendance records yet"}
      </p>

      <p className="mt-1 max-w-xs text-xs text-gray-500">
        {filtered
          ? "Try selecting different filters."
          : "Charts will appear."}
      </p>
    </div>
  );
}

export default function Dashboard({ analyticsMode = false }) {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState([]);

  const [showProfileMenu, setShowProfileMenu] =
    useState(false);

  const [selyears, setSelyears] = useState("all");
  const [selDept, setSelDept] = useState("");
  const [selProgram, setSelProgram] = useState("");
  const [selSession, setSelSession] = useState("");
  const [selCourse, setSelCourse] = useState("");
  const [selStudent, setSelStudent] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "courses"), (snap) => {
      setCourses(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          courseName: d.data().courseName || d.id,
          department: d.data().department || "Unknown",
        }))
      );
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "students"), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          regNo:
            d.data().regno || d.data().regNo || d.id,

          name: `${d.data().name || ""} ${
            d.data().surname || ""
          }`.trim(),

          program: d.data().program || "",

          years: String(
            d.data().years || d.data().yearss || ""
          ),

          department: d.data().department || "",

          enrolledCourses:
            d.data().assignedCourses ||
            d.data().courses ||
            [],
        }))
      );
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "sessions"), (snap) => {
      if (!snap.empty) {
        setSessions(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
          }))
        );
      } else {
        setSessions([
          { id: "Class", name: "Class" },
          { id: "Lab", name: "Lab" },
          { id: "Exam", name: "Exam" },
        ]);
      }
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "programs"), (snap) => {
      if (!snap.empty) {
        const programMap = new Map();

        snap.docs.forEach((d) => {
          const name = d.data().name || d.id;
          const key = normalizeProgram(name);
          if (!key) return;

          programMap.set(key, {
            id: d.id,
            name,
            value: key,
          });
        });

        setPrograms([...programMap.values()]);
      } else {
        const programMap = new Map();

        students.forEach((s) => {
          const key = normalizeProgram(s.program);
          if (!key || programMap.has(key)) return;

          programMap.set(key, {
            id: s.program,
            name: s.program,
            value: key,
          });
        });

        setPrograms([...programMap.values()]);
      }
    });
  }, [students]);

  useEffect(() => {
    setLoading(true);

    return onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendance(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      setLoading(false);
    });
  }, []);

  const uniqueDepts = useMemo(() => {
    const depts = courses
      .map((c) => c.department)
      .filter(
        (d) =>
          d &&
          d !== "Unassigned" &&
          d !== "Unknown"
      );

    return [...new Set(depts)].sort();
  }, [courses]);

  const filteredCourseOptions = useMemo(() => {
    return courses.filter((c) => {
      if (selDept && c.department !== selDept)
        return false;

      return true;
    });
  }, [courses, selDept]);

  const filteredStudentOptions = useMemo(() => {
    return students
      .filter((s) => {
        if (selDept && s.department !== selDept)
          return false;

        if (
          selProgram &&
          normalizeProgram(s.program) !== selProgram
        )
          return false;

        if (
          selyears !== "all" &&
          s.years !== selyears
        )
          return false;

        if (selCourse) {
          const studentCourses = normalizeCourseList(
            s.enrolledCourses
          );

          if (!studentCourses.includes(selCourse))
            return false;
        }

        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    students,
    selDept,
    selProgram,
    selyears,
    selCourse,
  ]);

  const todayStr = useMemo(
    () => new Date().toISOString().split("T")[0],
    []
  );

  const studentMap = useMemo(() => {
    return Object.fromEntries(
      students.map((s) => [s.regNo, s])
    );
  }, [students]);

  const flatEntries = useMemo(() => {
    const rows = [];

    const filteredDocs = attendance.filter((doc) => {
      if (
        selSession &&
        doc.sessionType !== selSession
      )
        return false;

      if (selCourse && doc.courseCode !== selCourse)
        return false;

      if (selDept && !selCourse) {
        const deptCourseIds = new Set(
          courses
            .filter((c) => c.department === selDept)
            .map((c) => c.id)
        );

        if (!deptCourseIds.has(doc.courseCode))
          return false;
      }

      return true;
    });

    filteredDocs.forEach((doc) => {
      const list = Array.isArray(doc.fullAttendanceList)
        ? doc.fullAttendanceList
        : [];

      list.forEach((entry) => {
        const sInfo = studentMap[entry.regNo];

        if (selStudent && entry.regNo !== selStudent)
          return;

        if (
          selProgram &&
          normalizeProgram(sInfo?.program) !== selProgram
        )
          return;

        if (
          selyears !== "all" &&
          sInfo?.years !== selyears
        )
          return;

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
  }, [
    attendance,
    selCourse,
    selDept,
    selStudent,
    selyears,
    selSession,
    selProgram,
    courses,
    studentMap,
  ]);

  const stats = useMemo(() => {
    const total = flatEntries.length;

    const present = flatEntries.filter(
      (e) => e.status === "Present"
    ).length;

    return {
      total,
      present,
      absent: total - present,
      rate: pct(present, total),
    };
  }, [flatEntries]);

  const todayStats = useMemo(() => {
    const todayRows = flatEntries.filter(
      (e) => e.date === todayStr
    );

    const total = todayRows.length;

    const present = todayRows.filter(
      (e) => e.status === "Present"
    ).length;

    return {
      total,
      present,
      absent: total - present,
      rate: pct(present, total),
    };
  }, [flatEntries, todayStr]);

  const studentAttendanceData = useMemo(() => {
    const map = {};

    flatEntries.forEach((e) => {
      const row =
        map[e.regNo] ?? {
          regNo: e.regNo,
          present: 0,
          absent: 0,
          total: 0,
        };

      if (e.status === "Present")
        row.present += 1;
      else row.absent += 1;

      row.total += 1;

      map[e.regNo] = row;
    });

    return Object.values(map).map((row) => {
      const s = studentMap[row.regNo] || {};

      const rate = row.total
        ? pct(row.present, row.total)
        : 0;

      return {
        ...row,
        ...s,
        rate,
      };
    });
  }, [flatEntries, studentMap]);

  const trendData = useMemo(() => {
    const map = {};

    flatEntries.forEach((e) => {
      if (!map[e.date]) {
        map[e.date] = {
          date: e.date,
          Present: 0,
          Absent: 0,
        };
      }

      e.status === "Present"
        ? map[e.date].Present++
        : map[e.date].Absent++;
    });

    return Object.values(map).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [flatEntries]);

  const clearAll = useCallback(() => {
    setSelyears("all");
    setSelDept("");
    setSelProgram("");
    setSelSession("");
    setSelCourse("");
    setSelStudent("");
  }, []);

  const hasActiveFilters = !!(
    selSession ||
    selProgram ||
    selDept ||
    selCourse ||
    selyears !== "all" ||
    selStudent
  );

  const selectClass =
    "w-full rounded-xl border border-teal-400 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer appearance-none";

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-50 h-full transform bg-white transition-transform duration-300 sm:static sm:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <Sidebar
          drawerMode
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">

        {/* Top Header */}
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-md">

          {/* Mobile Top Row */}
          <div className="flex items-center justify-between w-full">

            {/* Hamburger */}
            <button
              onClick={() =>
                setSidebarOpen(!sidebarOpen)
              }
              className="sm:hidden rounded-xl bg-white/20 p-2 text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            {/* Title */}
            <div className="flex-1 ml-3">
              <h1 className="text-white text-lg sm:text-xl tracking-tight font-bold">
                Dashboard
              </h1>

              
            </div>

            {/* Profile */}
            <button
              onClick={() =>
                setShowProfileMenu(!showProfileMenu)
              }
              className="rounded-full p-2 text-white hover:bg-teal-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.0}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
            </button>
          </div>

          {/* Profile Menu */}
          {showProfileMenu && (
            <div className="absolute right-2 top-full z-40 mt-2 w-28 rounded-xl bg-white text-left shadow-lg border">
              <button
                onClick={() => navigate("/")}
                className="w-full px-4 py-3 text-sm text-slate-700 hover:bg-gray-50 rounded-xl"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                Session Type
              </label>

              <select
                value={selSession}
                onChange={(e) =>
                  setSelSession(e.target.value)
                }
                className={selectClass}
              >
                <option value="">All Types</option>

                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                Program
              </label>

              <select
                value={selProgram}
                onChange={(e) =>
                  setSelProgram(e.target.value)
                }
                className={selectClass}
              >
                <option value="">All Programs</option>

                {programs.map((p) => (
                  <option key={p.value || p.id} value={p.value}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                Department
              </label>

              <select
                value={selDept}
                onChange={(e) =>
                  setSelDept(e.target.value)
                }
                className={selectClass}
              >
                <option value="">All Departments</option>

                {uniqueDepts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                Course
              </label>

              <select
                value={selCourse}
                onChange={(e) =>
                  setSelCourse(e.target.value)
                }
                className={selectClass}
              >
                <option value="">All Courses</option>

                {filteredCourseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                Years
              </label>

              <select
                value={selyears}
                onChange={(e) =>
                  setSelyears(e.target.value)
                }
                className={selectClass}
              >
                <option value="all">All Years</option>

                {["1", "2", "3", "4", "5"].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                Student
              </label>

              <select
                value={selStudent}
                onChange={(e) =>
                  setSelStudent(e.target.value)
                }
                className={selectClass}
              >
                <option value="">Search Student</option>

                {filteredStudentOptions.map((s) => (
                  <option
                    key={s.regNo}
                    value={s.regNo}
                  >
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={clearAll}
              className="text-sm bg-teal-500 text-white px-4 py-2 rounded-xl font-medium w-full sm:w-auto"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Student Metrics */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Student Metrics
              </h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  label="Total Selected Entries"
                  value={flatEntries.length}
                  accent={PRESENT_COLOR}
                />

                <StatCard
                  label="Present (based on selected)"
                  value={stats.present}
                  accent={PRESENT_COLOR}
                />

                <StatCard
                  label="Attendance"
                  value={`${stats.rate}%`}
                  accent={PRESENT_COLOR}
                />

                <StatCard
                  label="Absent (Selected)"
                  value={stats.absent}
                  accent={ABSENT_COLOR}
                />

                <StatCard
                  label="At Risk entries"
                  value={
                    studentAttendanceData.filter(
                      (s) => s.rate < 75
                    ).length
                  }
                  accent={ABSENT_COLOR}
                />

                <StatCard
                  label="Today's Entries"
                  value={todayStats.total}
                  accent={ABSENT_COLOR}
                />
              </div>
            </div>

            {/* Daily Trends */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                Daily Attendance Trends
              </h2>

              <div className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 overflow-x-auto">

                {trendData.length > 0 ? (
                  <div className="min-w-[600px]">
                    <ResponsiveContainer
                      width="100%"
                      height={300}
                    >
                      <LineChart data={trendData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />

                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                        />

                        <YAxis
                          tick={{ fontSize: 11 }}
                        />

                        <Tooltip
                          content={<CustomTooltip />}
                        />

                        <Legend />

                        <Line
                          type="monotone"
                          dataKey="Present"
                          stroke={PRESENT_COLOR}
                          strokeWidth={3}
                          dot={{ r: 3 }}
                        />

                        <Line
                          type="monotone"
                          dataKey="Absent"
                          stroke={ABSENT_COLOR}
                          strokeWidth={3}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState
                    filtered={hasActiveFilters}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
