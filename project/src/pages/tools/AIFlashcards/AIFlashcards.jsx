import { useState, useEffect } from "react";
import { Brain, Plus, X, Save, Pencil, MoveRight } from "lucide-react";
import { useDeckData } from "./hooks";
import FlashcardDifficultySelector from "./FlashcardDifficultySelector";
import StarSelector from "./StarSelector";
import FlashcardDeckList from "./FlashcardDeckList";
import PreGeneratedFlashcardSection from "./PreGeneratedFlashcardSection";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const MIN_FLASHCARDS = 1;
const MAX_FLASHCARDS = 100;

const AIFlashcards = () => {
  // Get folderId from URL query params if present
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');
  
  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [topicPrompt, setTopicPrompt] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [difficulty, setDifficulty] = useState(null);
  const [selectedDeckID, setSelectedDeckID] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [numCards, setNumCards] = useState(10);
  const navigate = useNavigate();

  const {
    savedDecks,
    isSaving,
    saveSuccess,
    error,
    setError,
    decksFetchedRef,
    fetchSavedDecks,
    saveDeck,
    deleteDeck,
    generateFlashcardsFromTopic,
    generateFlashcards,
    getFlashcardByID,
  } = useDeckData();

  const addCard = () => {
    if (newQuestion && newAnswer && difficulty) {
      setCards([
        ...cards,
        {
          question: newQuestion,
          answer: newAnswer,
          difficulty: difficulty,
          important: false,
        },
      ]);
      setNewQuestion("");
      setNewAnswer("");
    }
  };

  const handleJSONUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const text = await file.text();
        const jsonData = JSON.parse(text);

        // JSON can be either a single deck object or an array of decks
        const decksToImport = Array.isArray(jsonData) ? jsonData : [jsonData];

        decksToImport.forEach((deckObj) => {
          if (deckObj.title && Array.isArray(deckObj.cards)) {
            // Save to existing system
            saveDeck(deckObj.title, deckObj.cards, folderId);
          } else {
            console.error("Invalid JSON format:", deckObj);
          }
        });

        alert("JSON flashcards uploaded successfully!");
      } catch (err) {
        console.error("Error reading JSON:", err);
        alert("Invalid JSON file. Please check the format.");
      }
    }
  };

  const removeCard = (index) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleDeckSelect = async (deckId) => {
    try {
      const fullDeck = await getFlashcardByID(deckId);

      navigate(`/tools/flashcards/study/${deckId}`, {
        state: {
          title: fullDeck.title,
          flashcards: fullDeck.cards,
        },
      });
    } catch (err) {
      console.error("Failed to open deck", err);
    }
  };

  const handlePreGeneratedDeckSelect = (deck) => {
    navigate(`/tools/flashcards/study/${deck.id}`);
  };

  const saveCard = () => {
    let deckName = prompt("Choose a name for this deck");
    saveDeck(deckName, cards, folderId);
  };

  const handleTopicGenerate = async () => {
    if (!topicPrompt) return;

    setIsProcessing(true);
    try {
      const result = await generateFlashcardsFromTopic(topicPrompt, numCards, folderId);

      navigate(`/tools/flashcards/study/${result.deckId}`, {
        state: {
          title: topicPrompt,
        },
      });
    } catch (err) {
      console.error(err);
      alert("Failed to generate flashcards from topic");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveCardTestDeck = async () => {
    let deckName = prompt("Choose a name for this deck");
    let id = await saveDeck(deckName, cards, folderId);
    navigate(`/tools/flashcards/study/${id}`, {
      state: {
        flashcards: cards,
        title: deckName,
      },
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsProcessing(true);
      try {
        await generateFlashcards(file, numCards, folderId);
        window.location.reload();
      } catch (error) {
        console.error("Error processing PDF:", error);
        alert(error.message || "Failed to generate flashcards from PDF");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleNumCardsChange = (e) => {
    const rawValue = e.target.value;

    if (rawValue === "") {
      setNumCards("");
      return;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsedValue)) {
      return;
    }

    setNumCards(
      Math.min(MAX_FLASHCARDS, Math.max(MIN_FLASHCARDS, parsedValue))
    );
  };

  const handleNumCardsBlur = () => {
    if (numCards === "") {
      setNumCards(10);
      return;
    }

    setNumCards(
      Math.min(MAX_FLASHCARDS, Math.max(MIN_FLASHCARDS, Number(numCards)))
    );
  };

  // Fetch saved decks on component mount
  useEffect(() => {
    if (!decksFetchedRef.current) {
      fetchSavedDecks();
    }
  }, [fetchSavedDecks, decksFetchedRef]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 rounded-full border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Generating flashcards…</p>
            <p className="text-sm text-gray-500">
              This usually takes under a minute
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900">AI Flashcards</h1>
        <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
          Upload a PDF and instantly generate study-ready flashcards using AI.
        </p>
      </div>

      {/* Topic Generator */}
      <div className="max-w-2xl mx-auto mb-24">
        <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Generate Flashcards from a Topic
            </h3>
          </div>

          <p className="text-sm text-gray-600 mb-6 max-w-xl">
            Type any topic, concept, or course name and let AI generate a
            complete flashcard deck for you.
          </p>

          <textarea
            value={topicPrompt}
            onChange={(e) => setTopicPrompt(e.target.value)}
            placeholder="e.g. Linear systems, cell division, World War II, etc."
            className="
        w-full rounded-xl border border-gray-300 p-4 text-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        resize-none h-28
      "
          />

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Number of flashcards
              </span>
              <input
                type="number"
                min={MIN_FLASHCARDS}
                max={MAX_FLASHCARDS}
                value={numCards}
                onChange={handleNumCardsChange}
                onBlur={handleNumCardsBlur}
                className="w-32 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-xs text-gray-500">
                Choose between {MIN_FLASHCARDS} and {MAX_FLASHCARDS} cards.
              </p>
            </label>

            <button
              disabled={!topicPrompt || numCards === ""}
              onClick={handleTopicGenerate}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3
             text-sm font-medium text-white hover:bg-blue-700 transition
             disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Flashcards
              <MoveRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Upload Card */}
      <div className="max-w-xl mx-auto mb-24">
        <div className="mb-4 flex items-end justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gray-900">PDF flashcard count</p>
            <p className="text-xs text-gray-500">
              The uploaded PDF will use the same card count.
            </p>
          </div>

          <input
            type="number"
            min={MIN_FLASHCARDS}
            max={MAX_FLASHCARDS}
            value={numCards}
            onChange={handleNumCardsChange}
            onBlur={handleNumCardsBlur}
            className="w-28 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <label
          htmlFor="pdf-upload"
          className="group cursor-pointer block rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm hover:shadow-md transition"
        >
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-105 transition">
            <Plus className="h-7 w-7 text-blue-600" />
          </div>

          <h3 className="text-lg font-semibold text-gray-900">Upload a PDF</h3>
          <p className="mt-1 text-sm text-gray-500">
            Lecture notes, slides, textbooks
          </p>

          <p className="mt-4 text-xs text-gray-400">
            PDF only • AI-generated flashcards
          </p>
        </label>

        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Saved Decks */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Your Flashcard Decks
        </h2>

        {savedDecks.length > 0 ? (
          <FlashcardDeckList
            decks={savedDecks}
            onDeckSelect={handleDeckSelect}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
            No flashcard decks yet. Upload a PDF to get started.
          </div>
        )}
      </div>

      <PreGeneratedFlashcardSection
        onDeckSelect={handlePreGeneratedDeckSelect}
      />
    </div>
  );
};

export default AIFlashcards;
