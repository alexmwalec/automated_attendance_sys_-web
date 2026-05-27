import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function StudentAuth() {
  const [regNo, setRegNo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Look for the student document where the ID (Document ID) matches the Reg No
      const q = query(collection(db, "students"));
      const querySnapshot = await getDocs(q);
      
      // Check if any document ID matches the entered Reg No
      const studentExists = querySnapshot.docs.find(
        (doc) => doc.id.trim().toUpperCase() === regNo.trim().toUpperCase()
      );

      if (studentExists) {
        // Save to localStorage so the dashboard knows who is logged in
        localStorage.setItem("studentRegNo", regNo.trim().toUpperCase());
        navigate("/student-dashboard");
      } else {
        setError("Registration Number not found in our system.");
      }
    } catch (err) {
      setError("System error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-teal-100">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-teal-600">Student Access</h1>
            <p className="text-slate-500 text-sm mt-2">Enter your Reg No to view attendance</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}

        <form onSubmit={handleVerify}>
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Registration Number</label>
            <input 
              type="text" 
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-teal-500 focus:bg-white transition-all uppercase"
              placeholder="e.g. S20/12345"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-xl bg-teal-500 py-4 font-bold text-white shadow-lg shadow-teal-200 hover:bg-teal-600 transition-all active:scale-95"
          >
            {loading ? "Verifying..." : "View My Attendance"}
          </button>
        </form>
      </div>
    </div>
  );
}