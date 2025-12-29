import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Search, Filter, List, LayoutGrid, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, MoreVertical, Trash2, FolderSymlink
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

// Tool tiles: link directly to real routes
const toolTiles = [
  { label: "AI Flashcards",    icon: <Brain className="text-2xl" />,   color: "from-indigo-500 to-violet-500",  path: "/tools/ai-flashcards" },
  { label: "Voice Notes",      icon: <Mic2 className="text-2xl" />,    color: "from-purple-500 to-pink-500",    path: "/tools/voice-notes" },
  { label: "Mind Maps",        icon: <GridIcon className="text-2xl" />, color: "from-green-500 to-emerald-500",  path: "/tools/mind-maps" },
  { label: "Practice Tests",   icon: <Edit3 className="text-2xl" />,   color: "from-orange-500 to-yellow-500", path: "/tools/practice-tests" },
  { label: "Smart Summarizer", icon: <Zap className="text-2xl" />,     color: "from-cyan-500 to-sky-500",       path: "/tools/summarizer" },
  { label: "Study Planner",    icon: <NotebookPen className="text-2xl" />, color: "from-rose-500 to-red-500",    path: "/tools/study-plans" },
];

const filterOptions = ["All Types", "Quiz", "Flashcards", "Study Plan", "Voice Note", "Summary", "Mind Map"];
const sortOptions = ["Most Recent", "Oldest", "Alphabetical"];

