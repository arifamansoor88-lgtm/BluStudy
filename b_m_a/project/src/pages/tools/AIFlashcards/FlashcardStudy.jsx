import React, { useState } from 'react';
import { RotateCw, ArrowLeft } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

// Example flashcard prop structure
// const flashcards = [
//   { question: 'What is 2 + 2?', answer: '4' },
//   { question: 'Capital of France?', answer: 'Paris' },
// ];

const FlashcardStudyPage = () => {
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const flashcards = useLocation().state?.flashcards || [];

    const handleNext = () => {
        setIndex((prevIndex) => (prevIndex + 1) % flashcards.length);
        setFlipped(false);
    };

    const handleFlip = () => {
        setFlipped((prev) => !prev);
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
            <div className="mb-6">
                <Link
                    to="/tools/flashcards"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Flashcards
                </Link>
            </div>

            <div
                className="cursor-pointer w-full h-64 bg-white shadow-lg rounded-lg flex items-center justify-center text-center text-2xl font-semibold text-gray-700 transition-transform transform-gpu hover:scale-105"
                onClick={handleFlip}
            >
                {flipped ? currentCard.answer : currentCard.question}
            </div>

            <div className="mt-6 flex justify-between items-center">
                <button
                    onClick={handleNext}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <RotateCw className="w-4 h-4" />
                    Next Card
                </button>

                <p className="text-sm text-gray-500">
                    Card {index + 1} of {flashcards.length}
                </p>
            </div>
        </div>
    );
};

export default FlashcardStudyPage;