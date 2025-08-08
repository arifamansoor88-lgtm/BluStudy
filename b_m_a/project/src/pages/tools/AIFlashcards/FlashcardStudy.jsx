import React, { useState } from 'react';
import { RotateCw, ArrowLeft, FileDown, Volume2, Pencil, Shuffle } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import { useDeckData } from './hooks';
import { useParams } from "react-router-dom";

const FlashcardStudyPage = () => {
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [flashcards, setFlashcards] = useState(useLocation().state?.flashcards || []);
    const { deckId } = useParams();
    const { saveDeck, deleteDeck, getFlashcardByID } = useDeckData();

    React.useEffect(() => {
        if (flashcards.length > 0 && flashcards[0].originalIndex === undefined) {
            setFlashcards(flashcards.map((card, i) => ({
                ...card,
                originalIndex: i
            })));
        }
    }, [useLocation().state?.flashcards]); // empty array means run only once when component mounts
    
    
    const difficultyWeights = {
        hard: 3,   // appears 3x more likely
        medium: 2, // 2x
        easy: 1    // normal
    };

    // Smart shuffle
    const smartShuffle = () => {
        const shuffled = [...flashcards].sort((a, b) => {
            const weightA = difficultyWeights[a.difficulty || 'medium'] || 1;
            const weightB = difficultyWeights[b.difficulty || 'medium'] || 1;
            return (Math.random() * (1 / weightA)) - (Math.random() * (1 / weightB));
        });

        setFlashcards(shuffled);
        setIndex(flashcards[0].originalIndex); 
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

    // This Helper Function reverses the editing status while saves deck
    const handleEditStatusChange = async () => {
        // if (isEditing) {
        //     await deleteDeck(deckId);
        //     await saveDeck(getTitleOfDeck(), flashcards);
        // }
        setIsEditing((prev) => !prev)
    }

    const getTitleOfDeck = async () => {
        try {
            const deck = await getFlashcardByID(deckId); // Await the asynchronous call
            console.log(deck); // Debug the structure of the deck object
            return deck.data.title; // Access the title from the resolved data
        } catch (error) {
            console.error("Error fetching deck title:", error);
            return "Unknown Deck"
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
            // Question side
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

            // Answer side
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
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                value={card.answer}
                                onChange={(e) => handleCardEdit(i, 'answer', e.target.value)}
                                placeholder="Edit answer"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FlashcardStudyPage;
