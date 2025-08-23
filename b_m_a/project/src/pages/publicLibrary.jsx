// publicLibrary.jsx — tags instead of folders
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Download, Share2, Globe, Tag as TagIcon } from "lucide-react";

// Resolve API base URL
const API_URL = (() => {
  if (typeof window !== "undefined" && window.__API_URL__) return window.__API_URL__;
  try {
    if (typeof process !== "undefined" && process.env) {
      const fromNext = process.env.NEXT_PUBLIC_API_URL;
      const fromCRA = process.env.REACT_APP_API_URL;
      if (fromNext) return fromNext;
      if (fromCRA) return fromCRA;
    }
  } catch {}
  try {
    const fromVite = import.meta?.env?.VITE_API_URL;
    if (fromVite) return fromVite;
  } catch {}
  return "http://localhost:8000";
})();

const api = axios.create({ baseURL: API_URL });

const PublicLibrary = () => {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [allTags, setAllTags] = useState([]);

  const load = async (q = "", tag = "") => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (tag) params.append("tag", tag);
    const res = await api.get(`/public/voice-notes?${params.toString()}`);
    const items = Array.isArray(res.data) ? res.data : [];
    setNotes(items);
    const tags = new Set();
    items.forEach(n => (n.tags || []).forEach(t => tags.add(t)));
    setAllTags(Array.from(tags));
  };

  useEffect(() => { load(); }, []);

  const filtered = notes.filter((n) => {
    const q = (searchQuery || "").toLowerCase();
    const matchesQ =
      (n.title || "").toLowerCase().includes(q) ||
      (n.text || "").toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q));
    const matchesTag = !selectedTag || (n.tags || []).map(x => x.toLowerCase()).includes(selectedTag.toLowerCase());
    return matchesQ && matchesTag;
  });

  const formatDuration = (s) =>
    `${Math.floor((s || 0) / 60)}:${((s || 0) % 60).toString().padStart(2, "0")}`;

  const handleShare = async (note) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title || "Voice Note", text: note.text, url: note.audio_url });
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
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
        >
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => load(searchQuery, selectedTag)}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
        >
          Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-gray-500">No public notes found.</div>
      ) : (
        filtered.map((note) => (
          <div
            key={note.id}
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow mb-4 flex flex-col md:flex-row md:items-start md:justify-between"
          >
            <div className="flex-1">
              {note.title && (<h3 className="text-lg font-semibold text-gray-900 mb-1">{note.title}</h3>)}
              <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-gray-500">
                <span>{note.timestamp}</span>
                <span className="text-gray-400">({formatDuration(note.duration)})</span>
                <span className="ml-4 font-medium text-gray-600">by {note.user_id?.slice(0, 8) || "user"}</span>
                <div className="flex flex-wrap gap-2 ml-4">
                  {(note.tags || []).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                      <TagIcon size={12} /> {t}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-gray-800 mb-4 whitespace-pre-wrap">{note.text}</p>
              {note.audio_url && <audio controls src={note.audio_url} className="w-full" />}
            </div>
            <div className="flex items-center gap-4 mt-4 md:mt-0 ml-4">
              <button onClick={() => handleShare(note)} className="text-purple-600 hover:text-purple-800">
                <Share2 size={20} />
              </button>
              {note.audio_url && (
                <a href={note.audio_url} download={`note_${note.id}.webm`} className="text-purple-600 hover:text-purple-800">
                  <Download size={20} />
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PublicLibrary;
