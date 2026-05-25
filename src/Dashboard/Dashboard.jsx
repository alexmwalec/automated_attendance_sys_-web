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

//pallette
const PRESENT_COLOR = "#10b981";  
const ABSENT_COLOR  = "#ef4444";  

//Helper functions
function pct(a, total) {
  return total === 0 ? 0 : Math.round((a / total) * 100);
}

function getISOWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), 
                                   date.getMonth(), 
                                   date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target - firstThursday;
  return 1 + Math.round(diff / 604800000);
}

function getWeekdayLabel(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", 
          "Thursday", "Friday", "Saturday"][date.getDay()];
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
  if (!Number.isNaN(asDate)) return asDate;
  const normalized = String(value).replace(/\s+/g, "T");
  const altDate = new Date(normalized);
  return Number.isNaN(altDate) ? null : altDate;
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
        {filtered ? "Try a different department, course, year, or student." : "Charts will appear here after attendance is captured."}
      </p>
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

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

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

  const studentInfoByReg = useMemo(() => {
    return Object.fromEntries(students
      .filter(s => s.regNo)
      .map(s => [s.regNo, {
        regNo: s.regNo,
        name: s.name || s.regNo,
        department: s.department || "Unknown",
        program: s.program || "Unknown",
        year: s.year || "Unknown",
        faculty: s.faculty || s.department || "Unknown",
        campus: s.campus || "Unknown",
        enrolledCourses: normalizeCourseList(s.enrolledCourses),
      }])
    );
  }, [students]);

  const coursePrereqMap = useMemo(() => {
    return Object.fromEntries(courses.map(c => {
      const prereqs = c.prerequisites || c.prereq || c.prerequisiteCourses || c.requiredCourses || [];
      return [c.id, normalizeCourseList(prereqs)];
    }));
  }, [courses]);

  const studentAttendanceData = useMemo(() => {
    const map = {};

    attendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        const regNo = entry.regNo || "";
        if (!regNo) return;

        const row = map[regNo] ?? { regNo, present: 0, absent: 0, total: 0, courses: new Set(), attendanceEntries: [] };
        if (entry.status === "Present") row.present += 1;
        else row.absent += 1;
        row.total += 1;
        row.courses.add(doc.courseCode || "Unknown");
        row.attendanceEntries.push({ ...entry, courseCode: doc.courseCode, date: doc.date });
        map[regNo] = row;
      });
    });

    Object.values(studentInfoByReg).forEach(info => {
      const row = map[info.regNo] ?? { regNo: info.regNo, present: 0, absent: 0, total: 0, courses: new Set(), attendanceEntries: [] };
      row.name = info.name;
      row.department = info.department;
      row.program = info.program;
      row.year = info.year;
      row.faculty = info.faculty;
      row.campus = info.campus;
      row.enrolledCourses = info.enrolledCourses;
      map[info.regNo] = row;
    });

    return Object.values(map).map(row => {
      const rate = row.total ? pct(row.present, row.total) : 0;
      return {
        ...row,
        rate,
        riskScore: row.total ? Math.round(100 - rate) : 0,
        courses: [...row.courses],
      };
    });
  }, [attendance, studentInfoByReg]);

  const studentsBelowThreshold = useMemo(() => {
    return studentAttendanceData
      .filter(s => s.total > 0 && s.rate < 75)
      .sort((a, b) => a.rate - b.rate);
  }, [studentAttendanceData]);

  const studentsRepeatedAbsences = useMemo(() => {
    return studentAttendanceData
      .filter(s => s.total > 0 && s.absent >= 3)
      .sort((a, b) => b.absent - a.absent);
  }, [studentAttendanceData]);

  const studentsMissingPrereqs = useMemo(() => {
    return studentAttendanceData
      .map(student => {
        const enrolled = normalizeCourseList(student.enrolledCourses);
        const missingPrereqs = [...new Set(enrolled.flatMap(courseId => {
          const prereqs = coursePrereqMap[courseId] || [];
          return prereqs.filter(pr => !enrolled.includes(pr));
        }))];

        return { ...student, missingPrereqs };
      })
      .filter(student => student.missingPrereqs && student.missingPrereqs.length > 0);
  }, [studentAttendanceData, coursePrereqMap]);

  const courseAnalytics = useMemo(() => {
    const map = {};

    attendance.forEach(doc => {
      const code = doc.courseCode || "Unknown";
      const row = map[code] ?? { courseCode: code, present: 0, absent: 0, total: 0, absenteeByDay: {} };
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        if (entry.status === "Present") row.present += 1;
        else row.absent += 1;
        row.total += 1;

        const dateLabel = doc.date || "Unknown";
        row.absenteeByDay[dateLabel] = (row.absenteeByDay[dateLabel] || 0) + (entry.status === "Present" ? 0 : 1);
      });
      map[code] = row;
    });

    return Object.values(map).map(item => {
      const peak = Object.entries(item.absenteeByDay).reduce((best, [date, count]) => {
        if (!best || count > best.count) return { date, count };
        return best;
      }, null);
      const course = courses.find(c => c.id === item.courseCode) || {};
      return {
        courseCode: item.courseCode,
        courseName: course.courseName || item.courseCode,
        averageAttendance: pct(item.present, item.total),
        peakAbsenteeismDay: peak ? peak.date : "N/A",
        peakAbsences: peak ? peak.count : 0,
        total: item.total,
      };
    });
  }, [attendance, courses]);

  const buildGroupMetrics = (field) => {
    const groups = {};

    studentAttendanceData.forEach(student => {
      const label = student[field] || "Unknown";
      const row = groups[label] ?? { label, present: 0, absent: 0, total: 0, students: 0 };
      row.present += student.present;
      row.absent += student.absent;
      row.total += student.total;
      row.students += 1;
      groups[label] = row;
    });

    return Object.values(groups)
      .filter(group => group.total > 0)
      .map(group => ({
        ...group,
        rate: pct(group.present, group.total),
        chronicAbsenteeism: pct(group.absent, group.total),
        lecturerCompliance: Math.max(0, Math.round(100 - pct(group.absent, group.total))),
        completionRate: pct(group.present, group.total),
      }))
      .sort((a, b) => b.rate - a.rate);
  };

  const facultyComparison = useMemo(() => buildGroupMetrics("faculty"), [studentAttendanceData]);
  const departmentComparison = useMemo(() => buildGroupMetrics("department"), [studentAttendanceData]);
  const programComparison = useMemo(() => buildGroupMetrics("program"), [studentAttendanceData]);
  const campusComparison = useMemo(() => buildGroupMetrics("campus"), [studentAttendanceData]);

  const attendanceRecords = useMemo(() => {
    return attendance.flatMap(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      const docDate = parseAttendanceDate(doc.date);
      return list.map(entry => {
        const recordDate = parseAttendanceDate(entry.date || doc.date) || docDate;
        return {
          courseCode: doc.courseCode || "Unknown",
          regNo: entry.regNo || "",
          status: entry.status || "Absent",
          dateObj: recordDate,
          weekday: recordDate ? getWeekdayLabel(recordDate) : "Unknown",
          hour: recordDate != null ? recordDate.getHours() : null,
          month: recordDate != null ? recordDate.getMonth() + 1 : null,
        };
      });
    });
  }, [attendance]);

  const attendanceByHourData = useMemo(() => {
    const map = {};
    attendanceRecords.forEach(record => {
      if (record.hour == null) return;
      const hourLabel = `${String(record.hour).padStart(2, "0")}:00`;
      const row = map[record.hour] ?? { hour: record.hour, label: hourLabel, present: 0, absent: 0, total: 0 };
      if (record.status === "Present") row.present += 1;
      else row.absent += 1;
      row.total += 1;
      map[record.hour] = row;
    });
    return Object.values(map).sort((a, b) => a.hour - b.hour).map(item => ({ ...item, rate: pct(item.present, item.total) }));
  }, [attendanceRecords]);

  const attendanceByWeekdayData = useMemo(() => {
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const map = {};
    attendanceRecords.forEach(record => {
      if (!record.weekday || record.weekday === "Unknown") return;
      const row = map[record.weekday] ?? { weekday: record.weekday, present: 0, absent: 0, total: 0 };
      if (record.status === "Present") row.present += 1;
      else row.absent += 1;
      row.total += 1;
      map[record.weekday] = row;
    });
    return Object.values(map)
      .map(item => ({ ...item, rate: pct(item.present, item.total) }))
      .sort((a, b) => order.indexOf(a.weekday) - order.indexOf(b.weekday));
  }, [attendanceRecords]);

  const morningAfternoonData = useMemo(() => {
    const map = { Morning: { period: "Morning", present: 0, absent: 0, total: 0 }, Afternoon: { period: "Afternoon", present: 0, absent: 0, total: 0 } };
    attendanceRecords.forEach(record => {
      if (record.hour == null) return;
      const bucket = record.hour < 12 ? "Morning" : "Afternoon";
      const row = map[bucket];
      if (record.status === "Present") row.present += 1;
      else row.absent += 1;
      row.total += 1;
    });
    return Object.values(map).map(item => ({ ...item, rate: pct(item.present, item.total) }));
  }, [attendanceRecords]);

  const rainySeasonData = useMemo(() => {
    const rainyMonths = [3, 4, 5, 10, 11, 12];
    const buckets = { Rainy: { label: "Rainy Season", present: 0, absent: 0, total: 0 }, Other: { label: "Non-Rainy", present: 0, absent: 0, total: 0 } };
    attendanceRecords.forEach(record => {
      if (record.month == null) return;
      const bucket = rainyMonths.includes(record.month) ? buckets.Rainy : buckets.Other;
      if (record.status === "Present") bucket.present += 1;
      else bucket.absent += 1;
      bucket.total += 1;
    });
    return Object.values(buckets).map(item => ({ ...item, rate: pct(item.present, item.total) }));
  }, [attendanceRecords]);

  const analyticsInsights = useMemo(() => {
    const insights = [];
    const lowestHour = attendanceByHourData.filter(item => item.total > 0).sort((a, b) => a.rate - b.rate)[0];
    const lowestWeekday = attendanceByWeekdayData.filter(item => item.total > 0).sort((a, b) => a.rate - b.rate)[0];
    const morning = morningAfternoonData.find(item => item.period === "Morning");
    const afternoon = morningAfternoonData.find(item => item.period === "Afternoon");
    const rainy = rainySeasonData.find(item => item.label === "Rainy Season");
    const nonRainy = rainySeasonData.find(item => item.label === "Non-Rainy");

    if (lowestHour) insights.push(`${lowestHour.label} classes have the weakest attendance at ${lowestHour.rate}%`);
    if (lowestWeekday) insights.push(`${lowestWeekday.weekday} shows the lowest attendance at ${lowestWeekday.rate}%`);
    if (morning && afternoon) {
      insights.push(`${morning.rate > afternoon.rate ? "Morning" : "Afternoon"} attendance is stronger with ${Math.max(morning.rate, afternoon.rate)}% participation`);
    }
    if (rainy && nonRainy) {
      const diff = rainy.rate - nonRainy.rate;
      insights.push(`Rainy season attendance is ${Math.abs(diff)} points ${diff < 0 ? "lower" : "higher"} than other months`);
    }

    return insights;
  }, [attendanceByHourData, attendanceByWeekdayData, morningAfternoonData, rainySeasonData]);

  // Analytics
  const stats = useMemo(() => {
    const total = flatEntries.length;
    const present = flatEntries.filter(e => e.status === "Present").length;
    const absent = total - present;
    return { total, present, absent, rate: pct(present, total) };
  }, [flatEntries]);

  const courseDeptMap = useMemo(() => {
    return Object.fromEntries(courses.map(c => [c.id, c.department || "Unassigned"]));
  }, [courses]);

  const departmentAttendanceSummary = useMemo(() => {
    const byDept = {};

    attendance.forEach(doc => {
      const dept = courseDeptMap[doc.courseCode] || "Unassigned";
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        if (!entry || !entry.status) return;
        const row = byDept[dept] ?? { present: 0, total: 0 };
        row.total += 1;
        if (entry.status === "Present") row.present += 1;
        byDept[dept] = row;
      });
    });

    const deptEntries = Object.entries(byDept)
      .filter(([, row]) => row.total > 0)
      .map(([department, row]) => ({
        department,
        present: row.present,
        total: row.total,
        rate: pct(row.present, row.total),
      }));

    if (!deptEntries.length) return { best: null, worst: null };

    deptEntries.sort((a, b) => b.rate - a.rate || b.total - a.total);
    return {
      best: deptEntries[0],
      worst: deptEntries[deptEntries.length - 1],
    };
  }, [attendance, courseDeptMap]);

  const semesterAttendanceAverage = useMemo(() => {
    let total = 0;
    let present = 0;

    attendance.forEach(doc => {
      const list = Array.isArray(doc.fullAttendanceList) ? doc.fullAttendanceList : [];
      list.forEach(entry => {
        if (!entry || !entry.status) return;
        total += 1;
        if (entry.status === "Present") present += 1;
      });
    });

    return pct(present, total);
  }, [attendance]);

  const todayEntries = useMemo(() => {
    return flatEntries.filter(entry => entry.date === todayStr);
  }, [flatEntries, todayStr]);

  const todayStats = useMemo(() => {
    const total = todayEntries.length;
    const present = todayEntries.filter(e => e.status === "Present").length;
    const absent = total - present;
    return {
      total,
      present,
      absent,
      rate: pct(present, total)
    };
  }, [todayEntries]);

  const atRiskCount = useMemo(() => {
    const studentMap = {};
    const validRegNos = new Set(filteredStudentOptions.map(s => s.regNo));

    flatEntries.forEach(entry => {
      if (validRegNos.size && !validRegNos.has(entry.regNo)) return;
      if (!entry.regNo) return;
      const row = studentMap[entry.regNo] ?? { present: 0, total: 0 };
      row.total += 1;
      if (entry.status === "Present") row.present += 1;
      studentMap[entry.regNo] = row;
    });

    return Object.values(studentMap).filter(row => row.total > 0 && pct(row.present, row.total) < 75).length;
  }, [flatEntries, filteredStudentOptions]);

  const trendData = useMemo(() => {
    const map = {};
    flatEntries.forEach(e => {
      const key = e.date;
      if (!map[key]) map[key] = { date: key, Present: 0, Absent: 0 };
      e.status === "Present" ? map[key].Present++ : map[key].Absent++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [flatEntries]);

  const weeklyAttendanceData = useMemo(() => {
    const map = {};
    flatEntries.forEach(entry => {
      const date = new Date(entry.date);
      if (Number.isNaN(date)) return;
      const period = getWeekLabel(date);
      if (!map[period]) map[period] = { period, Present: 0, Absent: 0, total: 0 };
      if (entry.status === "Present") map[period].Present += 1;
      else map[period].Absent += 1;
      map[period].total += 1;
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  }, [flatEntries]);

  const monthlyAttendanceData = useMemo(() => {
    const map = {};
    flatEntries.forEach(entry => {
      const date = new Date(entry.date);
      if (Number.isNaN(date)) return;
      const period = getMonthLabel(date);
      if (!map[period]) map[period] = { period,
                                        Present: 0,
                                        Absent: 0, 
                                        total: 0 };
      if (entry.status === "Present") map[period].Present += 1;
      else map[period].Absent += 1;
      map[period].total += 1;
    });
    return Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  }, [flatEntries]);

  const weeklyAttendancePercentData = useMemo(() => {
    return weeklyAttendanceData.map(item => ({
      period: item.period,
      rate: pct(item.Present, item.total),
      Present: item.Present,
      Absent: item.Absent,
    }));
  }, [weeklyAttendanceData]);

  const monthlyAttendancePercentData = useMemo(() => {
    return monthlyAttendanceData.map(item => ({
      period: item.period,
      rate: pct(item.Present, item.total),
      Present: item.Present,
      Absent: item.Absent,
    }));
  }, [monthlyAttendanceData]);

  const weeklyConsistencyAvg = useMemo(() => {
    if (!weeklyAttendancePercentData.length) return 0;
    return Math.round(weeklyAttendancePercentData.reduce((sum, item) => sum + item.rate, 0) / weeklyAttendancePercentData.length);
  }, [weeklyAttendancePercentData]);

  const monthlyConsistencyAvg = useMemo(() => {
    if (!monthlyAttendancePercentData.length) return 0;
    return Math.round(monthlyAttendancePercentData.reduce((sum, item) => sum + item.rate, 0) / monthlyAttendancePercentData.length);
  }, [monthlyAttendancePercentData]);

  const clearAll = useCallback(() => {
    setSelYear("all"); setSelDept("");
    setSelCourse(""); setSelStudent("");
  }, []);

  const hasActiveFilters = selYear !== "all" || selDept || selCourse || selStudent;
  const hasChartData = stats.total > 0;

  const selectClass = "w-full rounded-xl border border-teal-400 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer appearance-none";

  const topRiskStudents = studentsBelowThreshold.slice(0, 6);
  const repeatedAbsenceStudentsTop = studentsRepeatedAbsences.slice(0, 6);
  const missingPrereqStudentsTop = studentsMissingPrereqs.slice(0, 6);
  const averageRiskScore = studentAttendanceData.length
    ? Math.round(studentAttendanceData.reduce((sum, student) => sum + student.riskScore, 0) / studentAttendanceData.length)
    : 0;

  const courseBarData = courseAnalytics.slice(0, 6).map(item => ({
    name: item.courseName,
    averageAttendance: item.averageAttendance,
    peakAbsences: item.peakAbsences,
  }));

  const facultyBarData = facultyComparison.slice(0, 6).map(item => ({ name: item.label, attendance: item.rate, chronic: item.chronicAbsenteeism }));
  const departmentBarData = departmentComparison.slice(0, 6).map(item => ({ name: item.label, attendance: item.rate, chronic: item.chronicAbsenteeism }));
  const programRadarData = programComparison.slice(0, 5).map(item => ({ subject: item.label, attendance: item.rate, absenteeism: item.chronicAbsenteeism, completion: item.completionRate }));

  const rainySummary = rainySeasonData.reduce((acc, item) => {
    if (item.label === "Rainy Season") acc.rainy = item;
    if (item.label === "Non-Rainy") acc.nonRainy = item;
    return acc;
  }, { rainy: null, nonRainy: null });

  const analyticsModeRender = (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Below Threshold" value={studentsBelowThreshold.length} accent="#dc2626" sub="Attendance < 75%" />
        <StatCard label="Repeated Absences" value={studentsRepeatedAbsences.length} accent="#f59e0b" sub="3+ absences" />
        <StatCard label="Missing Prereqs" value={studentsMissingPrereqs.length} accent="#2563eb" sub="Potential course gaps" />
        <StatCard label="Average Risk Score" value={`${averageRiskScore}%`} accent="#0d9488" sub="Higher means more concern" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Students Below Attendance Threshold</h3>
          {topRiskStudents.length ? (
            <div className="overflow-x-auto text-sm">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead className="text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Risk</th>
                    <th className="px-3 py-2">Faculty</th>
                    <th className="px-3 py-2">Program</th>
                    <th className="px-3 py-2">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {topRiskStudents.map(student => (
                    <tr key={student.regNo} className="bg-slate-50 even:bg-white rounded-xl">
                      <td className="px-3 py-2">{student.name}</td>
                      <td className="px-3 py-2 font-semibold">{student.riskScore}%</td>
                      <td className="px-3 py-2">{student.faculty}</td>
                      <td className="px-3 py-2">{student.program}</td>
                      <td className="px-3 py-2">{student.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No students currently below threshold.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Repeated Absences</h3>
          {repeatedAbsenceStudentsTop.length ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {repeatedAbsenceStudentsTop.map(student => (
                <li key={student.regNo} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-2">
                  <div className="font-semibold">{student.name}</div>
                  <div className="text-xs text-gray-500">Absences: {student.absent} · {student.program} · Year {student.year}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No repeated absence patterns detected yet.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Missing Prerequisite Classes</h3>
          {missingPrereqStudentsTop.length ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {missingPrereqStudentsTop.map(student => (
                <li key={student.regNo} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-2">
                  <div className="font-semibold">{student.name}</div>
                  <div className="text-xs text-gray-500">Missing: {student.missingPrereqs.join(", ") || "N/A"}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Prerequisite course data is not available or no gaps found.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-700 text-sm">Course Analytics</h3>
              <p className="text-xs text-gray-500">Average attendance per course and peak absentee days.</p>
            </div>
          </div>
          {courseBarData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={courseBarData} margin={{ left: -20, right: 0, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={24} iconType="circle" />
                <Bar dataKey="averageAttendance" fill="#0d9488" name="Avg Attendance" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState filtered={false} />
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Top Course Insights</h3>
          {courseAnalytics.length ? (
            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-xl border border-gray-100 bg-slate-50 p-3">
                <p className="font-semibold">Best average attendance</p>
                <p>{courseAnalytics.sort((a, b) => b.averageAttendance - a.averageAttendance)[0]?.courseName || "N/A"}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50 p-3">
                <p className="font-semibold">Peak absenteeism day</p>
                <p>{courseAnalytics.sort((a, b) => b.peakAbsences - a.peakAbsences)[0]?.peakAbsenteeismDay || "N/A"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No course attendance data to summarize.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 xl:col-span-2">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Faculty & Department Comparisons</h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Top Faculties</h4>
              {facultyBarData.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={facultyBarData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="attendance" fill="#2563eb" name="Attendance" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">No faculty-level attendance data.</p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Top Departments</h4>
              {departmentBarData.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={departmentBarData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="attendance" fill="#0d9488" name="Attendance" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">No department-level attendance data.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Program Radar</h3>
          {programRadarData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={programRadarData} outerRadius={110}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Attendance" dataKey="attendance" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">No program-level comparison data available.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 text-sm mb-4">Attendance by Hour</h3>
            {attendanceByHourData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceByHourData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rate" fill="#0d9488" name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState filtered={false} />
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 text-sm mb-4">Attendance by Weekday</h3>
            {attendanceByWeekdayData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceByWeekdayData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="weekday" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rate" fill="#16a34a" name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState filtered={false} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 xl:col-span-2">
            <h3 className="font-bold text-gray-700 text-sm mb-4">Morning vs Afternoon Attendance</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
              {morningAfternoonData.map(item => (
                <div key={item.period} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase text-gray-500">{item.period}</div>
                  <div className="text-2xl font-bold">{item.rate}%</div>
                  <div className="text-xs text-gray-500">{item.present} present / {item.absent} absent</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 text-sm mb-4">Rainy Season Effect</h3>
            {rainySummary.rainy || rainySummary.nonRainy ? (
              <div className="space-y-3 text-sm text-gray-700">
                <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase text-gray-500">Rainy Season</div>
                  <div className="text-2xl font-bold">{rainySummary.rainy?.rate ?? 0}%</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase text-gray-500">Non-Rainy</div>
                  <div className="text-2xl font-bold">{rainySummary.nonRainy?.rate ?? 0}%</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No seasonal attendance patterns detected.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 text-sm mb-4">Example Insights</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
            {analyticsInsights.length ? analyticsInsights.map((insight, index) => (
              <li key={index}>{insight}</li>
            )) : (
              <li>No strong time-based patterns identified.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans sm:h-screen sm:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="relative mb-5 flex flex-col gap-3 rounded-2xl bg-teal-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 shadow-md">
          <div>
            <h1 className="text-white text-lg tracking-tight font-bold">
              {analyticsMode ? "Attendance Analytics" : "Attendance Insights"}
            </h1>
            <p className="text-teal-100 text-xs">
              {analyticsMode ? "Executive attendance metrics for students, courses, faculty and time-based trends." : `Monitoring ${courses.length} courses and ${students.length} students`}
            </p>
          </div>
          <div className="relative flex items-center gap-2 self-start sm:self-auto">
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

        {!analyticsMode && (
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-xs font-bold uppercase text-gray-400">Filters</h2>
            </div>
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
            <div className="mt-3 flex justify-end">
              <button onClick={clearAll} className="text-xs bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-lg transition font-medium">
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : analyticsMode ? (
          analyticsModeRender
        ) : (
            <>
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Total Registered Students" value={filteredStudentOptions.length} accent="#0d9488" />
              <StatCard label="Present Today" value={todayStats.present} accent="#10b981" />
              <StatCard label="Absent Today" value={todayStats.absent} accent="#f43f5e" />
              <StatCard label="Attendance % Today" value={`${todayStats.rate}%`} accent={todayStats.rate >= 75 ? "#10b981" : "#f97316"} />
              <StatCard label="Students At Risk" value={atRiskCount} accent="#f97316" />
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
              <StatCard
                label="Best Department Attendance"
                value={departmentAttendanceSummary.best ? `${departmentAttendanceSummary.best.department} (${departmentAttendanceSummary.best.rate}%)` : "N/A"}
                accent="#0d9488"
              />
              <StatCard
                label="Lowest Department Attendance"
                value={departmentAttendanceSummary.worst ? `${departmentAttendanceSummary.worst.department} (${departmentAttendanceSummary.worst.rate}%)` : "N/A"}
                accent="#ef4444"
              />
              <StatCard
                label="Semester Attendance Average"
                value={`${semesterAttendanceAverage}%`}
                accent="#2563eb"
                sub="Overall attendance across current records"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Gauge / Pie */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                    <h3 className="font-bold text-gray-700 text-sm mb-3 self-start">Engagement Ratio</h3>
                    {hasChartData ? (
                      <ResponsiveContainer width="100%" height={230}>
                          <PieChart>
                              <Pie data={[{name:"Present", value:stats.present}, {name:"Absent", value:stats.absent}]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                  <Cell fill={PRESENT_COLOR} /><Cell fill={ABSENT_COLOR} />
                              </Pie>
                              <Tooltip />
                              <Legend verticalAlign="bottom" height={24} iconType="circle" />
                          </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChartState filtered={hasActiveFilters} />
                    )}
                </div>

                {/* Trend */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 text-sm mb-4">Historical Trend</h3>
                    {hasChartData ? (
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
                    ) : (
                      <EmptyChartState filtered={hasActiveFilters} />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm mb-4">Daily Attendance Trends</h3>
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={24} iconType="circle" />
                      <Line type="monotone" dataKey="Present" stroke={PRESENT_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Absent" stroke={ABSENT_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState filtered={hasActiveFilters} />
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 text-sm">Weekly Engagement Consistency</h3>
                    <span className="text-xs text-gray-500">Avg {weeklyConsistencyAvg}%</span>
                  </div>
                  {weeklyAttendancePercentData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={weeklyAttendancePercentData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="rate" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState filtered={hasActiveFilters} />
                  )}
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 text-sm">Monthly Engagement Consistency</h3>
                    <span className="text-xs text-gray-500">Avg {monthlyConsistencyAvg}%</span>
                  </div>
                  {monthlyAttendancePercentData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={monthlyAttendancePercentData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState filtered={hasActiveFilters} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 text-sm mb-4">Weekly Attendance Change</h3>
                  {weeklyAttendanceData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={weeklyAttendanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={24} iconType="circle" />
                        <Bar dataKey="Present" fill={PRESENT_COLOR} />
                        <Bar dataKey="Absent" fill={ABSENT_COLOR} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState filtered={hasActiveFilters} />
                  )}
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 text-sm mb-4">Monthly Attendance Change</h3>
                  {monthlyAttendanceData.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={monthlyAttendanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={24} iconType="circle" />
                        <Bar dataKey="Present" fill={PRESENT_COLOR} />
                        <Bar dataKey="Absent" fill={ABSENT_COLOR} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState filtered={hasActiveFilters} />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
