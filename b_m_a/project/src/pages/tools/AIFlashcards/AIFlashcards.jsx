import React, { useState, useEffect } from 'react';
import { Brain, Plus, X, Save, Pencil, MoveRight } from 'lucide-react';
import { useDeckData } from './hooks';
import FlashcardDifficultySelector from "./FlashcardDifficultySelector";
import StarSelector from "./StarSelector"
import FlashcardDeckList from './FlashcardDeckList';
import FlashcardStudyPage from './FlashcardStudy';
import { Link, useNavigate } from "react-router-dom";

const AIFlashcards = () => {
    const [cards, setCards] = useState([]);
    const [decks, setDecks] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');
    const [difficulty, setDifficulty] = useState(null);
    const [selectedDeckID, setSelectedDeckID] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const navigate = useNavigate();

    const addCard = () => {
        if (newQuestion && newAnswer && difficulty) {
            setCards([...cards, { question: newQuestion, answer: newAnswer, difficulty: difficulty, important: false }]);
            setNewQuestion('');
            setNewAnswer('');
        }
    };

    const removeCard = (index) => {
        setCards(cards.filter((_, i) => i !== index));
    };

    const handleDeckSelect = (deck) => {
        console.log("Selected deck:", deck);
        setSelectedDeckID(deck);
    };

    const saveCard = () => {
        let deckName = prompt("Choose a name for this deck");
        saveDeck(deckName, cards);
    }

    const saveCardTestDeck = async () => {
        let deckName = prompt("Choose a name for this deck");
        let id = await saveDeck(deckName, cards);
        navigate(`./FlashcardStudyPage/tools/flashcards/FlashcardStudyPage/${id}`, {
            state: { flashcards: cards }
        });
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setIsProcessing(true);
            try {
                await generateFlashcards(file, 10);
                window.location.reload();
            } catch (error) {
                console.error("Error processing PDF:", error);
            } finally {
                setIsProcessing(false);
            }
        }
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
        deleteDeck,
        generateFlashcards
    } = useDeckData();

    // Fetch saved decks on component mount
    useEffect(() => {
        if (!decksFetchedRef.current) {
            fetchSavedDecks();
        }
    }, [fetchSavedDecks, decksFetchedRef]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Processing Modal */}
            {isProcessing && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-lg font-medium text-gray-900">Processing PDF...</p>
                        <p className="text-sm text-gray-600">This may take a few moments</p>
                    </div>
                </div>
            )}

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
                            onClick={saveCard}
                            className={`flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg
                    transition-all duration-300 hover:bg-blue-700`}
                        >
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
                        <button
                            onClick={() => {
                                const updatedCards = [...cards];
                                updatedCards[index].isEditing = !updatedCards[index].isEditing;
                                setCards(updatedCards);
                            }}
                            className="absolute top-2 right-10 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        <StarSelector onSelect={(isImportant) => {
                            const updatedCards = [...cards];
                            updatedCards[index].important = isImportant;
                            setCards(updatedCards);
                        }} />
                        {card.isEditing ? (
                            <>
                                <h3 className="font-medium text-gray-900 mb-2">Question:</h3>
                                <input
                                    type="text"
                                    value={card.question}
                                    onChange={(e) => {
                                        const updatedCards = [...cards];
                                        updatedCards[index].question = e.target.value;
                                        setCards(updatedCards);
                                    }}
                                    className="w-full p-2 mb-4 border rounded-md text-gray-600"
                                />
                                <h3 className="font-medium text-gray-900 mb-2">Answer:</h3>
                                <input
                                    type="text"
                                    value={card.answer}
                                    onChange={(e) => {
                                        const updatedCards = [...cards];
                                        updatedCards[index].answer = e.target.value;
                                        setCards(updatedCards);
                                    }}
                                    className="w-full p-2 mb-4 border rounded-md text-gray-600"
                                />
                                <h3 className="font-medium text-gray-900 mb-2">Difficulty:</h3>
                                <select
                                    value={card.difficulty}
                                    onChange={(e) => {
                                        const updatedCards = [...cards];
                                        updatedCards[index].difficulty = e.target.value;
                                        setCards(updatedCards);
                                    }}
                                    className="w-full p-2 mb-4 border rounded-md text-gray-600"
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                                <button
                                    onClick={() => {
                                        const updatedCards = [...cards];
                                        updatedCards[index].isEditing = false;
                                        setCards(updatedCards);
                                    }}
                                    className="mt-2 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Save
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="font-medium text-gray-900 mb-2">Question:</h3>
                                <p className="text-gray-600 mb-4">{card.question}</p>
                                <h3 className="font-medium text-gray-900 mb-2">Answer:</h3>
                                <p className="text-gray-600">{card.answer}</p>
                                <div className="flex items-center gap-2 p-2 rounded-md bg-gray-100 shadow-sm transition-all duration-300 hover:scale-105">
                                    <div className={`w-3 h-3 rounded-full ${card.difficulty.toLowerCase() === 'easy' ? 'bg-green-500' :
                                        card.difficulty.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                                            card.difficulty.toLowerCase() === 'hard' ? 'bg-red-500' : 'bg-gray-500'
                                        } animate-pulse`}></div>
                                    <p className="text-sm font-semibold text-gray-700">
                                        {card.difficulty.charAt(0).toUpperCase() + card.difficulty.slice(1).toLowerCase()}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Saved Decks</h2>
                <FlashcardDeckList
                    decks={savedDecks}
                    onDeckSelect={handleDeckSelect}
                />
            </div>
        </div>
    );
};

export default AIFlashcards;