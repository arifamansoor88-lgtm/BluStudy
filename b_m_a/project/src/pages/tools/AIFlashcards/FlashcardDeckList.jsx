import { useState } from "react";
import { useEffect } from "react";
import { useDeckData } from './hooks';
import { X } from 'lucide-react';

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
  const [localDecks, setLocalDecks] = useState([]);

  useEffect(() => {
    const normalizedDecks = (decks || []).map(deck => ({
      ...deck,
      title: deck.title ?? deck.data?.title ?? "Untitled Deck",
      cards: deck.cards ?? deck.data?.cards ?? [],
    }));

    setLocalDecks(normalizedDecks);
  }, [decks]);

  const handleDeleteDeck = async (deckId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this flashcard deck?")) return;

    try {
      await deleteDeck(deckId);
      setLocalDecks(prev => prev.filter(d => d.id !== deckId));
    } catch (err) {
      console.error("Failed to delete deck:", err);
    }
  };

  if (!localDecks.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
        No flashcard decks yet. Upload a PDF to generate your first deck.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {localDecks.map(deck => (
        <div
          key={deck.id}
          onClick={() => onDeckSelect(deck.id)}
          className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition"
        >
          {/* Delete */}
          <button
            onClick={(e) => handleDeleteDeck(deck.id, e)}
            className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            title="Delete deck"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
            {deck.title}
          </h3>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <CardStackIcon className="h-4 w-4" />
              <span>{deck.cards.length} cards</span>
            </div>

            <span className="text-xs rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
              AI-generated
            </span>
          </div>

          {/* CTA hint */}
          <div className="mt-6 text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition">
            Click to study →
          </div>
        </div>
      ))}
    </div>
  );
};


export default FlashcardDeckList;