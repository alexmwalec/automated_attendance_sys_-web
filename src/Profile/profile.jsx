import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/sidebar";

function Profile() {
  const [users, setUsers] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [toast, setToast] = useState(null);
  const [emailError, setEmailError] = useState("");
  const toastTimerRef = useRef(null);

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    role: ""
  });

  const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Check if email already exists, excluding the currently edited user
  const isDuplicateEmail = (email, excludeIndex = null) =>
    users.some(
      (user, i) =>
        user.email.toLowerCase() === email.trim().toLowerCase() &&
        i !== excludeIndex
    );

  const showToast = (toastData, duration = 3000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(toastData);
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "email") {
      if (!value) {
        setEmailError("");
        return;
      }
      // Clear error live as user types — recheck both format and duplicate
      if (emailError) {
        if (!isValidEmail(value)) {
          setEmailError("Please enter a valid email address (e.g. name@example.com).");
        } else if (isDuplicateEmail(value, editingIndex)) {
          setEmailError("This email is already registered.");
        } else {
          setEmailError("");
        }
      }
    }
  };

  const handleEmailBlur = () => {
    if (!formData.email) return;
    if (!isValidEmail(formData.email)) {
      setEmailError("Please enter a valid email address (e.g. name@example.com).");
    } else if (isDuplicateEmail(formData.email, editingIndex)) {
      setEmailError("This email is already registered.");
    } else {
      setEmailError("");
    }
  };

  const handleAddUser = () => {
    if (!formData.name || !formData.email || !formData.department || !formData.role) {
      alert("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(formData.email)) {
      setEmailError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    if (isDuplicateEmail(formData.email, editingIndex)) {
      setEmailError("This email is already registered.");
      return;
    }

    if (editingIndex !== null) {
      const updatedUsers = [...users];
      updatedUsers[editingIndex] = { ...formData };
      setUsers(updatedUsers);
      setEditingIndex(null);
      showToast({ type: "success", message: `${formData.name}'s changes were saved successfully.` });
    } else {
      setUsers([...users, { ...formData }]);
      showToast({ type: "success", message: `${formData.name} was added successfully.` });
    }

    setFormData({ name: "", email: "", department: "", role: "" });
    setEmailError("");
  };

  const handleEdit = (index) => {
    setFormData({ ...users[index] });
    setEditingIndex(index);
    setEmailError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (index) => {
    const deletedUser = users[index];

    setUsers((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setFormData({ name: "", email: "", department: "", role: "" });
      setEmailError("");
    }

    showToast({ type: "deleted", deletedUser, deletedIndex: index }, 5000);
  };

  const handleUndo = () => {
    if (!toast || toast.type !== "deleted") return;
    clearTimeout(toastTimerRef.current);

    setUsers((prev) => {
      const updated = [...prev];
      updated.splice(toast.deletedIndex, 0, toast.deletedUser);
      return updated;
    });

    setToast(null);
  };

  const handleDismissToast = () => {
    clearTimeout(toastTimerRef.current);
    setToast(null);
  };

  useEffect(() => {
    return () => clearTimeout(toastTimerRef.current);
  }, []);

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setFormData({ name: "", email: "", department: "", role: "" });
    setEmailError("");
  };

  const isFormValid =
    formData.name &&
    formData.email &&
    isValidEmail(formData.email) &&
    !isDuplicateEmail(formData.email, editingIndex) &&
    formData.department &&
    formData.role;

  return (
    <div className="flex h-screen bg-gray-100">

      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="bg-teal-500 text-white px-4 py-3 rounded-lg mb-4 flex justify-between items-center relative">
          <span>Profile</span>
          <button type="button" onClick={() => setShowProfileMenu(!showProfileMenu)} className="rounded-full p-2 hover:bg-teal-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </button>
          {showProfileMenu && (
            <div className="absolute right-4 top-full mt-2 w-20 h-11 rounded-xl bg-teal-100 text-left shadow-lg ring-1 ring-black ring-opacity-5">
              <button type="button" onClick={() => { setShowProfileMenu(false); navigate("/"); }} className="w-full px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 transition-colors rounded-lg">
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-xl font-semibold text-teal-700 mb-4">
            {editingIndex !== null ? "Edit User" : "Add New User"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Enter name"
              />
            </div>

            {/* Email field with format + duplicate validation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                onBlur={handleEmailBlur}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
                  emailError
                    ? "border-red-400 bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400"
                    : "border-gray-300"
                }`}
                placeholder="Enter email"
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select name="department" value={formData.department} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="" disabled hidden>Select department</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Physics">Physics</option>
                <option value="Biology">Biology</option>
                <option value="Chemistry">Chemistry</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select name="role" value={formData.role} onChange={handleFormChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="" disabled hidden>Select role</option>
                <option value="lecturer">Lecturer</option>
                <option value="teaching assistant">Teaching Assistant</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            {editingIndex !== null && (
              <button type="button" onClick={handleCancelEdit} className="px-6 py-2 rounded-full font-semibold shadow-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleAddUser}
              disabled={!isFormValid}
              className={`px-6 py-2 rounded-full font-semibold shadow-md transition-colors ${
                isFormValid
                  ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              {editingIndex !== null ? "Save Changes" : "Add User"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h2 className="text-xl font-semibold text-teal-700 mb-4">Profiles</h2>
          <table className="w-full min-w-full border border-gray-300">
            <thead>
              <tr className="bg-teal-600 text-white text-sm">
                <th className="w-1/4 p-3 text-left border border-gray-300 whitespace-nowrap">NAME</th>
                <th className="w-1/4 p-3 text-left border border-gray-300 whitespace-nowrap">EMAIL</th>
                <th className="p-3 text-left border border-gray-300 whitespace-nowrap">DEPARTMENT</th>
                <th className="p-3 text-left border border-gray-300 whitespace-nowrap">ROLE</th>
                <th className="p-3 text-center border border-gray-300 whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-6 text-sm">No profiles added yet.</td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="w-1/4 p-2 border border-gray-300">{user.name}</td>
                    <td className="w-1/4 p-2 border border-gray-300">{user.email}</td>
                    <td className="p-2 border border-gray-300">{user.department}</td>
                    <td className="p-2 border border-gray-300 capitalize">{user.role}</td>
                    <td className="p-2 border border-gray-300">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={() => handleEdit(index)} title="Edit" className="text-teal-600 hover:text-teal-800 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => handleDelete(index)} title="Delete" className="text-red-500 hover:text-red-700 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-teal-700 text-white px-5 py-3 rounded-xl shadow-xl animate-fade-in-up">
          {toast.type === "success" ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-teal-200 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 text-teal-200 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          )}

          <span className="text-sm">
            {toast.type === "success"
              ? toast.message
              : <><span className="font-semibold">{toast.deletedUser?.name}</span> was deleted.</>
            }
          </span>

          {toast.type === "deleted" && (
            <button type="button" onClick={handleUndo} className="text-white hover:text-teal-200 text-sm font-bold underline underline-offset-2 transition-colors">
              Undo
            </button>
          )}

          <button type="button" onClick={handleDismissToast} className="text-teal-200 hover:text-white transition-colors ml-1" title="Dismiss">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="absolute bottom-0 left-0 h-1 bg-teal-300 rounded-b-xl animate-shrink-bar"
            style={{ animationDuration: toast.type === "deleted" ? "5000ms" : "3000ms" }}
          />
        </div>
      )}

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes shrink-bar {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
        .animate-shrink-bar { animation: shrink-bar linear forwards; }
      `}</style>
    </div>
  );
}

export default Profile;