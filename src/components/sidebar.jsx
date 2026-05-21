import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FiChevronLeft,
  FiGrid,
  FiBarChart2,
  FiClipboard,
  FiUsers,
  FiUser,
} from "react-icons/fi";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <FiGrid className="h-5 w-5" />,
    },
    {
      name: "Analytics",
      path: "/analytics",
      icon: <FiBarChart2 className="h-5 w-5" />,
    },
    {
      name: "Assign Invigilator",
      path: "/assign",
      icon: <FiClipboard className="h-5 w-5" />,
    },
    {
      name: "Profile",
      path: "/profile",
      icon: <FiUsers className="h-5 w-5" />,
    },
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
          className={`h-3.5 w-3.5 transition-transform duration-300 ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {/* Header */}
      <div className="flex flex-col items-center mb-6 overflow-hidden">
        <div
          className={`bg-teal-100 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
            isOpen ? "w-20 h-20" : "w-9 h-9"
          }`}
        >
          <FiUser
            className={`text-teal-600 transition-all duration-300 ${
              isOpen ? "h-10 w-10" : "h-5 w-5"
            }`}
          />
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
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {item.icon}
            </span>
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
    </aside>
  );
}

export default Sidebar;