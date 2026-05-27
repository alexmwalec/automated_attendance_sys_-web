import React, { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Hardcoded Lecturer Check (as per your original requirement)
    if (email.trim().toLowerCase() === "alexmwalec03@gmail.com" && password === "12345678") {
      navigate("/lecturer-sessions");
      setLoading(false);
      return;
    }

    try {
      // 2. Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Fetch User Role from Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;

        if (role === "admin") {
          navigate("/dashboard");
        } 
        else if (role === "student") {
          // Store RegNo for the student dashboard
          localStorage.setItem("studentRegNo", userData.regNo || "");
          navigate("/student-dashboard");
        } 
        else if (role === "lecturer") {
          navigate("/lecturer-sessions");
        } 
        else {
          await signOut(auth);
          setError("Access Denied: Unrecognized user role.");
        }
      } else {
        await signOut(auth);
        setError("User profile not found in system.");
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Branding Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-full mb-4 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-gray-800">AAS Portal</h1>
          <p className="text-gray-500 text-sm mt-2">Automated Attendance System</p>
        </div>

        <form onSubmit={handleLogin} className="rounded-3xl bg-white p-8 shadow-2xl border border-gray-100">          
          {error && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">Email Address</label>
            <input 
              type="email" 
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-teal-500 focus:bg-white transition-all" 
              placeholder="kings2005@aas.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">Password</label>
            <input 
              type="password" 
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-teal-500 focus:bg-white transition-all" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full rounded-xl py-4 font-bold text-white shadow-lg shadow-teal-200 transition-all flex items-center justify-center
              ${loading ? 'bg-teal-300 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-600 active:scale-95'}`}
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Sign In"}
          </button>
        </form>
        
        <p className="text-center text-gray-400 text-xs mt-8">
          Authorized personnel only. Contact Admin for access.
        </p>
      </div>
    </div>
  );
}