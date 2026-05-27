import React, { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function StudentLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verify Student Role in Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists() && userDoc.data().role === "student") {
        // Store RegNo locally for easy access in the dashboard
        localStorage.setItem("studentRegNo", userDoc.data().regNo);
        navigate("/student-dashboard"); 
      } else {
        await signOut(auth);
        setError("Access Denied: You do not have student privileges.");
      }
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-teal-50">
      <form onSubmit={handleLogin} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-teal-100">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-teal-600">Student Portal</h2>
            <p className="text-gray-500 text-sm mt-2">Sign in to view your attendance</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
        
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-400 uppercase ml-1 mb-1">Email Address</label>
          <input 
            type="email" 
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 outline-none focus:border-teal-500 transition-all" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-400 uppercase ml-1 mb-1">Password</label>
          <input 
            type="password" 
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 outline-none focus:border-teal-500 transition-all" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>

        <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-xl bg-teal-500 py-4 font-bold text-white hover:bg-teal-600 transition-all shadow-lg shadow-teal-100"
        >
          {loading ? "Verifying..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}