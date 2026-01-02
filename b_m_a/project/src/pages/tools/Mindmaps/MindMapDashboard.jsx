import { Network, Search, Trash, MoreVertical } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getMindmaps, deleteMindmap, createMindmap } from '../../../api/apiService';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';

const MindMapDashboard = () => {
    const { instance, inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [savedMindmaps, setSavedMindmaps] = useState([]);
    const [selectedMindmap, setSelectedMindmap] = useState(null);
    const [openModal, setOpenModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newMindmapTitle, setNewMindmapTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Search Logic to search through saved mindmaps
    const searchFilter = savedMindmaps.filter(mindmap => mindmap.data?.title.toLowerCase().includes(search.toLowerCase()));

    const fetchSavedMindmaps = useCallback(async () => {
        try {
        const allItems = await getMindmaps();
        const mindmaps = allItems.filter(item => item.contentType === 'mindmap');
        setSavedMindmaps(mindmaps);
        } catch (err) {
            console.error("Fetch Failed.", err);
        }
    }, []);

    const handleDeleteClick = (mindmap) => {
        setOpenModal(true);
        setSelectedMindmap(mindmap);
    }

    const handleConfirmDelete = async () => {
        try {
            await deleteMindmap(selectedMindmap.id);
            setSavedMindmaps(savedMindmaps.filter(mindmap => mindmap.id !== selectedMindmap.id));
        } catch (err) {
            console.err("Error deleting mindmap.");
        } finally {
            setOpenModal(false);
            setSelectedMindmap(null);
        }
    }

    const handleCreateMindmap = async () => {
        if (!newMindmapTitle.trim()) {
            return;
        }

        try {
            setIsCreating(true);
            const response = await createMindmap(newMindmapTitle);
            // Navigate to the new mindmap using its slug
            navigate(`/tools/maps/${response.slug}`);
        } catch (err) {
            console.error("Error creating mindmap:", err);
            alert("Failed to create mindmap. Please try again.");
        } finally {
            setIsCreating(false);
            setShowCreateModal(false);
            setNewMindmapTitle('');
        }
    }

  // Load saved mindmaps on component mount
  useEffect(() => {
        // Only fetch when MSAL is fully done initializing and user is logged in
        if (isAuthenticated && inProgress === InteractionStatus.None) {
            fetchSavedMindmaps();
        }
  }, [isAuthenticated, inProgress, fetchSavedMindmaps]);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-4 mb-8">
                <Network className="h-8 w-8 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Mind Maps</h1>
            </div>
            <div className="flex justify-between items-center mb-4 gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        placeholder="Search by title"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button className="rounded-lg border-1 border-gray-200 px-4 py-2 bg-white text-gray-900 text-bold shadow-lg">Filter</button>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="rounded-lg px-6 py-2 bg-blue-500 text-white text-bold shadow-lg hover:bg-blue-600">
                    + New Board
                </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Boards in this team ({savedMindmaps.length})</span>
                </div>
                <div className="bg-color-white px-6 py-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchFilter.map((mindmap) => (
                        <div 
                            key={mindmap.id} 
                            className="flex flex-col border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer bg-white"
                            onClick={() => navigate(`/tools/maps/${mindmap.id}`)}
                        >
                            {/* Preview Image */}
                            <div className="w-full h-48 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                                {mindmap.data?.svgPreview ? (
                                    <img 
                                        src={mindmap.data.svgPreview} 
                                        alt={mindmap.data?.title}
                                        className="w-full h-full object-contain p-2"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <Network className="h-12 w-12" />
                                        <span className="text-xs">No preview</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Card Content */}
                            <div className="p-4 flex justify-between items-center">
                                <h1 className="font-medium text-gray-900 truncate flex-1">
                                    {mindmap.data?.title}
                                </h1>
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(mindmap);
                                        }}
                                    >
                                        <Trash className="text-gray-400 rounded-lg p-1 hover:bg-red-50 w-6 h-6"/>
                                    </button>
                                    <button onClick={(e) => e.stopPropagation()}>
                                        <MoreVertical className="text-gray-400 w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {openModal && <ConfirmModal setOpenModal={setOpenModal} selectedMindmap={selectedMindmap}  onConfirm={handleConfirmDelete}/>}
            
            {/* Create Mindmap Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold mb-4">Create New Mind Map</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title
                            </label>
                            <input
                                type="text"
                                value={newMindmapTitle}
                                onChange={(e) => setNewMindmapTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isCreating) {
                                        handleCreateMindmap();
                                    }
                                }}
                                placeholder="Enter mindmap title..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewMindmapTitle('');
                                }}
                                disabled={isCreating}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateMindmap}
                                disabled={!newMindmapTitle.trim() || isCreating}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isCreating ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MindMapDashboard;
