import React, { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { renderTextWithMath } from "./MathText";

const MathSelect = ({ value, options, onChange, placeholder = "Select an option" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-left hover:border-gray-400 transition-colors"
      >
        <span className="flex-1 min-w-0">
          {value ? renderTextWithMath(value) : <span className="text-gray-400">{placeholder}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
          >
            {placeholder}
          </button>
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors ${opt === value ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-800"}`}
            >
              {renderTextWithMath(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function seededShuffle(array, seed) {
  const shuffled = [...array];
  let m = shuffled.length;
  let t = seed | 0;
  const random = () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  while (m > 0) {
    const i = Math.floor(random() * m--);
    [shuffled[m], shuffled[i]] = [shuffled[i], shuffled[m]];
  }
  return shuffled;
}

const DragAndDropQuestion = ({ question, index, userAnswer, onAnswerChange }) => {
  const shuffledTargets = useMemo(() => {
    const seed = hashString(question.question + question.targets.join(","));
    return seededShuffle(question.targets, seed);
  }, [question.question, question.targets]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-gray-900 mb-6">
        {renderTextWithMath(question.question)}
      </h2>
      {question.prompts.map((prompt, promptIndex) => {
        const currentMapping =
          userAnswer && userAnswer[prompt] ? userAnswer[prompt] : "";
        return (
          <div
            key={promptIndex}
            className="flex flex-col md:flex-row items-start md:items-center gap-3 p-3 border rounded-lg"
          >
            <div className="font-medium min-w-[200px]">{renderTextWithMath(prompt)}</div>
            <MathSelect
              value={currentMapping}
              options={shuffledTargets}
              placeholder="-- Select an option --"
              onChange={(val) => {
                const newMapping = { ...(userAnswer || {}) };
                newMapping[prompt] = val;
                onAnswerChange(index, newMapping);
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * Component for rendering a quiz question based on its type
 */
const QuizQuestion = ({ question, index, userAnswer, onAnswerChange }) => {
  if (!question) return null;

  switch (question.type) {
    case "multiple_choice":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-gray-900 mb-6">
            {renderTextWithMath(question.question)}
          </h2>
          {question.options.map((option, optionIndex) => (
            <button
              key={optionIndex}
              onClick={() => onAnswerChange(index, option)}
              className={`w-full p-4 text-left rounded-lg border
                ${
                  userAnswer === option
                    ? "bg-blue-50 border-blue-500"
                    : "border-gray-200 hover:border-blue-300"
                }`}
            >
              {renderTextWithMath(option)}
            </button>
          ))}
        </div>
      );

    case "multi_select":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-gray-900 mb-2">
            {renderTextWithMath(question.question)}
          </h2>
          <p className="text-sm text-gray-500 mb-4">Select all that apply</p>
          {question.options.map((option, optionIndex) => {
            const isSelected =
              Array.isArray(userAnswer) && userAnswer.includes(option);
            return (
              <div
                key={optionIndex}
                className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  id={`option-${index}-${optionIndex}`}
                  checked={isSelected}
                  onChange={() => {
                    let newAnswer = Array.isArray(userAnswer)
                      ? [...userAnswer]
                      : [];
                    if (isSelected) {
                      newAnswer = newAnswer.filter((item) => item !== option);
                    } else {
                      newAnswer.push(option);
                    }
                    onAnswerChange(index, newAnswer);
                  }}
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor={`option-${index}-${optionIndex}`}
                  className="flex-1 cursor-pointer"
                >
                  {renderTextWithMath(option)}
                </label>
              </div>
            );
          })}
        </div>
      );

    case "drag_and_drop":
      return (
        <DragAndDropQuestion
          question={question}
          index={index}
          userAnswer={userAnswer}
          onAnswerChange={onAnswerChange}
        />
      );

    case "short_answer":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-gray-900 mb-6">
            {renderTextWithMath(question.question)}
          </h2>
          <textarea
            value={userAnswer || ""}
            onChange={(e) => onAnswerChange(index, e.target.value)}
            placeholder="Type your answer here..."
            className="w-full p-4 border rounded-lg"
            rows={4}
          />
        </div>
      );

    case "fill_in_blank":
      // Replace [BLANK] with an input field
      const parts = question.question.split("[BLANK]");

      return (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-gray-900 mb-6">
            Fill in the blank:
          </h2>
          <div className="flex items-center flex-wrap gap-2">
            {parts.map((part, partIndex) => (
              <React.Fragment key={partIndex}>
                <span>{renderTextWithMath(part)}</span>
                {partIndex < parts.length - 1 && (
                  <input
                    type="text"
                    value={userAnswer || ""}
                    onChange={(e) => onAnswerChange(index, e.target.value)}
                    className="border-b-2 border-gray-300 focus:border-blue-500 outline-none px-1 w-32 text-center"
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      );

    case "numerical": {
      const FAKE_UNITS = ["unitless", "none", "n/a", "na", "-", ""];
      const displayUnits = question.units && !FAKE_UNITS.includes(String(question.units).toLowerCase().trim())
        ? question.units : null;
      return (
        <div className="space-y-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            {renderTextWithMath(question.question)}
          </h2>

          <div className="mt-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Answer:</label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={userAnswer || ""}
                  onChange={(e) => onAnswerChange(index, e.target.value)}
                  placeholder="Enter your answer..."
                  className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-lg px-4 py-3 font-mono text-xl focus:border-red-500 focus:ring-0 transition-all shadow-sm"
                />
              </div>
              {displayUnits && (
                <div className="bg-gray-100 px-4 py-3 rounded-lg border border-gray-200 text-gray-700 font-bold text-lg font-mono min-w-[60px] flex items-center justify-center">
                  {displayUnits}
                </div>
              )}
            </div>
            {displayUnits && (
              <p className="text-xs text-gray-500 mt-2 italic">
                * Tolerance of ±{question.tolerance || 0.01} will be applied.
              </p>
            )}
          </div>
        </div>
      );
    }

    default:
      return <div>Unsupported question type: {question.type}</div>;
  }
};

export default QuizQuestion;
