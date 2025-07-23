import React, { useState, useEffect } from "react";
import { Download, Share2, Globe } from "lucide-react";

const PublicLibrary = () => {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Load notes from localStorage (or from backend in future)
    const storedNotes = JSON.parse(localStorage.getItem("voiceNotes")) || [];

    // Filter only public ones
    const publicNotes = storedNotes.filter(
      (note) => note.visibility === "Public"
    );

    setNotes(publicNotes);
  }, []);

  const filteredNotes = notes.filter((note) =>
    note.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Globe size={28} /> Public Library
      </h1>

      <input
        type="text"
        placeholder="Search public notes..."
        className="w-full mb-6 px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {filteredNotes.length === 0 ? (
        <div className="text-center py-6 text-gray-500">No public notes found.</div>
      ) : (
        filteredNotes.map((note) => (
          <div
            key={note.id}
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow mb-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex gap-2 mb-2 text-sm text-gray-500">
                  <span>{note.timestamp}</span>
                  <span className="text-gray-400">
                    ({note.duration ? `${Math.floor(note.duration / 60)}:${(note.duration % 60).toString().padStart(2, "0")}` : "00:00"})
                  </span>
                </div>
                <p className="text-gray-900 mb-4">{note.text}</p>
                {note.audioUrl && (
                  <audio controls src={note.audioUrl} className="w-full" />
                )}
              </div>

              <div className="flex flex-col gap-2 items-center">
                <button className="text-blue-600 hover:text-blue-800">
                  <Share2 size={20} />
                </button>
                <a
                  href={note.audioUrl}
                  download={`note_${note.id}.webm`}
                  className="text-green-600 hover:text-green-800"
                >
                  <Download size={20} />
                </a>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PublicLibrary;
