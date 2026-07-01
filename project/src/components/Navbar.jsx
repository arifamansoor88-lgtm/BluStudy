import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Brain,
  Home,
  LayoutGrid,
  Library,
  Layers,
  ClipboardList,
  FileText,
  CalendarDays,
  Settings,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMsal } from "@azure/msal-react";

const NAV_ITEMS = [
  { icon: Home,          label: "Home",           to: "/dashboard",             guestAllowed: false },
  { icon: LayoutGrid,    label: "Study Tools",    to: "/tools",                 guestAllowed: false },
  { icon: Library,       label: "My Library",     to: "/workspace",             guestAllowed: false },
  { icon: Layers,        label: "Flashcards",     to: "/tools/flashcards",      guestAllowed: true  },
  { icon: ClipboardList, label: "Practice Tests", to: "/tools/practice-tests",  guestAllowed: true  },
  { icon: FileText,      label: "Summarizer",     to: "/tools/summarizer",      guestAllowed: true  },
  { icon: CalendarDays,  label: "Study Planner",  to: "/tools/study-planner",   guestAllowed: false },
  { icon: Settings,      label: "Settings",       to: "/settings",              guestAllowed: false },
];

export const Sidebar = ({ isOpen, onToggle, guestMode = false }) => {
  const { pathname } = useLocation();
  const visibleItems = guestMode ? NAV_ITEMS.filter((i) => i.guestAllowed) : NAV_ITEMS;
  const exactMatch = visibleItems.find((item) => pathname === item.to)?.to;
  const logoTo = guestMode ? "/" : "/dashboard";

  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-white border-r border-gray-100 flex flex-col z-40 transition-all duration-300"
      style={{ width: isOpen ? "224px" : "64px" }}
    >
      {/* Logo + toggle */}
      <div className="px-3 py-4 border-b border-gray-100 flex items-center justify-between min-h-[64px]">
        {isOpen ? (
          <Link to={logoTo} className="flex items-center gap-3 group">
            <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
              <Brain className="h-8 w-8 text-primary-600 flex-shrink-0" />
            </motion.div>
            <span className="text-lg font-bold text-gray-900">BluStudy</span>
          </Link>
        ) : (
          <Link to={logoTo} className="mx-auto">
            <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
              <Brain className="h-7 w-7 text-primary-600" />
            </motion.div>
          </Link>
        )}
        {isOpen && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ icon: Icon, label, to }) => {
          const isActive = pathname === to || (!exactMatch && to !== "/dashboard" && pathname.startsWith(to + "/"));
          return (
            <Link
              key={to}
              to={to}
              title={!isOpen ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isOpen ? "" : "justify-center"
              } ${
                isActive
                  ? "bg-primary-50 text-primary-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {isOpen && label}
            </Link>
          );
        })}
      </nav>

      {/* Expand button when collapsed */}
      {!isOpen && (
        <div className="px-2 pb-4">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
};

export const TopBar = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const account = instance.getActiveAccount() || accounts[0];
  const rawName =
    account?.name ||
    account?.idTokenClaims?.name ||
    account?.idTokenClaims?.given_name ||
    account?.username?.split("@")[0] ||
    "User";
  const displayName = rawName.includes("@") ? rawName.split("@")[0] : rawName;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await instance.logoutPopup();
    navigate("/signin");
  };

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-end px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
          <Bell className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700">{displayName}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

/* ── Public top nav (used on landing / sign-in / sign-up) ── */
const Navbar = ({ isPublicPage }) => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const isAuthenticated = accounts.length > 0;

  const handleSignOut = async () => {
    await instance.logoutPopup();
    navigate("/signin");
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
              <Brain className="h-8 w-8 text-primary-600" />
            </motion.div>
            <span className="text-xl font-bold text-gray-900">BluStudy</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button onClick={() => navigate("/dashboard")} className="button-primary">
                  Go to Dashboard
                </button>
                <button onClick={handleSignOut} className="button-secondary flex items-center gap-1">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </>
            ) : (
              <Link to="/signin" className="button-primary">Log In</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
