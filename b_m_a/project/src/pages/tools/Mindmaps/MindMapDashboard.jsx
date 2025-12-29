import { Network, Search, Trash, MoreVertical, Star } from 'lucide-react';
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
    const [favorites, setFavorites] = useState(new Set());

    // Search Logic to search through saved mindmaps
    const searchFilter = savedMindmaps.filter(mindmap => mindmap.data?.title.toLowerCase().includes(search.toLowerCase()));

    const toggleFavorite = (e, mindmapId) => {
        e.stopPropagation();
        setFavorites(prev => {
            const newFavorites = new Set(prev);
            if (newFavorites.has(mindmapId)) {
                newFavorites.delete(mindmapId);
            } else {
                newFavorites.add(mindmapId);
            }
            return newFavorites;
        });
    };


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
            // Navigate to the new mindmap using its ID
            navigate(`/tools/maps/${response.id}`);
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
        <div className="h-screen overflow-hidden bg-gray-50">
            {/* Header */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex items-center gap-3">
                            <Network className="h-9 w-9 text-green-600" />
                            <h1 className="text-3xl font-semibold text-gray-900">MindMaps</h1>
                        </div>
                </div>
            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="mb-4 flex items-center gap-2 flex-1 max-w-2xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                            className="w-full pl-10 bg-white pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            placeholder="Search by title..."
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <select className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option>All Boards</option>
                        <option>My Boards</option>
                        <option>Shared</option>
                    </select>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                        + New Board
                    </button>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-y-auto max-h-[70vh]">
                    {/* List Header */}
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            BOARDS IN THIS TEAM ({searchFilter.length})
                        </h2>
                    </div>

                    {/* List Items */}
                    <div className="divide-y divide-gray-100">
                        {searchFilter.length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <Network className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-base font-semibold text-gray-900 mb-1">No mind maps found</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    {search ? 'Try adjusting your search terms' : 'Create your first mind map to get started'}
                                </p>
                                {!search && (
                                    <button 
                                        onClick={() => setShowCreateModal(true)}
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Network className="h-4 w-4 mr-2" />
                                        Create Your First Board
                                    </button>
                                )}
                            </div>
                        ) : (
                            searchFilter.map((mindmap) => {
                                const isFavorite = favorites.has(mindmap.id);
                                const owner = mindmap.owner || 'Unknown';
                                
                                return (
                                    <div 
                                        key={mindmap.id} 
                                        className="group px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-4"
                                        onClick={() => navigate(`/tools/maps/${mindmap.id}`)}
                                    >
                                        {/* Icon */}
                                        <div className="flex-shrink-0">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <Network className="h-5 w-5 text-blue-600" />
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                                                {mindmap.data?.title || 'Untitled Mind Map'}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                 Owned by {owner}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => toggleFavorite(e, mindmap.id)}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <Star 
                                                    className={`h-5 w-5 ${
                                                        isFavorite 
                                                            ? 'fill-yellow-400 text-yellow-400' 
                                                            : 'text-gray-400'
                                                    }`} 
                                                />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteClick(mindmap);
                                                }}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <Trash className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                            </button>
                                            <button 
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <MoreVertical className="h-4 w-4 text-gray-400" />
                                            </button>
                                        </div>

                                        {/* Star (visible when favorited) */}
                                        {isFavorite && (
                                            <div className="flex-shrink-0 group-hover:opacity-0 transition-opacity">
                                                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
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
