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

function Sidebar({ closeSidebar, drawerMode = false }) {
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
    /*{
      name: "Profile",
      path: "/profile",
      icon: <FiUsers className="h-5 w-5" />,
    },*/
  ];

  return (
    <aside
      className={`relative z-20 flex shrink-0 flex-col bg-teal-50 border-teal-200 transition-all duration-300 ease-in-out ${
        drawerMode
          ? "h-screen border-r p-4"
          : "border-b p-3 sm:h-screen sm:border-b-0 sm:border-r sm:p-4"
      } ${
        isOpen
          ? drawerMode
            ? "w-64"
            : "w-full sm:w-64"
          : drawerMode
          ? "w-16"
          : "w-full sm:w-16"
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-teal-300 bg-white text-teal-700 shadow-sm transition hover:bg-teal-100 sm:-right-3 sm:top-6 sm:h-6 sm:w-6"
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <FiChevronLeft
          className={`h-3.5 w-3.5 transition-transform duration-300 ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {/* Header */}
      <div className="mb-3 flex items-center gap-3 overflow-hidden pr-10 sm:mb-6 sm:flex-col sm:gap-0 sm:pr-0">
        <div
          className={`bg-teal-100 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
            isOpen
              ? drawerMode
                ? "h-20 w-20"
                : "h-10 w-10 sm:h-20 sm:w-20"
              : "h-9 w-9"
          }`}
        >
          <FiUser
            className={`text-teal-600 transition-all duration-300 ${
              isOpen
                ? drawerMode
                  ? "h-10 w-10"
                  : "h-5 w-5 sm:h-10 sm:w-10"
                : "h-5 w-5"
            }`}
          />
        </div>

        <h2
          className={`text-xs text-gray-600 whitespace-nowrap transition-all duration-200 ${
            drawerMode
              ? "mt-2 text-center text-sm"
              : "sm:mt-2 sm:text-center sm:text-sm"
          } ${
            isOpen
              ? drawerMode
                ? "opacity-100 max-w-xs max-h-10"
                : "opacity-100 max-w-xs sm:max-h-10"
              : drawerMode
              ? "opacity-0 max-w-0 overflow-hidden max-h-0"
              : "opacity-0 max-w-0 overflow-hidden sm:max-h-0"
          }`}
        >
          MAIN NAVIGATION MENU
        </h2>
      </div>

      {/* Nav Items */}
      <nav
        className={
          drawerMode
            ? "block space-y-2 overflow-visible pb-0"
            : "flex gap-2 overflow-x-auto pb-1 sm:block sm:space-y-2 sm:overflow-visible sm:pb-0"
        }
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={closeSidebar}
            title={!isOpen ? item.name : undefined}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                drawerMode ? "w-full" : "sm:w-full"
              } ${
                isActive ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-teal-100"
              } ${!isOpen ? "justify-center" : ""}`
            }
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {item.icon}
            </span>
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
                isOpen ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
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
