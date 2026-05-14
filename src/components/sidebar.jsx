import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FiChevronDown,
  FiLogOut,
  FiSettings,
  FiUser,
  FiGrid,
  FiBarChart2,
  FiClipboard,
  FiUsers,
  FiChevronLeft,
} from "react-icons/fi";

const defaultAdmin = {
  name: "Harris Zintambila",
  email: "harriszintambila9@gmail.com",
  role: "Administrator",
};

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function AdminMenu({ admin = defaultAdmin, isOpen: sidebarOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const adminName = admin?.name || defaultAdmin.name;
  const adminEmail = admin?.email || defaultAdmin.email;
  const adminRole = admin?.role || defaultAdmin.role;
  const initials = getInitials(adminName);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!sidebarOpen) setIsOpen(false);
  }, [sidebarOpen]);

  const handleSettings = () => {
    setIsOpen(false);
    navigate("/settings");
  };

  const handleLogout = () => {
    setIsOpen(false);
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <div ref={menuRef} className="relative w-full">

      {/* Popover — opens upward */}
      <div
        className={`absolute bottom-full left-0 right-0 mb-2 z-50 rounded-2xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 transition-all duration-200 origin-bottom ${
          isOpen
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible translate-y-2 scale-95 opacity-0"
        }`}
        role="menu"
        aria-label="Admin profile options"
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
            {initials || <FiUser className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{adminName}</p>
            <p className="truncate text-xs text-gray-400">{adminEmail}</p>
            <span className="mt-1 inline-flex rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
              {adminRole}
            </span>
          </div>
        </div>

        <div className="mx-3 border-t border-gray-100" />

        <div className="p-2">
          <button
            type="button"
            onClick={handleSettings}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            role="menuitem"
          >
            <FiSettings className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Settings
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            role="menuitem"
          >
            <FiLogOut className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Log out
          </button>
        </div>
      </div>

      {/* Trigger — expanded */}
      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen((curr) => !curr)}
          className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition duration-150 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 ${
            isOpen ? "bg-teal-600" : "bg-teal-500 hover:bg-teal-600"
          }`}
          aria-label="Open admin profile menu"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
            {initials || <FiUser className="h-4 w-4" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-white">{adminName}</span>
            <span className="truncate text-xs text-teal-100">{adminRole}</span>
          </div>
          <FiChevronDown
            className={`h-4 w-4 text-white/70 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      ) : (
        // Trigger — collapsed
        <button
          type="button"
          onClick={() => setIsOpen((curr) => !curr)}
          className={`flex w-full items-center justify-center rounded-xl py-2 transition duration-150 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
            isOpen ? "bg-teal-600" : "bg-teal-500 hover:bg-teal-600"
          }`}
          aria-label="Open admin profile menu"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
            {initials || <FiUser className="h-4 w-4" />}
          </span>
        </button>
      )}
    </div>
  );
}

function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: <FiGrid className="h-5 w-5" /> },
    { name: "Analytics", path: "/analytics", icon: <FiBarChart2 className="h-5 w-5" /> },
    { name: "Assign Invigilator", path: "/assign", icon: <FiClipboard className="h-5 w-5" /> },
    { name: "Profile", path: "/profile", icon: <FiUsers className="h-5 w-5" /> },
    { name: "Settings", path: "/settings", icon: <FiSettings className="h-5 w-5" /> },
  ];

  return (
    <aside
      className={`relative flex flex-col bg-teal-50 border-r border-teal-200 p-4 transition-all duration-300 ease-in-out ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-teal-300 bg-white text-teal-700 shadow-sm hover:bg-teal-100 transition"
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <FiChevronLeft
          className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? "" : "rotate-180"}`}
        />
      </button>

      {/* Header */}
      <div className="flex flex-col items-center mb-6 overflow-hidden">
        <div className={`bg-teal-100 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${isOpen ? "w-20 h-20" : "w-9 h-9"}`}>
          <FiUser className={`text-teal-600 transition-all duration-300 ${isOpen ? "h-10 w-10" : "h-5 w-5"}`} />
        </div>
        <h2
          className={`mt-2 text-sm text-gray-600 text-center whitespace-nowrap transition-all duration-200 ${
            isOpen ? "opacity-100 max-h-10" : "opacity-0 max-h-0 overflow-hidden"
          }`}
        >
          MAIN NAVIGATION MENU
        </h2>
      </div>

      {/* Nav Items */}
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={!isOpen ? item.name : undefined}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 text-left py-2 px-3 rounded-lg transition ${
                isActive ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-teal-100"
              } ${!isOpen ? "justify-center" : ""}`
            }
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
                isOpen ? "opacity-100 max-w-xs" : "opacity-0 max-w-0"
              }`}
            >
              {item.name}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* AdminMenu pinned at bottom */}
      <div className="mt-auto pt-4 border-t border-teal-200">
        <AdminMenu isOpen={isOpen} />
      </div>
    </aside>
  );
}

export default Sidebar;