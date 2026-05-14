import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar";
import { FiUser, FiMail, FiLock, FiSave, FiEye, FiEyeOff, FiShield } from "react-icons/fi";

const defaultAdmin = {
  name: "Harris Zintambila",
  email: "harriszintambila9@gmail.com",
  role: "Administrator",
};

function Settings() {
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState({
    firstName: defaultAdmin.name.split(" ")[0],
    surname: defaultAdmin.name.split(" ").slice(1).join(" "),
    email: defaultAdmin.email,
    role: defaultAdmin.role,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [profileToast, setProfileToast] = useState(null);
  const [passwordToast, setPasswordToast] = useState(null);
  const [passwordErrors, setPasswordErrors] = useState({});

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = () => {
    if (!profileData.firstName.trim() || !profileData.surname.trim()) {
      setProfileToast({ type: "error", message: "First name and surname cannot be empty." });
      setTimeout(() => setProfileToast(null), 3000);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email.trim())) {
      setProfileToast({ type: "error", message: "Please enter a valid email address." });
      setTimeout(() => setProfileToast(null), 3000);
      return;
    }
    setProfileToast({ type: "success", message: "Profile updated successfully." });
    setTimeout(() => setProfileToast(null), 3000);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    setPasswordErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validatePassword = () => {
    const errors = {};
    if (!passwordData.currentPassword) errors.currentPassword = "Current password is required.";
    if (!passwordData.newPassword) {
      errors.newPassword = "New password is required.";
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters.";
    }
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
    return errors;
  };

  const handleSavePassword = () => {
    const errors = validatePassword();
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordToast({ type: "success", message: "Password changed successfully." });
    setTimeout(() => setPasswordToast(null), 3000);
  };

  const toggleShow = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const fullName = `${profileData.firstName.trim()} ${profileData.surname.trim()}`;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6">

        {/* Page header */}
        <div className="bg-teal-500 text-white px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <FiShield className="h-5 w-5" />
          <span className="font-medium">Settings</span>
        </div>

        {/* Cards — full width, matching the header */}
        <div className="space-y-6">

          {/* Profile Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <FiUser className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-teal-700">Profile Information</h2>
            </div>

            {/* Avatar preview */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-teal-50 rounded-xl">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-500 text-lg font-bold text-white">
                {profileData.firstName.charAt(0).toUpperCase()}
                {profileData.surname.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-gray-800">{fullName || "—"}</p>
                <p className="text-xs text-gray-500">{profileData.email || "—"}</p>
                <span className="mt-1 inline-flex rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                  {profileData.role}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
                <input
                  type="text"
                  name="surname"
                  value={profileData.surname}
                  onChange={handleProfileChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Enter surname"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <FiMail className="h-3.5 w-3.5 text-gray-400" />
                    Email Address
                  </span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Enter email"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  name="role"
                  value={profileData.role}
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-400">Role can only be changed by a super admin.</p>
              </div>
            </div>

            {profileToast && (
              <div className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                profileToast.type === "success"
                  ? "bg-teal-50 text-teal-700 border border-teal-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}>
                {profileToast.type === "success" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                )}
                {profileToast.message}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={handleSaveProfile}
                className="flex items-center gap-2 rounded-full bg-teal-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <FiSave className="h-4 w-4" />
                Save Profile
              </button>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <FiLock className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-teal-700">Change Password</h2>
            </div>

            <div className="space-y-4">

              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      passwordErrors.currentPassword ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow("current")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordErrors.currentPassword}</p>
                )}
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      passwordErrors.newPassword ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow("new")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordErrors.newPassword}</p>
                )}
                {passwordData.newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => {
                        const strength =
                          passwordData.newPassword.length >= 12 &&
                          /[A-Z]/.test(passwordData.newPassword) &&
                          /[0-9]/.test(passwordData.newPassword) &&
                          /[^A-Za-z0-9]/.test(passwordData.newPassword)
                            ? 4
                            : passwordData.newPassword.length >= 10 &&
                              /[A-Z]/.test(passwordData.newPassword) &&
                              /[0-9]/.test(passwordData.newPassword)
                            ? 3
                            : passwordData.newPassword.length >= 8
                            ? 2
                            : 1;
                        return (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              level <= strength
                                ? strength === 1
                                  ? "bg-red-400"
                                  : strength === 2
                                  ? "bg-amber-400"
                                  : strength === 3
                                  ? "bg-teal-400"
                                  : "bg-teal-600"
                                : "bg-gray-200"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {(() => {
                        const s = passwordData.newPassword;
                        const strength =
                          s.length >= 12 && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s)
                            ? "Strong"
                            : s.length >= 10 && /[A-Z]/.test(s) && /[0-9]/.test(s)
                            ? "Good"
                            : s.length >= 8
                            ? "Fair"
                            : "Weak";
                        return `Password strength: ${strength}`;
                      })()}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      passwordErrors.confirmPassword ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow("confirm")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {passwordToast && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {passwordToast.message}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={handleSavePassword}
                className="flex items-center gap-2 rounded-full bg-teal-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <FiSave className="h-4 w-4" />
                Update Password
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default Settings;