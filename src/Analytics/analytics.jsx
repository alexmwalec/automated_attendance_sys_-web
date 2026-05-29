import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ResponsiveContainer,
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/sidebar";

const ABSENT_COLOR = "#1306069d";
const PRESENT_COLOR = "#10b981";
const TABLE_PAGE_SIZE = 10;

// Converts raw counts into the rounded percentage used across charts and tables.
function attpercentage(a, total) {
  return total === 0 ? 0 : Math.round((a / total) * 100);
}

// Attendance dates may come from Firestore timestamps or stored string values.
function parseAttendanceDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();

  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate;

  const normalized = String(value).replace(/\s+/g, "T");
  const altDate = new Date(normalized);
  return Number.isNaN(altDate.getTime()) ? null : altDate;
}

function normalizeCourseCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeStudentName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeProgram(value) {
  return String(value || "").trim();
}

// Keeps unknown/missing years at the bottom while sorting real year values.
function getYearSortValue(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function isKnownStudentName(value) {
  const normalized = normalizeStudentName(value);
  return normalized && normalized !== "UNKNOWN";
}

function getStudentName(data) {
  return (
    data.studentName ||
    data.displayName ||
    `${data.name || ""} ${data.surname || ""}`.trim()
  );
}

// Prefer newer non-empty fields when duplicated student records share a name.
function mergeStudentData(existing, next) {
  if (!existing) return next;

  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== "")
    ),
  };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const hasBreakdown =
    row.present !== undefined ||
    row.absent !== undefined ||
    row.total !== undefined;
  const present = row.present ?? payload.find((p) => p.dataKey === "present")?.value ?? 0;
  const absent = row.absent ?? payload.find((p) => p.dataKey === "absent")?.value ?? 0;
  const total = row.total ?? present + absent;
  const rate = row.rate ?? (total > 0 ? attpercentage(present, total) : 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>

      {!hasBreakdown ? (
        payload.map((p) => (
          <p key={p.name} style={{ color: p.fill || p.stroke }} className="flex justify-between gap-4">
            <span>{p.name}</span>
            <span className="font-bold">{p.value}%</span>
          </p>
        ))
      ) : (
        <>
          {typeof row.rate === "number" && (
        <p className="flex justify-between gap-4 text-teal-600">
          <span>Attendance</span>
          <span className="font-bold">{rate}%</span>
        </p>
          )}

          <p className="flex justify-between gap-4" style={{ color: PRESENT_COLOR }}>
            <span>Present</span>
            <span className="font-bold">{present}</span>
          </p>

          <p className="flex justify-between gap-4" style={{ color: ABSENT_COLOR }}>
            <span>Absent</span>
            <span className="font-bold">{absent}</span>
          </p>

          <p className="text-gray-400 text-xs mt-1 border-t pt-1">Total: {total}</p>
        </>
      )}
    </div>
  );
};