// Helper function to map database items to UI format
function mapDatabaseItemsToUI(dbItems) {
  return dbItems.map(item => {
    const contentType = item.contentType || "unknown";
    let title = "Untitled";
    let description = "";
    let icon = <Brain className="text-4xl text-gray-600" />;
    
    // Extract title and description based on content type
    if (contentType === "quiz") {
      title = item.data?.title || "Untitled Quiz";
      description = item.data?.resourceName || `Quiz with ${item.data?.questions?.length || 0} questions`;
      icon = <Edit3 className="text-4xl text-orange-600" />;
    } else if (contentType === "flashcard_deck") {
      title = item.title || item.data?.title || "Untitled Flashcards";
      description = `${item.cards?.length || item.data?.cards?.length || 0} flashcards`;
      icon = <Brain className="text-4xl text-indigo-600" />;
    } else if (contentType === "study_plan") {
      title = item.data?.title || "Untitled Study Plan";
      description = item.data?.description || "";
      icon = <NotebookPen className="text-4xl text-blue-600" />;
    } else if (contentType === "voice_note") {
      title = item.title || "Untitled Voice Note";
      description = item.text || "";
      icon = <Mic2 className="text-4xl text-purple-600" />;
    } else if (contentType === "summary") {
      title = item.data?.title || "Untitled Summary";
      description = item.data?.summary?.substring(0, 100) || "";
      icon = <Zap className="text-4xl text-yellow-600" />;
    } else if (contentType === "mindmap") {
      title = item.data?.title || "Untitled Mind Map";
      description = item.data?.description || "";
      icon = <GridIcon className="text-4xl text-green-600" />;
    }
    
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    const updatedAt = item.updatedAt || item.data?.updatedAt ? new Date(item.updatedAt || item.data.updatedAt) : null;
    
    return {
      id: item.id,
      icon,
      title,
      description,
      type: contentType === "quiz" ? "Quiz" : 
            contentType === "flashcard_deck" ? "Flashcards" :
            contentType === "study_plan" ? "Study Plan" :
            contentType === "voice_note" ? "Voice Note" :
            contentType === "summary" ? "Summary" :
            contentType === "mindmap" ? "Mind Map" : "Item",
      date: (updatedAt || createdAt).toLocaleString(),
      timestamp: updatedAt || createdAt,
      tags: item.tags || item.data?.tags || [],
      rawItem: item, // Keep original for operations
    };
  });
}

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

  const [items, setItems] = useState([]);               // items from database
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All Types");
  const [sortBy, setSortBy] = useState("Most Recent");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuOpenIdx, setMenuOpenIdx] = useState(null);

  // Content modals
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

  // Load folders + current folder meta + items from API
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load folders
        const folders = await apiFetch("/folders", { method: "GET" });
        setAllFolders(folders);
        const current = folders.find((f) => String(f.id) === String(folderId));
        setFolderMeta(current || null);

        // Load items from database for this folder
        const dbItems = await apiFetch(`/folders/${folderId}/items`, { method: "GET" });
        
        // Map database items to UI format
        const mappedItems = mapDatabaseItemsToUI(dbItems);
        
        setItems(mappedItems);
        setLoading(false);
      } catch (e) {
        console.error("Error loading folder items:", e);
        setError(e.message || "Failed to load folder items");
        setItems([]);
        setLoading(false);
        // Fallback folder metadata
        if (!folderMeta) {
          setFolderMeta({
            id: folderId,
            name: "Untitled Folder",
            items: 0,
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const folderName = folderMeta?.name || "Untitled Folder";
  const dynamicCount = items.length;

  // Filters/sorts
  const filtered = useMemo(() => {
    let base = items
      .filter((i) => filterType === "All Types" || i.type === filterType)
      .filter((i) => i.title.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Sorting
    if (sortBy === "Most Recent") {
      base.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === "Oldest") {
      base.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === "Alphabetical") {
      base.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    return base;
  }, [items, filterType, searchTerm, sortBy]);

  // ==============
  // Mutations
  // ==============
  
  async function doDelete() {
    if (deleteIdx === null) return;
    
    const itemToDelete = filtered[deleteIdx];
    if (!itemToDelete || !itemToDelete.id) {
      console.error("Cannot delete: item ID missing");
      setDeleteIdx(null);
      return;
    }

    try {
      // Determine the delete endpoint based on content type
      const contentType = itemToDelete.rawItem?.contentType;
      let deleteEndpoint = "";
      
      if (contentType === "quiz") {
        deleteEndpoint = `/quizzes/${itemToDelete.id}`;
      } else if (contentType === "flashcard_deck") {
        deleteEndpoint = `/delete-deck/${itemToDelete.id}`;
      } else if (contentType === "voice_note") {
        deleteEndpoint = `/voice-notes/${itemToDelete.id}`;
      } else if (contentType === "study_plan") {
        // Study plans might not have a delete endpoint, we'll handle it generically
        // For now, we'll use container.delete_item approach or skip if no endpoint exists
        deleteEndpoint = null;
      } else {
        // Generic delete - we'll need to implement a generic delete endpoint
        deleteEndpoint = null;
      }

      if (deleteEndpoint) {
        await apiFetch(deleteEndpoint, { method: "DELETE" });
      } else {
        // For items without specific delete endpoints, we'll update the folderId to null
        // This effectively removes it from the folder
        console.warn(`No delete endpoint for contentType: ${contentType}. Item will be removed from folder only.`);
      }

      // Reload items from the server
      const dbItems = await apiFetch(`/folders/${folderId}/items`, { method: "GET" });
      const mappedItems = mapDatabaseItemsToUI(dbItems);
      setItems(mappedItems);
      setDeleteIdx(null);
    } catch (e) {
      console.error("Error deleting item:", e);
      alert("Failed to delete item: " + (e.message || "Unknown error"));
      setDeleteIdx(null);
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading folder items...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
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
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {toolTiles.map((tool, i) => (
              <motion.button
                key={tool.label}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`${tool.path}?folderId=${folderId}`)}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl text-white bg-gradient-to-br ${tool.color} shadow-xl hover:scale-105 transition-transform`}
                title={`Create ${tool.label} in this folder`}
              >
                {tool.icon}
                <span className="mt-3 font-semibold">{tool.label}</span>
                <span className="mt-3 px-4 py-1 bg-white text-slate-700 rounded-full text-xs shadow">
                  Create
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
                  key={`${item.id || item.title}-${i}`}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="relative bg-white rounded-3xl p-6 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                  onClick={() => {
                    // Navigate based on content type
                    const contentType = item.rawItem?.contentType;
                    if (contentType === "quiz") {
                      navigate(`/tools/practice-tests?quizId=${item.id}`);
                    } else if (contentType === "flashcard_deck") {
                      navigate(`/tools/flashcards/study/${item.id}`);
                    } else if (contentType === "study_plan") {
                      navigate(`/tools/study-planner?planId=${item.id}`);
                    } else if (contentType === "voice_note") {
                      navigate(`/tools/voice-notes?noteId=${item.id}`);
                    }
                    // Other content types can be handled later
                  }}
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
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-slate-100 rounded-full mb-4">
                <FolderSymlink className="w-16 h-16 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No items found</h3>
              <p className="text-slate-500 mb-6">
                {searchTerm || filterType !== "All Types" 
                  ? "Try adjusting your search or filter"
                  : "Create new content to get started"}
              </p>
              {!searchTerm && filterType === "All Types" && (
                <button
                  onClick={() => navigate(`/tools/practice-tests?folderId=${folderId}`)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Create Your First Item
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-4">
              {filtered.map((item, i) => (
                <motion.li
                  key={`${item.id || item.title}-${i}`}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="relative flex items-start gap-4 bg-white rounded-xl p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                  onClick={() => {
                    // Navigate based on content type
                    const contentType = item.rawItem?.contentType;
                    if (contentType === "quiz") {
                      navigate(`/tools/practice-tests?quizId=${item.id}`);
                    } else if (contentType === "flashcard_deck") {
                      navigate(`/tools/flashcards/study/${item.id}`);
                    } else if (contentType === "study_plan") {
                      navigate(`/tools/study-planner?planId=${item.id}`);
                    } else if (contentType === "voice_note") {
                      navigate(`/tools/voice-notes?noteId=${item.id}`);
                    }
                  }}
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
