import React, { useState, useRef, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, Save, Trash2, Download, Share2, AudioWaveform as Waveform } from 'lucide-react';

const VoiceNotes = () => {
  const [notes, setNotes] = useState(() => JSON.parse(localStorage.getItem('voiceNotes')) || []);
  const [folders, setFolders] = useState(() => JSON.parse(localStorage.getItem('voiceNoteFolders')) || ['General']);
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

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(localChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setChunks(localChunks);

      setTimeout(() => {
        saveNote(blob, url, localChunks);
      }, 100);
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

  const saveNote = async (optionalBlob = null, optionalUrl = null, optionalChunks = null) => {
    const finalChunks = optionalChunks || chunks;
    const finalBlob = optionalBlob || new Blob(finalChunks, { type: 'audio/webm' });
    const finalUrl = optionalUrl || URL.createObjectURL(finalBlob);

    if (!finalChunks.length || !transcript.trim() || !noteTitle.trim()) return;

    const newNote = {
      id: Date.now().toString(),
      title: noteTitle.trim(),
      timestamp: new Date().toLocaleString(),
      text: transcript,
      folder: selectedFolder,
      audioUrl: finalUrl,
      duration: recordingDuration,
      visibility: privacySettings['temp'] || 'Private',
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    localStorage.setItem('voiceNotes', JSON.stringify(updatedNotes));

    setShowSaveAnimation(true);
    setTimeout(() => {
      resetTranscript();
      setAudioUrl(null);
      setChunks([]);
      setNoteTitle('');
      setPrivacySettings((prev) => {
        const newSettings = { ...prev };
        delete newSettings['temp'];
        return newSettings;
      });
      setShowSaveAnimation(false);
    }, 500);
  };

  const deleteNote = (id) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    localStorage.setItem('voiceNotes', JSON.stringify(updated));
  };

  const handlePrivacyChange = (id, value) => {
    const updated = notes.map((note) =>
      note.id === id ? { ...note, visibility: value } : note
    );
    setNotes(updated);
    localStorage.setItem('voiceNotes', JSON.stringify(updated));
  };

  const handleShare = async (note) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title || 'Voice Note',
          text: note.text,
          url: note.audioUrl,
        });
      } catch (err) {
        alert('Share canceled or failed: ' + err.message);
      }
    } else {
      try {
        const shareText = `Check out this voice note:\n\nTitle: ${note.title}\nTranscript: ${note.text}\nAudio: ${note.audioUrl}`;
        await navigator.clipboard.writeText(shareText);
        alert('Share link copied to clipboard!');
      } catch (err) {
        alert('Clipboard copy failed: ' + err.message);
      }
    }
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

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
                const updated = [...folders, name];
                setFolders(updated);
                setSelectedFolder(name);
                localStorage.setItem('voiceNoteFolders', JSON.stringify(updated));
              }
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
                onClick={() => saveNote()}
                disabled={!noteTitle.trim() || !transcript.trim()}
                className={`flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition ${
                  showSaveAnimation ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                } ${(!noteTitle.trim() || !transcript.trim()) && 'opacity-50 cursor-not-allowed'}`}
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
      {folders.map((folder) => {
        const folderNotes = notes.filter(
          (note) =>
            note.folder === folder &&
            (note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             note.text.toLowerCase().includes(searchQuery.toLowerCase()))
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
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">{note.title}</h4>
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
                  {note.audioUrl && (
                    <audio controls src={note.audioUrl} className="w-full" />
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
                    href={note.audioUrl}
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
      })}
    </div>
  );
};

export default VoiceNotes;
