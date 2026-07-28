import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  ArrowLeft,
  FileDown,
  Volume2,
  Pencil,
  Shuffle,
  Plus,
  RotateCcw,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { useLocation, Link, useParams, useNavigate } from 'react-router-dom';
import { renderTextWithMath } from '../PracticeTests/MathText';
import jsPDF from 'jspdf';
import { useDeckData } from './hooks';
import FlashcardDifficultySelector from './FlashcardDifficultySelector';
import {
  getPreGeneratedDeckById,
  isPreGeneratedDeckId,
} from './preGeneratedDecks';

const FlashcardStudyPage = () => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const location = useLocation();
  const { deckId } = useParams();
  const navigate = useNavigate();
  const routeTitle = location.state?.title || '';
  const isPreGeneratedDeck = isPreGeneratedDeckId(deckId);
  // Guest decks aren't persisted to the backend — cards arrive via navigation state
  const isUnsavedDeck = Boolean(location.state?.flashcards?.length);

  const { getFlashcardByID, updateDeck } = useDeckData();

  const [deckTitle, setDeckTitle] = useState(routeTitle);
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newDifficulty, setNewDifficulty] = useState(null);

  /* ----------------------------------------
     NORMALIZE EVERYTHING INTO ONE SHAPE
  -----------------------------------------*/
  const normalizeCard = (card) => ({
    question: card.question ?? card.front ?? '',
    answer: card.answer ?? card.back ?? '',
    difficulty: card.difficulty ?? 'medium',
    important: card.important ?? false
  });

  /* ----------------------------------------
     LOAD FROM BACKEND
  -----------------------------------------*/
  useEffect(() => {
    if (isUnsavedDeck) {
      setDeckTitle(location.state.title || routeTitle || 'Flashcards');
      setFlashcards(location.state.flashcards.map(normalizeCard));
      setLoading(false);
      return;
    }

    if (!deckId) {
      setLoading(false);
      return;
    }

    if (isPreGeneratedDeck) {
      const sampleDeck = getPreGeneratedDeckById(deckId);

      setDeckTitle(sampleDeck?.title || routeTitle || 'Pre-Generated Deck');
      setFlashcards((sampleDeck?.cards || []).map(normalizeCard));
      setLoading(false);
      return;
    }

    setLoading(true);
    getFlashcardByID(deckId)
      .then((deck) => {
        setDeckTitle(deck.title);
        setFlashcards(deck.cards.map(normalizeCard));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [deckId, getFlashcardByID, isPreGeneratedDeck, routeTitle, isUnsavedDeck, location.state]);

  /* ----------------------------------------
     STUDY MODE CONTROLS
  -----------------------------------------*/
  const handleFlip = () => setFlipped((p) => !p);

  const handleNext = () => {
    if (index === flashcards.length - 1) {
      setShowEndScreen(true);
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  };

  const handleRestart = () => {
    setIndex(0);
    setFlipped(false);
    setShowEndScreen(false);
  };

  const speakCard = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const text = flipped
      ? flashcards[index].answer
      : flashcards[index].question;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    synth.speak(utterance);
  };

  const difficultyWeights = { easy: 1, medium: 2, hard: 3 };

  const smartShuffle = () => {
    const shuffled = [...flashcards].sort(
      (a, b) =>
        Math.random() * (1 / difficultyWeights[a.difficulty]) -
        Math.random() * (1 / difficultyWeights[b.difficulty])
    );
    setFlashcards(shuffled);
    setIndex(0);
    setFlipped(false);
  };

  /* ----------------------------------------
     EDIT MODE
  -----------------------------------------*/
  const handleCardEdit = (i, field, value) => {
    setFlashcards((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
  };

  const handleAddCard = () => {
    if (!newQuestion || !newAnswer || !newDifficulty) return;

    setFlashcards((prev) => [
      ...prev,
      {
        question: newQuestion,
        answer: newAnswer,
        difficulty: newDifficulty,
        important: false
      }
    ]);

    setNewQuestion('');
    setNewAnswer('');
    setNewDifficulty(null);
  };

  const toggleEditMode = async () => {
    if (isPreGeneratedDeck) {
      return;
    }

    if (isEditing && !isUnsavedDeck) {
      await updateDeck(deckTitle, deckId, flashcards);
    }
    setIsEditing((p) => !p);
  };

  /* ----------------------------------------
     EXPORTS
  -----------------------------------------*/
  const exportToJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ title: deckTitle, cards: flashcards }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckTitle || 'flashcards'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ----------------------------------------
     RENDER
  -----------------------------------------*/
  if (loading) {
    return <div className="text-center py-16">Loading flashcards…</div>;
  }

  if (!flashcards.length) {
    return <div className="text-center py-16">No flashcards available.</div>;
  }

  const currentCard = flashcards[index];

  if (showEndScreen) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-12">
          <div className="flex justify-center mb-4">
            <div className="bg-green-50 p-4 rounded-full">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You finished the deck!</h2>
          <p className="text-gray-500 mb-8">
            You went through all {flashcards.length} cards in <span className="font-medium text-gray-700">{deckTitle}</span>. What do you want to do next?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleRestart}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Retry flashcards
            </button>
            <button
              onClick={() => navigate('/tools/practice-tests', { state: { flashcards, deckTitle } })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              Create a quiz on this topic
            </button>
          </div>
          <Link to="/tools/flashcards" className="inline-block mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Back to all decks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex justify-between mb-6">
        <Link to="/tools/flashcards" className="text-blue-600 flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>

        <div className="flex gap-4">
          {!isPreGeneratedDeck ? (
            <button onClick={toggleEditMode} className="text-gray-600 flex items-center">
              <Pencil className="w-4 h-4 mr-1" />
              {isEditing ? 'Save Editor' : 'Edit Cards'}
            </button>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              Pre-generated deck
            </span>
          )}
          <button onClick={exportToJSON} className="text-blue-600 flex items-center">
            <FileDown className="w-4 h-4 mr-1" />
            Export JSON
          </button>
        </div>
      </div>

      {!isEditing ? (
        <>
          {/* Progress + actions row */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500 font-medium">
              {index + 1} / {flashcards.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); speakCard(); }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="Read aloud"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onClick={smartShuffle}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="Smart shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full mb-6">
            <div
              className="h-1.5 bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / flashcards.length) * 100}%` }}
            />
          </div>

          {/* Flip card */}
          <div
            className="relative h-72 cursor-pointer select-none"
            style={{ perspective: '1200px' }}
            onClick={handleFlip}
          >
            <div
              className="relative w-full h-full transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front — question */}
              <div
                className="absolute inset-0 bg-white border border-gray-100 rounded-2xl shadow-md flex flex-col items-center justify-center p-8 text-center"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Question</span>
                <div className="text-xl font-semibold text-gray-800 leading-relaxed">{renderTextWithMath(currentCard.question)}</div>
                <span className="mt-6 text-xs text-gray-300">Click to reveal answer</span>
              </div>

              {/* Back — answer */}
              <div
                className="absolute inset-0 bg-primary-50 border border-primary-100 rounded-2xl shadow-md flex flex-col items-center justify-center p-8 text-center"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-primary-400 mb-4">Answer</span>
                <div className="text-xl font-semibold text-primary-800 leading-relaxed">{renderTextWithMath(currentCard.answer)}</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => { setIndex((i) => (i - 1 + flashcards.length) % flashcards.length); setFlipped(false); }}
              className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {flashcards.map((card, i) => (
            <div key={i} className="bg-white p-4 rounded shadow">
              <p className="mb-2 font-medium">Card {i + 1}</p>
              <input
                value={card.question}
                onChange={(e) => handleCardEdit(i, 'question', e.target.value)}
                className="w-full mb-2 border px-3 py-2 rounded"
              />
              <input
                value={card.answer}
                onChange={(e) => handleCardEdit(i, 'answer', e.target.value)}
                className="w-full mb-2 border px-3 py-2 rounded"
              />
              <select
                value={card.difficulty}
                onChange={(e) => handleCardEdit(i, 'difficulty', e.target.value)}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          ))}

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-medium mb-4">Add New Flashcard</h3>
            <input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Question"
              className="w-full mb-2 border px-3 py-2 rounded"
            />
            <input
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Answer"
              className="w-full mb-2 border px-3 py-2 rounded"
            />
            <FlashcardDifficultySelector onSelect={setNewDifficulty} />
            <button
              onClick={handleAddCard}
              disabled={!newQuestion || !newAnswer || !newDifficulty}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardStudyPage;
