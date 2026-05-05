import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Search, Filter, List, LayoutGrid, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, MoreVertical, Trash2, FolderSymlink, Folder, FolderPlus, ChevronRight, Upload, File as FileIcon, CheckSquare, Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mic2, LayoutGrid as GridIcon, Edit3, Zap, NotebookPen, Pencil } from "lucide-react";

// =======================
// API helpers (uses MSAL)
// =======================
import { msalInstance, protectedResources } from "../authConfig";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function getToken() {
  // Ensure MSAL is init before actually using it
  await msalInstance.initialize();
  
  const accounts = msalInstance.getAllAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error("You need to sign in to access this folder.");
  }
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
  { label: "AI Flashcards",    icon: <Brain className="text-2xl" />,   color: "from-indigo-500 to-violet-500",  path: "/tools/flashcards" },
  { label: "Voice Notes",      icon: <Mic2 className="text-2xl" />,    color: "from-purple-500 to-pink-500",    path: "/tools/voice-notes" },
  { label: "Mind Maps",        icon: <GridIcon className="text-2xl" />, color: "from-green-500 to-emerald-500",  path: "/tools/mind-maps" },
  { label: "Practice Tests",   icon: <Edit3 className="text-2xl" />,   color: "from-orange-500 to-yellow-500", path: "/tools/practice-tests" },
  { label: "Smart Summarizer", icon: <Zap className="text-2xl" />,     color: "from-cyan-500 to-sky-500",       path: "/tools/summarizer" },
  { label: "Study Planner",    icon: <NotebookPen className="text-2xl" />, color: "from-rose-500 to-red-500",    path: "/tools/study-plans" },
];

