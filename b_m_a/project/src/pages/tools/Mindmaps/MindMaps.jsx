import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Plus, 
  Palette, 
  Square, 
  Circle, 
  ArrowRight, 
  Trash2, 
  Download, 
  Upload,
  Save,
  FolderOpen,
  X,
  Network,
  RotateCcw
} from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { saveMindmap, getMindmaps, getMindmap, updateMindmap, deleteMindmap } from '../../../api/apiService';

// Custom CSS to override React Flow's selection border for groups
const groupStyles = `
  .react-flow__node-group.selected,
  .react-flow__node-group {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
    background-color: rgba(240, 240, 240, 0) !important;
  }
`;

// Color configuration
const COLOR_PALETTE = {
  blue: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-700', hex: '#3B82F6' },
  green: { bg: 'bg-green-500', text: 'text-white', border: 'border-green-700', hex: '#10B981' },
  purple: { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-700', hex: '#8B5CF6' },
  orange: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-700', hex: '#F59E0B' },
  red: { bg: 'bg-red-500', text: 'text-white', border: 'border-red-700', hex: '#EF4444' },
  gray: { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-700', hex: '#6B7280' },
};

const COLOR_OPTIONS = [
  { name: 'blue', color: '#3B82F6' },
  { name: 'green', color: '#10B981' },
  { name: 'purple', color: '#8B5CF6' },
  { name: 'orange', color: '#F59E0B' },
  { name: 'red', color: '#EF4444' },
  { name: 'gray', color: '#6B7280' },
];

// Custom node component
const CustomNode = ({ data, selected }) => {
  const colorConfig = COLOR_PALETTE[data.color] || COLOR_PALETTE.blue;
  const isCircle = data.shape === 'circle';
  const isArrowMode = data.isArrowMode;

  return (
    <div
      className={`
        relative px-4 py-3 min-w-[120px] text-center font-medium shadow-md cursor-pointer
        ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}
        ${isCircle ? 'rounded-full aspect-square flex items-center justify-center' : 'rounded-lg'}
        ${selected ? 'ring-4 ring-offset-2 ring-blue-400' : 'border-2'}
        ${isArrowMode ? 'ring-4 ring-offset-2 ring-green-400' : ''}
        hover:shadow-lg transition-all duration-200
      `}
      style={{ zIndex: 10 }} // Higher z-index to ensure nodes are selectable above groups
    >
      {/* Delete button - only show when selected */}
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            data.onDelete?.(data.id);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer text-xs z-10 hover:bg-red-600 transition-colors"
          title="Delete node"
        >
          <Trash2 size={10} />
        </button>
      )}

      {/* Arrow mode indicator */}
      {isArrowMode && (
        <div className="absolute -top-3 -left-3 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold z-20">
          <ArrowRight size={12} />
        </div>
      )}

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: colorConfig.hex }}
      />
      
      <div className="text-sm relative z-10">{data.label}</div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: colorConfig.hex }}
      />
      
      <Handle
        type="source"
        position={Position.Left}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: colorConfig.hex }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: colorConfig.hex }}
      />
    </div>
  );
};

