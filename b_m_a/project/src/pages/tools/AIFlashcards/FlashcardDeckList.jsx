import React from "react";
import { X } from 'lucide-react';
import { useDeckData } from "./hooks";

const CardStackIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" />
  </svg>
);

const StarIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10.868 2.884c.321-.662 1.215-.662 1.536 0l1.681 3.462a1 1 0 00.951.692h3.632c.712 0 1.008.972.474 1.455l-2.938 2.14a1 1 0 00-.364 1.118l1.11 3.865c.213.74-.585 1.36-1.226.978l-2.939-2.14a1 1 0 00-1.175 0l-2.939 2.14c-.64.382-1.439-.238-1.226-.978l1.11-3.865a1 1 0 00-.364-1.118L2.074 8.493c-.534-.483-.238-1.455.474-1.455h3.632a1 1 0 00.951-.692l1.681-3.462z" clipRule="evenodd" />
  </svg>
);

const FlashcardDeckList = ({ decks, onDeckSelect }) => {
  const { deleteDeck } = useDeckData();

  const handleDeleteDeck = async (deckId, e) => {
    e.stopPropagation(); // Prevent triggering onDeckSelect
    if (window.confirm("Are you sure you want to delete this deck?")) {
      try {
        await deleteDeck(deckId); // Assume deleteDeck updates savedDecks in useDeckData
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {deck.data.title || "Untitled Deck"}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center" title={`${cards.length} total cards`}>
                <CardStackIcon className="h-5 w-5 mr-1.5" />
                <span>{cards.length}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FlashcardDeckList;