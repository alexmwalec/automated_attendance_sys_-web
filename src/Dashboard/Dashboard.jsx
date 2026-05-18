import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer 
} from "recharts";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase"; // 
import Sidebar from "../components/sidebar";

const COLORS = ["#0f766e", "#a37931"];

function Dashboard() {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Filter Selections
  const [selections, setSelections] = useState({
    course: "",
    sessionType: "",
    year: "",
    department: "",
    program: "",
    student: ""
  });

  // Data states from Firestore
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [metadata, setMetadata] = useState({
    years: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
    departments: ["Computing", "Mathematics", "Linguistics", "Humanities"],
    programs: ["Bsc Computer Science", "Bsc Information Systems"],
    sessionTypes: ["Class", "Lab", "Exam"]
  });

  // 1. Fetch Dynamic Options (Courses, Students, Metadata)
  useEffect(() => {
    // Fetch Courses
    const unsubCourses = onSnapshot(collection(db, "courses"), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Students
    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Metadata (Optional: for dynamic years/departments)
    const unsubMeta = onSnapshot(collection(db, "metadata"), (snapshot) => {
      if (!snapshot.empty) {
        const metaDoc = snapshot.docs[0].data();
        setMetadata(prev => ({ ...prev, ...metaDoc }));
      }
    });

    return () => {
      unsubCourses();
      unsubStudents();
      unsubMeta();
    };
  }, []);

  // 2. Fetch Attendance Data based on selections
  useEffect(() => {
    let q = collection(db, "attendance");

    // If a specific course is selected, filter the query
    if (selections.course) {
      q = query(collection(db, "attendance"), where("courseCode", "==", selections.course));
    }

    const unsubAttendance = onSnapshot(q, (snapshot) => {
      const rawData = snapshot.docs.map(doc => doc.data());
      
      // Transform raw logs into the format Recharts needs (Weekly aggregation)
      const weeklyMap = {};
      rawData.forEach(record => {
        const week = record.week || "W1"; // Assuming you store week or calculate from date
        if (!weeklyMap[week]) weeklyMap[week] = { week, present: 0, absent: 0 };
        
        if (record.status === "Present") weeklyMap[week].present++;
        else weeklyMap[week].absent++;
      });

      setAttendanceRecords(Object.values(weeklyMap).sort((a,b) => a.week.localeCompare(b.week)));
    });

    return () => unsubAttendance();
  }, [selections.course]);

  const handleChange = (e) => {
    setSelections({ ...selections, [e.target.name]: e.target.value });
  };

  // UI Helpers
  const selectedCards = Object.entries(selections)
    .filter(([_, value]) => value !== "")
    .map(([key, value]) => ({ label: `${key.toUpperCase()}: ${value}` }));

  const dataVisible = selections.course || selections.student;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="bg-teal-600 text-white px-4 py-3 rounded-lg mb-4 flex justify-between items-center relative">
          <span className="font-bold">Attendance Analytics Dashboard</span>
          <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="hover:bg-teal-700 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          {showProfileMenu && (
            <div className="absolute right-4 top-full mt-2 w-32 bg-white rounded-md shadow-lg py-1 z-10">
              <button onClick={() => navigate("/")} className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left">Logout</button>
            </div>
          )}
        </div>

        {/* Dropdowns (Dynamic) */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select name="course" value={selections.course} onChange={handleChange} className="flex-1 min-w-[150px] border border-teal-500 rounded px-3 py-2">
            <option value="">Select Course</option>
            {courses.map(c => <option key={c.id} value={c.courseCode}>{c.courseCode}</option>)}
          </select>

          <select name="sessionType" value={selections.sessionType} onChange={handleChange} className="flex-1 min-w-[150px] border border-teal-500 rounded px-3 py-2">
            <option value="">Session Type</option>
            {metadata.sessionTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select name="year" value={selections.year} onChange={handleChange} className="flex-1 min-w-[150px] border border-teal-500 rounded px-3 py-2">
            <option value="">Select Year</option>
            {metadata.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select name="department" value={selections.department} onChange={handleChange} className="flex-1 min-w-[150px] border border-teal-500 rounded px-3 py-2">
            <option value="">Department</option>
            {metadata.departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select name="student" value={selections.student} onChange={handleChange} className="flex-1 min-w-[150px] border border-teal-500 rounded px-3 py-2">
            <option value="">Select Student</option>
            {students.map(s => <option key={s.id} value={s.fullName}>{s.fullName}</option>)}
          </select>
        </div>

        {/* Selected Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {selectedCards.map((card, idx) => (
            <div key={idx} className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-semibold">
              {card.label}
            </div>
          ))}
        </div>

        {/* Visualizations */}
        {dataVisible ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h3 className="font-bold text-gray-700 mb-4">Weekly Attendance Trends</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceRecords.length > 0 ? attendanceRecords : []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" fill="#0f766e" name="Present" />
                    <Bar dataKey="absent" fill="#a37931" name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md flex flex-col items-center">
              <h3 className="font-bold text-gray-700 mb-4">Student Demographics</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Males", value: students.filter(s => s.gender === 'Male').length || 1 },
                        { name: "Females", value: students.filter(s => s.gender === 'Female').length || 1 }
                      ]}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => <Cell key={index} fill={color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-teal-700 rounded-full"></span> Male</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#a37931] rounded-full"></span> Female</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-gray-500 text-lg">Select a course or student to view analytics</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;