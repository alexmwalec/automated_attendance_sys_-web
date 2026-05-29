import React, { useEffect, useState } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import { auth } from "../firebase";

export default function ChangePassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  useEffect(() => {
    const checkResetCode = async () => {
      if (!oobCode) {
        setFeedback({
          type: "error",
          message: "Password reset link is missing or invalid.",
        });
        setCheckingCode(false);
        return;
      }

      try {
        const resetEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(resetEmail);
      } catch (err) {
        console.error("Password reset link error:", err);
        setFeedback({
          type: "error",
          message: "This password reset link is invalid or has expired.",
        });
      } finally {
        setCheckingCode(false);
      }
    };

    checkResetCode();
  }, [oobCode]);

  const handleConfirmPassword = async (e) => {
    e.preventDefault();
    setFeedback({ type: "", message: "" });

    if (!oobCode) {
      setFeedback({ type: "error", message: "Password reset link is missing or invalid." });
      return;
    }

    if (newPassword.length < 6) {
      setFeedback({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", message: "Passwords do not match." });
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset(auth, oobCode, newPassword);
      setFeedback({
        type: "success",
        message: "Password updated successfully. Redirecting to login...",
      });
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      console.error("Password update error:", err);
      setFeedback({
        type: "error",
        message: "Unable to update password. Please request a new reset link.",
      });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-10 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-[32px] shadow-xl border border-slate-200 p-8 text-center">
        <h1 className="text-3xl font-bold tracking-[0.3em] text-teal-700 mb-3">AAS PORTAL</h1>
        <p className="text-sm text-slate-500 mb-8">Change Password</p>

        {checkingCode ? (
          <div className="mx-auto h-6 w-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
        ) : (
          <form onSubmit={handleConfirmPassword} className="space-y-4 text-left">
            {feedback.message && (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-xl border ${
                  feedback.type === "success"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                    : "text-red-600 bg-red-50 border-red-100"
                }`}
              >
                {feedback.message}
              </div>
            )}

            {email && <p className="text-center text-xs text-slate-500">Resetting password for {email}</p>}

            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                <FiLock size={17} />
              </span>
              <label htmlFor="newPassword" className="sr-only">Create New Password</label>
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create New Password"
                required
                disabled={feedback.type === "error" && !email}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-teal-600 transition-colors"
              >
                {showNewPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                <FiLock size={17} />
              </span>
              <label htmlFor="confirmPassword" className="sr-only">Confirm New Password</label>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                required
                disabled={feedback.type === "error" && !email}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-teal-600 transition-colors"
              >
                {showConfirmPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className={`w-full rounded-xl py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition ${
                loading || !email ? "bg-teal-400 cursor-not-allowed" : "bg-teal-700 hover:bg-teal-800"
              }`}
            >
              {loading ? (
                <div className="mx-auto h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Confirm"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
