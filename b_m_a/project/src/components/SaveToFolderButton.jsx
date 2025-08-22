/**
 ===========================================================
                    How to use 
 ===========================================================
  Features:
   • Opens a modal to create new folders or pick existing ones.
   • Includes a real time search inside the folder list.
   • Saves items to folders and updates backend + local state.
   • Supports custom labels, styles, and save data.

 
 -----------------------------------------------------------
 Props:
 -----------------------------------------------------------
 • toolType   → string    (required)  | Name of the tool/page
 • label      → string    (optional)  | Button text
 • size       → "sm"|"md"|"lg" (optional, default: "md")
 • color      → string    (optional)  | Tailwind classes for button style
 • icon       → ReactNode (optional)  | Replace default "+" icon
 • buildItem  → function  (optional)  | Customize what gets saved
 • onSaved    → function  (optional)  | Callback after save
 ===========================================================
*/

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  FolderPlus,
  ChevronDown,
  Loader2,
  Check,
  X,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { msalInstance, protectedResources } from "../authConfig";

const API_BASE = "http://localhost:8000";

// ---------- tiny API helper ----------
async function getToken() {
  const accounts = msalInstance.getAllAccounts();
  const request = { scopes: protectedResources.todoListApi.scopes, account: accounts[0] };
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

// ---------- localStorage helpers ----------
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
  // workspace listener
  localStorage.setItem("folders:changed", Date.now().toString());
}

// palette (reuses folder colors)
const FOLDER_COLORS = [
  "from-indigo-100 to-indigo-200",
  "from-fuchsia-100 to-pink-100",
  "from-amber-100 to-yellow-100",
  "from-green-100 to-lime-100",
  "from-cyan-100 to-sky-100",
  "from-purple-100 to-violet-100",
  "from-red-100 to-rose-100",
];

// size styles
const SIZE_STYLES = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-5 py-3 text-base rounded-2xl",
};
const ICON_SIZES = { sm: 16, md: 18, lg: 20 };


