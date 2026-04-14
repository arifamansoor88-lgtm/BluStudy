import React from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const stripDollarMarkers = (text) => text.replace(/^\$+|\$+$/g, "");

const normalizeMathText = (text) => {
  if (!text) return "";

  return text
    .replace(/\bimes\b/g, "\\times")
    .replace(/\btimes\b/g, "\\times")
    .replace(/\bsin\b/g, "\\sin")
    .replace(/\bcos\b/g, "\\cos")
    .replace(/\btan\b/g, "\\tan")
    .replace(/\bln\b/g, "\\ln")
    .replace(/\bsqrt\b/g, "\\sqrt")
    .replace(/\bpi\b/g, "\\pi")
    .replace(/\s*\^\s*/g, "^")
    .replace(/\s*_\s*/g, "_")
    .trim();
};

const formatMath = (text) => {
  if (!text) return "";
  return stripDollarMarkers(normalizeMathText(text));
};

const hasDollarMath = (text) => /\$[^$]+\$/.test(text);

const looksLikeMathSentence = (text) => {
  if (!text) return false;
  const normalized = normalizeMathText(text);
  if (/\\(?:times|sin|cos|tan|ln|sqrt|pi)/.test(normalized)) {
    return true;
  }
  return /^[0-9\s\^_+\-*/(){}.,]+$/.test(normalized);
};

const superscriptMap = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  q: "ᑫ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
  A: "ᴬ",
  B: "ᴮ",
  D: "ᴰ",
  E: "ᴱ",
  G: "ᴳ",
  H: "ᴴ",
  I: "ᴵ",
  J: "ᴶ",
  K: "ᴷ",
  L: "ᴸ",
  M: "ᴹ",
  N: "ᴺ",
  O: "ᴼ",
  P: "ᴾ",
  R: "ᴿ",
  T: "ᵀ",
  U: "ᵁ",
  V: "ⱽ",
  W: "ᵂ",
};

const toSuperscript = (text) =>
  text
    .split("")
    .map((char) => superscriptMap[char] || char)
    .join("");

const formatDropdownText = (text) => {
  if (!text) return "";

  let normalized = normalizeMathText(text);
  normalized = stripDollarMarkers(normalized);
  normalized = normalized.replace(/\\times/g, "×");
  normalized = normalized.replace(/\^\{([^}]+)\}/g, (_, match) => toSuperscript(match));
  normalized = normalized.replace(/\^([A-Za-z0-9])/g, (_, match) => toSuperscript(match));
  normalized = normalized.replace(/\\/g, "");
  return normalized;
};

const renderTextWithMath = (text, useBlock = false) => {
  if (!text) return null;

  const dollarSegments = text.split(/(\$\$[^$]*\$\$|\$[^$]*\$)/g).filter(Boolean);

  if (dollarSegments.length === 1 && !/^(\$\$[^$]*\$\$|\$[^$]*\$)$/.test(dollarSegments[0])) {
    if (hasDollarMath(text) || looksLikeMathSentence(text)) {
      return useBlock ? (
        <BlockMath math={formatMath(text)} />
      ) : (
        <InlineMath math={formatMath(text)} />
      );
    }
    return <span>{text}</span>;
  }

  return dollarSegments.map((segment, idx) => {
    if (/^\$\$[^$]*\$\$$/.test(segment)) {
      return <BlockMath key={idx} math={formatMath(segment)} />;
    }
    if (/^\$[^$]*\$$/.test(segment)) {
      return <InlineMath key={idx} math={formatMath(segment)} />;
    }
    if (looksLikeMathSentence(segment)) {
      return <InlineMath key={idx} math={formatMath(segment)} />;
    }
    return <span key={idx}>{segment}</span>;
  });
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
            {renderTextWithMath(question.question, true)}
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
            {renderTextWithMath(question.question, false)}
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
      // For drag and drop, we'll create a simplified version that allows selection from dropdowns
      return (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            {renderTextWithMath(question.question, true)}
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
                  {renderTextWithMath(prompt)}
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
                      {formatDropdownText(target)}
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
            {renderTextWithMath(question.question, true)}
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
            {renderTextWithMath(question.question, false)}
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

    default:
      return <div>Unsupported question type: {question.type}</div>;
  }
};

export default QuizQuestion;
