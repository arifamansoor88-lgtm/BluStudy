import React, { useMemo } from "react";

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
        {question.question}
      </h2>
      {question.prompts.map((prompt, promptIndex) => {
        const currentMapping =
          userAnswer && userAnswer[prompt] ? userAnswer[prompt] : "";
        return (
          <div
            key={promptIndex}
            className="flex flex-col md:flex-row items-start md:items-center gap-3 p-3 border rounded-lg"
          >
            <div className="font-medium min-w-[200px]">{prompt}</div>
            <select
              value={currentMapping}
              onChange={(e) => {
                const newMapping = { ...(userAnswer || {}) };
                newMapping[prompt] = e.target.value;
                onAnswerChange(index, newMapping);
              }}
              className="flex-1 p-2 border rounded-md"
            >
              <option value="">-- Select an option --</option>
              {shuffledTargets.map((target, targetIndex) => (
                <option key={targetIndex} value={target}>
                  {target}
                </option>
              ))}
            </select>
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
            {question.question}
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
              {option}
            </button>
          ))}
        </div>
      );

    case "multi_select":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-gray-900 mb-2">
            {question.question}
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
                  {option}
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
            {question.question}
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
                <span>{part}</span>
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

    case "numerical":
      return (
        <div className="space-y-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">
            {question.question}
          </h2>

          {/* Display given values in a structured card if available */}
          {question.given_values && Object.keys(question.given_values).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-2 font-semibold uppercase tracking-wider">Given Data:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(question.given_values).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center text-sm border-b border-gray-100 pb-1">
                    <span className="text-gray-600 font-medium">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-900 font-mono bg-white px-2 py-0.5 rounded border border-gray-100 shadow-inner">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Answer input with units label */}
          <div className="mt-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Numerical Answer:</label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={userAnswer || ""}
                  onChange={(e) => onAnswerChange(index, e.target.value)}
                  placeholder="Enter value..."
                  className="w-full bg-white border-2 border-gray-200 text-gray-900 rounded-lg px-4 py-3 font-mono text-xl focus:border-red-500 focus:ring-0 transition-all shadow-sm"
                />
              </div>
              {question.units && (
                <div className="bg-gray-100 px-4 py-3 rounded-lg border border-gray-200 text-gray-700 font-bold text-lg font-mono min-w-[60px] flex items-center justify-center">
                  {question.units}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">
              * Enter the numeric value only or include the units. Tolerance of ±{question.tolerance || 0.01} will be applied.
            </p>
          </div>
        </div>
      );

    default:
      return <div>Unsupported question type: {question.type}</div>;
  }
};

export default QuizQuestion;
