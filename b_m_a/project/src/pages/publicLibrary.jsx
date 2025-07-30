import React, { useState, useEffect } from "react";
import { Download, Share2, Globe } from "lucide-react";

const PublicLibrary = () => {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const storedNotes = JSON.parse(localStorage.getItem("voiceNotes")) || [];

    // Only notes that are explicitly marked public and have valid data
    const publicNotes = storedNotes.filter(
      (note) =>
        note.visibility === "Public" &&
        note.audioUrl &&
        note.text &&
        note.folder
    );

    setNotes(publicNotes);
  }, []);

  const filteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase();
    return (
      note.title?.toLowerCase().includes(query) ||
      note.text?.toLowerCase().includes(query) ||
      note.folder?.toLowerCase().includes(query)
    );
  });

  // Extract folders from public notes
  const folders = [...new Set(filteredNotes.map((note) => note.folder || "General"))];

  const formatDuration = (s) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleShare = async (note) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title || "Voice Note",
          text: note.text,
          url: note.audioUrl,
        });
      } catch (err) {
        alert("Share canceled or failed: " + err.message);
      }
    } else {
      try {
        const shareText = `Title: ${note.title}\n\n${note.text}\nAudio: ${note.audioUrl}`;
        await navigator.clipboard.writeText(shareText);
        alert("Copied to clipboard!");
      } catch (err) {
        alert("Clipboard copy failed: " + err.message);
      }
    }
  };

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

      {folders.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          No public notes found.
        </div>
      ) : (
        folders.map((folder) => {
          const notesInFolder = filteredNotes.filter((note) => note.folder === folder);
          if (notesInFolder.length === 0) return null;

          return (
            <div key={folder} className="mb-8">
              <h2 className="text-xl font-semibold text-purple-700 mb-4">{folder}</h2>
              {notesInFolder.map((note) => (
                <div
                  key={note.id}
                  className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow mb-4 flex flex-col md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex-1">
                    {note.title && (
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {note.title}
                      </h3>
                    )}
                    <div className="flex gap-2 mb-2 text-sm text-gray-500">
                      <span>{note.timestamp}</span>
                      <span className="text-gray-400">
                        ({formatDuration(note.duration || 0)})
                      </span>
                    </div>
                    <p className="text-gray-800 mb-4">{note.text}</p>
                    {note.audioUrl && (
                      <audio controls src={note.audioUrl} className="w-full" />
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-4 md:mt-0 ml-4">
                    <button
                      onClick={() => handleShare(note)}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <Share2 size={20} />
                    </button>
                    <a
                      href={note.audioUrl}
                      download={`note_${note.id}.webm`}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <Download size={20} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
};

export default PublicLibrary;
