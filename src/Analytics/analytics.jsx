import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/sidebar";

const supersetDashboardUrl = "http://localhost:8088/superset/dashboard/1/?standalone=true";

function Analytics() {
  const location = useLocation();
  const [selections, setSelections] = useState({
    course: "",
    year: "",
    department: "",
    program: "",
    student: ""
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSelections({
      course: params.get("course") || "",
      year: params.get("year") || "",
      department: params.get("department") || "",
      program: params.get("program") || "",
      student: params.get("student") || ""
    });
  }, [location.search]);

  // Helper to get display label
  const getLabel = (key) => {
    const labels = {
      course: "Course",
      year: "Year",
      department: "Department",
      program: "Program",
      student: "Student"
    };
    return labels[key] || key;
  };

  // Filter out empty selectio
  const activeSelections = Object.entries(selections).filter(([_, value]) => value);

  return (
    <div className="flex h-screen bg-gray-100">

      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">

        {/* Header */}
        <div className="bg-teal-500 text-white px-4 py-3 rounded-lg mb-4 flex justify-between items-center relative">
          <span>Analytics</span>
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="rounded-full p-2 hover:bg-teal-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </button>
          {showProfileMenu && (
            <div className="absolute right-4 top-full mt-2 w-20 h-11 rounded-xl bg-teal-100 text-left shadow-lg ring-1 ring-black ring-opacity-5">
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/");
                }}
                className="w-full px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 transition-colors rounded-lg"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Heading - Show selected filters */}
        {activeSelections.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
            <h2 className="text-lg font-semibold text-teal-700 mb-2">
              Analytics for:
            </h2>
           {/* <div className="flex flex-wrap gap-4">
              {activeSelections.map(([key, value], i) => (
                <div
                  key={i}
                  className="flex-1 min-w-[180px] bg-teal-50 border border-teal-200 rounded-lg p-4 text-center text-sm font-medium text-teal-700"
                >
                  {getLabel(key)}: {value}
                </div>
              ))}
            </div> */}
          </div>
        )}

        {/* Info Cards - Dynamic based on selections */}
        <div className="flex flex-wrap gap-4 mb-6">
          {activeSelections.length > 0 ? (
            activeSelections.map(([key, value], i) => (
              <div
                key={i}
                className="flex-1 min-w-[180px] bg-teal-50 border border-teal-200 rounded-lg p-4 text-center text-sm font-medium text-teal-700"
              >
                {getLabel(key)}: {value}
              </div>
            ))
          ) : (
            [
              "Program: Computer Science",
              "Department: Computing",
              "Year: 4",
              "Program of Study: BSc Computing"
            ].map((item, i) => (
              <div
                key={i}
                className="flex-1 min-w-[180px] bg-teal-50 border border-teal-200 rounded-lg p-4 text-center text-sm font-medium text-teal-700"
              >
                {item}
              </div>
            ))
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 h-[calc(100vh-6.5rem)]">
          <iframe
            src={supersetDashboardUrl}
            title="Superset Analytics Dashboard"
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      </main>
    </div>
  );
}

export default Analytics;