// Group container component
const GroupContainer = ({ data }) => {
  const colorConfig = COLOR_PALETTE[data.color] || COLOR_PALETTE.blue;
  const [isEditing, setIsEditing] = useState(false);
  const [groupName, setGroupName] = useState(data.label || 'Group');
  
  const handleNameEdit = () => {
    data.onNameChange?.(groupName);
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    // Prevent keyboard shortcuts from affecting selected nodes
    e.stopPropagation();
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setGroupName(data.label || 'Group');
      setIsEditing(false);
    }
  };

  const handleInputFocus = (e) => {
    // Prevent any keyboard shortcuts when input is focused
    e.stopPropagation();
  };

  const handleInputBlur = (e) => {
    e.stopPropagation();
    handleNameEdit();
  };
  
  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-4
        ${colorConfig.border} bg-opacity-5 ${colorConfig.bg.replace('bg-', 'bg-')}
        transition-all duration-200
      `}
      style={{
        width: data.width || 300,
        height: data.height || 200,
        zIndex: -1, // Negative z-index to ensure it's behind everything
        pointerEvents: 'none', // Completely transparent to pointer events
        position: 'absolute', // Ensure it doesn't affect layout
      }}
    >
      {/* Group label - editable */}
      <div 
        className="absolute -top-3 left-4 px-2 bg-white text-sm font-medium text-gray-700 border border-gray-300 rounded pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 15 }} // Higher z-index for the label
      >
        {isEditing ? (
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyPress}
            onFocus={handleInputFocus}
            className="w-20 text-sm border-none outline-none bg-transparent"
            autoFocus
          />
        ) : (
          <span 
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="cursor-pointer hover:text-blue-600"
            title="Click to edit group name"
          >
            {groupName}
          </span>
        )}
      </div>
      
      {/* Delete button for individual group */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          data.onDelete?.(data.id);
        }}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer text-xs z-10 hover:bg-red-600 transition-colors pointer-events-auto"
        title="Delete this group"
        style={{ zIndex: 15 }} // Higher z-index for the delete button
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
};

// Define nodeTypes outside the component
const nodeTypes = {
  custom: CustomNode,
  group: GroupContainer,
};

// Control panel section component
const ControlSection = ({ title, children, className = "" }) => (
  <div className={`w-auto ${className}`}>
    <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
    {children}
  </div>
);

// Color picker component
const ColorPicker = ({ colors, selectedColor, onColorChange, className = "" }) => (
  <div className={`flex gap-1 ${className}`}>
    {colors.map((color) => (
      <button
        key={color.name}
        onClick={() => onColorChange(color.name)}
        className={`
          w-8 h-8 rounded-full border-2 transition-colors
          ${selectedColor === color.name ? 'border-gray-800' : 'border-gray-300 hover:border-gray-400'}
        `}
        style={{ backgroundColor: color.color }}
        title={color.name}
      />
    ))}
  </div>
);

// Shape picker component
const ShapePicker = ({ selectedShape, onShapeChange }) => (
  <div className="flex gap-2">
    <button
      onClick={() => onShapeChange('square')}
      className={`
        px-3 py-2 rounded-md text-sm flex items-center gap-1 transition-colors
        ${selectedShape === 'square' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }
      `}
      title="Square nodes"
    >
      <Square className="h-4 w-4" />
      Square
    </button>
    <button
      onClick={() => onShapeChange('circle')}
      className={`
        px-3 py-2 rounded-md text-sm flex items-center gap-1 transition-colors
        ${selectedShape === 'circle' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }
      `}
      title="Circle nodes"
    >
      <Circle className="h-4 w-4" />
      Circle
    </button>
  </div>
);

// Export button component
const ExportButton = ({ onClick, disabled, children, variant = "green", className = "" }) => {
  const baseClasses = "px-3 py-2 text-white rounded-md text-sm flex items-center gap-1 transition-colors";
  const variantClasses = {
    green: "bg-green-600 hover:bg-green-700",
    orange: "bg-orange-600 hover:bg-orange-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    purple: "bg-purple-600 hover:bg-purple-700",
    disabled: "bg-gray-400 cursor-not-allowed"
  };
  
  const classes = disabled ? variantClasses.disabled : variantClasses[variant];
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${classes} ${className}`}
    >
      <Download className="h-4 w-4" />
      {children}
    </button>
  );
};

