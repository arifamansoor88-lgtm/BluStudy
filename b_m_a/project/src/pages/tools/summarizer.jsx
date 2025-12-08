import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
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
  AlertCircle
} from 'lucide-react';
import { generateSummary } from '../../api/apiService';

// reusable save-to-folder button
import SaveToFolderButton from '../../components/SaveToFolderButton';

const Summarizer = () => {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [summaryStyle, setSummaryStyle] = useState('high');
  const [summaryFormat, setSummaryFormat] = useState('bullet');
  const [copied, setCopied] = useState(false);

  // Editing / status
  const [isEditing, setIsEditing] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

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
        <div className="flex items-center gap-4 mb-8">
          <FileSearch className="h-8 w-8 text-indigo-600" />
          <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
            Smart Summarizer
          </h1>
        </div>

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
                    <SaveToFolderButton
                      toolType="Smart Summarizer"
                      label="Save to Folder"
                      size="md"
                      color="bg-emerald-600 text-white hover:brightness-110"
                      buildItem={buildFolderItem}
                      onSaved={handleSaved}   // <-- wire up
                    />
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
      </motion.div>
    </div>
  );
};

export default Summarizer;
