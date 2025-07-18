import React from "react";

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
        // Default to an empty array if deck.cards is null or undefined
        const cards = deck.data.cards || [];

        // Calculate stats using the safe 'cards' variable
        const stats = cards.reduce(
          (acc, card) => {
            const difficulty = card.difficulty?.toLowerCase();
            if (difficulty === 'easy') acc.easy++;
            if (difficulty === 'medium') acc.medium++;
            if (difficulty === 'hard') acc.hard++;
            if (card.important) acc.important++;
            return acc;
          },
          { easy: 0, medium: 0, hard: 0, important: 0 }
        );

        return (
          <div
            key={deck.id}
            className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-shadow duration-200 ease-in-out"
            onClick={() => onDeckSelect(deck)}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {deck.data.title || "Untitled Deck"}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600 dark:text-gray-400">
              {/* Now we use the safe 'cards' variable here */}
              <div className="flex items-center" title={`${cards.length} total cards`}>
                <CardStackIcon className="h-5 w-5 mr-1.5" />
                <span>{cards.length}</span>
              </div>

              {stats.important > 0 && (
                <div className="flex items-center" title={`${stats.important} important cards`}>
                  <StarIcon className="h-5 w-5 mr-1.5 text-yellow-400" />
                  <span>{stats.important}</span>
                </div>
              )}

              <div className="flex items-center gap-x-3 ml-auto">
                {stats.easy > 0 && (
                  <div className="flex items-center" title={`${stats.easy} easy cards`}>
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 mr-1.5"></span>
                    <span>{stats.easy}</span>
                  </div>
                )}
                {stats.medium > 0 && (
                  <div className="flex items-center" title={`${stats.medium} medium cards`}>
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 mr-1.5"></span>
                    <span>{stats.medium}</span>
                  </div>
                )}
                {stats.hard > 0 && (
                  <div className="flex items-center" title={`${stats.hard} hard cards`}>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 mr-1.5"></span>
                    <span>{stats.hard}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FlashcardDeckList;

