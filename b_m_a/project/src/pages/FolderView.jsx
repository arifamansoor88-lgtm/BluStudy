import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Search, Filter, List, LayoutGrid, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, MoreVertical, Pencil, Trash2, FolderSymlink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mic2, LayoutGrid as GridIcon, Edit3, Zap } from "lucide-react";

const studyTools = [
  { label: "AI Flashcards",    icon: <Brain className="text-2xl"/>,   color: "from-indigo-500 to-violet-500", page: "/tools/flashcards"},
  { label: "Voice Notes",      icon: <Mic2 className="text-2xl"/>,    color: "from-purple-500 to-pink-500", page: "/tools/voice-notes"},
  { label: "Mind Maps",        icon: <GridIcon className="text-2xl"/>, color: "from-green-500 to-emerald-500", page: "/tools/mind-maps"},
  { label: "Practice Tests",   icon: <Edit3 className="text-2xl"/>,   color: "from-orange-500 to-yellow-500", page: "/tools/practice-tests"},
  { label: "Smart Summarizer", icon: <Zap className="text-2xl"/>,     color: "from-cyan-500 to-sky-500", page: "/tools/summarizer"},
];

const initialItems = [
  {
    icon: <Brain className="text-4xl"/>,
    title: "Project Requirements Document",
    description: "Comprehensive requirements gathering and documentation for...",
    type: "Notes",
    date: "Dec 18, 05:30 AM",
    tags: ["requirements", "documentation", "planning"],
    timestamp: new Date("2025-12-18T05:30:00")
  },
  {
    icon: <GridIcon className="text-4xl"/>,
    title: "Weekly Team Meeting Summary",
    description: "Key decisions and action items from team meeting with stakeholders...",
    type: "Summary",
    date: "Dec 17, 09:20 AM",
    tags: ["meetings", "team", "summary"],
    timestamp: new Date("2025-12-17T09:20:00")
  },
  {
    icon: <Edit3 className="text-4xl"/>,
    title: "Technical Architecture Quiz",
    description: "15 questions covering system architecture concepts and best practices...",
    type: "Quiz",
    date: "Dec 16, 04:15 AM",
    tags: ["architecture", "technical", "assessment"],
    timestamp: new Date("2025-12-16T04:15:00")
  }
];

const filterOptions = ["All Types", "Notes", "Summary", "Quiz", "Research", "Essay", "Flashcards"];
const sortOptions = ["Most Recent", "Oldest"];

const mockFolders = {
  1: { name: "Project Documentation", items: 5 },
  2: { name: "Research Materials", items: 8 },
  3: { name: "Design Assets", items: 3 },
  4: { name: "Meeting Notes", items: 6 },
};

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
  const navigate = useNavigate();

  const [items, setItems] = useState(initialItems);
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

  const folder = mockFolders[id] || { name: "Untitled Folder", items: 0 };
  const dynamicCount = items.length;

  // Filters
  let filtered = items
    .filter(i => filterType === "All Types" || i.type === filterType)
    .filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()));
  filtered.sort((a, b) => sortBy === "Most Recent" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);

  // Actions
  const doRename = () => {
    setItems(prev => prev.map((it, i) => (i === renameIdx ? { ...it, title: renameValue } : it)));
    setRenameIdx(null);
  };
  const doMove = () => {
    // Simulate: removing item from this folder after "moving"
    setItems(prev => prev.filter((_, i) => i !== moveIdx));
    setMoveIdx(null);
  };
  const doDelete = () => {
    setItems(prev => prev.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* NAVBAR */}
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/workspace")}
            className="p-2 rounded-lg bg-white shadow border border-slate-200"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{folder.name}</h1>
            <p className="text-sm text-slate-500">
              {dynamicCount} items • Updated 2 hours ago
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
              onClick={() => setFilterOpen(o => !o)}
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm"
            >
              <Filter className="w-4 h-4 text-slate-600" />
              <span className="text-sm">{filterType}</span>
              {filterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {filterOpen && (
              <ul className="absolute right-0 mt-2 w-44 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-20">
                {filterOptions.map(opt => (
                  <li
                    key={opt}
                    onClick={() => { setFilterType(opt); setFilterOpen(false); }}
                    className="px-4 py-2 hover:bg-slate-100 cursor-pointer"
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={() => setView(v => (v === "grid" ? "list" : "grid"))}
            className="p-2 bg-white rounded-full border border-slate-300 shadow-sm"
          >
            {view === "grid" ? <List className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
          </button>

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(o => !o)}
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm"
            >
              <span className="text-sm">{sortBy}</span>
              {sortOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {sortOpen && (
              <ul className="absolute right-0 mt-2 w-40 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-20">
                {sortOptions.map(opt => (
                  <li
                    key={opt}
                    onClick={() => { setSortBy(opt); setSortOpen(false); }}
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
          <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Content</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {studyTools.map((tool, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl text-white bg-gradient-to-br ${tool.color} shadow-xl hover:scale-105 transition-transform`}
              >
                {tool.icon}
                <span className="mt-3 font-semibold">{tool.label}</span>
                <Link to = {tool.page}>
                <button className="mt-4 px-4 py-1 bg-white text-slate-700 rounded-full text-sm shadow hover:scale-105">
                  Create
                </button>
                </Link>
              </motion.div>
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
                  key={i}
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
                    {item.icon}
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
                    {item.tags.map((tag, t) => (
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
                  key={i}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="relative flex items-start gap-4 bg-white rounded-xl p-4 shadow-lg"
                >
                  <div className="mt-1">{item.icon}</div>
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
          {Object.entries(mockFolders).map(([fid, f]) => (
            <option key={fid} value={fid}>{f.name}</option>
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
