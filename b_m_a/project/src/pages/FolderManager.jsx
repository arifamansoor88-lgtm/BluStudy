import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Trash2, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ConfirmModal = ({ open, title, subtitle, confirmLabel = "Delete", onClose, onConfirm }) => {
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
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white shadow hover:brightness-110"
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const FolderManager = ({ view, folders, onToggleStar, onRename, onDelete }) => {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);

  const renameFolder = (e, id, currentName) => {
    e.stopPropagation();
    const newName = prompt("Enter new folder name:", currentName);
    if (newName && newName.trim()) {
      onRename(id, newName.trim());
    }
  };

  const askDelete = (e, folder) => {
    e.stopPropagation();
    setPendingDelete(folder);
  };

  const confirmDelete = () => {
    if (pendingDelete) {
      onDelete(pendingDelete.id);
      setPendingDelete(null);
    }
  };

  const sorted = [
    ...folders.filter(f => f.starred),
    ...folders.filter(f => !f.starred),
  ];

  if (view === "list") {
    return (
      <>
        <ul className="space-y-3">
          {sorted.map(folder => (
            <motion.li
              key={folder.id}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-4 bg-white rounded-xl shadow cursor-pointer"
              onClick={() => navigate(`/workspace/folder/${folder.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${folder.color}`} />
                <div>
                  <div className="font-semibold text-slate-800">{folder.name}</div>
                  <div className="text-sm text-slate-500">{folder.items} items</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={(e) => { e.stopPropagation(); onToggleStar(folder.id); }} title="Star / Unstar">
                  <Star
                    className={`w-5 h-5 ${folder.starred ? "text-yellow-500" : "text-slate-400"}`}
                    fill={folder.starred ? "currentColor" : "none"}
                  />
                </button>
                <button onClick={(e) => renameFolder(e, folder.id, folder.name)} title="Rename">
                  <Pencil className="w-5 h-5 text-blue-500 hover:text-blue-700" />
                </button>
                <button onClick={(e) => askDelete(e, folder)} title="Delete">
                  <Trash2 className="w-5 h-5 text-red-400 hover:text-red-600" />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>

        <ConfirmModal
          open={!!pendingDelete}
          title="Delete this folder?"
          subtitle={
            pendingDelete
              ? `“${pendingDelete.name}” and all files inside will be permanently deleted. This action cannot be undone.`
              : ""
          }
          onClose={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      </>
    );
  }

  // GRID VIEW
  return (
    <>
      {folders.some(f => f.starred) && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">⭐ Starred</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {folders.filter(f => f.starred).map(folder => (
              <motion.div
                key={folder.id}
                onClick={() => navigate(`/workspace/folder/${folder.id}`)}
                whileHover={{ scale: 1.02 }}
                className={`rounded-3xl p-5 bg-gradient-to-br ${folder.color} cursor-pointer shadow-md border border-white/40 relative`}
              >
                <div className="text-lg font-bold text-slate-800 mb-1">{folder.name}</div>
                <div className="text-sm text-slate-600">{folder.items} items</div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onToggleStar(folder.id); }} title="Star / Unstar">
                    <Star
                      className={`w-5 h-5 ${folder.starred ? "text-yellow-500" : "text-slate-400"}`}
                      fill={folder.starred ? "currentColor" : "none"}
                    />
                  </button>
                  <button onClick={(e) => renameFolder(e, folder.id, folder.name)} title="Rename">
                    <Pencil className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                  </button>
                  <button onClick={(e) => askDelete(e, folder)} title="Delete">
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-slate-700 mb-4">📁 All Folders</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {folders.filter(f => !f.starred).map(folder => (
            <motion.div
              key={folder.id}
              onClick={() => navigate(`/workspace/folder/${folder.id}`)}
              whileHover={{ scale: 1.02 }}
              className={`rounded-3xl p-5 bg-gradient-to-br ${folder.color} cursor-pointer shadow-md border border-white/40 relative`}
            >
              <div className="text-lg font-bold text-slate-800 mb-1">{folder.name}</div>
              <div className="text-sm text-slate-600">{folder.items} items</div>
              <div className="absolute top-3 right-3 flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); onToggleStar(folder.id); }} title="Star / Unstar">
                  <Star
                    className={`w-5 h-5 ${folder.starred ? "text-yellow-500" : "text-slate-400"}`}
                    fill={folder.starred ? "currentColor" : "none"}
                  />
                </button>
                <button onClick={(e) => renameFolder(e, folder.id, folder.name)} title="Rename">
                  <Pencil className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                </button>
                <button onClick={(e) => askDelete(e, folder)} title="Delete">
                  <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete this folder?"
        subtitle={
          pendingDelete
            ? `“${pendingDelete.name}” and all files inside will be permanently deleted. This action cannot be undone.`
            : ""
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
};

export default FolderManager;
