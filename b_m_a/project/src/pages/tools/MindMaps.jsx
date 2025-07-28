import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Network as Network2, Plus, RotateCcw, Trash2, Download, Circle, Square } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

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

// Custom node component with Tailwind classes
const CustomNode = ({ data, selected }) => {
  const colorConfig = COLOR_PALETTE[data.color] || COLOR_PALETTE.blue;
  const isCircle = data.shape === 'circle';

  return (
    <div
      className={`
        relative px-4 py-3 min-w-[120px] text-center font-medium shadow-md
        ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}
        ${isCircle ? 'rounded-full aspect-square flex items-center justify-center' : 'rounded-lg'}
        ${selected ? 'ring-4 ring-offset-2 ring-blue-400' : 'border-2'}
      `}
    >
      {/* Delete button - only show when selected */}
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (data.onDelete) {
              data.onDelete(data.id);
            }
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer text-xs z-10 hover:bg-red-600 transition-colors"
          title="Delete node"
        >
          <Trash2 size={10} />
        </button>
      )}

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: COLOR_PALETTE[data.color]?.hex || COLOR_PALETTE.blue.hex }}
      />
      
      <div className="text-sm">{data.label}</div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: COLOR_PALETTE[data.color]?.hex || COLOR_PALETTE.blue.hex }}
      />
      
      <Handle
        type="source"
        position={Position.Left}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: COLOR_PALETTE[data.color]?.hex || COLOR_PALETTE.blue.hex }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-white"
        style={{ backgroundColor: COLOR_PALETTE[data.color]?.hex || COLOR_PALETTE.blue.hex }}
      />
    </div>
  );
};

// Define nodeTypes outside the component to fix React Flow warning
const nodeTypes = {
  custom: CustomNode,
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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [newNodeText, setNewNodeText] = useState('');
  const [selectedNodeColor, setSelectedNodeColor] = useState('blue');
  const [selectedEdgeColor, setSelectedEdgeColor] = useState('blue');
  const [selectedNodeShape, setSelectedNodeShape] = useState('square');
  const [nextId, setNextId] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const reactFlowRef = useRef(null);

  // Delete node function
  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
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

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { 
              stroke: COLOR_PALETTE[selectedEdgeColor]?.hex || COLOR_PALETTE.blue.hex, 
              strokeWidth: 3,
              strokeDasharray: '5,5',
            },
            type: 'smoothstep',
          },
          eds
        )
      );
    },
    [setEdges, selectedEdgeColor]
  );

  const addNode = () => {
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
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNewNodeText('');
    setNextId(nextId + 1);
  };

  const autoArrange = () => {
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
  };

  const hierarchicalArrange = () => {
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
  };

  const clearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  const exportAsImage = async () => {
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
  };

  const exportAsPDF = async () => {
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
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Network2 className="h-8 w-8 text-green-600" />
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

          {/* Edge Color */}
          <ControlSection title="Edge Color">
            <ColorPicker
              colors={COLOR_OPTIONS}
              selectedColor={selectedEdgeColor}
              onColorChange={setSelectedEdgeColor}
            />
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
                variant="green"
              >
                {isExporting ? 'Exporting...' : 'Image'}
              </ExportButton>
              <ExportButton
                onClick={exportAsPDF}
                disabled={isExporting}
                variant="orange"
              >
                PDF
              </ExportButton>
            </div>
          </ControlSection>

          {/* Delete Actions */}
          <ControlSection title="Delete">
            <button
              onClick={clearAll}
              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm flex items-center gap-1"
              title="Clear all nodes and edges"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          </ControlSection>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="bg-white rounded-lg shadow-sm h-[600px]">
        <div ref={reactFlowRef} className="w-full h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </div>

    </div>
  );
};

export default MindMaps;