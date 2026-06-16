import React, { useMemo, useState } from "react";
import { Folder, ChevronRight, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MoveFolderModal({ open, onClose, folderId, allFolders, onConfirm }) {
  const [selectedTarget, setSelectedTarget] = useState(null);

  const descendantIds = useMemo(() => {
    const ids = new Set();
    function collect(parentId) {
      for (const f of allFolders) {
        if (f.parentFolderId === parentId) {
          ids.add(f.id);
          collect(f.id);
        }
      }
    }
    collect(folderId);
    return ids;
  }, [folderId, allFolders]);

  const calculateDepth = (id) => {
    let depth = 0;
    let current = allFolders.find(f => f.id === id);
    while (current?.parentFolderId) {
      depth++;
      current = allFolders.find(f => f.id === current.parentFolderId);
    }
    return depth;
  };

  const isDisabled = (targetId) => {
    if (targetId === folderId) return true;
    if (descendantIds.has(targetId)) return true;
    const targetDepth = calculateDepth(targetId);
    if (targetDepth >= 2) return true;
    return false;
  };

  const currentFolder = allFolders.find(f => f.id === folderId);
  const currentParentId = currentFolder?.parentFolderId || null;

  const rootFolders = allFolders.filter(f => !f.parentFolderId && f.id !== folderId);

  const getChildren = (parentId) =>
    allFolders.filter(f => f.parentFolderId === parentId && f.id !== folderId && !descendantIds.has(f.id));

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Move "{currentFolder?.name}" to...</h3>

          <div className="max-h-72 overflow-y-auto space-y-1 mb-4">
            <button
              onClick={() => setSelectedTarget("__root__")}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-2 transition ${
                selectedTarget === "__root__"
                  ? "bg-indigo-50 border border-indigo-300"
                  : currentParentId === null ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "border border-slate-200 hover:bg-slate-50"
              }`}
              disabled={currentParentId === null}
            >
              <Home className="w-5 h-5 text-slate-600" />
              <span className="font-medium">Root level (no parent)</span>
              {currentParentId === null && <span className="text-xs text-slate-400 ml-auto">(current)</span>}
            </button>

            {rootFolders.map(folder => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                depth={0}
                selectedTarget={selectedTarget}
                setSelectedTarget={setSelectedTarget}
                isDisabled={isDisabled}
                getChildren={getChildren}
                currentParentId={currentParentId}
              />
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={onClose}>Cancel</button>
            <button
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white disabled:opacity-50"
              disabled={!selectedTarget}
              onClick={() => {
                const parentId = selectedTarget === "__root__" ? "" : selectedTarget;
                onConfirm(parentId);
                onClose();
              }}
            >
              Move Here
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function FolderTreeItem({ folder, depth, selectedTarget, setSelectedTarget, isDisabled, getChildren, currentParentId }) {
  const [expanded, setExpanded] = useState(false);
  const children = getChildren(folder.id);
  const disabled = isDisabled(folder.id);
  const isCurrent = currentParentId === folder.id;

  return (
    <div>
      <button
        onClick={() => !disabled && setSelectedTarget(folder.id)}
        className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 transition ${
          selectedTarget === folder.id
            ? "bg-indigo-50 border border-indigo-300"
            : disabled ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "border border-slate-200 hover:bg-slate-50"
        }`}
        style={{ paddingLeft: `${(depth + 1) * 16 + 16}px` }}
        disabled={disabled}
      >
        {children.length > 0 && (
          <ChevronRight
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          />
        )}
        <Folder className="w-4 h-4 text-slate-600" />
        <span className="font-medium text-sm">{folder.name}</span>
        {isCurrent && <span className="text-xs text-slate-400 ml-auto">(current parent)</span>}
        {disabled && !isCurrent && <span className="text-xs text-slate-400 ml-auto">(unavailable)</span>}
      </button>
      {expanded && children.map(child => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          selectedTarget={selectedTarget}
          setSelectedTarget={setSelectedTarget}
          isDisabled={isDisabled}
          getChildren={getChildren}
          currentParentId={currentParentId}
        />
      ))}
    </div>
  );
}
