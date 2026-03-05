import React from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
const formatMath = (text) => {
  if (!text) return "";

  return text
    .replace(/\$/g, "")
    .replace(/\^(\d+)/g, "^{$1}")
    .replace(/([a-z])([A-Z])/g, "$1 $2")   
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")   
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")   
    .replace(/sin/g, "\\sin")
    .replace(/cos/g, "\\cos")
    .replace(/tan/g, "\\tan")
    .replace(/ln/g, "\\ln")
    .replace(/sqrt/g, "\\sqrt");
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
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
  {question.question.includes("$") ? (
    <BlockMath math={formatMath(question.question)} />
  ) : (
    question.question
  )}
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
              {option.includes("$") || option.includes("^") || option.includes("\\") ? (
                <InlineMath math={formatMath(option)} />
              ) : (
  <span>{option}</span>
)}
            </button>
          ))}
        </div>
      );

    case "multi_select":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-gray-900 mb-2">
            {question.question.includes("$") || question.question.includes("^") || question.question.includes("\\") ? (
  <BlockMath math={formatMath(question.question)} />
) : (
  <span>{question.question}</span>
)}
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
  {option.includes("$") || option.includes("^") || option.includes("\\") ? (
    <InlineMath math={formatMath(option)} />
  ) : (
    <span>{option}</span>
  )}
</label>
              </div>
            );
          })}
        </div>
      );

    case "drag_and_drop":
      // For drag and drop, we'll create a simplified version that allows selection from dropdowns
      return (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
  {question.question.includes("$") ? (
    <BlockMath math={formatMath(question.question)} />
  ) : (
    question.question
  )}
</h2>
          {question.prompts.map((prompt, promptIndex) => {
            const currentMapping =
              userAnswer && userAnswer[prompt] ? userAnswer[prompt] : "";
            return (
              <div
                key={promptIndex}
                className="flex flex-col md:flex-row items-start md:items-center gap-3 p-3 border rounded-lg"
              >
                <div className="font-medium min-w-[200px]">
  {prompt.includes("$") || prompt.includes("^") || prompt.includes("\\") ? (
    <InlineMath math={formatMath(prompt)} />
  ) : (
    <span>{prompt}</span>
  )}
</div>
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
                  {question.targets.map((target, targetIndex) => (
                    <option key={targetIndex} value={target}>
                      {target.replace(/\$/g, "")}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      );

    case "short_answer":
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
  {question.question.includes("$") ? (
    <BlockMath math={formatMath(question.question)} />
  ) : (
    question.question
  )}
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
  const parts = question.question.split("[BLANK]");

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
  {question.question.includes("$") ? (
    <BlockMath math={formatMath(question.question)} />
  ) : (
    question.question
  )}
</h2>

      <div className="flex items-center flex-wrap gap-2">
        {parts.map((part, partIndex) => (
          <React.Fragment key={partIndex}>
            <span>
              {part.includes("$") ? (
  <InlineMath math={formatMath(part)} />
) : (
  part
)}
            </span>

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

    default:
      return <div>Unsupported question type: {question.type}</div>;
  }
};

export default QuizQuestion;
