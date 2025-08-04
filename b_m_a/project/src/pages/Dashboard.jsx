import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { Trophy, Clock, Folder } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUserStats } from "../hooks/useUserStats";
import { useUserRecents } from "../hooks/useUserRecents";

// User ID and email 
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

    // Prefer the 'name' claim, then 'given_name', then acct.name, then email prefix
    const name =
      claims.name ??
      claims.given_name ??
      acct.name ??
      (acct.username?.split("@")[0]) ??
      "User";

    // For email display
    const email =
      claims.email ??
      claims.preferred_username ??
      acct.username ??
      "";

    setUser({ id: acct.localAccountId, name, email });
  }, [instance, accounts, navigate]);

  return user;
}

export default function Dashboard() {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  const user    = useUserData(instance, accounts, navigate);
  const stats   = useUserStats(user?.id);
  const recents = useUserRecents(user?.id);

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

      {/* Stats + Recents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <StatCard
          icon={Trophy}
          label="Current Streak"
          value={stats.streak != null ? `${stats.streak} days` : "—"}
        />
        <StatCard
          icon={Clock}
          label="Hours Studied"
          value={stats.hours != null ? `${stats.hours} hr.` : "—"}
        />
        <RecentsList items={recents} />

        {/* Workspace */}
        <div className="lg:col-span-2">
          <WorkspaceGrid
            folders={["Math","Biology","Flashcards","History","Research","Archive"]}
          />
        </div>
        <div className="hidden lg:block" />
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
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recents</h2>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-gray-400" />
              <Link to={`/workspace/${it.id}`} className="text-gray-900 hover:underline">
                {it.name}
              </Link>
            </div>
            <span className="text-sm text-gray-500">{it.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function WorkspaceGrid({ folders }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">My Workspace</h2>
        <Link to="/workspace" className="text-primary-600 text-sm font-medium">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {folders.map((name,i) => (
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
    </div>
  );
}
