// VoiceNotes.jsx — patched so "Save Note" immediately shows in Saved Notes
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, Save, Trash2, Download, Share2, AudioWaveform as Waveform } from 'lucide-react';

const API_URL = "http://localhost:8000"; // ✅ Change this when deploying

// ✅ Stable user id so backend partitioning is consistent
const USER_ID_KEY = "voice_notes_user_id";
const getUserId = () => {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
};
axios.defaults.headers.common['X-User-Id'] = getUserId();

const VoiceNotes = () => {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState(['General']);
  const [selectedFolder, setSelectedFolder] = useState('General');
  const [noteTitle, setNoteTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [privacySettings, setPrivacySettings] = useState({});

  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  const { transcript, resetTranscript } = useSpeechRecognition();

  // ✅ Fetch all notes on load
  const fetchNotes = async () => {
    try {
      const res = await axios.get(`${API_URL}/voice-notes`);
      setNotes(res.data || []);
      const uniqueFolders = [...new Set((res.data || []).map(n => n.folder).filter(Boolean))];
      setFolders(prev => Array.from(new Set([...prev, ...uniqueFolders])));
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // ✅ Draw waveform for live recording
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = '${rect.width}px';
    canvas.style.height = '${rect.height}px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analyser.fftSize = 2048;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7c3aed';
      ctx.beginPath();

      const width = canvas.width;
      const height = canvas.height;
      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  };

  const startRecording = async () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    const localChunks = [];

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) localChunks.push(e.data);
    };

    // ❌ Avoid auto-save on stop — user will click "Save Note"
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(localChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setChunks(localChunks);
    };

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    await audioContextRef.current.resume();

    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);
    drawWaveform();

    mediaRecorderRef.current.start();
    setIsRecording(true);
    setRecordingDuration(0);
    timerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
  };

  const stopRecording = () => {
    SpeechRecognition.stopListening();
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    setIsRecording(false);
  };

  const toggleRecording = () => (isRecording ? stopRecording() : startRecording());

  // ✅ Save note to backend (no transcript requirement)
  const saveNoteToBackend = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (!blob || !noteTitle.trim()) return; // only title required

    const formData = new FormData();
    formData.append('audio', blob, `note_${Date.now()}.webm`);
    formData.append('title', noteTitle.trim());
    formData.append('text', transcript || ''); // allow empty transcript
    formData.append('folder', selectedFolder || 'General');
    formData.append('duration', recordingDuration || 0);
    formData.append('visibility', privacySettings['temp'] || 'Private');

    try {
      const res = await axios.post(`${API_URL}/voice-notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newNote = res.data;

      // ✅ Immediately show in UI
      setNotes(prev => [newNote, ...prev]);

      // ✅ Ensure folder appears in list
      if (newNote.folder && !folders.includes(newNote.folder)) {
        setFolders(prev => [...prev, newNote.folder]);
      }

      // Optional: re-fetch from backend to stay consistent
      // await fetchNotes();

      setShowSaveAnimation(true);
      setTimeout(() => {
        resetTranscript();
        setAudioUrl(null);
        setChunks([]);
        setNoteTitle('');
        setShowSaveAnimation(false);
      }, 400);
    } catch (err) {
      console.error("Error saving voice note:", err);
      alert("Failed to save note. Check server logs.");
    }
  };

  const deleteNote = async (id) => {
    try {
      await axios.delete(`${API_URL}/voice-notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const handlePrivacyChange = async (id, value) => {
    try {
      await axios.put(`${API_URL}/voice-notes/${id}`, { visibility: value });
      setNotes(prev => prev.map(n => n.id === id ? { ...n, visibility: value } : n));
    } catch (err) {
      console.error("Error updating privacy:", err);
    }
  };

  const handleShare = async (note) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title || 'Voice Note',
          text: note.text,
          url: note.audio_url,
        });
      } catch (err) {
        alert('Share canceled or failed: ' + err.message);
      }
    } else {
      try {
        const shareText = `Check out this voice note:\n\nTitle: ${note.title}\nTranscript: ${note.text}\nAudio: ${note.audio_url}`;
        await navigator.clipboard.writeText(shareText);
        alert('Share link copied to clipboard!');
      } catch (err) {
        alert('Clipboard copy failed: ' + err.message);
      }
    }
  };

  const formatDuration = (s) => `${Math.floor((s || 0) / 60)}:${((s || 0) % 60).toString().padStart(2, '0')}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-purple-100 p-3 rounded-full">
          <Waveform className="h-8 w-8 text-purple-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Voice Notes</h1>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Folder</label>
        <select
          className="p-2 border border-gray-300 rounded w-full"
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
        >
          {folders.map((folder) => (
            <option key={folder} value={folder}>{folder}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Create new folder"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              const name = e.target.value.trim();
              if (!folders.includes(name)) {
                setFolders(prev => [...prev, name]);
              }
              setSelectedFolder(name);
              e.target.value = '';
            }
          }}
          className="p-2 border border-gray-300 rounded w-full"
        />
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter a title for this note"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full"
        />
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleRecording}
              className={`p-4 rounded-full transition ${
                isRecording
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
              }`}
            >
              <Mic className="h-6 w-6" />
            </button>
            <div>
              <p className="text-sm text-gray-700">
                {isRecording ? 'Recording...' : 'Ready to record'}
              </p>
              {isRecording && (
                <p className="text-xs text-red-600">
                  {formatDuration(recordingDuration)}
                </p>
              )}
            </div>
          </div>

          {(isRecording || audioUrl) && (
            <>
              <select
                className="mr-4 p-2 rounded border border-gray-300"
                value={privacySettings['temp'] || 'Private'}
                onChange={(e) =>
                  setPrivacySettings((prev) => ({
                    ...prev,
                    temp: e.target.value,
                  }))
                }
              >
                <option>Private</option>
                <option>Public</option>
              </select>
              <button
                onClick={saveNoteToBackend}
                disabled={!noteTitle.trim() || !chunks.length}
                className={`flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition ${
                  showSaveAnimation ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                } ${(!noteTitle.trim() || !chunks.length) && 'opacity-50 cursor-not-allowed'}`}
              >
                <Save className="h-4 w-4" /> Save Note
              </button>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="mt-4 w-full h-24 rounded bg-gray-100" />

        {isRecording && (
          <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <p className="text-gray-700 min-h-[3rem]">{transcript || 'Listening...'}</p>
          </div>
        )}

        {audioUrl && !isRecording && (
          <div className="mt-6 flex items-center gap-4">
            <audio controls src={audioUrl} className="flex-1" />
            <a
              href={audioUrl}
              download={`voice_note_${Date.now()}.webm`}
              className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
            >
              <Download className="h-4 w-4" /> Download
            </a>
          </div>
        )}
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full"
        />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-6">Saved Notes</h2>
      {Array.isArray(notes) && notes.length > 0 ? (
        folders.map((folder) => {
          const folderNotes = notes.filter(
            (note) =>
              note.folder === folder &&
              ((note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
               (note.text || '').toLowerCase().includes(searchQuery.toLowerCase()))
          );

          if (folderNotes.length === 0) return null;

          return (
            <div key={folder} className="mb-8">
              <h3 className="text-lg font-semibold text-purple-700 mb-4">{folder}</h3>
              {folderNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow mb-4 flex flex-col md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">{note.title || 'Untitled'}</h4>
                    <div className="flex gap-2 mb-2 text-sm text-gray-500">
                      <span>{note.timestamp}</span>
                      <span className="text-gray-400">
                        ({formatDuration(note.duration)})
                      </span>
                      <span className="ml-4 font-medium text-gray-600">
                        Privacy: {note.visibility || 'Private'}
                      </span>
                    </div>
                    <p className="text-gray-900 mb-4">{note.text}</p>
                    {note.audio_url && (
                      <audio controls src={note.audio_url} className="w-full" />
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <select
                      value={note.visibility || 'Private'}
                      onChange={(e) => handlePrivacyChange(note.id, e.target.value)}
                      className="p-2 border border-gray-300 rounded"
                    >
                      <option>Private</option>
                      <option>Public</option>
                    </select>

                    <button
                      onClick={() => handleShare(note)}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <Share2 className="h-6 w-6" />
                    </button>

                    <a
                      href={note.audio_url}
                      download={`voice_note_${note.id}.webm`}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <Download className="h-6 w-6" />
                    </a>

                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      ) : (
        <p className="text-gray-500">No voice notes available.</p>
      )}
    </div>
  );
};

export default VoiceNotes;
