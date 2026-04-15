import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mic2, LayoutGrid as GridIcon, Edit3, Zap, NotebookPen, File as FileIcon, Folder } from "lucide-react";

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

function getItemDisplay(item) {
  const ct = item.contentType;
  if (ct === "folder") return { title: item.data?.name || "Folder", icon: <Folder className="w-8 h-8 text-slate-600" />, type: "Folder" };
  if (ct === "quiz") return { title: item.data?.title || "Quiz", icon: <Edit3 className="w-8 h-8 text-orange-600" />, type: "Quiz" };
  if (ct === "flashcard_deck") return { title: item.title || item.data?.title || "Flashcards", icon: <Brain className="w-8 h-8 text-indigo-600" />, type: "Flashcards" };
  if (ct === "study_plan") return { title: item.data?.title || "Study Plan", icon: <NotebookPen className="w-8 h-8 text-blue-600" />, type: "Study Plan" };
  if (ct === "voice_note") return { title: item.title || "Voice Note", icon: <Mic2 className="w-8 h-8 text-purple-600" />, type: "Voice Note" };
  if (ct === "summary") return { title: item.title || item.data?.title || "Summary", icon: <Zap className="w-8 h-8 text-yellow-600" />, type: "Summary" };
  if (ct === "mindmap") return { title: item.data?.title || "Mind Map", icon: <GridIcon className="w-8 h-8 text-green-600" />, type: "Mind Map" };
  if (ct === "uploaded_file") return { title: item.data?.title || item.data?.originalFilename || "File", icon: <FileIcon className="w-8 h-8 text-blue-600" />, type: "File" };
  return { title: item.title || "Item", icon: <FileIcon className="w-8 h-8 text-gray-600" />, type: "Item" };
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

const Modal = ({ open, children, onClose }) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function TrashPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function loadTrash() {
    try {
      setLoading(true);
      const data = await apiFetch("/trash", { method: "GET" });
      setItems(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrash(); }, []);

  async function restoreItem(itemId) {
    try {
      await apiFetch(`/trash/${itemId}/restore`, { method: "POST" });
      await loadTrash();
    } catch (e) { alert("Failed to restore: " + e.message); }
  }

  async function permanentlyDelete(itemId) {
    try {
      await apiFetch(`/trash/${itemId}`, { method: "DELETE" });
      setDeleteConfirm(null);
      await loadTrash();
    } catch (e) { alert("Failed to delete: " + e.message); }
  }

  async function emptyTrash() {
    try {
      await apiFetch("/trash", { method: "DELETE" });
      setEmptyConfirm(false);
      await loadTrash();
    } catch (e) { alert("Failed to empty trash: " + e.message); }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div></div>;
  if (error) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-red-600">{error}</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/workspace")} className="p-2 rounded-lg bg-white shadow border border-slate-200"><ArrowLeft className="w-5 h-5 text-slate-700" /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Recently Deleted</h1>
            <p className="text-sm text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''} in trash</p>
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={() => setEmptyConfirm(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Empty Trash
          </button>
        )}
      </div>

      <div className="px-6 py-8">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <Trash2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Trash is empty</h3>
            <p className="text-slate-500">Deleted items will appear here for recovery.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const display = getItemDisplay(item);
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="flex-shrink-0">{display.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">{display.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="font-medium">{display.type}</span>
                      <span>Deleted {timeAgo(item.deletedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => restoreItem(item.id)} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                    <button onClick={() => setDeleteConfirm(item)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={emptyConfirm} onClose={() => setEmptyConfirm(false)}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-slate-900">Empty Trash?</h3>
        </div>
        <p className="text-slate-600 mb-6">This will permanently delete all {items.length} items. This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setEmptyConfirm(false)}>Cancel</button>
          <button className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={emptyTrash}>Empty Trash</button>
        </div>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Permanently delete?</h3>
        <p className="text-slate-600 mb-6">"{deleteConfirm && getItemDisplay(deleteConfirm).title}" will be permanently deleted. This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setDeleteConfirm(null)}>Cancel</button>
          <button className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={() => permanentlyDelete(deleteConfirm.id)}>Delete Forever</button>
        </div>
      </Modal>
    </div>
  );
}
