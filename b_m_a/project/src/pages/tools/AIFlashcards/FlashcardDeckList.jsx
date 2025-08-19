import React from "react";
import { X, Calendar } from 'lucide-react';
import { useDeckData } from "./hooks";
import { Link } from 'react-router-dom';

const CardStackIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" />
    </svg>
);

const FlashcardDeckList = ({ decks, onDeckSelect }) => {
    const { deleteDeck } = useDeckData();

    const handleDeleteDeck = async (deckId, e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this deck?")) {
            try {
                await deleteDeck(deckId);
            } catch (err) {
                console.error('Failed to delete deck:', err);
            }
            window.location.reload()
        }
    };

    if (!decks || decks.length === 0) {
        return (
            <div className="text-center py-10 px-4">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
                    <p className="text-gray-600 dark:text-gray-400">
                        No saved decks yet. Create a deck to get started!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {decks.map((deck) => {
                const cards = deck.data.cards || [];
                const lastEdited = deck.createdAt || null;
                return (
                    <div
                        key={deck.id}
                        className="relative group bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-shadow duration-200 ease-in-out"
                        onClick={() => onDeckSelect(deck)}
                    >
                        <button
                            onClick={(e) => handleDeleteDeck(deck.id, e)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <Link
                            to={`/tools/flashcards/FlashcardStudyPage/${deck.id}`}
                            state={{ flashcards: cards, title: deck.data.title || "Untitled Deck"}}
                        >
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                {deck.data.title || "Untitled Deck"}
                            </h3>
                        </Link>

                        {/* Folder dropdown (UI only, no state saving yet) */}
                        <div className="mt-3">
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Folder:
                            </label>
                            <select
                                defaultValue={deck.data.folder || ""}
                                className="border rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">None</option>
                                <option value="School">Chemistry</option>
                                <option value="Work">English</option>
                                <option value="Personal">History</option>
                            </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center" title={`${cards.length} total cards`}>
                                <CardStackIcon className="h-5 w-5 mr-1.5" />
                                <span>{cards.length}</span>
                            </div>
                            {lastEdited && (
                                <div className="flex items-center" title={`Last edited: ${new Date(lastEdited).toLocaleString()}`}>
                                    <Calendar className="h-4 w-4 mr-1.5" />
                                    <span>Created At: {new Date(lastEdited).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default FlashcardDeckList;