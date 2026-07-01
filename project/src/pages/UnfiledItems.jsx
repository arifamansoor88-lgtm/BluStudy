import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Filter, List, LayoutGrid, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, MoreVertical, FolderSymlink, Folder,
  CheckSquare, Square, FileQuestion
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Layers, Mic2, LayoutGrid as GridIcon, Edit3, Zap, NotebookPen, File as FileIcon } from "lucide-react";

import { msalInstance, protectedResources } from "../authConfig";
const API_BASE = "http://localhost:8000";

async function getToken() {
  await msalInstance.initialize();
  const accounts = msalInstance.getAllAccounts();
  if (!accounts || accounts.length === 0) throw new Error("Sign in required.");
  const request = { scopes: protectedResources.todoListApi.scopes, account: accounts[0] };
  try { return (await msalInstance.acquireTokenSilent(request)).accessToken; }
  catch { return (await msalInstance.acquireTokenPopup(request)).accessToken; }
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!res.ok) { const msg = await res.text().catch(() => res.statusText); throw new Error(msg || `HTTP ${res.status}`); }
  return res.status === 204 ? null : res.json();
}

function mapDatabaseItemsToUI(dbItems) {
  return dbItems.map(item => {
    const contentType = item.contentType || "unknown";
    let title = "Untitled";
    let description = "";
    let icon = <Brain className="text-4xl text-gray-600" />;
    if (contentType === "quiz") { title = item.data?.title || "Untitled Quiz"; description = item.data?.resourceName || `Quiz with ${item.data?.questions?.length || 0} questions`; icon = <Edit3 className="text-4xl text-orange-600" />; }
    else if (contentType === "flashcard_deck") { title = item.title || item.data?.title || "Untitled Flashcards"; description = `${item.cards?.length || item.data?.cards?.length || 0} flashcards`; icon = <Layers className="text-4xl text-indigo-600" />; }
    else if (contentType === "study_plan") { title = item.data?.title || "Untitled Study Plan"; description = item.data?.description || ""; icon = <NotebookPen className="text-4xl text-blue-600" />; }
    else if (contentType === "voice_note") { title = item.title || "Untitled Voice Note"; description = item.text || ""; icon = <Mic2 className="text-4xl text-purple-600" />; }
    else if (contentType === "summary") { title = item.title || item.data?.title || "Untitled Summary"; description = item.data?.summary?.substring(0, 100) || item.description || ""; icon = <Zap className="text-4xl text-yellow-600" />; }
    else if (contentType === "mindmap") { title = item.data?.title || "Untitled Mind Map"; description = item.data?.description || ""; icon = <GridIcon className="text-4xl text-green-600" />; }
    else if (contentType === "uploaded_file") { title = item.data?.title || item.data?.originalFilename || "Untitled File"; icon = <FileIcon className="text-4xl text-blue-600" />; }
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    const updatedAt = item.updatedAt || item.data?.updatedAt ? new Date(item.updatedAt || item.data.updatedAt) : null;
    return { id: item.id, icon, title, description, type: contentType === "quiz" ? "Quiz" : contentType === "flashcard_deck" ? "Flashcards" : contentType === "study_plan" ? "Study Plan" : contentType === "voice_note" ? "Voice Note" : contentType === "summary" ? "Summary" : contentType === "mindmap" ? "Mind Map" : contentType === "uploaded_file" ? "File" : "Item", date: (updatedAt || createdAt).toLocaleString(), timestamp: updatedAt || createdAt, tags: item.tags || item.data?.tags || [], rawItem: item };
  });
}

const filterOptions = ["All Types", "Quiz", "Flashcards", "Study Plan", "Voice Note", "Summary", "Mind Map", "File"];
const sortOptions = ["Most Recent", "Oldest", "Alphabetical"];