const MindMaps = () => {
  const { id: slug } = useParams(); // Get the mindmap slug from the URL
  const { inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [newNodeText, setNewNodeText] = useState('');
  const [selectedNodeColor, setSelectedNodeColor] = useState('blue');
  const [selectedNodeShape, setSelectedNodeShape] = useState('square');
  const [nextId, setNextId] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [arrowMode, setArrowMode] = useState(false);
  const [firstSelectedNode, setFirstSelectedNode] = useState(null);
  const [groupMode, setGroupMode] = useState(false);
  const [selectedNodesForGroup, setSelectedNodesForGroup] = useState([]);
  const [groupNodeMap, setGroupNodeMap] = useState(new Map());
  
  // Mindmap save/load state
  const [savedMindmaps, setSavedMindmaps] = useState([]);
  const [currentMindmapId, setCurrentMindmapId] = useState(null);
  const [mindmapTitle, setMindmapTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  
  const reactFlowRef = useRef(null);
  const hasLoadedInitialMindmap = useRef(false);

  // Inject custom CSS
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = groupStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Load mindmap on mount if ID is provided in URL
  useEffect(() => {
    // Skip if slug is null, undefined, or the literal string "null"
    if (slug && slug !== 'null' && !hasLoadedInitialMindmap.current && isAuthenticated && inProgress === InteractionStatus.None) {
      hasLoadedInitialMindmap.current = true;
      // Use a direct call to avoid dependency issues
      const loadInitialMindmap = async () => {
        try {
          setIsLoading(true);
          setError('');
          
          const mindmap = await getMindmap(slug);
          const data = mindmap.data;
          
          // Load nodes with proper delete functionality
          const nodesWithDelete = data.nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              onDelete: deleteNode
            }
          }));
          setNodes(nodesWithDelete);
          
          // Load edges
          setEdges(data.edges);
          
          // Load groups
          if (data.groups) {
            setGroupNodeMap(new Map(data.metadata?.groupNodeMap || []));
          }
          
          // Set current mindmap info (use the actual mindmap ID, not the slug)
          setCurrentMindmapId(mindmap.id);
          setMindmapTitle(data.title);
        } catch (err) {
          console.error('Error loading mindmap:', err);
          setError('Failed to load mindmap');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadInitialMindmap();
    }
  }, [slug, isAuthenticated, inProgress]); // Only re-run if slug or auth status changes

  // Delete node function
  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => {
      const filteredNodes = nds.filter((node) => node.id !== nodeId);
      
      // If deleting a group, remove from group mappings
      const deletedNode = nds.find(n => n.id === nodeId);
      if (deletedNode?.type === 'group') {
        setGroupNodeMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(nodeId);
          return newMap;
        });
      }
      
      return filteredNodes;
    });
    
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    
    // Clean up group mappings when regular nodes are deleted
    setGroupNodeMap(prev => {
      const newMap = new Map(prev);
      newMap.forEach((nodeIds, groupId) => {
        const updatedNodeIds = nodeIds.filter(id => id !== nodeId);
        if (updatedNodeIds.length === 0) {
          newMap.delete(groupId);
        } else {
          newMap.set(groupId, updatedNodeIds);
        }
      });
      return newMap;
    });
  }, [setNodes, setEdges]);

  // Delete edge function
  const deleteEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  // Keyboard shortcuts for delete
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(node => node.selected);
        const selectedEdges = edges.filter(edge => edge.selected);

        selectedNodes.forEach(node => deleteNode(node.id));
        selectedEdges.forEach(edge => deleteEdge(edge.id));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, deleteNode, deleteEdge]);

  // Connection handling
  const onConnect = useCallback(
    (params) => {
      if (params.source === params.target) return;

      const connectionExists = edges.some(
        edge => edge.source === params.source && edge.target === params.target
      );

      if (connectionExists) return;

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { stroke: '#6B7280', strokeWidth: 2 },
            type: 'smoothstep',
          },
          eds
        )
      );
    },
    [setEdges, edges]
  );

  // Create group from selected nodes
  const createGroup = useCallback(() => {
    if (selectedNodesForGroup.length < 2) {
      alert('Please select at least 2 nodes to create a group.');
      return;
    }

    // Calculate group bounds more precisely
    const minX = Math.min(...selectedNodesForGroup.map(n => n.position.x));
    const maxX = Math.max(...selectedNodesForGroup.map(n => n.position.x));
    const minY = Math.min(...selectedNodesForGroup.map(n => n.position.y));
    const maxY = Math.max(...selectedNodesForGroup.map(n => n.position.y));

    // Add more padding around nodes to prevent edges from going over border
    const padding = 40;
    const groupWidth = maxX - minX + 200; // 120px node width + 80px padding
    const groupHeight = maxY - minY + 160; // 60px node height + 100px padding
    const groupX = minX - padding;
    const groupY = minY - padding;

    const groupId = `group-${nextId}`;

    const groupNode = {
      id: groupId,
      type: 'group',
      position: { x: groupX, y: groupY },
      draggable: false,
      selectable: false,
      data: {
        label: `Group ${nextId}`,
        color: selectedNodeColor,
        width: groupWidth,
        height: groupHeight,
        onDelete: deleteNode,
        onNameChange: (newName) => {
          setNodes((nds) => 
            nds.map(n => 
              n.id === groupId 
                ? { ...n, data: { ...n.data, label: newName } }
                : n
            )
          );
        },
        id: groupId,
      },
    };

    // Deselect all nodes when creating group to prevent selection issues
    setNodes((nds) => {
      const deselectedNodes = nds.map(n => ({ ...n, selected: false }));
      return [...deselectedNodes, groupNode];
    });
    
    setGroupNodeMap(prev => {
      const newMap = new Map(prev);
      newMap.set(groupId, selectedNodesForGroup.map(n => n.id));
      return newMap;
    });
    
    setNextId(nextId + 1);
    setSelectedNodesForGroup([]);
    setGroupMode(false);
  }, [selectedNodesForGroup, nextId, selectedNodeColor, deleteNode, setNodes]);

  // Add new node
  const addNode = useCallback(() => {
    if (!newNodeText.trim()) return;

    const newNode = {
      id: `node-${nextId}`,
      type: 'custom',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: newNodeText,
        color: selectedNodeColor,
        shape: selectedNodeShape,
        onDelete: deleteNode,
        id: `node-${nextId}`,
        isArrowMode: false,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNewNodeText('');
    setNextId(nextId + 1);
  }, [newNodeText, nextId, selectedNodeColor, selectedNodeShape, deleteNode, setNodes]);

  // Layout functions
  const autoArrange = useCallback(() => {
    if (nodes.length === 0) return;

    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    const arrangedNodes = nodes.map((node, index) => {
      const angle = (index * 2 * Math.PI) / nodes.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      return { ...node, position: { x, y } };
    });

    setNodes(arrangedNodes);
  }, [nodes, setNodes]);

  const hierarchicalArrange = useCallback(() => {
    if (nodes.length === 0) return;

    const rootNode = nodes[0];
    const otherNodes = nodes.slice(1);
    
    const arrangedNodes = [rootNode];
    
    otherNodes.forEach((node, index) => {
      const level = Math.floor(index / 3) + 1;
      const positionInLevel = index % 3;
      
      const x = rootNode.position.x + (positionInLevel - 1) * 200;
      const y = rootNode.position.y + level * 150;
      
      arrangedNodes.push({ ...node, position: { x, y } });
    });

    setNodes(arrangedNodes);
  }, [nodes, setNodes]);

  // Update group positions when nodes move
  const updateGroupPositions = useCallback(() => {
    setNodes((nds) => {
      const updatedNodes = [...nds];
      
      groupNodeMap.forEach((nodeIds, groupId) => {
        const groupNode = updatedNodes.find(n => n.id === groupId);
        if (!groupNode) return;
        
        const groupNodes = updatedNodes.filter(n => nodeIds.includes(n.id));
        if (groupNodes.length === 0) return;
        
        // Calculate new group bounds
        const minX = Math.min(...groupNodes.map(n => n.position.x));
        const maxX = Math.max(...groupNodes.map(n => n.position.x));
        const minY = Math.min(...groupNodes.map(n => n.position.y));
        const maxY = Math.max(...groupNodes.map(n => n.position.y));
        
        const padding = 40;
        const groupWidth = maxX - minX + 200;
        const groupHeight = maxY - minY + 160;
        const groupX = minX - padding;
        const groupY = minY - padding;
        
        // Update group position and size
        const groupIndex = updatedNodes.findIndex(n => n.id === groupId);
        if (groupIndex !== -1) {
          updatedNodes[groupIndex] = {
            ...updatedNodes[groupIndex],
            position: { x: groupX, y: groupY },
            data: {
              ...updatedNodes[groupIndex].data,
              width: groupWidth,
              height: groupHeight,
            },
          };
        }
      });
      
      return updatedNodes;
    });
  }, [groupNodeMap, setNodes]);

  // Clear all
  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setFirstSelectedNode(null);
    setSelectedNodesForGroup([]);
    setGroupNodeMap(new Map());
    setRenderKey(prev => prev + 1); // Force re-render
  }, [setNodes, setEdges]);

  // Export functions
  const exportAsImage = useCallback(async () => {
    if (!reactFlowRef.current || nodes.length === 0) {
      alert('Please add some nodes to your mindmap before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      const reactFlowElement = reactFlowRef.current.querySelector('.react-flow__viewport');
      
      if (reactFlowElement) {
        const dataUrl = await toPng(reactFlowElement, {
          backgroundColor: '#ffffff',
          width: 1200,
          height: 800,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          },
        });

        const link = document.createElement('a');
        link.download = 'mindmap.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Failed to export image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [nodes]);

  const exportAsPDF = useCallback(async () => {
    if (!reactFlowRef.current || nodes.length === 0) {
      alert('Please add some nodes to your mindmap before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      const reactFlowElement = reactFlowRef.current.querySelector('.react-flow__viewport');
      
      if (reactFlowElement) {
        const dataUrl = await toPng(reactFlowElement, {
          backgroundColor: '#ffffff',
          width: 1200,
          height: 800,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          },
        });

        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const imgWidth = 297;
        const imgHeight = 210;
        const img = new Image();
        
        img.onload = () => {
          pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
          pdf.save('mindmap.pdf');
        };
        
        img.src = dataUrl;
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [nodes]);

  // Node click handling
  const onNodeClick = useCallback((event, node) => {
    if (node.type === 'group') {
      event.stopPropagation();
      return;
    }

    if (arrowMode) {
      event.stopPropagation();
      
      if (!firstSelectedNode) {
        setFirstSelectedNode(node);
        setNodes((nds) => 
          nds.map(n => ({
            ...n,
            data: { ...n.data, isArrowMode: n.id === node.id }
          }))
        );
      } else if (firstSelectedNode.id !== node.id) {
        const newEdge = {
          id: `arrow-${firstSelectedNode.id}-${node.id}-${Date.now()}`,
          source: firstSelectedNode.id,
          target: node.id,
          style: { 
            stroke: '#EF4444',
            strokeWidth: 3,
            markerEnd: {
              type: 'arrowclosed',
              width: 20,
              height: 20,
              color: '#EF4444',
            },
          },
          type: 'smoothstep',
        };

        setEdges((eds) => [...eds, newEdge]);
        setFirstSelectedNode(null);
        setNodes((nds) => 
          nds.map(n => ({
            ...n,
            data: { ...n.data, isArrowMode: false }
          }))
        );
      }
    } else if (groupMode) {
      event.stopPropagation();
      setSelectedNodesForGroup(prev => {
        const isSelected = prev.find(n => n.id === node.id);
        return isSelected 
          ? prev.filter(n => n.id !== node.id)
          : [...prev, node];
      });
    }
  }, [arrowMode, firstSelectedNode, groupMode, setEdges, setNodes]);

  // Update group positions when nodes change
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    setTimeout(updateGroupPositions, 0);
  }, [onNodesChange, updateGroupPositions]);

  // Mindmap Save/Load Functions
  const fetchSavedMindmaps = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Add a small delay to ensure MSAL is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const allItems = await getMindmaps();
      
      // Filter for actual mindmaps (contentType === 'mindmap')
      const mindmaps = allItems.filter(item => item.contentType === 'mindmap');
      
      setSavedMindmaps(mindmaps);
    } catch (err) {
      console.error('Error fetching mindmaps:', err);
      if (err.message && err.message.includes('uninitialized_public_client_application')) {
        console.log('MSAL not ready, will retry in 2 seconds...');
        // Retry after a delay
        setTimeout(() => {
          fetchSavedMindmaps();
        }, 2000);
        return;
      }
      setError('Failed to load saved mindmaps. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Export as image string for preview
  const exportAsPreviewImage = useCallback(async () => {
    if (!reactFlowRef.current || nodes.length === 0) {
      return null;
    }

    try {
      const reactFlowElement = reactFlowRef.current.querySelector('.react-flow__viewport');
      
      if (reactFlowElement) {
        // Use PNG for better compatibility and quality
        const imageDataUrl = await toPng(reactFlowElement, {
          backgroundColor: '#ffffff',
          width: 800,
          height: 600,
          quality: 0.8,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          },
        });
        return imageDataUrl;
      }
    } catch (error) {
      console.error('Error exporting preview image:', error);
    }
    return null;
  }, [nodes]);

  const saveCurrentMindmap = useCallback(async () => {
    // Use slug from URL to identify the mindmap
    if (!slug || slug === 'null') {
      setError('No mindmap loaded to save');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      
      // Generate preview image
      const previewImage = await exportAsPreviewImage();
      
      // Prepare mindmap data
      const mindmapData = {
        title: mindmapTitle || 'Untitled Mindmap',
        slug: slug, // Keep the same slug
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            ...node.data,
            onDelete: undefined // Don't save function references
          }
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          style: edge.style,
          type: edge.type
        })),
        groups: nodes.filter(node => node.type === 'group').map(node => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            ...node.data,
            onDelete: undefined,
            onNameChange: undefined
          }
        })),
        svgPreview: previewImage,
        metadata: {
          groupNodeMap: Array.from(groupNodeMap.entries()),
          updatedAt: new Date().toISOString()
        }
      };

      // Use currentMindmapId if available, otherwise fetch by slug first
      if (currentMindmapId) {
        await updateMindmap(currentMindmapId, mindmapData);
      } else {
        // Fetch the mindmap by slug to get the ID, then update
        const existingMindmap = await getMindmap(slug);
        if (existingMindmap && existingMindmap.id) {
          setCurrentMindmapId(existingMindmap.id);
          await updateMindmap(existingMindmap.id, mindmapData);
        } else {
          throw new Error('Could not find mindmap to update');
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving mindmap:', err);
      setError('Failed to save mindmap');
    } finally {
      setIsSaving(false);
    }
  }, [slug, mindmapTitle, nodes, edges, groupNodeMap, currentMindmapId, exportAsPreviewImage]);

  const loadMindmap = useCallback(async (mindmapId) => {
    try {
      setIsLoading(true);
      setError('');
      
      const mindmap = await getMindmap(mindmapId);
      const data = mindmap.data;
      
      // Load nodes with proper delete functionality
      const nodesWithDelete = data.nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onDelete: deleteNode // Attach the delete function
        }
      }));
      setNodes(nodesWithDelete);
      
      // Load edges
      setEdges(data.edges);
      
      // Load groups
      if (data.groups) {
        setGroupNodeMap(new Map(data.metadata?.groupNodeMap || []));
      }
      
      // Set current mindmap info
      setCurrentMindmapId(mindmapId);
      setMindmapTitle(data.title);
      
      setShowLoadDialog(false);
    } catch (err) {
      console.error('Error loading mindmap:', err);
      setError('Failed to load mindmap');
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges, deleteNode]);

  const deleteSavedMindmap = useCallback(async (mindmapId) => {
    try {
      await deleteMindmap(mindmapId);
      await fetchSavedMindmaps();
      
      // If we deleted the currently loaded mindmap, clear the current state
      if (mindmapId === currentMindmapId) {
        setCurrentMindmapId(null);
        setMindmapTitle('');
      }
    } catch (err) {
      console.error('Error deleting mindmap:', err);
      setError('Failed to delete mindmap');
    }
  }, [currentMindmapId, fetchSavedMindmaps]);

  const clearCurrentMindmap = useCallback(() => {
    // Clear all nodes and edges
    setNodes([]);
    setEdges([]);
    
    // Clear group mappings
    setGroupNodeMap(new Map());
    
    // Clear current mindmap state
    setCurrentMindmapId(null);
    setMindmapTitle('');
    
    // Reset next ID
    setNextId(1);
    
    // Clear any selection states
    setFirstSelectedNode(null);
    setSelectedNodesForGroup([]);
    setGroupMode(false);
    setArrowMode(false);
    
    // Force React Flow to completely re-render
    setRenderKey(prev => prev + 1);
    
    // Force React Flow to re-render by using setTimeout
    setTimeout(() => {
      setNodes([]);
      setEdges([]);
    }, 0);
  }, [setNodes, setEdges, nodes.length, edges.length]);

  // Load saved mindmaps on component mount
  useEffect(() => {
    // Only fetch mindmaps if MSAL is initialized
    const checkAndFetchMindmaps = async () => {
      try {
        // Wait a bit for MSAL to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchSavedMindmaps();
      } catch (error) {
        console.log('MSAL not ready yet, will retry later');
        // Retry after a longer delay
        setTimeout(checkAndFetchMindmaps, 2000);
      }
    };
    
    // Only try to fetch if we're authenticated
    const checkAuthAndFetch = () => {
      // Check if we have an active account (simple check)
      const hasActiveAccount = document.cookie.includes('msal') || 
                              localStorage.getItem('msal') || 
                              sessionStorage.getItem('msal');
      
      if (hasActiveAccount) {
        checkAndFetchMindmaps();
      } else {
        // Wait longer and try again
        setTimeout(checkAuthAndFetch, 3000);
      }
    };
    
    checkAuthAndFetch();
  }, [fetchSavedMindmaps]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Network className="h-8 w-8 text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">Mind Maps</h1>
      </div>

      {/* Control Panel */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <div className="flex flex-wrap items-start gap-8">
          {/* Node Color */}
          <ControlSection title="Node Color">
            <ColorPicker
              colors={COLOR_OPTIONS}
              selectedColor={selectedNodeColor}
              onColorChange={setSelectedNodeColor}
            />
          </ControlSection>

          {/* Node Shape */}
          <ControlSection title="Node Shape">
            <ShapePicker
              selectedShape={selectedNodeShape}
              onShapeChange={setSelectedNodeShape}
            />
          </ControlSection>

          {/* Add Node */}
          <ControlSection title="Add New Node" className="flex-1 min-w-[250px] max-w-[300px]">
            <div className="flex gap-2">
              <input
                type="text"
                value={newNodeText}
                onChange={(e) => setNewNodeText(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter node text"
                onKeyPress={(e) => e.key === 'Enter' && addNode()}
              />
              <button
                onClick={addNode}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </ControlSection>

          {/* Group Controls */}
          {groupMode && (
            <ControlSection title="Group Actions">
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-600">
                  Selected: {selectedNodesForGroup.length} nodes
                </p>
                <button
                  onClick={createGroup}
                  disabled={selectedNodesForGroup.length < 2}
                  className={`
                    px-3 py-2 rounded-md text-sm flex items-center gap-1 transition-colors
                    ${selectedNodesForGroup.length >= 2 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  <FolderOpen className="h-4 w-4" />
                  Create Group
                </button>
              </div>
            </ControlSection>
          )}

          {/* Arrow Mode */}
          <ControlSection title="Arrow Mode">
            <button
              onClick={() => {
                const newMode = !arrowMode;
                setArrowMode(newMode);
                if (!newMode) {
                  setFirstSelectedNode(null);
                  setNodes((nds) => 
                    nds.map(n => ({
                      ...n,
                      data: { ...n.data, isArrowMode: false }
                    }))
                  );
                }
                if (newMode && groupMode) {
                  setGroupMode(false);
                  setSelectedNodesForGroup([]);
                }
              }}
              className={`
                px-3 py-2 rounded-md text-sm flex items-center gap-1 transition-colors
                ${arrowMode 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }
              `}
            >
              <ArrowRight className="h-4 w-4" />
              {arrowMode ? 'ON' : 'OFF'}
            </button>
          </ControlSection>

          {/* Group Mode */}
          <ControlSection title="Group Mode">
            <button
              onClick={() => {
                const newMode = !groupMode;
                setGroupMode(newMode);
                if (!newMode) {
                  setSelectedNodesForGroup([]);
                }
                if (newMode && arrowMode) {
                  setArrowMode(false);
                  setFirstSelectedNode(null);
                  setNodes((nds) => 
                    nds.map(n => ({
                      ...n,
                      data: { ...n.data, isArrowMode: false }
                    }))
                  );
                }
              }}
              className={`
                px-3 py-2 rounded-md text-sm flex items-center gap-1 transition-colors
                ${groupMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }
              `}
            >
              <FolderOpen className="h-4 w-4" />
              {groupMode ? 'ON' : 'OFF'}
            </button>
          </ControlSection>

          {/* Layout Actions */}
          <ControlSection title="Layout">
            <div className="flex gap-2">
              <button
                onClick={autoArrange}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
                title="Arrange nodes in a circle"
              >
                <RotateCcw className="h-4 w-4" />
                Circle
              </button>
              <button
                onClick={hierarchicalArrange}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
                title="Arrange nodes hierarchically"
              >
                Tree
              </button>
            </div>
          </ControlSection>

          {/* Export Actions */}
          <ControlSection title="Export">
            <div className="flex gap-2">
              <ExportButton
                onClick={exportAsImage}
                disabled={isExporting}
                variant="blue"
              >
                {isExporting ? 'Exporting...' : 'Image'}
              </ExportButton>
              <ExportButton
                onClick={exportAsPDF}
                disabled={isExporting}
                variant="purple"
              >
                PDF
              </ExportButton>
            </div>
          </ControlSection>

          {/* Delete Actions */}
          <ControlSection title="Delete">
            <div className="flex flex-col gap-2">
              <button
                onClick={clearAll}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm flex items-center gap-1"
                title="Clear all nodes and edges"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </button>
              {groupNodeMap.size > 0 && (
                <button
                  onClick={() => {
                    setNodes((nds) => nds.filter(n => n.type !== 'group'));
                    setGroupNodeMap(new Map());
                  }}
                  className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm flex items-center gap-1"
                  title="Delete all groups"
                >
                  <FolderOpen className="h-4 w-4" />
                  Delete Groups
                </button>
              )}
            </div>
          </ControlSection>

          {/* Save/Load Actions */}
          <ControlSection title="Save/Load">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Clear current mindmap and start fresh
                  setCurrentMindmapId(null);
                  setMindmapTitle('');
                  setNodes([]);
                  setEdges([]);
                  setGroupNodeMap(new Map());
                  setRenderKey(prev => prev + 1);
                }}
                className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm flex items-center gap-1"
                title="Start new mindmap"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
              <button
                onClick={saveCurrentMindmap}
                disabled={!slug || slug === 'null' || isSaving}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save current mindmap"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save')}
              </button>
              <button
                onClick={() => {
                  setShowLoadDialog(true);
                  fetchSavedMindmaps(); // Fetch mindmaps when dialog is opened
                }}
                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm flex items-center gap-1"
                title="Load saved mindmap"
              >
                <Upload className="h-4 w-4" />
                Load
              </button>
            </div>
          </ControlSection>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="bg-white rounded-lg shadow-sm h-[600px]">
        <div ref={reactFlowRef} className="w-full h-full">
          <ReactFlow
            key={`mindmap-${renderKey}`}
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </div>

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Save Mindmap</h3>
            <input
              type="text"
              value={mindmapTitle}
              onChange={(e) => setMindmapTitle(e.target.value)}
              placeholder="Enter mindmap title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            {saveSuccess && <p className="text-green-600 text-sm mb-4">Mindmap saved successfully!</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setError('');
                  setMindmapTitle('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentMindmap}
                disabled={isSaving || !mindmapTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog Modal */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Load Mindmap</h3>
              <button
                onClick={fetchSavedMindmaps}
                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                title="Refresh mindmap list"
              >
                ↻
              </button>
            </div>
            {isLoading ? (
              <p className="text-gray-600">Loading...</p>
            ) : savedMindmaps.length === 0 ? (
              <p className="text-gray-600">No saved mindmaps found.</p>
            ) : (
              <div className="space-y-2">
                {savedMindmaps.map((mindmap) => (
                  <div
                    key={mindmap.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{mindmap.data?.title || 'Untitled Mindmap'}</h4>
                      <p className="text-sm text-gray-500">
                        {mindmap.createdAt ? new Date(mindmap.createdAt).toLocaleDateString() : 'Unknown date'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadMindmap(mindmap.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteSavedMindmap(mindmap.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowLoadDialog(false);
                  setError('');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MindMaps;