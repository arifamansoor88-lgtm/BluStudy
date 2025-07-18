import React, { useState } from "react";

const difficultyOptions = [
  { label: "Easy", value: "easy", color: "bg-green-500" },
  { label: "Medium", value: "medium", color: "bg-yellow-400" },
  { label: "Hard", value: "hard", color: "bg-red-500" },
];

const FlashcardDifficultySelector = ({ onSelect }) => {
  const [selected, setSelected] = useState(null);

  const handleClick = (value) => {
    setSelected(value);
    if (onSelect) onSelect(value); // Call the parent callback
  };

  return (
    <div className="flex gap-4 items-center">
      {difficultyOptions.map(({ label, value, color }) => (
        <button
          key={value}
          onClick={() => handleClick(value)}
          className={`px-4 py-2 rounded-xl shadow-md text-white font-semibold transition-transform duration-150 ${
            selected === value
              ? `${color} scale-105`
              : "bg-gray-200 text-gray-700 hover:scale-105"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default FlashcardDifficultySelector;