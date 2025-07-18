import React, { useState, useEffect } from 'react';
import { Brain, Plus, X, Save, Star } from 'lucide-react';
import { useDeckData } from './hooks';
import FlashcardDifficultySelector from "./FlashcardDifficultySelector";
import StarSelector from "./StarSelector"

const AIFlashcards = () => {
    const [cards, setCards] = useState([]);
    const [decks, setDecks] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');
    const [difficulty, setDifficulty] = useState(null);

    const addCard = () => {
        if (newQuestion && newAnswer && difficulty) {
            setCards([...cards, { question: newQuestion, answer: newAnswer, difficulty: difficulty, important: false }]);
            setNewQuestion('');
            setNewAnswer('');
            setDifficulty(null);
        }
    };

    const removeCard = (index) => {
        setCards(cards.filter((_, i) => i !== index));
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        console.log(file);
    }

    const {
        savedDecks,
        isSaving,
        saveSuccess,
        error,
        setError,
        decksFetchedRef,
        fetchSavedDecks,
        saveDeck,
    } = useDeckData();

    // Fetch saved decks on component mount
    useEffect(() => {
        if (!decksFetchedRef.current) {
            fetchSavedDecks();
        }
    }, [fetchSavedDecks, decksFetchedRef]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-4 mb-8">
                <Brain className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">AI Flashcards</h1>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Flashcard Deck</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                        <input
                            type="text"
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Enter your question"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                        <input
                            type="text"
                            value={newAnswer}
                            onChange={(e) => setNewAnswer(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Enter the answer"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                        <FlashcardDifficultySelector onSelect={setDifficulty} />
                    </div>
                    {/* Flex container for side-by-side buttons */}
                    <div className="flex gap-4">
                        <button
                            onClick={addCard}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Card
                        </button>
                        {/* Label triggers the hidden file input */}
                        <label
                            htmlFor="pdf-upload"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            Upload PDF
                        </label>
                        <input
                            id="pdf-upload"
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <button
                            onClick={console.log(cards)}
                            className={`flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg
                    transition-all duration-300 hover:bg-blue-700`}>
                            <Save className="h-4 w-4" />
                            Save Deck
                        </button>
                    </div>
                </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                {cards.map((card, index) => (
                    <div key={index} className="bg-white p-6 rounded-lg shadow-sm relative group flex flex-col h-full">
                        <button
                            onClick={() => removeCard(index)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <StarSelector onSelect={(isImportant) => {
                            const updatedCards = [...cards];
                            updatedCards[index].important = isImportant;
                            setCards(updatedCards);
                        }} />
                        <h3 className="font-medium text-gray-900 mb-2">Question:</h3>
                        <p className="text-gray-600 mb-4">{card.question}</p>
                        <h3 className="font-medium text-gray-900 mb-2">Answer:</h3>
                        <p className="text-gray-600">{card.answer}</p>
                        <h3 className="font-medium text-gray-900 mb-2">Difficulty:</h3>
                        <p className="text-gray-600">{card.difficulty}</p>
                        <h3 className="font-medium text-gray-900 mb-2">Importance:</h3>
                        <p className="text-gray-600">{card.important.toString()}</p>
                    </div>
                ))}
            </div>

            {/* Saved decks */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Saved Decks</h2>
                {decks.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No saved decks yet.</p>
                    </div>
                ) : (
                    decks.map(deck => (
                        <div
                            key={deck.title}
                            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-gray-500">{note.timestamp}</span>
                                        <span className="text-sm text-gray-400">({formatDuration(note.duration)})</span>
                                    </div>
                                    <p className="text-gray-900 mb-4">{note.text}</p>
                                    {note.audioUrl && (
                                        <audio controls src={note.audioUrl} className="w-full" />
                                    )}
                                </div>
                                <button
                                    onClick={() => saveDeck}
                                    className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AIFlashcards;