export default function SaveToFolderButton({
  toolType,
  label = "Save to Folder",
  size = "md",
  color = "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white hover:brightness-110",
  icon,
  buildItem,
  onSaved,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [err, setErr] = useState("");

  // choose existing
  const [selectedFolderId, setSelectedFolderId] = useState("");
  // or create new
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);

  // search inside "Choose Folder" tab
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ---- portal + body scroll lock ----
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // fetch folders when opening
  useEffect(() => {
    if (!open) return;
    setErr("");
    (async () => {
      try {
        setLoading(true);
        const list = await apiFetch("/folders", { method: "GET" });
        setFolders(list);
        if (list.length && !creatingNew) setSelectedFolderId(list[0].id);
      } catch (e) {
        setErr(typeof e?.message === "string" ? e.message : "Failed to load folders");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, creatingNew]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const q = searchQuery.toLowerCase();
    return folders.filter((f) => f.name?.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  const selectedFolder = useMemo(
    () => folders.find((f) => String(f.id) === String(selectedFolderId)) || null,
    [folders, selectedFolderId]
  );

  function defaultBuildItem() {
    const now = new Date();
    return {
      title: `${toolType} ${now.toLocaleTimeString()}`,
      description: `Saved from ${toolType}`,
      type: "Notes",
      date: now.toLocaleString(),
      tags: [toolType.toLowerCase().replace(/\s+/g, "-")],
      timestamp: now,
    };
  }

  async function handleConfirm() {
    setErr("");
    setLoading(true);
    try {
      let folderIdToUse = selectedFolderId;
      let folderItemsCount = selectedFolder?.items ?? 0;

      // create folder if needed
      if (creatingNew) {
        if (!newName.trim()) throw new Error("Folder name is required");
        const created = await apiFetch("/folders", {
          method: "POST",
          body: JSON.stringify({
            name: newName.trim(),
            color: newColor,
            starred: false,
            items: 0,
          }),
        });
        folderIdToUse = created.id;
        folderItemsCount = created.items ?? 0;
        setFolders((prev) => [created, ...prev]);
        setSelectedFolderId(created.id);
      }

      const item = typeof buildItem === "function" ? buildItem() : defaultBuildItem();

      // local list -> so FolderView shows immediately
      const existing = loadItems(folderIdToUse);
      const updated = [item, ...existing];
      saveItems(folderIdToUse, updated);

      // bump backend count => Workspace stats in sync
      const newCount = folderItemsCount + 1;
      await apiFetch(`/folders/${folderIdToUse}`, {
        method: "PATCH",
        body: JSON.stringify({ items: newCount }),
      });

      // notify parent that a save occurred (so it can flip its dirty indicator)
      if (typeof onSaved === "function") onSaved();

      setOpen(false);
      setCreatingNew(false);
      setNewName("");
      setIsSearching(false);
      setSearchQuery("");
    } catch (e) {
      setErr(typeof e?.message === "string" ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;

  // ------------- Modal UI -------------
  const modalUI = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

          {/* dialog */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden z-[101]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-fuchsia-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white shadow">
                  <FolderPlus className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Save <span className="text-indigo-700">“{toolType}”</span> to a folder
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
                disabled={loading}
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* tabs + inline search */}
            <div className="px-6 pt-4 flex items-center justify-between gap-3">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setCreatingNew(false)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    !creatingNew ? "bg-white text-indigo-700 shadow" : "text-slate-700"
                  }`}
                >
                  Choose Folder
                </button>
                <button
                  onClick={() => setCreatingNew(true)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    creatingNew ? "bg-white text-indigo-700 shadow" : "text-slate-700"
                  }`}
                >
                  Create New
                </button>
              </div>

              {!creatingNew && (
                <div className="flex items-center gap-2">
                  {!isSearching ? (
                    <button
                      onClick={() => setIsSearching(true)}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                      title="Search folders"
                    >
                      <Search className="w-4 h-4 text-slate-600" />
                    </button>
                  ) : (
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search folders…"
                        className="pl-9 pr-8 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 w-56"
                      />
                      <button
                        onClick={() => { setSearchQuery(""); setIsSearching(false); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Clear"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* body (scrolls) */}
            <div className="px-6 pb-6 pt-4 max-h-[70vh] overflow-y-auto">
              {!creatingNew ? (
                <>
                  {loading ? (
                    <div className="flex items-center gap-2 text-slate-600 py-8">
                      <Loader2 className="animate-spin" /> Loading folders…
                    </div>
                  ) : filteredFolders.length ? (
                    <div className="space-y-3">
                      {filteredFolders.map((f) => {
                        const selected = String(selectedFolderId) === String(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition ${
                              selected ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                            }`}
                            onClick={() => setSelectedFolderId(f.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color || FOLDER_COLORS[0]}`} />
                              <div>
                                <div className="font-medium text-slate-800">{f.name}</div>
                                <div className="text-xs text-slate-500">{f.items ?? 0} items</div>
                              </div>
                            </div>
                            <span
                              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                selected ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-white"
                              }`}
                            >
                              {selected ? <Check className="w-3 h-3" /> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
                      {searchQuery.trim()
                        ? "No folders match your search."
                        : "No folders yet. Switch to Create New to add one."}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Folder name</label>
                    <input
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-300"
                      placeholder="e.g., Project Documentation"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Color</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {FOLDER_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${c} border-2 ${
                            newColor === c ? "border-indigo-500" : "border-transparent"
                          }`}
                          title={c}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {err ? (
                <div className="mt-4 px-4 py-2 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 text-sm">
                  {err}
                </div>
              ) : null}
            </div>

            {/* sticky footer */}
            <div className="px-6 py-4 border-t bg-white flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:brightness-110 disabled:opacity-60 inline-flex items-center gap-2"
                disabled={loading || (!creatingNew && !selectedFolderId) || (creatingNew && !newName.trim())}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <FolderPlus size={16} />}
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* trigger */}
      <button
        onClick={() => setOpen(true)}
        className={`${SIZE_STYLES[size] || SIZE_STYLES.md} ${color} inline-flex items-center gap-2 shadow`}
      >
        {icon ?? <Plus size={ICON_SIZES[size] || ICON_SIZES.md} />}
        {label}
        <ChevronDown size={(ICON_SIZES[size] || ICON_SIZES.md) - 2} className="opacity-80" />
      </button>

      {/* portal modal */}
      {createPortal(modalUI, document.body)}
    </>
  );
}
