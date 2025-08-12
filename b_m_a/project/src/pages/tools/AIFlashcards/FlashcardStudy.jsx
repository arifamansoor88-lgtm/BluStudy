import React, { useState, useEffect } from 'react';
import { RotateCw, ArrowLeft, FileDown, Volume2, Pencil, Shuffle, Plus } from 'lucide-react';
import { useLocation, Link, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { useDeckData } from './hooks';
import FlashcardDifficultySelector from './FlashcardDifficultySelector';

const FlashcardStudyPage = () => {
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [flashcards, setFlashcards] = useState(useLocation().state?.flashcards || []);
    const { deckId } = useParams();
    const [loading, setLoading] = useState(false);
    const { saveDeck, deleteDeck, getFlashcardByID } = useDeckData();
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');
    const [newDifficulty, setNewDifficulty] = useState(null);

    useEffect(() => {
        if (flashcards.length > 0 && flashcards[0].originalIndex === undefined) {
            setFlashcards(flashcards.map((card, i) => ({
                ...card,
                originalIndex: i
            })));
        }
    }, [useLocation().state?.flashcards]);

    useEffect(() => {
        if (flashcards.length === 0 && deckId) {
            setLoading(true);
            getFlashcardByID(deckId)
                .then(deck => {
                    setFlashcards(deck.data.flashcards || []);
                })
                .catch(err => {
                    console.error("Error loading deck", err);
                })
                .finally(() => setLoading(false));
        }
    }, [deckId, getFlashcardByID]);

    const difficultyWeights = {
        hard: 3,
        medium: 2,
        easy: 1
    };

    const smartShuffle = () => {
        const shuffled = [...flashcards].sort((a, b) => {
            const weightA = difficultyWeights[a.difficulty || 'medium'] || 1;
            const weightB = difficultyWeights[b.difficulty || 'medium'] || 1;
            return (Math.random() * (1 / weightA)) - (Math.random() * (1 / weightB));
        });

        setFlashcards(shuffled);
        setIndex(shuffled[0]?.originalIndex || 0);
        setFlipped(false);
    };

    const handleNext = () => {
        setIndex((prevIndex) => (prevIndex + 1) % flashcards.length);
        setFlipped(false);
    };

    const handleFlip = () => setFlipped((prev) => !prev);

    const speakCard = () => {
        const synth = window.speechSynthesis;
        synth.cancel();
        const text = flipped ? flashcards[index].answer : flashcards[index].question;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        synth.speak(utterance);
    };

    const handleEditStatusChange = async () => {
        if (isEditing && (newQuestion || newAnswer || newDifficulty)) {
            if (window.confirm('You have unsaved changes in the new card form. Save them before closing?')) {
                await handleAddCard();
            }
        }
        setIsEditing((prev) => !prev);
        setNewQuestion('');
        setNewAnswer('');
        setNewDifficulty(null);
    };

    const getTitleOfDeck = async () => {
        try {
            const deck = await getFlashcardByID(deckId);
            return deck.data.title || 'Untitled Deck';
        } catch (error) {
            console.error('Error fetching deck title:', error);
            return 'Untitled Deck';
        }
    };

    const handleAddCard = async () => {
        if (newQuestion && newAnswer && newDifficulty) {
            const newCard = {
                question: newQuestion,
                answer: newAnswer,
                difficulty: newDifficulty,
                important: false,
                originalIndex: flashcards.length
            };
            const updatedFlashcards = [...flashcards, newCard];
            setFlashcards(updatedFlashcards);
            setNewQuestion('');
            setNewAnswer('');
            setNewDifficulty(null);

            try {
                const deckTitle = await getTitleOfDeck();
                await deleteDeck(deckId); // Delete old deck
                await saveDeck(deckTitle, updatedFlashcards); // Save updated deck
            } catch (error) {
                console.error('Error saving new card to deck:', error);
            }
        }
    };

    const exportToPDF = () => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const cardWidth = 400;
        const cardHeight = 250;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const centerX = (pageWidth - cardWidth) / 2;
        const centerY = (pageHeight - cardHeight) / 2;

        flashcards.forEach((card, i) => {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(200);
            doc.setLineWidth(1);
            doc.roundedRect(centerX, centerY, cardWidth, cardHeight, 10, 10, 'FD');
            doc.setFontSize(16);
            doc.setTextColor(51, 51, 51);
            doc.setFont('helvetica', 'bold');
            doc.text(`Card ${i + 1}`, pageWidth / 2, centerY - 20, { align: 'center' });
            doc.setFontSize(18);
            doc.setFont('helvetica', 'normal');
            doc.text(card.question, pageWidth / 2, pageHeight / 2, {
                align: 'center',
                maxWidth: cardWidth - 40
            });
            doc.addPage();

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(200);
            doc.setLineWidth(1);
            doc.roundedRect(centerX, centerY, cardWidth, cardHeight, 10, 10, 'FD');
            doc.setFontSize(16);
            doc.setTextColor(51, 51, 51);
            doc.setFont('helvetica', 'bold');
            doc.text(`Answer to Card ${i + 1}`, pageWidth / 2, centerY - 20, { align: 'center' });
            doc.setFontSize(18);
            doc.setFont('helvetica', 'normal');
            doc.text(card.answer, pageWidth / 2, pageHeight / 2, {
                align: 'center',
                maxWidth: cardWidth - 40
            });

            if (i < flashcards.length - 1) {
                doc.addPage();
            }
        });

        doc.save('flashcards.pdf');
    };

    const handleCardEdit = (i, field, value) => {
        const updated = [...flashcards];
        updated[i][field] = value;
        setFlashcards(updated);
    };

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <p className="text-gray-600 text-lg">Loading flashcards...</p>
            </div>
        );
    }

    if (flashcards.length === 0) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <p className="text-gray-600 text-lg">No flashcards available.</p>
                <Link
                    to="/tools/flashcards"
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Flashcards
                </Link>
            </div>
        );
    }

    const currentCard = flashcards[index];

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="mb-6 flex justify-between items-center">
                <Link
                    to="/tools/flashcards"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Flashcards
                </Link>
                <div className="flex items-center gap-4">
                    <button
                        onClick={exportToPDF}
                        className="inline-flex items-center gap-2 text-sm text-green-600 hover:underline"
                    >
                        <FileDown className="w-4 h-4" />
                        Export to PDF
                    </button>
                    <button
                        onClick={handleEditStatusChange}
                        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:underline"
                    >
                        <Pencil className="w-4 h-4" />
                        {isEditing ? 'Close Editor' : 'Edit Cards'}
                    </button>
                </div>
            </div>

            {!isEditing ? (
                <>
                    <div
                        className="relative cursor-pointer w-full h-64 bg-white shadow-lg rounded-lg flex items-center justify-center text-center text-2xl font-semibold text-gray-700 transition-transform transform-gpu hover:scale-105"
                        onClick={handleFlip}
                    >
                        {flipped ? currentCard.answer : currentCard.question}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                speakCard();
                            }}
                            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
                            title="Speak"
                        >
                            <Volume2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mt-6 flex justify-between items-center">
                        <button
                            onClick={handleNext}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            <RotateCw className="w-4 h-4" />
                            Next Card
                        </button>
                        <button
                            onClick={smartShuffle}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                        >
                            <Shuffle className="w-4 h-4" />
                            Smart Shuffle
                        </button>
                        <p className="text-sm text-gray-500">
                            Card {index + 1} of {flashcards.length}
                        </p>
                    </div>
                </>
            ) : (
                <div className="space-y-6">
                    {flashcards.map((card, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg shadow">
                            <p className="text-gray-600 font-medium mb-2">Card {i + 1}</p>
                            <input
                                className="w-full mb-2 px-3 py-2 border rounded-md text-sm"
                                value={card.question}
                                onChange={(e) => handleCardEdit(i, 'question', e.target.value)}
                                placeholder="Edit question"
                            />
                            <input
                                className="w-full mb-2 px-3 py-2 border rounded-md text-sm"
                                value={card.answer}
                                onChange={(e) => handleCardEdit(i, 'answer', e.target.value)}
                                placeholder="Edit answer"
                            />
                            <select
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                value={card.difficulty || 'medium'}
                                onChange={(e) => handleCardEdit(i, 'difficulty', e.target.value)}
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                    ))}
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Flashcard</h3>
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
                                <FlashcardDifficultySelector onSelect={setNewDifficulty} />
                            </div>
                            <button
                                onClick={handleAddCard}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                disabled={!newQuestion || !newAnswer || !newDifficulty}
                            >
                                <Plus className="h-4 w-4" />
                                Add Card
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlashcardStudyPage;