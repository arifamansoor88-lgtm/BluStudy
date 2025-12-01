// VoiceNotes.jsx — tags instead of folders, now with Pause/Resume while recording
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, Save, Trash2, Download, Share2, Tag as TagIcon, AudioWaveform as Waveform, PauseCircle, PlayCircle } from 'lucide-react';

const API_URL = "http://localhost:8000";

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
  const [allTags, setAllTags] = useState([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [showSaveAnimation, setShowSaveAnimation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [privacySettings, setPrivacySettings] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [pendingTags, setPendingTags] = useState([]); // tags for the note being created
  const [micPermissionError, setMicPermissionError] = useState(false);

  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  const { transcript, resetTranscript } = useSpeechRecognition();

  const fetchNotes = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTagFilter) params.append('tag', selectedTagFilter);
      const res = await axios.get(`${API_URL}/voice-notes?${params.toString()}`);
      const items = res.data || [];
      setNotes(items);
      const tags = new Set();
      items.forEach(n => (n.tags || []).forEach(t => tags.add(t)));
      setAllTags(Array.from(tags));
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  useEffect(() => { fetchNotes(); }, [selectedTagFilter]);

  // canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
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
      ctx.strokeStyle = isPaused ? '#a3a3a3' : '#7c3aed';
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

      if (isPaused) {
        // overlay "Paused"
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
      }
    };
    draw();
  };

  const startRecording = async () => {
    resetTranscript();
    setMicPermissionError(false);
    
    try {
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
    } catch (e) {
      // Speech recognition might fail, continue anyway
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const localChunks = [];

      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) localChunks.push(e.data); };
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
      setIsPaused(false);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
    } catch (error) {
      console.log('Microphone access denied or error:', error.name);
      setMicPermissionError(true);
      try {
        SpeechRecognition.stopListening();
      } catch (e) {
        // Ignore if speech recognition wasn't started
      }
      return; // Stop execution here
    }
  };

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;
    try {
      if (mediaRecorderRef.current && typeof mediaRecorderRef.current.pause === 'function') {
        mediaRecorderRef.current.pause();
      }
    } catch (e) {
      console.warn('MediaRecorder.pause not supported, ignoring.');
    }
    clearInterval(timerRef.current);
    setIsPaused(true);
    SpeechRecognition.stopListening();
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;
    try {
      if (mediaRecorderRef.current && typeof mediaRecorderRef.current.resume === 'function') {
        mediaRecorderRef.current.resume();
      }
    } catch (e) {
      console.warn('MediaRecorder.resume not supported, ignoring.');
    }
    setIsPaused(false);
    timerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
  };

  const stopRecording = () => {
    SpeechRecognition.stopListening();
    try {
      mediaRecorderRef.current?.stop();
    } catch (e) {
      // ignore
    }
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    setIsRecording(false);
    setIsPaused(false);
  };

  const toggleRecording = () => (isRecording ? stopRecording() : startRecording());
  const togglePause = () => (isPaused ? resumeRecording() : pauseRecording());

  // Optional: spacebar to pause/resume while recording
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && isRecording) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRecording, isPaused]);

  const addPendingTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!pendingTags.map(x => x.toLowerCase()).includes(t.toLowerCase())) {
      setPendingTags(prev => [...prev, t]);
    }
    setTagInput('');
  };
  const removePendingTag = (t) => setPendingTags(prev => prev.filter(x => x !== t));

  const saveNoteToBackend = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (!blob || !noteTitle.trim()) return;

    const formData = new FormData();
    formData.append('audio', blob, `note_${Date.now()}.webm`);
    formData.append('title', noteTitle.trim());
    formData.append('text', transcript || '');
    formData.append('duration', recordingDuration || 0);
    formData.append('visibility', privacySettings['temp'] || 'Private');
    formData.append('tags', pendingTags.join(', '));

    try {
      const res = await axios.post(`${API_URL}/voice-notes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const newNote = res.data;
      setNotes(prev => [newNote, ...prev]);

      // refresh tag universe
      const tags = new Set(allTags);
      (newNote.tags || []).forEach(t => tags.add(t));
      setAllTags(Array.from(tags));

      setShowSaveAnimation(true);
      setTimeout(() => {
        resetTranscript();
        setAudioUrl(null);
        setChunks([]);
        setNoteTitle('');
        setPendingTags([]);
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
        await navigator.share({ title: note.title || 'Voice Note', text: note.text, url: note.audio_url });
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

  const filtered = notes.filter((n) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesQ = (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q);
    const matchesTag = !selectedTagFilter || (n.tags || []).map(x => x.toLowerCase()).includes(selectedTagFilter.toLowerCase());
    return matchesQ && matchesTag;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-purple-100 p-3 rounded-full">
          <Waveform className="h-8 w-8 text-purple-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Voice Notes</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full"
        />
        <select
          className="p-2 border border-gray-300 rounded w-full"
          value={selectedTagFilter}
          onChange={(e) => setSelectedTagFilter(e.target.value)}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
        <button
          onClick={() => fetchNotes()}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
        >
          Refresh
        </button>
      </div>

      {/* Title */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter a title for this note"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full"
        />
      </div>

      {/* Tag input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a tag (press Enter)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPendingTag(); }}
            className="p-2 border border-gray-300 rounded w-full"
          />
          <button onClick={addPendingTag} className="px-4 py-2 bg-gray-200 rounded">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {pendingTags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-purple-100 text-purple-700 rounded-full">
              <TagIcon size={14} /> {t}
              <button onClick={() => removePendingTag(t)} className="ml-1 text-purple-700 hover:text-purple-900">×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => (isRecording ? stopRecording() : startRecording())}
              className={`p-4 rounded-full transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
              title={isRecording ? 'Stop' : 'Start recording'}
            >
              <Mic className="h-6 w-6" />
            </button>

            {isRecording && (
              <button
                onClick={togglePause}
                className={`p-4 rounded-full transition ${isPaused ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
                title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
              >
                {isPaused ? <PlayCircle className="h-6 w-6" /> : <PauseCircle className="h-6 w-6" />}
              </button>
            )}

            <div>
              <p className="text-sm text-gray-700">
                {isRecording ? (isPaused ? 'Paused' : 'Recording...') : 'Ready to record'}
              </p>
              {isRecording && <p className={`text-xs ${isPaused ? 'text-gray-500' : 'text-red-600'}`}>{formatDuration(recordingDuration)}</p>}
            </div>
          </div>

          {(isRecording || audioUrl) && (
            <>
              <select
                className="mr-4 p-2 rounded border border-gray-300"
                value={privacySettings['temp'] || 'Private'}
                onChange={(e) => setPrivacySettings((prev) => ({ ...prev, temp: e.target.value }))}
              >
                <option>Private</option>
                <option>Public</option>
              </select>
              <button
                onClick={saveNoteToBackend}
                disabled={!noteTitle.trim() || !chunks.length}
                className={`flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition ${showSaveAnimation ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} ${(!noteTitle.trim() || !chunks.length) && 'opacity-50 cursor-not-allowed'}`}
              >
                <Save className="h-4 w-4" /> Save Note
              </button>
            </>
          )}
        </div>

        {micPermissionError && (
          <div className="bg-red-100 border-2 border-red-400 p-4 rounded-lg mt-4">
            <p className="text-red-700 font-medium">Please Enable your microphone.</p>
          </div>
        )}

        <canvas ref={canvasRef} className="mt-4 w-full h-24 rounded bg-gray-100" />

        {isRecording && (
          <div className={`mt-6 p-4 rounded-lg border ${isPaused ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
            <p className="text-gray-700 min-h-[3rem]">{isPaused ? '— Paused —' : (transcript || 'Listening...')}</p>
          </div>
        )}

        {audioUrl && !isRecording && (
          <div className="mt-6 flex items-center gap-4">
            <audio controls src={audioUrl} className="flex-1" />
            <a href={audioUrl} download={`voice_note_${Date.now()}.webm`} className="flex items-center gap-2 text-purple-600 hover:text-purple-700">
              <Download className="h-4 w-4" /> Download
            </a>
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-6">Saved Notes</h2>
      {Array.isArray(filtered) && filtered.length > 0 ? (
        filtered.map((note) => (
          <div key={note.id} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow mb-4 flex flex-col md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-1">{note.title || 'Untitled'}</h4>
              <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-gray-500">
                <span>{note.timestamp}</span>
                <span className="text-gray-400">({formatDuration(note.duration)})</span>
                <span className="ml-4 font-medium text-gray-600">Privacy: {note.visibility || 'Private'}</span>
                <div className="flex flex-wrap gap-2 ml-4">
                  {(note.tags || []).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                      <TagIcon size={12} /> {t}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-gray-900 mb-4 whitespace-pre-wrap">{note.text}</p>
              {note.audio_url && (<audio controls src={note.audio_url} className="w-full" />)}
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

              <button onClick={() => handleShare(note)} className="text-purple-600 hover:text-purple-800">
                <Share2 className="h-6 w-6" />
              </button>

              {note.audio_url && (
                <a href={note.audio_url} download={`voice_note_${note.id}.webm`} className="text-purple-600 hover:text-purple-800">
                  <Download className="h-6 w-6" />
                </a>
              )}

              <button onClick={() => deleteNote(note.id)} className="text-red-600 hover:text-red-800">
                <Trash2 className="h-6 w-6" />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-500">No voice notes found.</p>
      )}
    </div>
  );
};

export default VoiceNotes;
