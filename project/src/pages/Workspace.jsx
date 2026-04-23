import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderPlus,
  Star,
  FolderKanban,
  List,
  Search,
  FileQuestion,
  Trash2
} from "lucide-react";
import FolderManager from "./FolderManager";
import { motion, AnimatePresence } from "framer-motion";

// MSAL
import { msalInstance, protectedResources } from "../authConfig";

const API_BASE = "http://localhost:8000";

// ---------- Auth + API helpers ----------
async function getToken() {
  // Ensure MSAL is initialized before using it
  await msalInstance.initialize();
  
  const accounts = msalInstance.getAllAccounts();
  if (!accounts || accounts.length === 0) {
    // Surface a clear message to the UI; don't crash
    throw new Error("You need to sign in to see your workspace.");
  }
  const request = {
    scopes: protectedResources.todoListApi.scopes,
    account: accounts[0],
  };
  try {
    const result = await msalInstance.acquireTokenSilent(request);
    return result.accessToken;
  } catch {
    const result = await msalInstance.acquireTokenPopup(request);
    return result.accessToken;
  }
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = "";
    try {
      const text = await res.text();
      try {
        const body = JSON.parse(text);
        if (typeof body.detail === "string") {
          msg = body.detail;
        } else if (Array.isArray(body.detail)) {
          msg = body.detail.map((e) => (typeof e === "object" && e.msg ? e.msg : String(e))).join("; ");
        } else {
          msg = text;
        }
      } catch {
        msg = text;
      }
    } catch {}
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

// ---------- UI palette ----------
const folderColors = [
  "from-indigo-100 to-indigo-200",
  "from-fuchsia-100 to-pink-100",
  "from-amber-100 to-yellow-100",
  "from-green-100 to-lime-100",
  "from-cyan-100 to-sky-100",
  "from-purple-100 to-violet-100",
  "from-red-100 to-rose-100",
];

export default function Workspace() {
  const navigate = useNavigate();
  const [view, setView] = useState("grid");
  const [folders, setFolders] = useState([]);
  const [allFoldersRaw, setAllFoldersRaw] = useState([]);
  const [stats, setStats] = useState({ totalFolders: 0, starredFolders: 0, totalItems: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState(folderColors[0]);

  // Recursively count items in a folder and all its subfolders
  const countItemsRecursively = useCallback((folderId, allFolders) => {
    let count = 0;
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return 0;
    
    // Add direct items in this folder
    count += folder.items ?? 0;
    
    // Find all subfolders and recursively count their items
    const subfolders = allFolders.filter(f => f.parentFolderId === folderId);
    for (const subfolder of subfolders) {
      count += countItemsRecursively(subfolder.id, allFolders);
    }
    
    return count;
  }, []);

  const deriveStats = useCallback((list) => {
    const totalFolders = list.length;
    const starredFolders = list.filter(f => !!f.starred).length;
    const totalItems = list.reduce((sum, f) => sum + (Number(f.items) || 0), 0);
    return { totalFolders, starredFolders, totalItems };
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // Fetch ALL folders (not just root) to calculate recursive counts
      const allFoldersRes = await apiFetch("/folders", { method: "GET" });
      setAllFoldersRaw(allFoldersRes || []);

      // Filter to show only root-level folders (parentFolderId is null or undefined)
      const rootFolders = (allFoldersRes || []).filter(f => !f.parentFolderId);

      // Calculate recursive item counts for each root folder
      const serverFolders = rootFolders.map(f => ({
        id: f.id,
        name: f.name,
        items: countItemsRecursively(f.id, allFoldersRes), // Recursive count
        color: f.color || folderColors[0],
        starred: !!f.starred,
        parentFolderId: f.parentFolderId,
      }));
      setFolders(serverFolders);
      
      // Derive stats client-side from folders
      setStats(deriveStats(serverFolders));

      try {
        const unfiledItems = await apiFetch("/items/unfiled", { method: "GET" });
        setUnfiledCount((unfiledItems || []).length);
      } catch { setUnfiledCount(0); }

      try {
        const trashItems = await apiFetch("/trash", { method: "GET" });
        setTrashCount((trashItems || []).length);
      } catch { setTrashCount(0); }
    } catch (e) {
      setFolders([]);
      setStats({ totalFolders: 0, starredFolders: 0, totalItems: 0 });
      setErr(typeof e?.message === "string" ? e.message : "Failed to load workspace.");
    } finally {
      setLoading(false);
    }
  }, [deriveStats, countItemsRecursively]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // cross-tab refresh
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "folders:changed") loadAll();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadAll]);

  const filtered = useMemo(() => {
    if (!search.trim()) return folders;
    const q = search.toLowerCase();
    return folders.filter(f =>
      f.name.toLowerCase().includes(q) ||
      String(f.items ?? "").toLowerCase().includes(q)
    );
  }, [folders, search]);

  async function createFolder() {
    if (!newFolderName.trim()) return;
    setErr("");
    try {
      const created = await apiFetch("/folders", {
        method: "POST",
        body: JSON.stringify({
          name: newFolderName.trim(),
          color: selectedColor,
          // parentFolderId is omitted (null) for root-level folders
        }),
      });
      // update list
      const next = [{
        id: created.id,
        name: created.name,
        items: created.items ?? 0,
        color: created.color || selectedColor,
        starred: !!created.starred,
      }, ...folders];
      setFolders(next);
      // Derive stats client-side from folders
      setStats(deriveStats(next));
      // reset modal
      setNewFolderName("");
      setSelectedColor(folderColors[0]);
      setIsModalOpen(false);
    } catch (e) {
      setErr(typeof e?.message === "string" ? e.message : "Failed to create folder.");
    }
  }

  // Callbacks for child (FolderManager)
  async function onToggleStar(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    setErr("");
    try {
      const updated = await apiFetch(`/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ starred: !folder.starred }),
      });
      const next = folders.map(f => f.id === id ? { ...f, starred: !!updated.starred } : f);
      setFolders(next);
      setStats(deriveStats(next));
    } catch (e) {
      setErr("Failed to update folder.");
    }
  }

  async function onRename(id, newName) {
    if (!newName?.trim()) return;
    setErr("");
    try {
      const updated = await apiFetch(`/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setFolders(prev => prev.map(x => x.id === id ? { ...x, name: updated.name } : x));
    } catch (e) {
      setErr("Failed to rename folder.");
    }
  }

  async function onMove(folderId, newParentId) {
    setErr("");
    try {
      await apiFetch(`/folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify({ parentFolderId: newParentId }),
      });
      await loadAll();
    } catch (e) {
      setErr("Failed to move folder.");
    }
  }

  async function onDelete(id) {
    setErr("");
    try {
      await apiFetch(`/folders/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (e) {
      setErr("Failed to delete folder.");
    }
  }

  return (
    <div className="min-h-screen px-6 py-8 bg-gradient-to-br from-white via-slate-100 to-slate-200">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">My Workspace</h1>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-full shadow-md bg-white/70 backdrop-blur text-slate-700 w-72 flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-400">
            <Search className="w-4 h-4 opacity-70" />
            <input
              type="text"
              placeholder="Search folders and content..."
              className="bg-transparent outline-none flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={() => setView(v => v === "grid" ? "list" : "grid")}
            className="p-2 rounded-lg shadow-inner bg-white/70 backdrop-blur border border-slate-300"
            title="Toggle view"
          >
            {view === "grid"
              ? <List className="w-5 h-5 text-slate-700"/>
              : <FolderKanban className="w-5 h-5 text-slate-700"/>}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl shadow bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-medium hover:scale-[1.03] transition-transform"
          >
            <FolderPlus className="inline w-4 h-4 mr-2"/> New Folder
          </button>
        </div>
      </div>

      {/* ERR */}
      {err ? (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-100 text-rose-800 border border-rose-200">
          {err}
        </div>
      ) : null}

      {unfiledCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 cursor-pointer"
          onClick={() => navigate("/workspace/unfiled")}
        >
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 rounded-xl bg-white shadow">
              <FileQuestion className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Unfiled Items</h3>
              <p className="text-sm text-slate-500">{unfiledCount} item{unfiledCount !== 1 ? 's' : ''} not in any folder</p>
            </div>
          </div>
        </motion.div>
      )}

      {trashCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 cursor-pointer"
          onClick={() => navigate("/workspace/trash")}
        >
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 rounded-xl bg-white shadow">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Recently Deleted</h3>
              <p className="text-sm text-slate-500">{trashCount} item{trashCount !== 1 ? 's' : ''} in trash</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* FOLDER MANAGER */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <FolderManager
          view={view}
          folders={filtered}
          allFolders={allFoldersRaw}
          onToggleStar={onToggleStar}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
        />
      </motion.div>

      {/* MODAL: Create Folder */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex justify-center items-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-[90%] max-w-md space-y-6"
            >
              <h2 className="text-xl font-bold text-slate-800">Create New Folder</h2>
              <input
                className="w-full px-4 py-2 rounded-xl border border-slate-300 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {folderColors.map((color, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} border-2 ${selectedColor === color ? "border-blue-500" : "border-transparent"}`}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white disabled:opacity-60"
                  disabled={!newFolderName.trim()}
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
