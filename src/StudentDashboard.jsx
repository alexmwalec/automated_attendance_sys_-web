import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  FiChevronUp,
  FiChevronDown,
  FiLogOut,
} from "react-icons/fi";

const ITEMS_PER_PAGE = 10;

export default function StudentDashboard() {
  // Attendance records for the logged-in student
  const [myAttendance, setMyAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({
    courseCode: "",
    sessionType: "",
    date: "",
    status: "",
  });

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  // Cache the student's registration number from localStorage
  const regNo = localStorage.getItem("studentRegNo");

  useEffect(() => {
    // Real-time listener for attendance records
    if (!regNo) {
      navigate("/login");
      return;
    }

    // Find the student's entry in the full attendance list for this record
    const unsub = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const records = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        // Store record if student is found in the attendance list
        const studentEntry = data.fullAttendanceList?.find(
          (s) =>
            s.regNo?.trim().toUpperCase() ===
            regNo.trim().toUpperCase()
        );

        // Safely handle missing fields with defaults
        if (studentEntry) {
          records.push({
            id: doc.id,
            courseCode: data.courseCode || "",
            sessionType: data.sessionType || "",
            date: data.date || "",
            status: studentEntry.status || "",
          });
        }
      });

      setMyAttendance(records);
      setLoading(false);
    });

    return () => unsub();
  }, [regNo, navigate]);

  // Unique course codes and session types for filter dropdowns
  const uniqueCourses = [
    ...new Set(
      myAttendance.map((r) => r.courseCode).filter(Boolean)
    ),
  ];

  const uniqueTypes = [
    ...new Set(
      myAttendance.map((r) => r.sessionType).filter(Boolean)
    ),
  ];

  // Filter attendance based on selected filters
  let filteredAttendance = myAttendance.filter((item) => {
    let matchesDate = true;

    // Handle date filter by converting both to YYYY-MM-DD format for comparison
    if (filters.date) {
      const formattedDate = item.date
        ?.split("/")
        ?.reverse()
        ?.join("-");

      matchesDate = formattedDate === filters.date;
    }

    return (
      (filters.courseCode === "" ||
        item.courseCode === filters.courseCode) &&
      (filters.sessionType === "" ||
        item.sessionType === filters.sessionType) &&
      matchesDate &&
      (filters.status === "" ||
        item.status === filters.status)
    );
  });

  // Sort the filtered attendance based on the current sort configuration
  filteredAttendance.sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    if (sortConfig.key === "date") {
      const convertDate = (dateStr) => {
        if (!dateStr) return new Date(0);

        const [day, month, year] = dateStr.split("/");

        return new Date(`${year}-${month}-${day}`);
      };

      valA = convertDate(valA);
      valB = convertDate(valB);
    } else {
      valA = (valA || "").toString().toLowerCase();
      valB = (valB || "").toString().toLowerCase();
    }

    if (valA < valB) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }

    if (valA > valB) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }

    return 0;
  });

  // Paginate the sorted & filtered attendance records
  const totalPages = Math.ceil(
    filteredAttendance.length / ITEMS_PER_PAGE
  );

  const paginatedAttendance = filteredAttendance.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));

    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      courseCode: "",
      sessionType: "",
      date: "",
      status: "",
    });

    setCurrentPage(1);
  };

  // Handle sorting when a column header is clicked
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc"
          ? "desc"
          : "asc",
    }));

    setCurrentPage(1);
  };

  const isFiltered = Object.values(filters).some(
    (v) => v !== ""
  );

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between bg-teal-500 text-white p-5 rounded-2xl shadow-md">

          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              AAS PORTAL
            </h1>

            <p className="font-medium text-teal-50 text-lg">
              Student Attendance History
            </p>

            {/* Display Current Logged In Student */}
            <p className="font-medium text-black text-sm sm:text-base font-bold mt-1 break-words">
              {regNo}
            </p>
          </div>

          {/* Log Out */}
          <button
            onClick={async () => {
              try {
                await auth.signOut();

                localStorage.removeItem("studentRegNo");

                navigate("/login");
              } catch (error) {
                console.error("Logout Error:", error);
              }
            }}
            className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-teal-600 transition"
            title="Log Out"
          >
            <FiLogOut className="text-2xl text-white" />
          </button>
        </div>

        {/* Mobile Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 lg:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Course */}
            <div>
              <label className="block text-sm font-normal text-gray-600 uppercase tracking-wide mb-1">
                Course
              </label>

              <select
                name="courseCode"
                value={filters.courseCode}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm"
              >
                <option value="">All Courses</option>

                {uniqueCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                Type
              </label>

              <select
                name="sessionType"
                value={filters.sessionType}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm"
              >
                <option value="">All Types</option>

                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Date
              </label>

              <input
                type="date"
                name="date"
                value={filters.date}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-bold text-gray-600 uppercase tracking-wide mb-1">
                Status
              </label>

              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="mt-4 w-full text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">

            <table className="w-full text-left min-w-[700px]">

              {/* Table Header */}
              <thead className="hidden lg:table-header-group">
                <tr>

                  {/* Course */}
                  <th className="px-4 py-3 border border-gray-300 font-normal bg-teal-500">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide mb-1">
                      Course
                    </label>

                    <div className="flex items-center gap-2">
                      <select
                        name="courseCode"
                        value={filters.courseCode}
                        onChange={handleFilterChange}
                        className="flex-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm"
                      >
                        <option value="">All Courses</option>

                        {uniqueCourses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() =>
                          handleSort("courseCode")
                        }
                        className="text-white hover:text-teal-200"
                      >
                        {sortConfig.key ===
                          "courseCode" &&
                        sortConfig.direction === "asc" ? (
                          <FiChevronUp size={18} />
                        ) : (
                          <FiChevronDown size={18} />
                        )}
                      </button>
                    </div>
                  </th>

                  {/* Type */}
                  <th className="px-4 py-3 border border-gray-300 font-normal bg-teal-500">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide mb-1">
                      Type
                    </label>

                    <div className="flex items-center gap-2">
                      <select
                        name="sessionType"
                        value={filters.sessionType}
                        onChange={handleFilterChange}
                        className="flex-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm"
                      >
                        <option value="">All Types</option>

                        {uniqueTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() =>
                          handleSort("sessionType")
                        }
                        className="text-white hover:text-teal-200"
                      >
                        {sortConfig.key ===
                          "sessionType" &&
                        sortConfig.direction === "asc" ? (
                          <FiChevronUp size={18} />
                        ) : (
                          <FiChevronDown size={18} />
                        )}
                      </button>
                    </div>
                  </th>

                  {/* Date */}
                  <th className="px-4 py-3 border border-gray-300 font-normal bg-teal-500">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide mb-1">
                      Date
                    </label>

                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        name="date"
                        value={filters.date}
                        onChange={handleFilterChange}
                        className="flex-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm"
                      />

                      <button
                        onClick={() => handleSort("date")}
                        className="text-white hover:text-teal-200"
                      >
                        {sortConfig.key === "date" &&
                        sortConfig.direction === "asc" ? (
                          <FiChevronUp size={18} />
                        ) : (
                          <FiChevronDown size={18} />
                        )}
                      </button>
                    </div>
                  </th>

                  {/* Status */}
                  <th className="px-4 py-3 border border-gray-300 font-normal bg-teal-500">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide mb-1">
                      Status
                    </label>

                    <div className="flex gap-2 items-center">
                      <select
                        name="status"
                        value={filters.status}
                        onChange={handleFilterChange}
                        className="flex-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-sm"
                      >
                        <option value="">All</option>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                      </select>

                      <button
                        onClick={() =>
                          handleSort("status")
                        }
                        className="text-white hover:text-teal-200"
                      >
                        {sortConfig.key === "status" &&
                        sortConfig.direction === "asc" ? (
                          <FiChevronUp size={18} />
                        ) : (
                          <FiChevronDown size={18} />
                        )}
                      </button>

                      {isFiltered && (
                        <button
                          onClick={clearFilters}
                          className="shrink-0 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg"
                        >
                          ✕ Clear
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y bg-teal-50 divide-gray-50">

                {paginatedAttendance.length > 0 ? (
                  paginatedAttendance.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-teal-50/30 transition-colors block lg:table-row border-b lg:border-none mb-3 lg:mb-0 bg-white lg:bg-transparent rounded-xl lg:rounded-none p-3 lg:p-0"
                    >

                      <td className="border border-gray-300 px-4 sm:px-6 py-3 sm:py-4 text-gray-700 block lg:table-cell">
                        <span className="font-bold lg:hidden">
                          Course:
                        </span>{" "}
                        {item.courseCode}
                      </td>

                      <td className="border border-gray-300 px-4 sm:px-6 py-3 sm:py-4 text-gray-500 block lg:table-cell">
                        <span className="font-bold lg:hidden">
                          Type:
                        </span>{" "}
                        {item.sessionType}
                      </td>

                      <td className="border border-gray-300 px-4 sm:px-6 py-3 sm:py-4 text-gray-500 block lg:table-cell">
                        <span className="font-bold lg:hidden">
                          Date:
                        </span>{" "}
                        {item.date}
                      </td>

                      <td className="border border-gray-300 px-4 sm:px-6 py-3 sm:py-4 block lg:table-cell">
                        <span className="font-bold lg:hidden">
                          Status:
                        </span>{" "}

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.status === "Present"
                              ? "bg-green-200 text-teal-600"
                              : "bg-red-200 text-red-600"
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center py-20 text-gray-400 italic"
                    >
                      {loading
                        ? "Loading records..."
                        : isFiltered
                        ? "No records match the selected filters."
                        : "No attendance records found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-white">

              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.max(1, p - 1)
                  )
                }
                disabled={currentPage === 1}
                className="px-5 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
              >
                Previous
              </button>

              <span className="text-sm text-gray-600 font-medium">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(totalPages, p + 1)
                  )
                }
                disabled={currentPage === totalPages}
                className="px-5 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}