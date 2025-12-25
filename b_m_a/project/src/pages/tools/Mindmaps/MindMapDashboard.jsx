import { Network, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getMindmaps } from '../../../api/apiService';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';

const MindMapDashboard = () => {
    const { instance, inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [search, setSearch] = useState('');
    const [savedMindmaps, setSavedMindmaps] = useState([]);

    const handleChange = (event) => {
        const response = setSearch(event.target.value);
    }

    const fetchSavedMindmaps = useCallback(async () => {
        try {
        const allItems = await getMindmaps();
        const mindmaps = allItems.filter(item => item.contentType === 'mindmap');
        setSavedMindmaps(mindmaps);
        } catch (err) {
            console.error("Fetch Failed.", err);
        }
    }, []);

  // Load saved mindmaps on component mount
  useEffect(() => {
        // Only fetch when MSAL is fully done initializing and user is logged in
        if (isAuthenticated && inProgress === InteractionStatus.None) {
            fetchSavedMindmaps();
        }
  }, [isAuthenticated, inProgress, fetchSavedMindmaps]);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-4 mb-4">
                <Network className="h-8 w-8 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Mind Maps</h1>
            </div>
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        placeholder="Search by title"
                        type="text"
                        value={search}
                        onChange={handleChange} />
                </div>
                <button className="rounded-lg border-1 border-gray-200 px-4 py-2 bg-white text-gray-900 text-bold shadow-lg">Filter</button>
                <button className="rounded-lg px-6 py-2 bg-blue-500 text-white text-bold shadow-lg">+ New Board</button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Boards in this team ()</span>
                </div>
                <div className="bg-color-white">
                    {savedMindmaps.map((mindmap) => (
                        <div key={mindmap.id}>
                            <h1>
                                {mindmap.data?.title}
                            </h1>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default MindMapDashboard;