const Modal = ({ open, children, onClose }) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function UnfiledItems() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [allFolders, setAllFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All Types");
  const [sortBy, setSortBy] = useState("Most Recent");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const filterRef = useRef();
  const sortRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (!filterRef.current?.contains(e.target)) setFilterOpen(false);
      if (!sortRef.current?.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [unfiled, folders] = await Promise.all([
          apiFetch("/items/unfiled", { method: "GET" }),
          apiFetch("/folders", { method: "GET" }),
        ]);
        setItems(mapDatabaseItemsToUI(unfiled || []));
        setAllFolders(folders || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let base = items.filter(i => filterType === "All Types" || i.type === filterType).filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortBy === "Most Recent") base.sort((a, b) => b.timestamp - a.timestamp);
    else if (sortBy === "Oldest") base.sort((a, b) => a.timestamp - b.timestamp);
    else if (sortBy === "Alphabetical") base.sort((a, b) => a.title.localeCompare(b.title));
    return base;
  }, [items, filterType, searchTerm, sortBy]);

  function toggleItemSelection(itemId) {
    setSelectedItems(prev => { const next = new Set(prev); if (next.has(itemId)) next.delete(itemId); else next.add(itemId); return next; });
  }
  function toggleSelectAll() {
    if (selectedItems.size === filtered.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(filtered.map(item => item.id)));
  }

  async function moveItemsToFolder(targetFolderId) {
    try {
      for (const itemId of selectedItems) {
        await apiFetch(`/items/${itemId}/move`, { method: "PATCH", body: JSON.stringify({ folder_id: targetFolderId }) });
      }
      const unfiled = await apiFetch("/items/unfiled", { method: "GET" });
      setItems(mapDatabaseItemsToUI(unfiled || []));
      setSelectedItems(new Set());
      setShowMoveModal(false);
    } catch (e) {
      alert("Failed to move items: " + e.message);
    }
  }

  function handleItemClick(item) {
    const contentType = item.rawItem?.contentType;
    if (contentType === "quiz") navigate(`/tools/practice-tests?quizId=${item.id}`);
    else if (contentType === "flashcard_deck") navigate(`/tools/flashcards/study/${item.id}`);
    else if (contentType === "study_plan") navigate(`/tools/study-planner?planId=${item.id}`);
    else if (contentType === "voice_note") navigate(`/tools/voice-notes?noteId=${item.id}`);
    else if (contentType === "mindmap") navigate(`/tools/maps/${item.id}`);
    else if (contentType === "summary") navigate(`/tools/summarizer?summaryId=${item.id}`);
    else if (contentType === "uploaded_file") {
      (async () => {
        try {
          const token = await getToken();
          const response = await fetch(`${API_BASE}/files/${item.id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (response.ok) { const blob = await response.blob(); const url = window.URL.createObjectURL(blob); window.open(url, "_blank"); setTimeout(() => window.URL.revokeObjectURL(url), 100); }
        } catch (e) { alert("Failed to open file"); }
      })();
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div></div>;
  if (error) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-red-600">{error}</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/workspace")} className="p-2 rounded-lg bg-white shadow border border-slate-200"><ArrowLeft className="w-5 h-5 text-slate-700" /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Unfiled Items</h1>
            <p className="text-sm text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''} not in any folder</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative"><Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" /><input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 rounded-full border border-slate-300 shadow-sm focus:ring-1 focus:ring-indigo-300" /></div>
          <button onClick={toggleSelectAll} className="px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm hover:bg-slate-50">{selectedItems.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-slate-600" />}</button>
          {selectedItems.size > 0 && <button onClick={() => setShowMoveModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Move {selectedItems.size} to folder</button>}
          <div className="relative" ref={filterRef}>
            <button onClick={() => setFilterOpen(o => !o)} className="flex items-center gap-1 px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm"><Filter className="w-4 h-4 text-slate-600" /><span className="text-sm">{filterType}</span>{filterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
            {filterOpen && <ul className="absolute right-0 mt-2 w-44 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-20">{filterOptions.map(opt => <li key={opt} onClick={() => { setFilterType(opt); setFilterOpen(false); }} className="px-4 py-2 hover:bg-slate-100 cursor-pointer">{opt}</li>)}</ul>}
          </div>
          <button onClick={() => setView(v => v === "grid" ? "list" : "grid")} className="p-2 bg-white rounded-full border border-slate-300 shadow-sm">{view === "grid" ? <List className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}</button>
          <div className="relative" ref={sortRef}>
            <button onClick={() => setSortOpen(o => !o)} className="flex items-center gap-1 px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm"><span className="text-sm">{sortBy}</span>{sortOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
            {sortOpen && <ul className="absolute right-0 mt-2 w-40 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-20">{sortOptions.map(opt => <li key={opt} onClick={() => { setSortBy(opt); setSortOpen(false); }} className="px-4 py-2 hover:bg-slate-100 cursor-pointer">{opt}</li>)}</ul>}
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileQuestion className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No unfiled items</h3>
            <p className="text-slate-500">All your content is organized in folders.</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`relative bg-white rounded-3xl p-6 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${selectedItems.has(item.id) ? "ring-2 ring-indigo-500" : ""}`}
                onClick={() => { if (selectedItems.size > 0) { toggleItemSelection(item.id); return; } handleItemClick(item); }}>
                <div className="absolute top-4 left-4"><button onClick={(e) => { e.stopPropagation(); toggleItemSelection(item.id); }} className="p-1 rounded hover:bg-slate-100">{selectedItems.has(item.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-slate-400" />}</button></div>
                <div className="absolute -top-6 left-6 bg-white p-2 rounded-full shadow-lg">{item.icon}</div>
                <div className="mt-8"><h3 className="text-lg font-semibold text-slate-800">{item.title}</h3><p className="text-sm text-slate-500 mt-2 line-clamp-2">{item.description}</p></div>
                <div className="mt-4 flex items-center text-sm text-slate-500"><span className="font-medium">{item.type}</span><CalendarIcon className="w-4 h-4 mx-2" /><span>{item.date}</span></div>
              </motion.div>
            ))}
          </div>
        ) : (
          <ul className="space-y-4">
            {filtered.map((item, i) => (
              <motion.li key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className={`flex items-start gap-4 bg-white rounded-xl p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${selectedItems.has(item.id) ? "ring-2 ring-indigo-500" : ""}`}
                onClick={() => { if (selectedItems.size > 0) { toggleItemSelection(item.id); return; } handleItemClick(item); }}>
                <button onClick={(e) => { e.stopPropagation(); toggleItemSelection(item.id); }} className="p-1 rounded hover:bg-slate-100">{selectedItems.has(item.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-slate-400" />}</button>
                <div className="mt-1">{item.icon}</div>
                <div className="flex-1"><h3 className="font-semibold text-slate-800">{item.title}</h3><p className="text-sm text-slate-500">{item.description}</p><div className="mt-2 flex items-center text-xs text-slate-500"><span className="font-medium">{item.type}</span><CalendarIcon className="w-4 h-4 mx-2" /><span>{item.date}</span></div></div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={showMoveModal} onClose={() => setShowMoveModal(false)}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Move {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} to folder</h3>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {allFolders.map(folder => (
            <button key={folder.id} onClick={() => moveItemsToFolder(folder.id)} className="w-full text-left px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2">
              <Folder className="w-5 h-5 text-slate-600" /><span className="font-medium">{folder.name}</span><span className="text-sm text-slate-500 ml-auto">{folder.items ?? 0} items</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end"><button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setShowMoveModal(false)}>Cancel</button></div>
      </Modal>
    </div>
  );
}
