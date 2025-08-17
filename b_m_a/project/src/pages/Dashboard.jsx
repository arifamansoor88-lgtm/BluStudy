// src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
import { Trophy, Clock, Folder, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUserStats } from "../hooks/useUserStats";
import { useUserRecents } from "../hooks/useUserRecents";

// ———— Derive user from MSAL ————
function useUserData(instance, accounts, navigate) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (accounts.length === 0) {
      navigate("/signin");
      return;
    }
    if (!instance.getActiveAccount()) {
      instance.setActiveAccount(accounts[0]);
    }
    const acct = instance.getActiveAccount() || accounts[0];
    const claims = acct.idTokenClaims || {};

    const name =
      claims.name ??
      claims.given_name ??
      acct.name ??
      (acct.username?.split("@")[0]) ??
      "User";

    const email =
      claims.email ??
      claims.preferred_username ??
      (Array.isArray(claims.emails) ? claims.emails[0] : undefined) ??
      acct.username ??
      "";

    setUser({ id: acct.localAccountId, name, email });
  }, [instance, accounts, navigate]);

  return user;
}

export default function Dashboard() {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  const user = useUserData(instance, accounts, navigate);

  // Real data from API (via hooks)
  const stats = useUserStats(user?.id);          // -> { streak, hours }
  const recents = useUserRecents(user?.id);      // -> [{id,name,date,contentType}, ...]

  if (!user) return null; // or a spinner

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Greeting */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user.name.split(" ")[0]}!
        </h1>
        <p className="text-gray-600">{user.email}</p>
      </div>

      {/* Stats + Recents + Workspace + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <StatCard
          icon={Trophy}
          label="Current Streak"
          value={Number.isFinite(stats?.streak) ? `${stats.streak} days` : "—"}
        />
        <StatCard
          icon={Clock}
          label="Hours Studied"
          value={Number.isFinite(stats?.hours) ? `${stats.hours} hr` : "—"}
        />
        <RecentsList items={recents} />

        {/* Workspace (left two columns on desktop) */}
        <div className="lg:col-span-2">
          <WorkspaceGrid />
        </div>

        {/* Calendar (right column under Recents on desktop) */}
        <CalendarCard />
      </div>
    </div>
  );
}

// ———— Presentational ————
function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className="mt-4 text-2xl font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function RecentsList({ items }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recents</h2>
      <ul className="space-y-3">
        {list.map((it) => (
          <li key={it.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-gray-400" />
              {/* If your workspace routes by contentType, change to `/workspace/${it.contentType}/${it.id}` */}
              <Link to={`/workspace/${it.id}`} className="text-gray-900 hover:underline">
                {it.name}
              </Link>
            </div>
            <span className="text-sm text-gray-500">{it.date}</span>
          </li>
        ))}
        {list.length === 0 && (
          <li className="text-sm text-gray-500">No recent items.</li>
        )}
      </ul>
    </div>
  );
}

function WorkspaceGrid({ folders = [] }) {
  const list = Array.isArray(folders) ? folders : [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">My Workspace</h2>
        <Link to="/workspace" className="text-primary-600 text-sm font-medium">
          View All
        </Link>
      </div>

      {list.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {list.map((name, i) => (
            <Link
              key={i}
              to={`/workspace/folder/${encodeURIComponent(name)}`}
              className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <Folder className="h-5 w-5 text-gray-400" />
              <span className="text-gray-900">{name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          No folders to show yet. Use <span className="font-medium">View All</span> to manage your workspace.
        </div>
      )}
    </div>
  );
}

/** —— Clean, dependency-free calendar card —— */
function CalendarCard() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const monthName = cursor.toLocaleString(undefined, { month: "long" });
  const year = cursor.getFullYear();

  const { weeks } = useMemo(() => {
    const firstDayIdx = cursor.getDay(); // 0=Sun..6=Sat for day 1
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const prevMonthDays = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();

    // Build 6 weeks x 7 days = 42 cells
    const cells = [];
    // Leading days from prev month
    for (let i = 0; i < firstDayIdx; i++) {
      const day = prevMonthDays - firstDayIdx + 1 + i;
      const date = new Date(cursor.getFullYear(), cursor.getMonth() - 1, day);
      cells.push({ date, inMonth: false });
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      cells.push({ date, inMonth: true });
    }
    // Trailing days from next month
    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (firstDayIdx + daysInMonth) + 1;
      const date = new Date(cursor.getFullYear(), cursor.getMonth() + 1, nextDay);
      cells.push({ date, inMonth: false });
    }
    // Ensure 6 rows for stable height
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const date = new Date(last);
      date.setDate(date.getDate() + 1);
      cells.push({ date, inMonth: false });
    }

    // Chunk into weeks
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return { weeks };
  }, [cursor]);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const goPrev = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            {monthName} {year}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-2 rounded-md hover:bg-gray-100 transition"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1 rounded-md text-sm border hover:bg-gray-50 transition"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="p-2 rounded-md hover:bg-gray-100 transition"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((week, wi) =>
          week.map(({ date, inMonth }, di) => {
            const key = `${wi}-${date.toISOString().split("T")[0]}`;
            const isTodayCell = isSameDay(date, today);
            const base = "aspect-square flex items-center justify-center rounded-md text-sm";
            const muted = inMonth ? "text-gray-900" : "text-gray-300";
            const todayRing = isTodayCell ? "ring-1 ring-indigo-500 font-semibold" : "";
            const hover = "hover:bg-gray-100";
            return (
              <div key={key} className={`${base} ${muted} ${todayRing} ${hover}`}>
                {date.getDate()}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
