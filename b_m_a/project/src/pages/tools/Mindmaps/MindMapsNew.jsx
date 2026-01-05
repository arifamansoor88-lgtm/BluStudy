import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import ReactFlow, { 
  addEdge, 
  Controls, 
  Background, 
  Handle, 
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Plus, 
  Square, 
  Circle, 
  Trash2, 
  Save,
  Network,
  MoreVertical,
  Share2,
  Settings,
  Pencil,
  FileImage,
  FileText,
  LayoutGrid,
  Palette,
  Shapes,
  FolderOpen,
  PlusCircle,
  X,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getMindmap, getMindmaps, updateMindmap } from '../../../api/apiService';

// Color configuration
const COLOR_PALETTE = {
  red: { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600', hex: '#EF4444' },
  gray: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-700', hex: '#4B5563' },
  purple: { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600', hex: '#A855F7' },
  green: { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600', hex: '#22C55E' },
  yellow: { bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-500', hex: '#FACC15' },
  blue: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600', hex: '#3B82F6' },
};

const COLOR_OPTIONS = [
  { name: 'red', hex: '#EF4444' },
  { name: 'gray', hex: '#4B5563' },
  { name: 'purple', hex: '#A855F7' },
  { name: 'green', hex: '#22C55E' },
  { name: 'yellow', hex: '#FACC15' },
  { name: 'blue', hex: '#3B82F6' },
];

// Custom node component
const CustomNode = ({ data, selected }) => {
  const colorConfig = COLOR_PALETTE[data.color] || COLOR_PALETTE.blue;
  const isCircle = data.shape === 'circle';

  return (
    <div
      className={`
        relative px-6 py-4 min-w-[80px] text-center font-medium shadow-lg cursor-pointer
        ${colorConfig.bg} ${colorConfig.text}
        ${isCircle ? 'rounded-full w-24 h-24 flex items-center justify-center' : 'rounded-xl'}
        ${selected ? 'ring-2 ring-offset-2 ring-blue-400' : ''}
        transition-all duration-200
      `}
      style={{ zIndex: 10 }}
    >
      {/* Connection handles - one per side */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="w-3 h-3 bg-white border-2 border-gray-300"
      />
      
      <span className="text-sm font-medium">{data.label}</span>
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 bg-white border-2 border-gray-300"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-3 h-3 bg-white border-2 border-gray-300"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 bg-white border-2 border-gray-300"
      />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

// Add New Node Modal
const AddNodeModal = ({ onAdd, onClose, defaultColor }) => {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(defaultColor || 'blue');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleAdd = () => {
    if (label.trim()) {
      onAdd({ label: label.trim(), color });
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Add New Node</h3>
        
        {/* Label Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter node name"
          />
        </div>
        
        {/* Color Picker */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-600 mb-2">Color</label>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.name}
                onClick={() => setColor(c.name)}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  color === c.name ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!label.trim()}
            className="flex-1 px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Node Modal
const EditNodeModal = ({ node, onSave, onClose }) => {
  const [label, setLabel] = useState(node?.data?.label || '');
  const [color, setColor] = useState(node?.data?.color || 'blue');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    onSave(node.id, { label, color });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Node</h3>
        
        {/* Label Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Node name"
          />
        </div>
        
        {/* Color Picker */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-600 mb-2">Color</label>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.name}
                onClick={() => setColor(c.name)}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  color === c.name ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Floating toolbar for selected node
const NodeToolbar = ({ node, position, onDelete, onEdit }) => {
  if (!node || !position) return null;
  
  return (
    <div 
      className="absolute z-50 flex items-center gap-1 bg-white rounded-lg shadow-lg px-2 py-1.5 border border-gray-200"
      style={{ 
        left: position.x, 
        top: position.y - 50,
        transform: 'translateX(-50%)'
      }}
    >
      <button 
        onClick={() => onEdit(node)}
        className="p-1.5 hover:bg-blue-50 rounded-md transition-colors"
        title="Edit"
      >
        <Pencil size={16} className="text-blue-500" />
      </button>
      <button 
        onClick={() => onDelete(node.id)}
        className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
        title="Delete"
      >
        <Trash2 size={16} className="text-red-500" />
      </button>
    </div>
  );
};

// Top Header Bar
const HeaderBar = ({ title, onBack, onSave, onExport, onTitleChange, onShowMindmaps, isSaving, saveSuccess }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title || '');
  const titleInputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Update local state when title prop changes
  useEffect(() => {
    setEditTitle(title || '');
  }, [title]);

  const handleTitleSubmit = () => {
    if (editTitle.trim()) {
      onTitleChange(editTitle.trim());
    } else {
      setEditTitle(title || 'Untitled');
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditTitle(title || '');
      setIsEditingTitle(false);
    }
  };
  
  return (
    <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
      {/* Logo and Title */}
      <div className="flex items-center gap-2 bg-white rounded-lg shadow-md px-3 py-2 border border-gray-200">
        <button 
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          title="Back to Dashboard"
        >
          <Network size={18} className="text-white" />
        </button>
        
        {/* Editable Title */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyDown}
            className="font-medium text-gray-800 text-sm bg-gray-100 px-2 py-1 rounded border border-gray-300 outline-none focus:border-blue-400 w-32"
          />
        ) : (
          <span className="font-medium text-gray-800 text-sm">{title || 'Untitled'}</span>
        )}
        
        {/* Options Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical size={16} className="text-gray-500" />
          </button>
          
          {showOptionsMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
              <button 
                onClick={() => { setIsEditingTitle(true); setShowOptionsMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm text-gray-700"
              >
                <Pencil size={16} />
                Rename
              </button>
              <button 
                onClick={() => { onShowMindmaps(); setShowOptionsMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm text-gray-700"
              >
                <FolderOpen size={16} />
                Load
              </button>
            </div>
          )}
        </div>
        
        {/* Export Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            title="Export"
          >
            <Share2 size={16} className="text-gray-500" />
          </button>
          
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
              <button 
                onClick={() => { onExport('pdf'); setShowExportMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm text-gray-700"
              >
                <FileText size={16} />
                Export PDF
              </button>
              <button 
                onClick={() => { onExport('image'); setShowExportMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm text-gray-700"
              >
                <FileImage size={16} />
                Export Image
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Save Button */}
      <button 
        onClick={onSave}
        disabled={isSaving}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-md border transition-colors ${
          saveSuccess 
            ? 'bg-green-500 text-white border-green-500' 
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        } disabled:opacity-50`}
        title="Save"
      >
        <Save size={16} />
        <span className="text-sm font-medium">{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}</span>
      </button>
    </div>
  );
};

// Mindmap Sidebar for loading other mindmaps
const MindmapSidebar = ({ isOpen, onClose, onSelectMindmap, currentMindmapId }) => {
  const [mindmaps, setMindmaps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchMindmaps = async () => {
        setIsLoading(true);
        try {
          const allItems = await getMindmaps();
          const filteredMindmaps = allItems.filter(item => item.contentType === 'mindmap');
          setMindmaps(filteredMindmaps);
        } catch (err) {
          console.error('Error fetching mindmaps:', err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMindmaps();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Sidebar */}
      <div 
        className="absolute right-0 top-0 h-full w-72 bg-gray-100 shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Saved Mindmaps</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        
        {/* Mindmap List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {isLoading ? (
            <div className="text-center text-gray-500 py-4">Loading...</div>
          ) : mindmaps.length === 0 ? (
            <div className="text-center text-gray-500 py-4">No mindmaps found</div>
          ) : (
            mindmaps.map((mindmap) => (
              <button
                key={mindmap.id}
                onClick={() => onSelectMindmap(mindmap)}
                className={`w-full bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${
                  mindmap.id === currentMindmapId ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
                }`}
              >
                {/* Preview Image */}
                <div className="w-full h-28 bg-gray-50 flex items-center justify-center">
                  {mindmap.data?.svgPreview ? (
                    <img 
                      src={mindmap.data.svgPreview} 
                      alt={mindmap.data?.title || 'Mindmap'} 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Network size={32} className="text-gray-300" />
                  )}
                </div>
                {/* Title */}
                <div className="px-3 py-2 text-left">
                  <span className="text-sm font-medium text-gray-700 truncate block">
                    {mindmap.data?.title || 'Untitled'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Bottom Floating Toolbar
const BottomToolbar = ({ 
  selectedColor, 
  onColorChange, 
  selectedShape, 
  onShapeChange, 
  onAddNode,
  onLayoutChange 
}) => {
  const [activeMenu, setActiveMenu] = useState(null);
  
  const toggleMenu = (menu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-40">
      {/* Color Picker Popup */}
      {activeMenu === 'colors' && (
        <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
          <div className="grid grid-cols-3 gap-1.5">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.name}
                onClick={() => { onColorChange(color.name); setActiveMenu(null); }}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  selectedColor === color.name ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Shape Picker Popup */}
      {activeMenu === 'shapes' && (
        <div className="absolute bottom-full mb-2 left-12 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => { onShapeChange('square'); setActiveMenu(null); }}
              className={`p-2 rounded-lg transition-colors ${
                selectedShape === 'square' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Rectangle"
            >
              <Square size={20} />
            </button>
            <button
              onClick={() => { onShapeChange('circle'); setActiveMenu(null); }}
              className={`p-2 rounded-lg transition-colors ${
                selectedShape === 'circle' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Circle"
            >
              <Circle size={20} />
            </button>
          </div>
        </div>
      )}
      
      {/* Layout Presets Popup */}
      {activeMenu === 'layouts' && (
        <div className="absolute bottom-full mb-2 right-0 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => { onLayoutChange('circle'); setActiveMenu(null); }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="Circle Layout"
            >
              <div className="w-6 h-6 border-2 border-gray-400 rounded-full" />
            </button>
            <button
              onClick={() => { onLayoutChange('tree'); setActiveMenu(null); }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="Tree Layout"
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>
      )}
      
      {/* Main Toolbar */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-2xl px-3 py-2 shadow-lg border border-gray-200">
        <button
          onClick={() => toggleMenu('colors')}
          className={`p-3 rounded-xl transition-colors ${
            activeMenu === 'colors' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
          }`}
          title="Colors"
        >
          <Palette size={20} className="text-gray-600" />
        </button>
        
        <button
          onClick={() => toggleMenu('shapes')}
          className={`p-3 rounded-xl transition-colors ${
            activeMenu === 'shapes' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
          }`}
          title="Shapes"
        >
          <Shapes size={20} className="text-gray-600" />
        </button>
        
        <button
          onClick={onAddNode}
          className="p-3 rounded-xl hover:bg-white/50 transition-colors"
          title="Add Node"
        >
          <Plus size={20} className="text-gray-600" />
        </button>
        
        <button
          onClick={() => toggleMenu('layouts')}
          className={`p-3 rounded-xl transition-colors ${
            activeMenu === 'layouts' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
          }`}
          title="Layouts"
        >
          <LayoutGrid size={20} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
};

const MindMapsNew = () => {
  const { id: slug } = useParams();
  const navigate = useNavigate();
  const { inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedShape, setSelectedShape] = useState('square');
  const [nextId, setNextId] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodePosition, setNodePosition] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showMindmapSidebar, setShowMindmapSidebar] = useState(false);
  
  const [currentMindmapId, setCurrentMindmapId] = useState(null);
  const [mindmapTitle, setMindmapTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const reactFlowRef = useRef(null);
  const hasLoadedInitialMindmap = useRef(false);

  // Delete node (defined early so other functions can use it)
  const deleteNode = useCallback((nodeId) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // Load a specific mindmap
  const loadMindmapById = useCallback(async (mindmap) => {
    try {
      setIsLoading(true);
      setShowMindmapSidebar(false);
      
      const data = mindmap.data;
      const nodesWithCallbacks = data.nodes.map(node => ({
        ...node,
        data: { ...node.data, onDelete: deleteNode }
      }));
      setNodes(nodesWithCallbacks);
      setEdges(data.edges || []);
      setCurrentMindmapId(mindmap.id);
      setMindmapTitle(data.title);
      
      // Calculate next ID
      const existingIds = data.nodes.map(node => {
        const match = node.id.match(/node-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      setNextId(Math.max(...existingIds, 0) + 1);
      
      // Update URL
      navigate(`/tools/maps/${mindmap.id}`, { replace: true });
    } catch (err) {
      console.error('Error loading mindmap:', err);
      setError('Failed to load mindmap');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setNodes, setEdges, deleteNode]);

  // Update node (name/color)
  const updateNode = useCallback((nodeId, updates) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            label: updates.label,
            color: updates.color,
          }
        };
      }
      return n;
    }));
    setSelectedNode(null);
  }, [setNodes]);

  // Load mindmap on mount
  useEffect(() => {
    if (slug && slug !== 'null' && !hasLoadedInitialMindmap.current && isAuthenticated && inProgress === InteractionStatus.None) {
      hasLoadedInitialMindmap.current = true;
      
      const loadMindmap = async () => {
        try {
          setIsLoading(true);
          const mindmap = await getMindmap(slug);
          const data = mindmap.data;
          
          const nodesWithCallbacks = data.nodes.map(node => ({
            ...node,
            data: { ...node.data, onDelete: deleteNode }
          }));
          setNodes(nodesWithCallbacks);
          setEdges(data.edges || []);
          setCurrentMindmapId(mindmap.id);
          setMindmapTitle(data.title);
          
          // Calculate next ID
          const existingIds = data.nodes.map(node => {
            const match = node.id.match(/node-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          });
          setNextId(Math.max(...existingIds, 0) + 1);
        } catch (err) {
          console.error('Error loading mindmap:', err);
          setError('Failed to load mindmap');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadMindmap();
    }
  }, [slug, isAuthenticated, inProgress, deleteNode]);

  // Add node with custom label/color
  const addNode = useCallback(({ label, color }) => {
    const newNode = {
      id: `node-${nextId}`,
      type: 'custom',
      position: { x: 400 + Math.random() * 100, y: 300 + Math.random() * 100 },
      data: {
        label: label,
        color: color,
        shape: selectedShape,
        onDelete: deleteNode,
        id: `node-${nextId}`,
      },
    };
    setNodes(nds => [...nds, newNode]);
    setNextId(nextId + 1);
  }, [nextId, selectedShape, deleteNode, setNodes]);

  // Connection handling
  const onConnect = useCallback((params) => {
    if (params.source === params.target) return;
    setEdges(eds => addEdge({
      ...params,
      style: { stroke: '#6B7280', strokeWidth: 2 },
      type: 'smoothstep',
    }, eds));
  }, [setEdges]);

  // Node click - show toolbar
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    const rect = event.target.getBoundingClientRect();
    const flowRect = reactFlowRef.current?.getBoundingClientRect();
    if (flowRect) {
      setNodePosition({
        x: rect.left - flowRect.left + rect.width / 2,
        y: rect.top - flowRect.top
      });
    }
  }, []);

  // Click on canvas - deselect
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodePosition(null);
  }, []);

  // Layout functions
  const applyLayout = useCallback((type) => {
    if (nodes.length === 0) return;
    
    const centerX = 400;
    const centerY = 300;
    const radius = 150;
    
    if (type === 'circle') {
      const arrangedNodes = nodes.map((node, index) => {
        const angle = (index * 2 * Math.PI) / nodes.length;
        return {
          ...node,
          position: {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          },
        };
      });
      setNodes(arrangedNodes);
    } else if (type === 'tree') {
      const arrangedNodes = nodes.map((node, index) => {
        const level = Math.floor(index / 3);
        const posInLevel = index % 3;
        return {
          ...node,
          position: {
            x: centerX + (posInLevel - 1) * 180,
            y: 100 + level * 120,
          },
        };
      });
      setNodes(arrangedNodes);
    }
  }, [nodes, setNodes]);

  // Export functions
  const handleExport = useCallback(async (type) => {
    if (!reactFlowRef.current || nodes.length === 0) return;
    
    try {
      const element = reactFlowRef.current.querySelector('.react-flow__viewport');
      if (!element) return;
      
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        width: 1200,
        height: 800,
      });
      
      if (type === 'image') {
        const link = document.createElement('a');
        link.download = `${mindmapTitle || 'mindmap'}.png`;
        link.href = dataUrl;
        link.click();
      } else if (type === 'pdf') {
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const img = new Image();
        img.onload = () => {
          pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210);
          pdf.save(`${mindmapTitle || 'mindmap'}.pdf`);
        };
        img.src = dataUrl;
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [nodes, mindmapTitle]);

  // Save function
  const handleSave = useCallback(async () => {
    if (!slug || slug === 'null') return;
    
    try {
      setIsSaving(true);
      
      // Generate preview with proper bounds
      let previewImage = null;
      if (reactFlowRef.current && nodes.length > 0) {
        const nodesBounds = getNodesBounds(nodes);
        const padding = 50;
        const imageWidth = 800;
        const imageHeight = 600;
        
        // Calculate the viewport to fit all nodes
        const viewport = getViewportForBounds(
          nodesBounds,
          imageWidth,
          imageHeight,
          0.5, // min zoom
          2,   // max zoom
          padding
        );
        
        const element = reactFlowRef.current.querySelector('.react-flow__viewport');
        if (element) {
          previewImage = await toPng(element, {
            backgroundColor: '#ffffff',
            width: imageWidth,
            height: imageHeight,
            style: {
              width: `${imageWidth}px`,
              height: `${imageHeight}px`,
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            },
          });
        }
      }
      
      const mindmapData = {
        title: mindmapTitle || 'Untitled',
        slug,
        nodes: nodes.map(n => ({
          ...n,
          data: { ...n.data, onDelete: undefined }
        })),
        edges,
        svgPreview: previewImage,
        metadata: { updatedAt: new Date().toISOString() }
      };
      
      if (currentMindmapId) {
        await updateMindmap(currentMindmapId, mindmapData);
      } else {
        const mindmap = await getMindmap(slug);
        if (mindmap?.id) {
          setCurrentMindmapId(mindmap.id);
          await updateMindmap(mindmap.id, mindmapData);
        }
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [slug, mindmapTitle, nodes, edges, currentMindmapId]);

  return (
    <div className="w-full h-screen bg-gray-50 relative overflow-hidden">
      {/* Header */}
      <HeaderBar
        title={mindmapTitle}
        onBack={() => navigate('/tools/mind-maps')}
        onSave={handleSave}
        onExport={handleExport}
        onTitleChange={setMindmapTitle}
        onShowMindmaps={() => setShowMindmapSidebar(true)}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
      />
      
      {/* Canvas */}
      <div ref={reactFlowRef} className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          connectionMode="loose"
          fitView
        >
          <Controls position="bottom-left" style={{ marginBottom: '80px' }} />
          <Background variant="dots" gap={20} size={1} color="#d1d5db" />
        </ReactFlow>
        
        {/* Node Toolbar */}
        <NodeToolbar
          node={selectedNode}
          position={nodePosition}
          onDelete={deleteNode}
          onEdit={(node) => setEditingNode(node)}
        />
      </div>
      
      {/* Edit Node Modal */}
      {editingNode && (
        <EditNodeModal
          node={editingNode}
          onSave={updateNode}
          onClose={() => setEditingNode(null)}
        />
      )}
      
      {/* Add Node Modal */}
      {showAddNodeModal && (
        <AddNodeModal
          defaultColor={selectedColor}
          onAdd={addNode}
          onClose={() => setShowAddNodeModal(false)}
        />
      )}
      
      {/* Bottom Toolbar */}
      <BottomToolbar
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        selectedShape={selectedShape}
        onShapeChange={setSelectedShape}
        onAddNode={() => setShowAddNodeModal(true)}
        onLayoutChange={applyLayout}
      />
      
      {/* Mindmap Sidebar */}
      <MindmapSidebar
        isOpen={showMindmapSidebar}
        onClose={() => setShowMindmapSidebar(false)}
        onSelectMindmap={loadMindmapById}
        currentMindmapId={currentMindmapId}
      />
      
      {/* Loading/Error states */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default MindMapsNew;
