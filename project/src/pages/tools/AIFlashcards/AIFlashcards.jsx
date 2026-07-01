import { useState, useEffect } from "react";
import { Layers, Plus, MoveRight, Upload, FileText } from "lucide-react";
import { useDeckData } from "./hooks";
import FlashcardDeckList from "./FlashcardDeckList";
import PreGeneratedFlashcardSection from "./PreGeneratedFlashcardSection";
import { useNavigate, useSearchParams } from "react-router-dom";

const MIN_FLASHCARDS = 1;
const MAX_FLASHCARDS = 100;

const AIFlashcards = () => {
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("folderId");

  const [tab, setTab] = useState("topic"); // "topic" | "pdf"
  const [topicPrompt, setTopicPrompt] = useState("");
  const [numCards, setNumCards] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const {
    savedDecks,
    decksFetchedRef,
    fetchSavedDecks,
    saveDeck,
    generateFlashcardsFromTopic,
    generateFlashcards,
    getFlashcardByID,
  } = useDeckData();

  useEffect(() => {
    if (!decksFetchedRef.current) fetchSavedDecks();
  }, [fetchSavedDecks, decksFetchedRef]);

  const handleNumCardsChange = (e) => {
    const v = e.target.value;
    if (v === "") { setNumCards(""); return; }
    const n = parseInt(v, 10);
    if (!isNaN(n)) setNumCards(Math.min(MAX_FLASHCARDS, Math.max(MIN_FLASHCARDS, n)));
  };

  const handleNumCardsBlur = () => {
    if (numCards === "") setNumCards(10);
    else setNumCards(Math.min(MAX_FLASHCARDS, Math.max(MIN_FLASHCARDS, Number(numCards))));
  };

  const handleTopicGenerate = async () => {
    if (!topicPrompt) return;
    setIsProcessing(true);
    try {
      const result = await generateFlashcardsFromTopic(topicPrompt, numCards, folderId);
      navigate(`/tools/flashcards/study/${result.deckId}`, { state: { title: topicPrompt } });
    } catch (err) {
      alert("Failed to generate flashcards from topic");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      await generateFlashcards(file, numCards, folderId);
      window.location.reload();
    } catch (error) {
      alert(error.message || "Failed to generate flashcards from PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeckSelect = async (deckId) => {
    try {
      const fullDeck = await getFlashcardByID(deckId);
      navigate(`/tools/flashcards/study/${deckId}`, { state: { title: fullDeck.title, flashcards: fullDeck.cards } });
    } catch (err) {
      console.error("Failed to open deck", err);
    }
  };

  const handlePreGeneratedDeckSelect = (deck) => {
    navigate(`/tools/flashcards/study/${deck.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 rounded-full border-2 border-primary-600 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Generating flashcards...</p>
            <p className="text-sm text-gray-500">This usually takes under a minute</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary-50 p-2.5 rounded-xl">
          <Layers className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Flashcards</h1>
          <p className="text-sm text-gray-500">Generate study-ready flashcards from a topic or PDF</p>
        </div>
      </div>

      {/* Creation panel */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-8">

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { key: "topic", label: "From a Topic", icon: Layers },
            { key: "pdf",   label: "Upload PDF",   icon: FileText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "topic" ? (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Type any topic, concept, or course name and let AI build a complete deck for you.
              </p>
              <textarea
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder="e.g. Cell division, World War II, Linear systems..."
                className="w-full rounded-xl border border-gray-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none h-28"
              />
              <div className="flex items-end justify-between mt-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 mb-1 block">Number of cards</span>
                  <input
                    type="number"
                    min={MIN_FLASHCARDS}
                    max={MAX_FLASHCARDS}
                    value={numCards}
                    onChange={handleNumCardsChange}
                    onBlur={handleNumCardsBlur}
                    className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">1 – 100 cards</p>
                </label>
                <button
                  disabled={!topicPrompt || numCards === ""}
                  onClick={handleTopicGenerate}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate Flashcards
                  <MoveRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Upload lecture notes, slides, or a textbook chapter and AI will extract the key concepts.
              </p>

              <label
                htmlFor="pdf-upload"
                className="group cursor-pointer flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-primary-400 hover:bg-primary-50 transition p-10 text-center"
              >
                <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                  <Upload className="h-5 w-5 text-primary-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">Click to upload a PDF</p>
                <p className="text-xs text-gray-400 mt-1">PDF only</p>
              </label>
              <input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />

              <div className="flex items-center justify-between mt-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 mb-1 block">Number of cards</span>
                  <input
                    type="number"
                    min={MIN_FLASHCARDS}
                    max={MAX_FLASHCARDS}
                    value={numCards}
                    onChange={handleNumCardsChange}
                    onBlur={handleNumCardsBlur}
                    className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">1 – 100 cards</p>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Decks */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Flashcard Decks</h2>
        {savedDecks.length > 0 ? (
          <FlashcardDeckList decks={savedDecks} onDeckSelect={handleDeckSelect} />
        ) : (
          <p className="text-sm text-gray-400">No decks yet. Generate one above to get started.</p>
        )}
      </div>

      {/* Pre-generated carousel */}
      <PreGeneratedFlashcardSection onDeckSelect={handlePreGeneratedDeckSelect} />
    </div>
  );
};

export default AIFlashcards;
