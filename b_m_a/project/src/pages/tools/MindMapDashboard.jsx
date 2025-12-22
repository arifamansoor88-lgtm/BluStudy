import { Network } from 'lucide-react';
import { useState } from 'react';

const MindMapDashboard = () => {
    const [search, setSearch] = useState(''); 

    const handleChange = (event) => {
        setSearch(event.target.value);
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Network className="h-8 w-8 text-green-600" />
                    <h1 className="text-2xl font-bold text-gray-900">Mind Maps</h1>
                </div>
                <input placeholder="Search by title" type="text" value={search} onChange={handleChange}/>
                <button>New</button>
            </div>
        </div>
    )
}

export default MindMapDashboard;
