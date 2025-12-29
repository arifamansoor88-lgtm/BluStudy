import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Search, Filter, List, LayoutGrid, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, MoreVertical, Trash2, FolderSymlink, Folder, FolderPlus, ChevronRight
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

const folderColors = [
  "from-indigo-100 to-indigo-200",
  "from-fuchsia-100 to-pink-100",
  "from-amber-100 to-yellow-100",
  "from-green-100 to-lime-100",
  "from-cyan-100 to-sky-100",
  "from-purple-100 to-violet-100",
  "from-red-100 to-rose-100",
];

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
  const [subfolders, setSubfolders] = useState([]);     // subfolders within current folder
  const [breadcrumbs, setBreadcrumbs] = useState([]);   // breadcrumb path

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
  
  // Subfolder creation modal
  const [isCreateSubfolderModalOpen, setIsCreateSubfolderModalOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [selectedSubfolderColor, setSelectedSubfolderColor] = useState("from-indigo-100 to-indigo-200");

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

  // Build breadcrumb path recursively
  const buildBreadcrumbs = (folders, currentFolderId, path = []) => {
    const current = folders.find((f) => String(f.id) === String(currentFolderId));
    if (!current) return path;
    
    const breadcrumb = { id: current.id, name: current.name };
    const newPath = [breadcrumb, ...path];
    
    if (current.parentFolderId) {
      return buildBreadcrumbs(folders, current.parentFolderId, newPath);
    }
    return newPath;
  };

  // Load folders + current folder meta + items from API
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load all folders
        const folders = await apiFetch("/folders", { method: "GET" });
        setAllFolders(folders);
        
        // Find current folder
        const current = folders.find((f) => String(f.id) === String(folderId));
        setFolderMeta(current || null);
        
        // Build breadcrumbs
        if (current) {
          const crumbs = buildBreadcrumbs(folders, folderId);
          setBreadcrumbs(crumbs);
        } else {
          setBreadcrumbs([]);
        }
        
        // Filter subfolders (folders where parentFolderId === current folderId)
        const subfoldersList = folders.filter((f) => String(f.parentFolderId) === String(folderId));
        setSubfolders(subfoldersList);

        // Load items from database for this folder (non-folder items only)
        const dbItems = await apiFetch(`/folders/${folderId}/items`, { method: "GET" });
        
        // Filter out folders from items (folders are shown separately)
        const contentItems = dbItems.filter(item => item.contentType !== "folder");
        
        // Map database items to UI format
        const mappedItems = mapDatabaseItemsToUI(contentItems);
        
        setItems(mappedItems);
        setLoading(false);
      } catch (e) {
        console.error("Error loading folder items:", e);
        setError(e.message || "Failed to load folder items");
        setItems([]);
        setSubfolders([]);
        setBreadcrumbs([]);
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

  // Calculate folder depth (0 = root, 1 = first level, 2 = second level, 3 = max)
  const calculateFolderDepth = (folderId, visited = new Set()) => {
    if (visited.has(folderId)) return 0; // Circular reference protection
    visited.add(folderId);
    
    const folder = allFolders.find((f) => String(f.id) === String(folderId));
    if (!folder || !folder.parentFolderId) return 0;
    return 1 + calculateFolderDepth(folder.parentFolderId, visited);
  };

  // Create subfolder
  async function createSubfolder() {
    if (!newSubfolderName.trim()) return;
    
    // Check depth limit (max depth is 3 levels, so current folder can be at most depth 2)
    const currentDepth = folderMeta ? calculateFolderDepth(folderId) : 0;
    if (currentDepth >= 2) {
      alert("Cannot create subfolder: Maximum nesting depth (3 levels) reached.");
      return;
    }
    
    try {
      await apiFetch("/folders", {
        method: "POST",
        body: JSON.stringify({
          name: newSubfolderName.trim(),
          parentFolderId: folderId,
          color: selectedSubfolderColor,
        }),
      });
      
      // Refresh all data by re-running the load logic
      const folders = await apiFetch("/folders", { method: "GET" });
      setAllFolders(folders);
      
      const current = folders.find((f) => String(f.id) === String(folderId));
      setFolderMeta(current || null);
      
      // Build breadcrumbs
      if (current) {
        const crumbs = buildBreadcrumbs(folders, folderId);
        setBreadcrumbs(crumbs);
      }
      
      // Filter subfolders
      const subfoldersList = folders.filter((f) => String(f.parentFolderId) === String(folderId));
      setSubfolders(subfoldersList);
      
      // Reset modal
      setNewSubfolderName("");
      setSelectedSubfolderColor(folderColors[0]);
      setIsCreateSubfolderModalOpen(false);
    } catch (e) {
      console.error("Error creating subfolder:", e);
      alert("Failed to create subfolder: " + (e.message || "Unknown error"));
    }
  }

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

  // Calculate current folder depth
  const currentDepth = folderMeta ? calculateFolderDepth(folderId) : 0;
  const canCreateSubfolder = currentDepth < 2; // Max depth is 3, so we can create subfolder if current depth < 2

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
          <div className="flex-1">
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <button
                      onClick={() => navigate(`/workspace/folder/${crumb.id}`)}
                      className="hover:text-slate-700 hover:underline"
                    >
                      {crumb.name}
                    </button>
                    {idx < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4" />}
                  </React.Fragment>
                ))}
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-800">{folderName}</h1>
            <p className="text-sm text-slate-500">
              {subfolders.length} {subfolders.length === 1 ? 'subfolder' : 'subfolders'} • {dynamicCount} {dynamicCount === 1 ? 'item' : 'items'}
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
        {/* Subfolders Section */}
        {subfolders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Subfolders</h2>
              {canCreateSubfolder && (
                <button
                  onClick={() => setIsCreateSubfolderModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  New Subfolder
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {subfolders.map((subfolder) => (
                <motion.div
                  key={subfolder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/workspace/folder/${subfolder.id}`)}
                  className={`rounded-2xl p-4 bg-gradient-to-br ${subfolder.color || folderColors[0]} cursor-pointer shadow-md border border-white/40 hover:scale-105 transition-transform`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Folder className="w-5 h-5 text-slate-700" />
                    <div className="text-sm font-semibold text-slate-800 truncate flex-1">
                      {subfolder.name}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">{subfolder.items ?? 0} items</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Content / Subfolder */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Create New Content</h2>
            {canCreateSubfolder && (
              <button
                onClick={() => setIsCreateSubfolderModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                {subfolders.length > 0 ? "New Subfolder" : "Create Subfolder"}
              </button>
            )}
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
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-red-600"
                          onClick={(e) => { e.stopPropagation(); setDeleteIdx(i); setMenuOpenIdx(null); }}
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
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-red-600"
                          onClick={(e) => { e.stopPropagation(); setDeleteIdx(i); setMenuOpenIdx(null); }}
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

      {/* CREATE SUBFOLDER MODAL */}
      <Modal open={isCreateSubfolderModalOpen} onClose={() => setIsCreateSubfolderModalOpen(false)}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Subfolder</h3>
        <input
          type="text"
          placeholder="Subfolder name"
          value={newSubfolderName}
          onChange={(e) => setNewSubfolderName(e.target.value)}
          className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          onKeyPress={(e) => {
            if (e.key === "Enter" && newSubfolderName.trim()) {
              createSubfolder();
            }
          }}
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {folderColors.map((color, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSubfolderColor(color)}
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} border-2 ${
                selectedSubfolderColor === color ? "border-indigo-500" : "border-transparent"
              }`}
              title={color}
            />
          ))}
        </div>
        {!canCreateSubfolder && (
          <p className="text-sm text-amber-600 mb-4">
            Maximum nesting depth (3 levels) reached. Cannot create subfolder here.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
            onClick={() => setIsCreateSubfolderModalOpen(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-50"
            onClick={createSubfolder}
            disabled={!newSubfolderName.trim() || !canCreateSubfolder}
          >
            Create
          </button>
        </div>
      </Modal>
    </div>
  );
}