const filterOptions = ["All Types", "Quiz", "Flashcards", "Study Plan", "Voice Note", "Summary", "Mind Map", "File"];
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
      title = item.title || item.data?.title || "Untitled Summary";
      description = item.data?.summary?.substring(0, 100) || item.description || "";
      icon = <Zap className="text-4xl text-yellow-600" />;
    } else if (contentType === "mindmap") {
      title = item.data?.title || "Untitled Mind Map";
      description = item.data?.description || "";
      icon = <GridIcon className="text-4xl text-green-600" />;
    } else if (contentType === "uploaded_file") {
      title = item.data?.title || item.data?.originalFilename || "Untitled File";
      const fileSize = item.data?.fileSize || 0;
      const sizeMB = fileSize > 0 ? (fileSize / (1024 * 1024)).toFixed(2) : "0";
      description = `${sizeMB} MB • ${item.data?.fileType || "file"}`;
      // Use file icon for all files (images will open when clicked)
      icon = <FileIcon className="text-4xl text-blue-600" />;
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
            contentType === "mindmap" ? "Mind Map" :
            contentType === "uploaded_file" ? "File" : "Item",
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
  const [uploading, setUploading] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedItems, setDraggedItems] = useState([]); // For multi-drag
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [pendingMoveFolderId, setPendingMoveFolderId] = useState(null); // For confirmation dialog

  // Content modals
  const [deleteIdx, setDeleteIdx] = useState(null);
  
  // Subfolder creation modal
  const [isCreateSubfolderModalOpen, setIsCreateSubfolderModalOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [selectedSubfolderColor, setSelectedSubfolderColor] = useState("from-indigo-100 to-indigo-200");

  const [pendingSubfolderDelete, setPendingSubfolderDelete] = useState(null);
  const [editingSubfolder, setEditingSubfolder] = useState(null);
  const [editSubfolderName, setEditSubfolderName] = useState("");
  const [editSubfolderColor, setEditSubfolderColor] = useState("");

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
        // Clear selection when folder changes
        setSelectedItems(new Set());
      } catch (e) {
        console.error("Error loading folder items:", e);
        setError(e.message || "Failed to load folder items");
        setItems([]);
        setSubfolders([]);
        setBreadcrumbs([]);
        setLoading(false);
        setSelectedItems(new Set());
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

  async function renameSubfolder() {
    if (!editingSubfolder || !editSubfolderName.trim()) return;
    try {
      await apiFetch(`/folders/${editingSubfolder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          name: editSubfolderName.trim(),
          color: editSubfolderColor || editingSubfolder.color,
        }),
      });
      
      const folders = await apiFetch("/folders", { method: "GET" });
      setAllFolders(folders);
      const current = folders.find((f) => String(f.id) === String(folderId));
      setFolderMeta(current || null);
      const subfoldersList = folders.filter((f) => String(f.parentFolderId) === String(folderId));
      setSubfolders(subfoldersList);
      
      setEditingSubfolder(null);
      setEditSubfolderName("");
      setEditSubfolderColor("");
    } catch (e) {
      console.error("Error renaming subfolder:", e);
      alert("Failed to rename subfolder: " + (e.message || "Unknown error"));
    }
  }

  async function deleteSubfolder() {
    if (!pendingSubfolderDelete) return;
    try {
      await apiFetch(`/folders/${pendingSubfolderDelete.id}`, { method: "DELETE" });
      
      const folders = await apiFetch("/folders", { method: "GET" });
      setAllFolders(folders);
      const current = folders.find((f) => String(f.id) === String(folderId));
      setFolderMeta(current || null);
      const subfoldersList = folders.filter((f) => String(f.parentFolderId) === String(folderId));
      setSubfolders(subfoldersList);
      
      const dbItems = await apiFetch(`/folders/${folderId}/items`, { method: "GET" });
      const contentItems = dbItems.filter(item => item.contentType !== "folder");
      const mappedItems = mapDatabaseItemsToUI(contentItems);
      setItems(mappedItems);
      
      setPendingSubfolderDelete(null);
    } catch (e) {
      console.error("Error deleting subfolder:", e);
      alert("Failed to delete subfolder: " + (e.message || "Unknown error"));
    }
  }

  // ==============
  // Mutations
  // ==============
  
  // Move item to folder (single or multiple items)
  async function moveItemToFolder(itemIdOrIds, targetFolderId) {
    try {
      // Handle both single item (string) and multiple items (array)
      const itemsToMove = Array.isArray(itemIdOrIds) ? itemIdOrIds : [itemIdOrIds];
      
      // Move all items
      for (const itemId of itemsToMove) {
        await apiFetch(`/items/${itemId}/move`, {
          method: "PATCH",
          body: JSON.stringify({ folder_id: targetFolderId }),
        });
      }
      
      // Reload all folders to get updated item counts
      const folders = await apiFetch("/folders", { method: "GET" });
      setAllFolders(folders);
      
      // Update current folder meta
      const current = folders.find((f) => String(f.id) === String(folderId));
      setFolderMeta(current || null);
      
      // Update subfolders with new counts
      const subfoldersList = folders.filter((f) => String(f.parentFolderId) === String(folderId));
      setSubfolders(subfoldersList);
      
      // Reload items in current folder after move
      const dbItems = await apiFetch(`/folders/${folderId}/items`, { method: "GET" });
      const contentItems = dbItems.filter(item => item.contentType !== "folder");
      const mappedItems = mapDatabaseItemsToUI(contentItems);
      setItems(mappedItems);
      
      // Clear selection if items were moved
      if (Array.isArray(itemIdOrIds)) {
        setSelectedItems(new Set());
      }
    } catch (e) {
      console.error("Error moving item:", e);
      alert("Failed to move item: " + (e.message || "Unknown error"));
    }
  }

  // Bulk move selected items to folder (called after confirmation)
  async function bulkMoveItems(targetFolderId) {
    try {
      const itemsToMove = Array.from(selectedItems);
      
      // Move all selected items
      for (const itemId of itemsToMove) {
        await apiFetch(`/items/${itemId}/move`, {
          method: "PATCH",
          body: JSON.stringify({ folder_id: targetFolderId }),
        });
      }
      
      // Reload all folders to get updated item counts
      const folders = await apiFetch("/folders", { method: "GET" });
      setAllFolders(folders);
      
      // Update current folder meta
      const current = folders.find((f) => String(f.id) === String(folderId));
      setFolderMeta(current || null);
      
      // Update subfolders with new counts
      const subfoldersList = folders.filter((f) => String(f.parentFolderId) === String(folderId));
      setSubfolders(subfoldersList);
      
      // Reload items in current folder after move
      const dbItems = await apiFetch(`/folders/${folderId}/items`, { method: "GET" });
      const contentItems = dbItems.filter(item => item.contentType !== "folder");
      const mappedItems = mapDatabaseItemsToUI(contentItems);
      setItems(mappedItems);
      
      // Clear selection and close modals
      setSelectedItems(new Set());
      setShowMoveModal(false);
      setPendingMoveFolderId(null);
    } catch (e) {
      console.error("Error moving items:", e);
      alert("Failed to move items: " + (e.message || "Unknown error"));
      setPendingMoveFolderId(null);
    }
  }

  // Handle folder selection in move modal (show confirmation)
  function handleMoveFolderSelection(targetFolderId) {
    setPendingMoveFolderId(targetFolderId);
  }

  // Confirm and execute the move
  function confirmMove() {
    if (pendingMoveFolderId !== null) {
      bulkMoveItems(pendingMoveFolderId);
    }
  }

  // Cancel the pending move
  function cancelPendingMove() {
    setPendingMoveFolderId(null);
  }

  // Toggle item selection
  function toggleItemSelection(itemId) {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  // Toggle select all
  function toggleSelectAll() {
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filtered.map(item => item.id)));
    }
  }

  // Create custom drag image (Google Drive style)
  function createDragImage(e, item, selectedItemsSet, itemsList) {
    const dragPreview = document.createElement("div");
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-1000px";
    dragPreview.style.left = "-1000px";
    dragPreview.style.padding = "10px 14px";
    dragPreview.style.background = "white";
    dragPreview.style.borderRadius = "10px";
    dragPreview.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)";
    dragPreview.style.display = "flex";
    dragPreview.style.alignItems = "center";
    dragPreview.style.gap = "10px";
    dragPreview.style.zIndex = "10000";
    dragPreview.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    dragPreview.style.border = "1px solid rgba(0,0,0,0.08)";
    
    // Get icon color and SVG based on item type
    const getIconData = (itemType) => {
      if (itemType === 'Quiz') {
        return {
          color: '#ea580c',
          svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
        };
      }
      if (itemType === 'Flashcards') {
        return {
          color: '#4f46e5',
          svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>'
        };
      }
      if (itemType === 'Study Plan') {
        return {
          color: '#3b82f6',
          svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
        };
      }
      if (itemType === 'Voice Note') {
        return {
          color: '#9333ea',
          svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 0 1-3-3V5a3 3 0 1 1 6 0v6a3 3 0 0 1-3 3z"></path></svg>'
        };
      }
      if (itemType === 'Summary') {
        return {
          color: '#eab308',
          svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>'
        };
      }
      if (itemType === 'Mind Map') {
        return {
          color: '#10b981',
          svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'
        };
      }
      if (itemType === 'File') {
        return {
          color: '#3b82f6',
          svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>'
        };
      }
      // Default
      return {
        color: '#6b7280',
        svg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>'
      };
    };
    
    const iconData = getIconData(item.type);
    
    // If item is selected and there are multiple selected, show stacked preview
    if (selectedItemsSet.has(item.id) && selectedItemsSet.size > 1) {
      const selectedCount = selectedItemsSet.size;
      
      dragPreview.innerHTML = `
        <div style="display: flex; align-items: center; position: relative; width: 56px; height: 48px;">
          <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 2; position: absolute; left: 0;">
            ${iconData.svg}
          </div>
          <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 1; position: absolute; left: 8px; opacity: 0.85;">
          </div>
          <div style="position: absolute; right: -8px; top: -4px; width: 20px; height: 20px; background: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 700; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 3;">
            ${selectedCount}
          </div>
        </div>
        <span style="font-weight: 600; color: #1e293b; font-size: 15px; letter-spacing: -0.01em;">${selectedCount} items</span>
      `;
    } else {
      // Single item drag - show icon and title
      const truncatedTitle = item.title.length > 18 ? item.title.substring(0, 18) + '...' : item.title;
      
      dragPreview.innerHTML = `
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex-shrink: 0;">
          ${iconData.svg}
        </div>
        <span style="font-weight: 600; color: #1e293b; font-size: 15px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.01em;">${truncatedTitle}</span>
      `;
    }
    
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 10, 10);
    
    // Clean up after a delay
    setTimeout(() => {
      if (document.body.contains(dragPreview)) {
        document.body.removeChild(dragPreview);
      }
    }, 0);
  }

  // File upload handler
  async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder_id", folderId);
        
        const token = await getToken();
        const response = await fetch(`${API_BASE}/upload-file`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }
      
      // Reload items after upload
      const dbItems = await apiFetch(`/folders/${folderId}/items`, { method: "GET" });
      const contentItems = dbItems.filter(item => item.contentType !== "folder");
      const mappedItems = mapDatabaseItemsToUI(contentItems);
      setItems(mappedItems);
    } catch (e) {
      console.error("Error uploading file:", e);
      alert("Failed to upload file: " + (e.message || "Unknown error"));
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  }

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
        // Remove quiz from folder only (don't delete the quiz itself)
        deleteEndpoint = null;
      } else if (contentType === "flashcard_deck") {
        // Remove flashcard deck from folder only (don't delete the deck itself)
        deleteEndpoint = null;
      } else if (contentType === "voice_note") {
        // Remove voice note from folder only (don't delete the note itself)
        deleteEndpoint = null;
      } else if (contentType === "uploaded_file") {
        deleteEndpoint = null;
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
      } else if (contentType === "uploaded_file") {
        // Delete uploaded file, remove from database and delete file from disk
        await apiFetch(`/files/${itemToDelete.id}`, { method: "DELETE" }).catch(() => {
          console.warn("Delete endpoint not available, removing from folder only");
        });
      } else {
        // For items without specific delete endpoints (including quizzes), remove from folder only
        await apiFetch(`/items/${itemToDelete.id}/move`, {
          method: "PATCH",
          body: JSON.stringify({ folder_id: null }),
        });
      }

      // Reload all folders to get updated item counts
      const folders = await apiFetch("/folders", { method: "GET" });
      setAllFolders(folders);
      
      // Update current folder meta
      const current = folders.find((f) => String(f.id) === String(folderId));
      setFolderMeta(current || null);
      
      // Update subfolders with new counts
      const subfoldersList = folders.filter((f) => String(f.parentFolderId) === String(folderId));
      setSubfolders(subfoldersList);

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
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm hover:bg-slate-50"
            title="Select All"
          >
            {selectedItems.size === filtered.length && filtered.length > 0 ? (
              <CheckSquare className="w-5 h-5 text-indigo-600" />
            ) : (
              <Square className="w-5 h-5 text-slate-600" />
            )}
          </button>
          {selectedItems.size > 0 && (
            <button
              onClick={() => setSelectedItems(new Set())}
              className="px-4 py-2 bg-white rounded-full border border-slate-300 shadow-sm hover:bg-slate-50 text-sm text-slate-700"
              title="Clear Selection"
            >
              Cancel
            </button>
          )}

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
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {subfolders.map((subfolder) => (
                <motion.div
                  key={subfolder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/workspace/folder/${subfolder.id}`)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverFolder(subfolder.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragOverFolder(null);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOverFolder(null);
                    
                    // Handle multi-drag (selected items)
                    if (draggedItems.length > 0) {
                      await moveItemToFolder(draggedItems, subfolder.id);
                      setDraggedItems([]);
                    } 
                    // Handle single drag
                    else if (draggedItem && draggedItem !== subfolder.id) {
                      await moveItemToFolder(draggedItem, subfolder.id);
                      setDraggedItem(null);
                    }
                  }}
                  className={`relative rounded-2xl p-4 bg-gradient-to-br ${subfolder.color || folderColors[0]} cursor-pointer shadow-md border-2 transition-transform ${
                    dragOverFolder === subfolder.id ? "border-indigo-500 scale-105" : "border-white/40 hover:scale-105"
                  }`}
                >
                  <div className="absolute top-2 right-2 flex gap-1 z-10" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSubfolder(subfolder);
                        setEditSubfolderName(subfolder.name);
                        setEditSubfolderColor(subfolder.color || folderColors[0]);
                      }}
                      className="p-1 rounded-lg hover:bg-white/50"
                      title="Edit subfolder"
                    >
                      <Pencil className="w-3.5 h-3.5 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingSubfolderDelete(subfolder);
                      }}
                      className="p-1 rounded-lg hover:bg-white/50"
                      title="Delete subfolder"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
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
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload Files"}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFolder(folderId);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOverFolder(null);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            setDragOverFolder(null);
            
            // Handle multi-drag (selected items)
            if (draggedItems.length > 0) {
              await moveItemToFolder(draggedItems, folderId);
              setDraggedItems([]);
            }
            // Handle single drag
            else if (draggedItem) {
              await moveItemToFolder(draggedItem, folderId);
              setDraggedItem(null);
            }
          }}
          className={dragOverFolder === folderId ? "border-2 border-indigo-500 rounded-xl p-4" : ""}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Your Content</h2>
            {selectedItems.size > 0 && (
              <button
                onClick={() => setShowMoveModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                Move {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item, i) => (
                <motion.div
                  key={`${item.id || item.title}-${i}`}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  draggable
                  onDragStart={(e) => {
                    // Create custom drag image (Google Drive style kindof)
                    createDragImage(e, item, selectedItems, items);
                    
                    // If item is selected and there are multiple selected, drag all selected items
                    if (selectedItems.has(item.id) && selectedItems.size > 1) {
                      const selectedArray = Array.from(selectedItems);
                      setDraggedItems(selectedArray);
                      setDraggedItem(null); // Clear single drag
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", `moving-${selectedArray.length}-items`);
                    } else {
                      // Single item drag
                      setDraggedItem(item.id);
                      setDraggedItems([]);
                      e.dataTransfer.effectAllowed = "move";
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedItem(null);
                    setDraggedItems([]);
                  }}
                  className={`relative bg-white rounded-3xl p-6 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${
                    (draggedItem === item.id || draggedItems.includes(item.id)) ? "opacity-50" : ""
                  } ${selectedItems.has(item.id) ? "ring-2 ring-indigo-500" : ""}`}
                  onClick={(e) => {
                    // If clicking on checkbox, don't navigate
                    if (e.target.closest('.checkbox-container')) {
                      e.stopPropagation();
                      toggleItemSelection(item.id);
                      return;
                    }
                    
                    // If in selection mode, toggle selection instead of navigating
                    if (selectedItems.size > 0) {
                      toggleItemSelection(item.id);
                      return;
                    }
                    
                    // Normal click behavior
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
                    } else if (contentType === "uploaded_file") {
                      // Open file with authentication
                      (async () => {
                        try {
                          const token = await getToken();
                          const response = await fetch(`${API_BASE}/files/${item.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            window.open(url, "_blank");
                            // Clean up URL after a delay
                            setTimeout(() => window.URL.revokeObjectURL(url), 100);
                          }
                        } catch (e) {
                          console.error("Error opening file:", e);
                          alert("Failed to open file");
                        }
                      })();
                    } else if (contentType === "mindmap") {
                      navigate(`/tools/maps/${item.id}`);
                    } else if (contentType === "summary") {
                      navigate(`/tools/summarizer?summaryId=${item.id}`);
                    }
                    // Other content types can be handled later
                  }}
                >
                  {/* Checkbox */}
                  <div className="absolute top-4 left-4 checkbox-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItemSelection(item.id);
                      }}
                      className="p-1 rounded hover:bg-slate-100"
                    >
                      {selectedItems.has(item.id) ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </div>

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
                  draggable
                  onDragStart={(e) => {
                    // Create custom drag image (Google Drive style)
                    createDragImage(e, item, selectedItems, items);
                    
                    // If item is selected and there are multiple selected, drag all selected items
                    if (selectedItems.has(item.id) && selectedItems.size > 1) {
                      const selectedArray = Array.from(selectedItems);
                      setDraggedItems(selectedArray);
                      setDraggedItem(null); // Clear single drag
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", `moving-${selectedArray.length}-items`);
                    } else {
                      // Single item drag
                      setDraggedItem(item.id);
                      setDraggedItems([]);
                      e.dataTransfer.effectAllowed = "move";
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedItem(null);
                    setDraggedItems([]);
                  }}
                  className={`relative flex items-start gap-4 bg-white rounded-xl p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${
                    (draggedItem === item.id || draggedItems.includes(item.id)) ? "opacity-50" : ""
                  } ${selectedItems.has(item.id) ? "ring-2 ring-indigo-500" : ""}`}
                  onClick={(e) => {
                    // If clicking on checkbox, don't navigate
                    if (e.target.closest('.checkbox-container')) {
                      e.stopPropagation();
                      toggleItemSelection(item.id);
                      return;
                    }
                    
                    // If in selection mode, toggle selection instead of navigating
                    if (selectedItems.size > 0) {
                      toggleItemSelection(item.id);
                      return;
                    }
                    
                    // Normal click behavior
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
                    } else if (contentType === "uploaded_file") {
                      // Open file with authentication
                      (async () => {
                        try {
                          const token = await getToken();
                          const response = await fetch(`${API_BASE}/files/${item.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            window.open(url, "_blank");
                            // Clean up URL after a delay
                            setTimeout(() => window.URL.revokeObjectURL(url), 100);
                          }
                        } catch (e) {
                          console.error("Error opening file:", e);
                          alert("Failed to open file");
                        }
                      })();
                    } else if (contentType === "mindmap") {
                      navigate(`/tools/maps/${item.id}`);
                    } else if (contentType === "summary") {
                      navigate(`/tools/summarizer?summaryId=${item.id}`);
                    }
                  }}
                >
                  <div className="checkbox-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItemSelection(item.id);
                      }}
                      className="p-1 rounded hover:bg-slate-100"
                    >
                      {selectedItems.has(item.id) ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </div>
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

      {/* MOVE MODAL */}
      <Modal open={showMoveModal} onClose={() => { setShowMoveModal(false); setPendingMoveFolderId(null); }}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Move {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} to folder
        </h3>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {/* Current folder option (move back) */}
          <button
            onClick={() => {
              handleMoveFolderSelection(folderId);
            }}
            className="w-full text-left px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
          >
            <Folder className="w-5 h-5 text-slate-600" />
            <span className="font-medium">{folderName}</span>
            <span className="text-sm text-slate-500 ml-auto">(Current folder)</span>
          </button>
          
          {/* Subfolders */}
          {subfolders.map((subfolder) => (
            <button
              key={subfolder.id}
              onClick={() => {
                handleMoveFolderSelection(subfolder.id);
              }}
              className="w-full text-left px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
            >
              <Folder className="w-5 h-5 text-slate-600" />
              <span className="font-medium">{subfolder.name}</span>
              <span className="text-sm text-slate-500 ml-auto">{subfolder.items ?? 0} items</span>
            </button>
          ))}
          
          {/* All other folders (excluding current and subfolders) */}
          {allFolders
            .filter(f => String(f.id) !== String(folderId) && String(f.parentFolderId) !== String(folderId))
            .map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  handleMoveFolderSelection(folder.id);
                }}
                className="w-full text-left px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
              >
                <Folder className="w-5 h-5 text-slate-600" />
                <span className="font-medium">{folder.name}</span>
                <span className="text-sm text-slate-500 ml-auto">{folder.items ?? 0} items</span>
              </button>
            ))}
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
            onClick={() => { setShowMoveModal(false); setPendingMoveFolderId(null); }}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* CONFIRMATION MODAL FOR MOVE */}
      <Modal open={pendingMoveFolderId !== null} onClose={cancelPendingMove}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Confirm Move
        </h3>
        <p className="text-slate-600 mb-6">
          Are you sure you want to move {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} to{' '}
          <span className="font-semibold">
            {pendingMoveFolderId && (() => {
              if (String(pendingMoveFolderId) === String(folderId)) {
                return folderName;
              }
              const targetFolder = subfolders.find(f => String(f.id) === String(pendingMoveFolderId)) ||
                                 allFolders.find(f => String(f.id) === String(pendingMoveFolderId));
              return targetFolder?.name || 'selected folder';
            })()}
          </span>?
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
            onClick={cancelPendingMove}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:scale-[1.02] transition-transform"
            onClick={confirmMove}
          >
            Confirm Move
          </button>
        </div>
      </Modal>

      {/* EDIT SUBFOLDER MODAL */}
      <Modal open={!!editingSubfolder} onClose={() => setEditingSubfolder(null)}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Subfolder</h3>
        <input
          type="text"
          placeholder="Subfolder name"
          value={editSubfolderName}
          onChange={(e) => setEditSubfolderName(e.target.value)}
          className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          onKeyPress={(e) => {
            if (e.key === "Enter" && editSubfolderName.trim()) {
              renameSubfolder();
            }
          }}
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {folderColors.map((color, idx) => (
            <button
              key={idx}
              onClick={() => setEditSubfolderColor(color)}
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} border-2 ${
                editSubfolderColor === color ? "border-indigo-500" : "border-transparent"
              }`}
              title={color}
            />
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
            onClick={() => setEditingSubfolder(null)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-50"
            onClick={renameSubfolder}
            disabled={!editSubfolderName.trim()}
          >
            Save
          </button>
        </div>
      </Modal>

      {/* DELETE SUBFOLDER MODAL */}
      <Modal open={!!pendingSubfolderDelete} onClose={() => setPendingSubfolderDelete(null)}>
        <h3 className="text-lg font-semibold text-slate-900">Delete this subfolder?</h3>
        <p className="text-sm text-slate-600 mt-1">
          Deleting "{pendingSubfolderDelete?.name}" will remove the subfolder and unlink all items inside. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setPendingSubfolderDelete(null)}>
            Cancel
          </button>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white" onClick={deleteSubfolder}>
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
