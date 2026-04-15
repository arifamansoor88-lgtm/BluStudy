import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import {
  FileSearch,
  Upload,
  RefreshCw,
  Trash2,
  ClipboardCopy,
  PencilLine,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Loader2,
  PlusCircle,
  BookOpen
} from 'lucide-react';
import { generateSummary } from '../../api/apiService';
import { msalInstance, protectedResources } from '../../authConfig';

// reusable save-to-folder button
import SaveToFolderButton from '../../components/SaveToFolderButton';

const API_BASE = "http://localhost:8000";

const Summarizer = () => {
  // Get folderId from URL query params if present
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');
  const summaryId = searchParams.get('summaryId');
  
  // View state: 'create' or 'saved'
  const [viewMode, setViewMode] = useState('create');
  const [savedSummaries, setSavedSummaries] = useState([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [summaryStyle, setSummaryStyle] = useState('high');
  const [summaryFormat, setSummaryFormat] = useState('bullet');
  const [copied, setCopied] = useState(false);
  const [viewingExisting, setViewingExisting] = useState(false);

  // Editing / status
  const [isEditing, setIsEditing] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Load existing summary if summaryId is provided
  useEffect(() => {
    if (!summaryId) return;
    (async () => {
      try {
        const accounts = msalInstance.getAllAccounts();
        const request = { scopes: protectedResources.todoListApi.scopes, account: accounts[0] };
        let token;
        try {
          const r = await msalInstance.acquireTokenSilent(request);
          token = r.accessToken;
        } catch {
          const r = await msalInstance.acquireTokenPopup(request);
          token = r.accessToken;
        }
        const res = await fetch(`${API_BASE}/items/${summaryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSummary(data.data?.summary || data.description || "");
          setViewingExisting(true);
          setIsEditing(false);
          setDirty(false);
        }
      } catch (e) {
        console.error("Error loading summary:", e);
      }
    })();
  }, [summaryId]);

  // Autosize textarea
  const textareaRef = useRef(null);
  const autoSize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(() => { autoSize(); }, [summary, isEditing]);

  // Warn on close if unsaved edits
  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Fetch saved summaries
  const fetchSavedSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    try {
      const accounts = msalInstance.getAllAccounts();
      const request = { scopes: protectedResources.todoListApi.scopes, account: accounts[0] };
      let token;
      try {
        const r = await msalInstance.acquireTokenSilent(request);
        token = r.accessToken;
      } catch {
        const r = await msalInstance.acquireTokenPopup(request);
        token = r.accessToken;
      }

      const response = await fetch(`${API_BASE}/summaries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch summaries");
      }

      const data = await response.json();
      setSavedSummaries(data);
    } catch (err) {
      console.error("Error fetching summaries:", err);
      setError("Failed to load saved summaries");
    } finally {
      setLoadingSummaries(false);
    }
  }, []);

  // Fetch summaries on mount when in saved view
  useEffect(() => {
    if (viewMode === 'saved') {
      fetchSavedSummaries();
    }
  }, [viewMode, fetchSavedSummaries]);

  // Handle creating a new summary
  const handleCreateNew = () => {
    setViewMode('create');
    setSelectedSummary(null);
    setFile(null);
    setSummary('');
    setError('');
    setDirty(false);
    setIsEditing(true);
    setLastSavedAt(null);
  };

  // Handle selecting a saved summary
  const handleSelectSummary = (savedSummary) => {
    setSelectedSummary(savedSummary);
    setSummary(savedSummary.data?.summary || '');
    setFile(savedSummary.data?.fileName ? { name: savedSummary.data.fileName } : null);
    setSummaryStyle(savedSummary.data?.style || 'high');
    setSummaryFormat(savedSummary.data?.format || 'bullet');
    setDirty(false);
    setIsEditing(false);
    setViewMode('create');
  };

  const callGenerateSummary = async (input) => {
    if (input instanceof FormData) {
      input.append('style', summaryStyle);
      input.append("format", summaryFormat);
      return await generateSummary(input);
    } else {
      return await generateSummary({ ...input, style: summaryStyle, format: summaryFormat });
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(summary || '', 180);
    doc.text(lines, 10, 10);
    doc.save('summary.pdf');
  };

  const handleDownloadDOCX = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [new Paragraph({ children: [new TextRun(summary || '')] })]
        }
      ]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'summary.docx');
  };

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setError('');
      const selectedFile = acceptedFiles[0];
      if (!selectedFile) return;
      setFile(selectedFile);
      setIsProcessing(true);

      const afterGen = (data) => {
        setSummary(data.summary || '');
        setDirty(true);        // unsaved until user stores it in a folder
        setIsEditing(true);
        setLastSavedAt(null);
      };

      if (selectedFile.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target.result;
          if (!text || text.trim() === '') {
            setIsProcessing(false);
            return setError('Empty text file');
          }
          try {
            const data = await callGenerateSummary({ text });
            afterGen(data);
          } catch (err) {
            console.error(err);
            setError('Summary failed.');
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsText(selectedFile);
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
          const data = await callGenerateSummary(formData);
          afterGen(data);
        } catch (err) {
          console.error(err);
          setError('Summary failed.');
        } finally {
          setIsProcessing(false);
        }
      }
    },
    [summaryStyle, summaryFormat]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleReset = () => {
    setFile(null);
    setSummary('');
    setError('');
    setDirty(false);
    setIsEditing(true);
    setLastSavedAt(null);
  };

  const wordCount = summary.trim() ? summary.trim().split(/\s+/).length : 0;

  // Build the item that will be saved to a folder by SaveToFolderButton
  const buildFolderItem = () => {
    const now = new Date();
    const baseTitle =
      file?.name
        ? `Summary: ${file.name}`
        : `Summary ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    const snippet = summary ? summary.replace(/\s+/g, ' ').slice(0, 140) : '';
    return {
      title: baseTitle,
      description: snippet,
      type: 'Summary',
      date: now.toLocaleString(),
      tags: ['smart-summarizer'],
      fullText: summary,
      timestamp: now
    };
  };

  // called by SaveToFolderButton after successful save
  const handleSaved = () => {
    setDirty(false);
    setLastSavedAt(Date.now());
    // Refresh saved summaries list (if not in a folder, always refresh)
    if (!folderId) {
      fetchSavedSummaries();
    }
  };

  // State for saving to folder directly (when folderId is in URL)
  const [isSavingToFolder, setIsSavingToFolder] = useState(false);

  // Save directly to the folder specified in URL params
  const saveToCurrentFolder = async () => {
    if (!folderId || !summary) return;
    
    setIsSavingToFolder(true);
    try {
      // Get token
      const accounts = msalInstance.getAllAccounts();
      const request = { scopes: protectedResources.todoListApi.scopes, account: accounts[0] };
      let token;
      try {
        const r = await msalInstance.acquireTokenSilent(request);
        token = r.accessToken;
      } catch {
        const r = await msalInstance.acquireTokenPopup(request);
        token = r.accessToken;
      }

      const now = new Date();
      const title = file?.name
        ? `Summary: ${file.name}`
        : `Summary ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

      // Save summary to backend with folderId
      const response = await fetch(`${API_BASE}/save-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description: summary.replace(/\s+/g, ' ').slice(0, 140),
          contentType: "summary",
          folderId: folderId,
          data: {
            summary: summary,
            style: summaryStyle,
            format: summaryFormat,
            fileName: file?.name || null,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save summary");
      }

      setDirty(false);
      setLastSavedAt(Date.now());
      // Refresh saved summaries list
      if (viewMode === 'saved') {
        fetchSavedSummaries();
      }
    } catch (err) {
      console.error("Error saving to folder:", err);
      setError("Failed to save to folder");
    } finally {
      setIsSavingToFolder(false);
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-[#edf2ff] to-[#fef9ff] min-h-screen py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-purple-100 via-white to-transparent opacity-30 animate-pulse pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-8 ring-1 ring-gray-200 backdrop-blur"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <FileSearch className="h-8 w-8 text-indigo-600" />
            <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
              Smart Summarizer
            </h1>
          </div>
          {viewMode === 'saved' && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              Create New
            </button>
          )}
          {viewMode === 'create' && (
            <button
              onClick={() => { setViewMode('saved'); setSelectedSummary(null); }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <BookOpen className="w-5 h-5" />
              Saved Summaries
            </button>
          )}
        </div>

        {/* Saved Summaries List */}
        {viewMode === 'saved' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
              <span className="mr-2">Saved Summaries</span>
              <div className="h-px bg-gradient-to-r from-purple-500 to-transparent flex-grow ml-4"></div>
            </h2>
            {loadingSummaries ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : savedSummaries.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-md border-t-4 border-purple-500">
                <div className="flex flex-col items-center justify-center py-6">
                  <FileSearch className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-center mb-2">
                    No saved summaries yet. Create a summary to get started!
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Create Your First Summary
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedSummaries.map((savedSummary) => (
                  <div
                    key={savedSummary.id}
                    onClick={() => handleSelectSummary(savedSummary)}
                    className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden h-full transform hover:-translate-y-1"
                  >
                    <div className="h-3 bg-gradient-to-r from-purple-500 to-indigo-400"></div>
                    <div className="p-6 h-full flex flex-col">
                      <h3 className="font-semibold text-gray-800 text-lg mb-3 min-h-[3rem] leading-tight">
                        {savedSummary.title || "Untitled Summary"}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4 flex items-center">
                        <svg
                          className="w-4 h-4 mr-1 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                        {savedSummary.createdAt
                          ? new Date(savedSummary.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "No date"}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-3 mt-auto">
                        {savedSummary.description || savedSummary.data?.summary?.substring(0, 100) || "No description"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Summary View */}
        {viewMode === 'create' && (
          <>
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-1">Summary Style</label>
            <select
              value={summaryStyle}
              onChange={(e) => setSummaryStyle(e.target.value)}
              className="bg-gradient-to-r from-white to-gray-50 border border-gray-300 rounded-xl px-4 py-2 shadow-sm text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="high">High-Level</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Summary Format</label>
            <select
              value={summaryFormat}
              onChange={(e) => setSummaryFormat(e.target.value)}
              className="bg-gradient-to-r from-white to-gray-50 border border-gray-300 rounded-xl px-4 py-2 shadow-sm text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bullet">Bullet Points</option>
              <option value="key">Key Sentences</option>
              <option value="qa">Q&amp;A</option>
            </select>
          </div>
        </div>

        <motion.div
          {...getRootProps()}
          whileHover={{ scale: 1.02 }}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 bg-white shadow-inner ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300'}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-indigo-400" />
          <p className="text-sm text-gray-600 mt-2">
            {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Drop or click to upload a .txt, .pdf, or .docx file'}
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}

        <AnimatePresence>
          {(isProcessing || summary) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-10 relative bg-white p-6 rounded-2xl shadow-xl ring-1 ring-indigo-100 overflow-hidden"
            >
              <div className="absolute -inset-1 bg-gradient-to-br from-indigo-100 to-purple-100 opacity-10 rounded-2xl blur-lg pointer-events-none"></div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold text-gray-800">Summary</h2>

                  {dirty ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Unsaved
                    </span>
                  ) : lastSavedAt ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Saved
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleReset}
                    className="text-gray-600 hover:text-gray-900 text-sm inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Clear
                  </button>

                  <div className="hidden sm:block h-6 w-px bg-gray-200" />

                  <button
                    onClick={() => setIsEditing((v) => !v)}
                    className="text-sm inline-flex items-center gap-1 px-3 py-2 rounded-xl border hover:bg-gray-50"
                  >
                    {isEditing ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Done
                      </>
                    ) : (
                      <>
                        <PencilLine className="w-4 h-4" /> Edit
                      </>
                    )}
                  </button>

                  <div className="hidden sm:block h-6 w-px bg-gray-200" />

                  <button
                    onClick={handleCopy}
                    disabled={!summary}
                    className="transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white px-4 py-2 rounded-xl text-sm inline-flex items-center"
                  >
                    <ClipboardCopy className="w-4 h-4 mr-1" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    disabled={!summary}
                    className="transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-xl text-sm"
                  >
                    PDF
                  </button>

                  <button
                    onClick={handleDownloadDOCX}
                    disabled={!summary}
                    className="transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-2 rounded-xl text-sm"
                  >
                    DOCX
                  </button>

                  {/* Save into a folder; when done, clear "Unsaved" */}
                  {summary && (
                    folderId ? (
                      // If we came from a folder, show direct save button
                      <button
                        onClick={saveToCurrentFolder}
                        disabled={isSavingToFolder}
                        className="transition-all duration-200 hover:shadow-md disabled:opacity-50 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2"
                      >
                        {isSavingToFolder ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FolderPlus className="w-4 h-4" />
                        )}
                        Save to Folder
                      </button>
                    ) : (
                      // Otherwise show the folder picker
                      <SaveToFolderButton
                        toolType="Smart Summarizer"
                        label="Save to Folder"
                        size="md"
                        color="bg-emerald-600 text-white hover:brightness-110"
                        buildItem={buildFolderItem}
                        onSaved={handleSaved}
                      />
                    )
                  )}
                </div>
              </div>

              {/* Editor / Preview */}
              <div className="relative z-10">
                {isProcessing ? (
                  <div className="flex items-center gap-2 text-indigo-500">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating summary...
                  </div>
                ) : (
                  <>
                    {isEditing ? (
                      <textarea
                        ref={textareaRef}
                        value={summary}
                        onChange={(e) => { setSummary(e.target.value); setDirty(true); }}
                        onInput={autoSize}
                        placeholder="Your summary will appear here. Edit it before saving."
                        className="w-full min-h-[220px] max-h-[500px] overflow-y-auto rounded-xl border border-indigo-200/70 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 px-4 py-3 text-gray-800 leading-relaxed bg-white/80"
                        spellCheck={true}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-gray-800 max-h-[500px] overflow-y-auto rounded-xl border border-transparent px-2 py-1">
                        {summary}
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>{wordCount} words • {summary.length} chars</span>
                      <span className="opacity-70">Tip: Save into a folder to track it</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Summarizer;
