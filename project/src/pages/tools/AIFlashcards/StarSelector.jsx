import React, { useState } from "react";
import { Star } from "lucide-react";

const StarSelector = ({ onSelect }) => {
  const [selected, setSelected] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isFilled = selected || hovered;

  const handleClick = () => {
    const newSelected = !selected;
    setSelected(newSelected);
    if (onSelect) onSelect(newSelected); // <-- send new selected status to parent
  };

  return (
    <button
      onClick={() => handleClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute top-1 left-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity transition-transform"
    >
      <Star
        className="w-4 h-4"
        fill={isFilled ? "#facc15" : "none"} // Tailwind yellow-400
        stroke={isFilled ? "#facc15" : "currentColor"}
      />
    </button>
  );
};

export default StarSelector;
