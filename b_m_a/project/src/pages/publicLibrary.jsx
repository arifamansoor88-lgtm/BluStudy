// publicLibrary.jsx — robust env resolution (no direct `process` use on client)
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Download, Share2, Globe } from "lucide-react";

// Resolve API base URL safely across CRA, Vite, Next.js, or plain HTML
const API_URL = (() => {
  // 1) Window-provided override (works in any setup)
  if (typeof window !== "undefined" && window.__API_URL__) return window.__API_URL__;

  // 2) Next.js / CRA build-time env (guarded so `process` isn't referenced if undefined)
  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== "undefined" && process.env) {
      // Next.js requires NEXT_PUBLIC_ prefix for client-side
      const fromNext = process.env.NEXT_PUBLIC_API_URL;
      const fromCRA = process.env.REACT_APP_API_URL;
      if (fromNext) return fromNext;
      if (fromCRA) return fromCRA;
    }
  } catch {}

  // 3) Vite
  try {
    // eslint-disable-next-line no-undef
    const fromVite = import.meta?.env?.VITE_API_URL;
    if (fromVite) return fromVite;
  } catch {}

  // 4) Fallback
  return "http://localhost:8000";
})();

const api = axios.create({ baseURL: API_URL });

const PublicLibrary = () => {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/public/voice-notes`);
        setNotes(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load public notes:", err);
        setNotes([]);
      }
    };
    fetch();
  }, []);

  const filtered = notes.filter((n) => {
    const q = (searchQuery || "").toLowerCase();
    const inFolder = !selectedFolder || (n.folder || "General") === selectedFolder;
    const matches =
      (n.title || "").toLowerCase().includes(q) ||
      (n.text || "").toLowerCase().includes(q) ||
      (n.folder || "").toLowerCase().includes(q);
    return inFolder && matches;
  });

  const folders = Array.from(new Set(filtered.map((n) => n.folder || "General")));

  const formatDuration = (s) =>
    `${Math.floor((s || 0) / 60)}:${((s || 0) % 60).toString().padStart(2, "0")}`;

  const handleShare = async (note) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title || "Voice Note",
          text: note.text,
          url: note.audio_url,
        });
      } catch (err) {
        alert("Share canceled or failed: " + err.message);
      }
    } else {
      try {
        const shareText = `Title: ${note.title}\n\n${note.text}\nAudio: ${note.audio_url}`;
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <input
          type="text"
          placeholder="Search public notes..."
          className="w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="px-4 py-2 border rounded-md"
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
        >
          <option value="">All folders</option>
          {Array.from(new Set(notes.map((n) => n.folder || "General"))).map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button
          onClick={async () => {
            const params = new URLSearchParams();
            if (searchQuery.trim()) params.set("q", searchQuery.trim());
            if (selectedFolder) params.set("folder", selectedFolder);
            const res = await api.get(`/public/voice-notes?${params.toString()}`);
            setNotes(Array.isArray(res.data) ? res.data : []);
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
        >
          Refresh
        </button>
      </div>

      {folders.length === 0 ? (
        <div className="text-center py-6 text-gray-500">No public notes found.</div>
      ) : (
        folders.map((folder) => {
          const notesInFolder = filtered.filter((n) => (n.folder || "General") === folder);
          if (!notesInFolder.length) return null;
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
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{note.title}</h3>
                    )}
                    <div className="flex gap-2 mb-2 text-sm text-gray-500">
                      <span>{note.timestamp}</span>
                      <span className="text-gray-400">({formatDuration(note.duration)})</span>
                      <span className="ml-4 font-medium text-gray-600">by {note.user_id?.slice(0, 8) || "user"}</span>
                    </div>
                    <p className="text-gray-800 mb-4 whitespace-pre-wrap">{note.text}</p>
                    {note.audio_url && <audio controls src={note.audio_url} className="w-full" />}
                  </div>
                  <div className="flex items-center gap-4 mt-4 md:mt-0 ml-4">
                    <button onClick={() => handleShare(note)} className="text-purple-600 hover:text-purple-800">
                      <Share2 size={20} />
                    </button>
                    {note.audio_url && (
                      <a
                        href={note.audio_url}
                        download={`note_${note.id}.webm`}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        <Download size={20} />
                      </a>
                    )}
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
