import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Search, Filter, List, LayoutGrid, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, MoreVertical, Pencil, Trash2, FolderSymlink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mic2, LayoutGrid as GridIcon, Edit3, Zap, NotebookPen } from "lucide-react";

// =======================
// API helpers (uses MSAL)
// =======================
import { msalInstance, protectedResources } from "../authConfig";
const API_BASE = "http://localhost:8000";

async function getToken() {
  const accounts = msalInstance.getAllAccounts();
  const request = {
    scopes: protectedResources.todoListApi.scopes,
    account: accounts[0],
  };
  try {
    const r = await msalInstance.acquireTokenSilent(request);
    return r.accessToken;
  } catch {
    const r = await msalInstance.acquireTokenPopup(request);
    return r.accessToken;
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
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// =======================
// localStorage utilities
// =======================
const LS_KEY_PREFIX = "folderItems:";
const lsKeyFor = (folderId) => `${LS_KEY_PREFIX}${folderId}`;

function loadItems(folderId) {
  try {
    const raw = localStorage.getItem(lsKeyFor(folderId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveItems(folderId, items) {
  localStorage.setItem(lsKeyFor(folderId), JSON.stringify(items));
  localStorage.setItem("folders:changed", Date.now().toString()); // notify Workspace
}

// Quick helper to make a new basic note
function makeBasicNote() {
  const now = new Date();
  return {
    icon: <NotebookPen className="text-4xl" />,
    title: `Note ${now.toLocaleTimeString()}`,
    description: "Quick note (local-only). Replace with your note editor later.",
    type: "Notes",
    date: now.toLocaleString(),
    tags: ["note"],
    timestamp: now,
  };
}

// Tool tiles: link directly to real routes
const toolTiles = [
  { label: "AI Flashcards",    icon: <Brain className="text-2xl" />,   color: "from-indigo-500 to-violet-500",  path: "/tools/ai-flashcards" },
  { label: "Voice Notes",      icon: <Mic2 className="text-2xl" />,    color: "from-purple-500 to-pink-500",    path: "/tools/voice-notes" },
  { label: "Mind Maps",        icon: <GridIcon className="text-2xl" />, color: "from-green-500 to-emerald-500",  path: "/tools/mind-maps" },
  { label: "Practice Tests",   icon: <Edit3 className="text-2xl" />,   color: "from-orange-500 to-yellow-500", path: "/tools/practice-tests" },
  { label: "Smart Summarizer", icon: <Zap className="text-2xl" />,     color: "from-cyan-500 to-sky-500",       path: "/tools/summarizer" },
  { label: "Study Planner",    icon: <NotebookPen className="text-2xl" />, color: "from-rose-500 to-red-500",    path: "/tools/study-plans" },
];

const filterOptions = ["All Types", "Notes", "Summary", "Quiz", "Research", "Essay", "Flashcards"];
const sortOptions = ["Most Recent", "Oldest"];

// --- lightweight modal ---
const Modal = ({ open, children, onClose }) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function FolderView() {
  const { id } = useParams();
  const folderId = id; // string
  const navigate = useNavigate();

  const [allFolders, setAllFolders] = useState([]);     // for Move dropdown
  const [folderMeta, setFolderMeta] = useState(null);   // current folder meta (backend)

  const [items, setItems] = useState([]);               // local “trivial” content for this folder
  const [view, setView] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All Types");
  const [sortBy, setSortBy] = useState("Most Recent");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuOpenIdx, setMenuOpenIdx] = useState(null);

  // Content modals
  const [renameIdx, setRenameIdx] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveIdx, setMoveIdx] = useState(null);
  const [moveDest, setMoveDest] = useState("");
  const [deleteIdx, setDeleteIdx] = useState(null);

  // Close dropdowns on outside click
  const filterRef = useRef(); const sortRef = useRef();
  useEffect(() => {
    const handler = (e) => {
      if (!filterRef.current?.contains(e.target)) setFilterOpen(false);
      if (!sortRef.current?.contains(e.target)) setSortOpen(false);
      if (menuOpenIdx !== null && !document.getElementById(`menu-${menuOpenIdx}`)?.contains(e.target)) {
        setMenuOpenIdx(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenIdx]);

  // Load folders + current folder meta + local items
  useEffect(() => {
    (async () => {
      try {
        const folders = await apiFetch("/folders", { method: "GET" });
        setAllFolders(folders);
        const current = folders.find((f) => String(f.id) === String(folderId));
        setFolderMeta(current || null);

        // load local items for this folder id
        const stored = loadItems(folderId);
        setItems(
          stored.map((it) => ({
            ...it,
            timestamp: it.timestamp ? new Date(it.timestamp) : new Date(),
          }))
        );

        // keep backend count aligned with local
        if (current && (current.items ?? 0) !== stored.length) {
          await apiFetch(`/folders/${folderId}`, {
            method: "PATCH",
            body: JSON.stringify({ items: stored.length }),
          });
        }
      } catch (e) {
        // fallback: show local items even if backend fails
        if (!folderMeta)
          setFolderMeta({
            id: folderId,
            name: "Untitled Folder",
            items: loadItems(folderId).length,
          });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const folderName = folderMeta?.name || "Untitled Folder";
  const dynamicCount = items.length;

  // Filters/sorts
  const filtered = useMemo(() => {
    const base = items
      .filter((i) => filterType === "All Types" || i.type === filterType)
      .filter((i) => i.title.toLowerCase().includes(searchTerm.toLowerCase()));
    base.sort((a, b) =>
      sortBy === "Most Recent" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );
    return base;
  }, [items, filterType, searchTerm, sortBy]);

  // ==============
  // Mutations
  // ==============
  async function syncCount(newCount) {
    try {
      await apiFetch(`/folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify({ items: newCount }),
      });
    } catch (e) {
      console.warn("Failed to sync folder count:", e.message);
    }
  }

  // Add a quick basic note (local)
  function addBasicNote() {
    const next = makeBasicNote();
    setItems((prev) => {
      const updated = [next, ...prev];
      saveItems(folderId, updated);
      syncCount(updated.length);
      return updated;
    });
  }

  function doRename() {
    setItems((prev) => {
      const updated = prev.map((it, i) => (i === renameIdx ? { ...it, title: renameValue } : it));
      saveItems(folderId, updated);
      return updated;
    });
    setRenameIdx(null);
  }

  async function doMove() {
    // Remove from this folder
    let movedItem = null;
    setItems((prev) => {
      movedItem = prev[moveIdx];
      const updated = prev.filter((_, i) => i !== moveIdx);
      saveItems(folderId, updated);
      syncCount(updated.length);
      return updated;
    });

    // Add to destination folder local store + bump its backend count
    if (movedItem && moveDest) {
      const destKey = lsKeyFor(moveDest);
      const destItems = (() => {
        try { return JSON.parse(localStorage.getItem(destKey) || "[]"); } catch { return []; }
      })();
      const next = [{ ...movedItem }, ...destItems];
      localStorage.setItem(destKey, JSON.stringify(next));
      localStorage.setItem("folders:changed", Date.now().toString());
      try {
        await apiFetch(`/folders/${moveDest}`, {
          method: "PATCH",
          body: JSON.stringify({ items: next.length }),
        });
      } catch (e) {
        console.warn("Failed to sync destination folder count:", e.message);
      }
    }

    setMoveIdx(null);
    setMoveDest("");
  }

  async function doDelete() {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== deleteIdx);
      saveItems(folderId, updated);
      syncCount(updated.length);
      return updated;
    });
    setDeleteIdx(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* NAVBAR */}
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/workspace")}
            className="p-2 rounded-lg bg-white shadow border border-slate-200"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{folderName}</h1>
            <p className="text-sm text-slate-500">
              {dynamicCount} items • Updated just now
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-full border border-slate-300 shadow-sm focus:ring-1 focus:ring-indigo-300"
            />
          </div>

          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm"
            >
              <Filter className="w-4 h-4 text-slate-600" />
              <span className="text-sm">{filterType}</span>
              {filterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {filterOpen && (
              <ul className="absolute right-0 mt-2 w-44 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-20">
                {filterOptions.map((opt) => (
                  <li
                    key={opt}
                    onClick={() => {
                      setFilterType(opt);
                      setFilterOpen(false);
                    }}
                    className="px-4 py-2 hover:bg-slate-100 cursor-pointer"
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            className="p-2 bg-white rounded-full border border-slate-300 shadow-sm"
            title="Toggle view"
          >
            {view === "grid" ? <List className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
          </button>

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm"
            >
              <span className="text-sm">{sortBy}</span>
              {sortOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {sortOpen && (
              <ul className="absolute right-0 mt-2 w-40 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-20">
                {sortOptions.map((opt) => (
                  <li
                    key={opt}
                    onClick={() => {
                      setSortBy(opt);
                      setSortOpen(false);
                    }}
                    className="px-4 py-2 hover:bg-slate-100 cursor-pointer"
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8">
        {/* Create New Content */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Create New Content</h2>
            {/* Quick basic note add (local) */}
            <button
              onClick={addBasicNote}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm shadow inline-flex items-center gap-2"
              title="Add a quick note to this folder"
            >
              <NotebookPen className="w-4 h-4" /> Add Note
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {toolTiles.map((tool, i) => (
              <motion.button
                key={tool.label}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => navigate(tool.path)}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl text-white bg-gradient-to-br ${tool.color} shadow-xl hover:scale-105 transition-transform`}
                title={`Open ${tool.label}`}
              >
                {tool.icon}
                <span className="mt-3 font-semibold">{tool.label}</span>
                <span className="mt-3 px-4 py-1 bg-white text-slate-700 rounded-full text-xs shadow">
                  Open
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Your Content */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Your Content</h2>

          {view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item, i) => (
                <motion.div
                  key={`${item.title}-${i}`}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="relative bg-white rounded-3xl p-6 shadow-lg"
                >
                  {/* item menu */}
                  <div className="absolute top-4 right-4" id={`menu-${i}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenIdx(menuOpenIdx === i ? null : i); }}
                      className="p-2 rounded-full hover:bg-slate-100"
                    >
                      <MoreVertical className="w-5 h-5 text-slate-600" />
                    </button>
                    {menuOpenIdx === i && (
                      <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20">
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                          onClick={() => { setRenameIdx(i); setRenameValue(item.title); setMenuOpenIdx(null); }}
                        >
                          <Pencil className="w-4 h-4" /> Rename
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                          onClick={() => { setMoveIdx(i); setMoveDest(""); setMenuOpenIdx(null); }}
                        >
                          <FolderSymlink className="w-4 h-4" /> Move
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-red-600"
                          onClick={() => { setDeleteIdx(i); setMenuOpenIdx(null); }}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="absolute -top-6 left-6 bg-white p-2 rounded-full shadow-lg">
                    {item.icon ?? <Brain className="text-4xl" />}
                  </div>
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-slate-800">{item.title}</h3>
                    <p className="text-sm text-slate-500 mt-2">{item.description}</p>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-slate-500">
                    <span className="font-medium">{item.type}</span>
                    <CalendarIcon className="w-4 h-4 mx-2" />
                    <span>{item.date}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags?.map((tag, t) => (
                      <span key={t} className="text-xs bg-slate-100 px-2 py-1 rounded-full">{tag}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <ul className="space-y-4">
              {filtered.map((item, i) => (
                <motion.li
                  key={`${item.title}-${i}`}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="relative flex items-start gap-4 bg-white rounded-xl p-4 shadow-lg"
                >
                  <div className="mt-1">{item.icon ?? <Brain className="text-4xl" />}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800">{item.title}</h3>
                    <p className="text-sm text-slate-500">{item.description}</p>
                    <div className="mt-2 flex items-center text-xs text-slate-500">
                      <span className="font-medium">{item.type}</span>
                      <CalendarIcon className="w-4 h-4 mx-2" />
                      <span>{item.date}</span>
                    </div>
                  </div>

                  {/* menu */}
                  <div className="absolute top-2 right-2" id={`menu-${i}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenIdx(menuOpenIdx === i ? null : i); }}
                      className="p-2 rounded-full hover:bg-slate-100"
                    >
                      <MoreVertical className="w-5 h-5 text-slate-600" />
                    </button>
                    {menuOpenIdx === i && (
                      <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20">
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                          onClick={() => { setRenameIdx(i); setRenameValue(item.title); setMenuOpenIdx(null); }}
                        >
                          <Pencil className="w-4 h-4" /> Rename
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                          onClick={() => { setMoveIdx(i); setMoveDest(""); setMenuOpenIdx(null); }}
                        >
                          <FolderSymlink className="w-4 h-4" /> Move
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-red-600"
                          onClick={() => { setDeleteIdx(i); setMenuOpenIdx(null); }}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* RENAME MODAL */}
      <Modal open={renameIdx !== null} onClose={() => setRenameIdx(null)}>
        <h3 className="text-lg font-semibold text-slate-900">Rename item</h3>
        <input
          className="mt-4 w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-300"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setRenameIdx(null)}>
            Cancel
          </button>
          <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:brightness-110" onClick={doRename}>
            Save
          </button>
        </div>
      </Modal>

      {/* MOVE MODAL */}
      <Modal open={moveIdx !== null} onClose={() => setMoveIdx(null)}>
        <h3 className="text-lg font-semibold text-slate-900">Move item</h3>
        <p className="text-sm text-slate-600 mt-1">Choose a destination folder.</p>
        <select
          className="mt-4 w-full px-3 py-2 rounded-xl border border-slate-300"
          value={moveDest}
          onChange={(e) => setMoveDest(e.target.value)}
        >
          <option value="" disabled>Select folder</option>
          {allFolders
            .filter((f) => String(f.id) !== String(folderId))
            .map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
        </select>
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setMoveIdx(null)}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:brightness-110 disabled:opacity-50"
            onClick={doMove}
            disabled={!moveDest}
          >
            Move
          </button>
        </div>
      </Modal>

      {/* DELETE MODAL */}
      <Modal open={deleteIdx !== null} onClose={() => setDeleteIdx(null)}>
        <h3 className="text-lg font-semibold text-slate-900">Delete this item?</h3>
        <p className="text-sm text-slate-600 mt-1">This action cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setDeleteIdx(null)}>
            Cancel
          </button>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white" onClick={doDelete}>
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