function EmptyChartState() {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
      <p className="text-sm font-semibold text-gray-700">no attendance records so far</p>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [atRiskProgramFilter, setAtRiskProgramFilter] = useState("");
  const [atRiskSort, setAtRiskSort] = useState("risk");
  const [atRiskPage, setAtRiskPage] = useState(1);
  const [coursePage, setCoursePage] = useState(1);

  // Load course definitions so courses with no attendance still appear in analytics.
  useEffect(() => {
    return onSnapshot(collection(db, "courses"), (snap) => {
      const courseMap = new Map();

      snap.docs.forEach(d => {
        const data = d.data();
        const id = data.courseCode || data.id || d.id;
        const courseKey = normalizeCourseCode(id);
        if (!courseKey) return;

        courseMap.set(courseKey, {
          id,
          courseKey,
          courseName: data.courseName || data.name || id,
          department: data.department || "Unknown",
        });
      });

      setCourses([...courseMap.values()]);
    });
  }, []);

  // Build a student lookup keyed by normalized name for joining attendance entries.
  useEffect(() => {
    return onSnapshot(collection(db, "students"), (snap) => {
      const studentMap = new Map();

      snap.docs.forEach(d => {
        const data = d.data();
        const name = getStudentName(data);
        if (!isKnownStudentName(name)) return;

        const nameKey = normalizeStudentName(name);

        const student = {
          id: d.id,
          regNo: data.regno || data.regNo || data.registrationNumber || "",
          name,
          nameKey,
          program: data.program || "",
          department: data.department || "",
          coursesStr: data.courses || data.assignedCourses || "",
          years: String(data.years || data.yearss || data.year || ""),
        };

        studentMap.set(
          nameKey,
          mergeStudentData(studentMap.get(nameKey), student)
        );
      });

      setStudents([...studentMap.values()]);
    });
  }, []);

  // Attendance records drive the charts, risk table, and course summaries.
  useEffect(() => {
    setLoading(true);
    return onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);


  // Fast lookup for adding student metadata to attendance-derived rows.
  const stuInfobyName = useMemo(() => {
    return Object.fromEntries(students.map(s => [s.nameKey, { ...s }]));
  }, [students]);


  // Flatten fullAttendanceList entries and remove duplicate student/session rows.
  const flEntrys = useMemo(() => {
    const rows = [];
    const seen = new Set();

    attendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        const studentName = getStudentName(entry);
        if (!isKnownStudentName(studentName)) return;

        const nameKey = normalizeStudentName(studentName);

        const courseCode = doc.courseCode || "";
        const sessionType = doc.sessionType || "";
        const date = doc.date || "";
        const rowKey = [
          normalizeCourseCode(courseCode),
          date,
          sessionType,
          nameKey,
        ].join("|");

        const status = entry.status || "";
        if (!status) return;

        if (seen.has(rowKey)) return;
        seen.add(rowKey);

        rows.push({
          courseCode,
          dateObject: parseAttendanceDate(doc.timestamp || doc.date),
          date,
          name: studentName,
          nameKey,
          sessionType,
          status,
        });
      });
    });

    return rows;
  }, [attendance]);


  // Aggregate each student's present/absent totals, then attach profile details.
  const stuAttData = useMemo(() => {
    const map = {};

    flEntrys.forEach(entry => {
      const row = map[entry.nameKey] ?? {
        name: entry.name,
        nameKey: entry.nameKey,
        present: 0,
        absent: 0,
        total: 0,
      };

      if (entry.status === "Present") row.present += 1;
      else row.absent += 1;
      row.total += 1;
      map[entry.nameKey] = row;
    });

    return Object.values(map).map(row => {
      const s = stuInfobyName[row.nameKey] || {};
      const rate = row.total ? attpercentage(row.present, row.total) : 0;

      return {
        ...row,
        ...s,
        regNo: s.regNo || "",
        program: s.program || "",
        years: s.years || "",
        rate,
        displayName: s.name || row.name,
      };
    });
  }, [flEntrys, stuInfobyName]);

  // Students below 50% attendance are considered at risk.
  const atRiskStudents = useMemo(() => {
    return stuAttData
      .filter(s => s.rate < 50)
      .sort((a, b) => a.rate - b.rate || b.absent - a.absent);
  }, [stuAttData]);

  // Summarize attendance totals per course without changing the raw attendance data.
  const courseAnalytics = useMemo(() => {
    const courseMap = {};

    courses.forEach(c => {
      courseMap[c.courseKey] = {
        courseCode: c.id,
        courseKey: c.courseKey,
        totalRecords: 0,
        absent: 0,
        present: 0,
      };
    });

    flEntrys.forEach(entry => {
      const code = normalizeCourseCode(entry.courseCode);
      if (!code) return;

      if (!courseMap[code]) {
        courseMap[code] = {
          courseCode: entry.courseCode,
          courseKey: code,
          totalRecords: 0,
          absent: 0,
          present: 0,
        };
      }

      courseMap[code].totalRecords += 1;
      if (entry.status === "Present") courseMap[code].present += 1;
      else courseMap[code].absent += 1;
    });

    return Object.values(courseMap)
      .map(c => ({ ...c, avgAttendance: c.totalRecords > 0 ? attpercentage(c.present, c.totalRecords) : 0 }))
      .sort((a, b) => b.avgAttendance - a.avgAttendance);
  }, [flEntrys, courses]);

  // Program options come from the current at-risk set.
  const atRiskPrograms = useMemo(() => {
    return [...new Set(
      atRiskStudents
        .map(student => normalizeProgram(student.program))
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [atRiskStudents]);

  // Apply the selected program filter and table sort after risk logic is calculated.
  const filteredAtRiskStudents = useMemo(() => {
    const rows = atRiskStudents.filter(student => {
      if (!atRiskProgramFilter) return true;
      return normalizeProgram(student.program) === atRiskProgramFilter;
    });

    if (atRiskSort === "name-asc" || atRiskSort === "name-desc") {
      return [...rows].sort((a, b) => {
        const comparison = (a.displayName || "").localeCompare(b.displayName || "");
        return atRiskSort === "name-asc" ? comparison : -comparison;
      });
    }

    if (atRiskSort === "year-asc" || atRiskSort === "year-desc") {
      return [...rows].sort((a, b) => {
        const yearA = getYearSortValue(a.years);
        const yearB = getYearSortValue(b.years);

        if (yearA === Number.MAX_SAFE_INTEGER && yearB !== Number.MAX_SAFE_INTEGER) return 1;
        if (yearB === Number.MAX_SAFE_INTEGER && yearA !== Number.MAX_SAFE_INTEGER) return -1;
        if (yearA !== yearB) {
          return atRiskSort === "year-asc" ? yearA - yearB : yearB - yearA;
        }

        return (a.displayName || "").localeCompare(b.displayName || "");
      });
    }

    return rows;
  }, [atRiskStudents, atRiskProgramFilter, atRiskSort]);

  // Paginate the two long tables at 10 rows so they stay readable as data grows.
  const atRiskTotalPages = Math.max(1, Math.ceil(filteredAtRiskStudents.length / TABLE_PAGE_SIZE));
  const paginatedAtRiskStudents = useMemo(() => {
    const start = (atRiskPage - 1) * TABLE_PAGE_SIZE;
    return filteredAtRiskStudents.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredAtRiskStudents, atRiskPage]);

  const courseTotalPages = Math.max(1, Math.ceil(courseAnalytics.length / TABLE_PAGE_SIZE));
  const paginatedCourseAnalytics = useMemo(() => {
    const start = (coursePage - 1) * TABLE_PAGE_SIZE;
    return courseAnalytics.slice(start, start + TABLE_PAGE_SIZE);
  }, [courseAnalytics, coursePage]);

  // Clamp current pages when filters or live data reduce the total row count.
  useEffect(() => {
    setAtRiskPage(page => Math.min(page, atRiskTotalPages));
  }, [atRiskTotalPages]);

  useEffect(() => {
    setCoursePage(page => Math.min(page, courseTotalPages));
  }, [courseTotalPages]);

  // Group student attendance into department-level performance.
  const departmentComparison = useMemo(() => {
    const groups = {};

    stuAttData.forEach(student => {
      const label = student.department?.trim();
      if (!label) return;

      const row = groups[label] ?? { label, present: 0, absent: 0, total: 0 };
      if (entry.status === "Present") row.present += 1;
      else row.absent += 1;
      row.total += 1;
      groups[label] = row;
    });

    return Object.values(groups)
      .filter(g => g.total > 0)
      .map(g => ({ ...g, rate: attpercentage(g.present, g.total) }))
      .sort((a, b) => b.rate - a.rate);
  }, [dashboardEntries, courseInfoById]);

  // Group attendance by hour of day for the hourly bar chart.
  const hourlyAttendanceData = useMemo(() => {
    const hours = {};

    flEntrys.forEach(entry => {
      const date = entry.dateObject;
      if (!date) return;

      const hour = date.getHours();
      if (!hours[hour]) {
        hours[hour] = {
          hour: `${hour}:00`,
          present: 0,
          absent: 0,
          total: 0,
        };
      }

      hours[hour].total++;
      if (entry.status === "Present") hours[hour].present++;
      else hours[hour].absent++;
    });

    return Object.values(hours).sort((a, b) => {
      return Number(a.hour.split(":")[0]) - Number(b.hour.split(":")[0]);
    });
  }, [flEntrys]);

  // Build weekday attendance rates for the trend chart.
  const weekdayAttendanceData = useMemo(() => {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday",
      "Thursday", "Friday", "Saturday"].map(day => ({
        day,
        absent: 0,
        present: 0,
        total: 0,
      }));
    flEntrys.forEach(entry => {
      const date = entry.dateObject;
      if (date) {
        const dayIndex = date.getDay();
        if (entry.status === "Present") weekdays[dayIndex].present++;
        else weekdays[dayIndex].absent++;
        weekdays[dayIndex].total++;
      }
    });
    return weekdays
      .filter(d => d.total > 0)
      .map(d => ({ ...d, rate: attpercentage(d.present, d.total) }));
  }, [flEntrys]);

  // Compare broad session timing buckets for morning versus afternoon attendance.
  const timeOfDayAnalytics = useMemo(() => {
    const morning = { name: "Morning (6AM-12PM)", present: 0, absent: 0, total: 0 };
    const afternoon = { name: "Afternoon (12PM-6PM)", present: 0, absent: 0, total: 0 };
    flEntrys.forEach(entry => {
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
      { ...morning, rate: morning.total > 0 ? attpercentage(morning.present, morning.total) : 0 },
      { ...afternoon, rate: afternoon.total > 0 ? attpercentage(afternoon.present, afternoon.total) : 0 },
    ].filter(period => period.total > 0);
  }, [flEntrys]);

  const hasChart = flEntrys.length > 0;

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 left-0 z-50 h-full transform bg-white transition-transform duration-300 sm:static sm:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <Sidebar
          drawerMode
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-md">
          <div className="flex w-full items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="sm:hidden rounded-xl bg-white/20 p-2 text-white"
              aria-label="Open sidebar"
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

            <h1 className="ml-3 flex-1 text-white text-lg tracking-tight font-bold">Analytics</h1>

            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="rounded-full p-2 text-white hover:bg-teal-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </button>
          </div>

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
              <h3 className="font-bold text-gray-700 text-lg mb-2">Total Attendance by Hour</h3>
              {hasChart ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={hourlyAttendanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 18 }} />
                    <YAxis tick={{ fontSize: 18 }} />
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
                <h3 className="font-bold text-gray-700 text-lg mb-2">Attendance by Day</h3>
                {weekdayAttendanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weekdayAttendanceData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 17 }} />
                      <YAxis tick={{ fontSize: 17 }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Attendance %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-lg mb-2">Morning vs Afternoon Attendance Analysis</h3>
                {timeOfDayAnalytics.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={timeOfDayAnalytics}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 18 }} domain={[0, 100]} />
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
                  <thead className="round-xl bg-teal-600 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-lg text-white text-left font-medium text-gray-700">Course</th>
                      <th className="px-4 py-3 text-lg text-white text-left font-medium text-gray-700">Total Attendance Records</th>
                      <th className="px-4 py-3 text-lg text-white text-left font-medium text-gray-700">Present Students</th>
                      <th className="px-4 py-3 text-lg text-white text-left font-medium text-gray-700">Absent Students</th>
                      <th className="px-4 py-3 text-lg text-white text-left font-medium text-gray-700">Attendance Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseAnalytics.length > 0 ? (
                      paginatedCourseAnalytics.map((course) => (
                        <tr key={course.courseKey} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{course.courseCode}</td>
                          <td className="px-4 py-3 text-gray-600">{course.totalRecords}</td>
                          <td className="px-4 py-3 text-green-600 font-semibold">{course.present}</td>
                          <td className="px-4 py-3 text-red-600 font-semibold">{course.absent}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${course.avgAttendance >= 80 ? "bg-green-100 text-green-700" :
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
              {courseAnalytics.length > TABLE_PAGE_SIZE && (
                <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-gray-600">
                    Showing {(coursePage - 1) * TABLE_PAGE_SIZE + 1}-{Math.min(coursePage * TABLE_PAGE_SIZE, courseAnalytics.length)} of {courseAnalytics.length} courses
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCoursePage(page => Math.max(1, page - 1))}
                      disabled={coursePage === 1}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-semibold text-gray-600">
                      Page {coursePage} of {courseTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCoursePage(page => Math.min(courseTotalPages, page + 1))}
                      disabled={coursePage === courseTotalPages}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-2 mt-8">Department Performance Analysis</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-lg mb-4">Department Leaderboard</h3>
                {departmentComparison.length > 0 ? (
                  <div className="space-y-2">
                    {departmentComparison.map((dept, idx) => (
                      <div key={dept.label} className="flex items-center gap-3">
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
                <h3 className="font-bold text-gray-700 text-lg mb-4">Department Comparison</h3>
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
                <div>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold text-gray-700">Program</span>
                      <select
                        value={atRiskProgramFilter}
                        onChange={(event) => {
                          setAtRiskProgramFilter(event.target.value);
                          setAtRiskPage(1);
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      >
                        <option value="">All programs</option>
                        {atRiskPrograms.map(program => (
                          <option key={program} value={program}>{program}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-semibold text-gray-700">Sort by</span>
                      <select
                        value={atRiskSort}
                        onChange={(event) => {
                          setAtRiskSort(event.target.value);
                          setAtRiskPage(1);
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      >
                        <option value="risk">Highest risk first</option>
                        <option value="name-asc">Student name A-Z</option>
                        <option value="name-desc">Student name Z-A</option>
                        <option value="year-asc">Year ascending</option>
                        <option value="year-desc">Year descending</option>
                      </select>
                    </label>

                    {(atRiskProgramFilter || atRiskSort !== "risk") && (
                      <button
                        type="button"
                        onClick={() => {
                          setAtRiskProgramFilter("");
                          setAtRiskSort("risk");
                          setAtRiskPage(1);
                        }}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-teal-600 border border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-lg text-white text-left font-medium">Student Name</th>
                          <th className="px-4 py-3 text-lg text-white text-left font-medium">Reg Number</th>
                          <th className="px-4 py-3 text-lg text-white text-left font-medium">Program</th>
                          <th className="px-4 py-3 text-lg text-white text-left font-medium">Year</th>
                          {/* <th className="px-4 py-3 text-white text-left font-medium">Department</th> */}
                          <th className="px-4 py-3 text-lg text-white text-left font-medium">Present</th>
                          <th className="px-4 py-3 text-lg text-white text-left font-semibold">Absent</th>
                          <th className="px-4 py-3 text-lg text-white text-left font-semibold">Attendance Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAtRiskStudents.length > 0 ? (
                          paginatedAtRiskStudents.map((student) => (
                            <tr key={student.nameKey} className="border-b border-gray-100 hover:bg-teal-50">
                              <td className="px-4 py-3 font-medium text-gray-800">{student.displayName}</td>
                              <td className="px-4 py-3 text-gray-600">{student.regNo}</td>
                              <td className="px-4 py-3 text-gray-600">{student.program}</td>
                              <td className="px-4 py-3 text-gray-600">{student.years}</td>
                              <td className="px-4 py-3 font-semibold text-green-600">{student.present}</td>
                              <td className="px-4 py-3 font-bold text-red-700 text-lg">{student.absent}</td>
                              <td className="px-4 py-3 text-gray-600">{student.rate}%</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" className="px-4 py-8 text-center text-gray-500">No at-risk students match the selected program.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredAtRiskStudents.length > TABLE_PAGE_SIZE && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-gray-600">
                        Showing {(atRiskPage - 1) * TABLE_PAGE_SIZE + 1}-{Math.min(atRiskPage * TABLE_PAGE_SIZE, filteredAtRiskStudents.length)} of {filteredAtRiskStudents.length} students
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setAtRiskPage(page => Math.max(1, page - 1))}
                          disabled={atRiskPage === 1}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm font-semibold text-gray-600">
                          Page {atRiskPage} of {atRiskTotalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAtRiskPage(page => Math.min(atRiskTotalPages, page + 1))}
                          disabled={atRiskPage === atRiskTotalPages}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No students below 50% attendance.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
