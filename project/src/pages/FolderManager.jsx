import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Pencil, FolderKanban, List, Star, FolderSymlink } from "lucide-react";
import MoveFolderModal from "../components/MoveFolderModal";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Props:
 * - view: "grid" | "list"
 * - folders: Array<{ id, name, items, color, starred, createdAt?, updatedAt? }>
 * - onToggleStar: (id) => Promise|void
 * - onRename: (id, newName) => Promise|void
 * - onDelete: (id) => Promise|void
 */
const ConfirmModal = ({
  open,
  title,
  subtitle,
  confirmLabel = "Delete",
  onClose,
  onConfirm,
}) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
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
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await onConfirm();
                } finally {
                  onClose();
                }
              }}
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

export default function FolderManager({
  view,
  folders,
  allFolders,
  onToggleStar,
  onRename,
  onDelete,
  onMove,
}) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [movingFolder, setMovingFolder] = useState(null);

  const handleRename = async (folder) => {
    const newName = prompt("Enter new folder name:", folder.name);
    if (newName && newName.trim() && newName.trim() !== folder.name) {
      await onRename(folder.id, newName.trim());
    }
  };

  const sorted = [
    ...folders.filter((f) => f.starred),
    ...folders.filter((f) => !f.starred),
  ];

  // LIST VIEW
  if (view === "list") {
    return (
      <>
        <ul className="space-y-3">
          {sorted.map((folder) => (
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
                  <div className="text-sm text-slate-500">{folder.items ?? 0} items</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleStar(folder.id); }}
                  title={folder.starred ? "Unstar" : "Star"}
                >
                  <Star className={`w-5 h-5 ${folder.starred ? "fill-yellow-400 text-yellow-400" : "text-slate-400 hover:text-yellow-500"}`} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMovingFolder(folder); }}
                  title="Move folder"
                >
                  <FolderSymlink className="w-5 h-5 text-purple-500 hover:text-purple-700" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRename(folder); }}
                  title="Rename"
                >
                  <Pencil className="w-5 h-5 text-blue-500 hover:text-blue-700" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(folder);
                  }}
                  title="Delete"
                >
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
              ? `"${pendingDelete.name}" and its contents will be moved to the trash. You can restore them later from the Recently Deleted section.`
              : ""
          }
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => {
            if (!pendingDelete) return;
            await onDelete(pendingDelete.id);
          }}
        />
      </>
    );
  }

  // GRID VIEW
  return (
    <>
      {folders.some((f) => f.starred) && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">⭐ Starred</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {folders.filter((f) => f.starred).map((folder) => (
              <motion.div
                key={folder.id}
                onClick={() => navigate(`/workspace/folder/${folder.id}`)}
                whileHover={{ scale: 1.02 }}
                className={`rounded-3xl p-5 bg-gradient-to-br ${folder.color} cursor-pointer shadow-md border border-white/40 relative`}
              >
                <div className="text-lg font-bold text-slate-800 mb-1">{folder.name}</div>
                <div className="text-sm text-slate-600">{folder.items ?? 0} items</div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleStar(folder.id); }}
                    title="Unstar"
                  >
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMovingFolder(folder); }}
                    title="Move folder"
                  >
                    <FolderSymlink className="w-4 h-4 text-purple-500 hover:text-purple-700" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRename(folder); }}
                    title="Rename"
                  >
                    <Pencil className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete(folder);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {folders.filter((f) => !f.starred).map((folder) => (
            <motion.div
              key={folder.id}
              onClick={() => navigate(`/workspace/folder/${folder.id}`)}
              whileHover={{ scale: 1.02 }}
              className={`rounded-3xl p-5 bg-gradient-to-br ${folder.color} cursor-pointer shadow-md border border-white/40 relative`}
            >
              <div className="text-lg font-bold text-slate-800 mb-1">{folder.name}</div>
              <div className="text-sm text-slate-600">{folder.items ?? 0} items</div>
              <div className="absolute top-3 right-3 flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleStar(folder.id); }}
                  title="Star"
                >
                  <Star className="w-4 h-4 text-slate-400 hover:text-yellow-500" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMovingFolder(folder); }}
                  title="Move folder"
                >
                  <FolderSymlink className="w-4 h-4 text-purple-500 hover:text-purple-700" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRename(folder); }}
                  title="Rename"
                >
                  <Pencil className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(folder);
                  }}
                  title="Delete"
                >
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
            ? `"${pendingDelete.name}" and its contents will be moved to the trash. You can restore them later from the Recently Deleted section.`
            : ""
        }
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await onDelete(pendingDelete.id);
        }}
      />

      <MoveFolderModal
        open={!!movingFolder}
        onClose={() => setMovingFolder(null)}
        folderId={movingFolder?.id}
        allFolders={allFolders || []}
        onConfirm={async (newParentId) => {
          if (movingFolder && onMove) {
            await onMove(movingFolder.id, newParentId);
          }
          setMovingFolder(null);
        }}
      />
    </>
  );
}
