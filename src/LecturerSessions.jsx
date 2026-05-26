import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

function parseDateValue(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const asDate = new Date(value);
  if (!Number.isNaN(asDate)) return asDate;
  const normalized = String(value).replace(/\s+/g, "T");
  const altDate = new Date(normalized);
  return Number.isNaN(altDate) ? null : altDate;
}

function formatTime(value) {
  const date = parseDateValue(value);
  if (!date) return String(value || "-");
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) return String(value || "-");
  return date.toLocaleDateString();
}

function isSameDay(dateA, dateB) {
  return dateA && dateB &&
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate();
}

export default function LecturerSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    const unsubCourses = onSnapshot(collection(db, "courses"), (snap) => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSessions = onSnapshot(collection(db, "sessions"), (snap) => {
      if (!snap.empty) {
        setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setSessions([]);
      }
    });

    const unsubActive = onSnapshot(collection(db, "active_sessions"), (snap) => {
      if (!snap.empty) {
        setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });

    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCourses();
      unsubSessions();
      unsubActive();
      unsubAttendance();
    };
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const courseMap = useMemo(() => {
    return Object.fromEntries(courses.map(course => [course.id, course.courseName || course.name || course.id]));
  }, [courses]);

  const lecturerSessions = useMemo(() => {
    return sessions.filter(session => {
      const sessionDate = parseDateValue(session.date || session.sessionDate || session.dateTime);
      if (!isSameDay(sessionDate, today)) return false;

      const owner = String(session.createdBy || session.lecturer || session.owner || session.instructor || "").toLowerCase();
      if (owner.includes("king")) return true;

      const courseKey = String(session.courseId || session.course || session.courseCode || "").toLowerCase();
      return courseKey.includes("king");
    });
  }, [sessions, today]);

  const sessionStatus = useMemo(() => {
    return lecturerSessions.map(session => {
      const statusField = session.status || session.lecturerStatus || session.statusRecorded || session.attendanceStatus;
      if (statusField) return String(statusField);

      const sessionId = session.id;
      const matching = attendance.find(att => 
        att.sessionId === sessionId || att.session === sessionId || att.sessionType === session.sessionType || att.courseCode === session.courseId || att.courseCode === session.courseCode
      );
      if (matching) return matching.status || matching.attendanceStatus || "Present";
      return "Not recorded";
    });
  }, [attendance, lecturerSessions]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-lg border border-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lecturer Daily Sessions</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome, <span className="font-semibold">king</span>. Showing today's sessions from Firestore.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate("/")} className="rounded-2xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">Logout</button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3">Course</th>
                <th className="border-b border-slate-200 px-4 py-3">Time</th>
                <th className="border-b border-slate-200 px-4 py-3">Session Type</th>
                <th className="border-b border-slate-200 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {lecturerSessions.length ? lecturerSessions.map((session, index) => (
                <tr key={session.id || index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border-b border-slate-200 px-4 py-4 font-medium text-slate-800">
                    {courseMap[session.courseId] || courseMap[session.course] || session.courseName || session.name || "Unknown course"}
                  </td>
                  <td className="border-b border-slate-200 px-4 py-4 text-slate-700">{formatTime(session.time || session.startTime || session.dateTime || session.date)}</td>
                  <td className="border-b border-slate-200 px-4 py-4 text-slate-700">{session.sessionType || session.type || session.category || "Unknown"}</td>
                  <td className="border-b border-slate-200 px-4 py-4 text-slate-700">{String(session.status || session.lecturerStatus || session.attendanceStatus || sessionStatus[index] || "Not recorded")}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-4 py-12 text-center text-sm text-slate-500">No sessions found for today.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
