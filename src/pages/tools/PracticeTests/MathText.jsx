import React from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const stripDollarMarkers = (text = "") => text.replace(/^\$+|\$+$/g, "");

const normalizeMathText = (text = "") =>
  text
    .replace(/\u0008/g, "\\b")
    .replace(/\u000c/g, "\\f")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/×/g, "\\times")
    .replace(/(?<!\\)\btimes\b/g, "\\times")
    .replace(/−/g, "-")
    .replace(/\\text\s*\{\s*ln\s*\}/gi, "\\ln")
    .replace(/\\text\s*\{\s*sin\s*\}/gi, "\\sin")
    .replace(/\\text\s*\{\s*cos\s*\}/gi, "\\cos")
    .replace(/\\text\s*\{\s*tan\s*\}/gi, "\\tan")
    .replace(/\\text\s*\{\s*e\s*\}/gi, "e")
    .replace(/\\sqrt\s*\(\s*([^()]+?)\s*\)/gi, "\\sqrt{$1}")
    .replace(/\\sqrt([A-Za-z0-9]+(?:\^[A-Za-z0-9{}()+-]+)?)/g, "\\sqrt{$1}")
    .replace(/(?<!\\)sqrt\s*\{\s*([^{}]+?)\s*\}/gi, "\\sqrt{$1}")
    .replace(/(?<!\\)sqrt\s*\(\s*([^()]+?)\s*\)/gi, "\\sqrt{$1}")
    .replace(/(?<!\\)sqrt\s+([A-Za-z0-9]+(?:\^[A-Za-z0-9{}()+-]+)?)/gi, "\\sqrt{$1}")
    .replace(/(?<!\\)sqrt([A-Za-z0-9]+(?:\^[A-Za-z0-9{}()+-]+)?)/gi, "\\sqrt{$1}")
    .replace(/(?<!\\)\bsin\b/g, "\\sin")
    .replace(/(?<!\\)\bcos\b/g, "\\cos")
    .replace(/(?<!\\)\btan\b/g, "\\tan")
    .replace(/(?<!\\)\bln\b/g, "\\ln")
    .replace(/(?<!\\)\bsqrt\b/g, "\\sqrt")
    .replace(/(?<!\\)\bpi\b/g, "\\pi")
    .replace(/\s*\^\s*/g, "^")
    .replace(/\s*_\s*/g, "_")
    .trim();

const formatMath = (text = "") => stripDollarMarkers(normalizeMathText(text));

const COMMAND_PATTERN = String.raw`\\[A-Za-z]+(?:\{[^}]*\})*`;
const FUNCTION_PATTERN = String.raw`[A-Za-z](?:'?[A-Za-z0-9]*)?\([^)]*\)`;
const EXPONENT_PATTERN = String.raw`\^\{?[A-Za-z0-9+\-]+\}?`;
const VARIABLE_TERM_PATTERN = String.raw`(?:\d+(?:\.\d+)?[A-Za-z](?:${EXPONENT_PATTERN})*|[A-Za-z](?:${EXPONENT_PATTERN})+)`;
const FRACTION_PATTERN = String.raw`(?:\d+|[A-Za-z]+)\/(?:\d+|[A-Za-z]+)`;
const STANDALONE_TOKEN_PATTERN = String.raw`-?(?:${COMMAND_PATTERN}|${FUNCTION_PATTERN}|${VARIABLE_TERM_PATTERN}|${FRACTION_PATTERN})`;
const CHAIN_TERM_PATTERN = String.raw`-?(?:${COMMAND_PATTERN}|${FUNCTION_PATTERN}|\[[A-Z_]+\]|${VARIABLE_TERM_PATTERN}|${FRACTION_PATTERN}|\d+(?:\.\d+)?|[A-Za-z])`;

const MATH_CHAIN_REGEX = new RegExp(
  `${CHAIN_TERM_PATTERN}(?:\\s*(?:\\\\times|[=+\\-*/<>])\\s*${CHAIN_TERM_PATTERN})+`,
  "g"
);
const MATH_CHAIN_FULL_REGEX = new RegExp(
  `^${CHAIN_TERM_PATTERN}(?:\\s*(?:\\\\times|[=+\\-*/<>])\\s*${CHAIN_TERM_PATTERN})+$`
);
const STANDALONE_MATH_REGEX = new RegExp(STANDALONE_TOKEN_PATTERN, "g");
const STANDALONE_MATH_FULL_REGEX = new RegExp(`^${STANDALONE_TOKEN_PATTERN}$`);
const TRAILING_PUNCTUATION_REGEX = /[.,;:?!]+$/;

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

const toSuperscript = (text = "") =>
  text
    .split("")
    .map((char) => superscriptMap[char] || char)
    .join("");

export const formatDropdownText = (text = "") => {
  let normalized = normalizeMathText(text);
  normalized = stripDollarMarkers(normalized);
  normalized = normalized.replace(/\\times/g, "×");
  normalized = normalized.replace(/\^\{([^}]+)\}/g, (_, match) => toSuperscript(match));
  normalized = normalized.replace(/\^([A-Za-z0-9])/g, (_, match) => toSuperscript(match));
  normalized = normalized.replace(/\\/g, "");
  return normalized;
};

const isStandaloneMathExpression = (text = "") => {
  const value = stripDollarMarkers(String(text).trim());
  if (!value || /^\[[A-Z_]+\]$/.test(value)) return false;

  return (
    MATH_CHAIN_FULL_REGEX.test(value) ||
    STANDALONE_MATH_FULL_REGEX.test(value)
  );
};

const collectMathMatches = (text = "") => {
  const matches = [];

  const addMatches = (regex) => {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = matches.some(
        (entry) => start < entry.end && end > entry.start
      );

      if (!overlaps) {
        matches.push({ start, end, text: match[0] });
      }
    }
  };

  addMatches(MATH_CHAIN_REGEX);
  addMatches(STANDALONE_MATH_REGEX);

  return matches.sort((left, right) => left.start - right.start);
};

const splitTrailingPunctuation = (text = "") => {
  const trailing = text.match(TRAILING_PUNCTUATION_REGEX)?.[0] || "";
  const core = trailing ? text.slice(0, -trailing.length) : text;
  return { core, trailing };
};

const renderMathNode = (text, key, useBlock = false) => {
  const math = formatMath(text);
  return useBlock ? (
    <BlockMath key={key} math={math} />
  ) : (
    <InlineMath key={key} math={math} />
  );
};

const renderPlainTextWithMathCandidates = (text, useBlock = false) => {
  const value = String(text);
  const matches = collectMathMatches(value);

  if (!matches.length) {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }

  if (isStandaloneMathExpression(value.trim())) {
    return renderMathNode(value.trim(), "standalone-math", useBlock);
  }

  const rendered = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.start > cursor) {
      rendered.push(
        <span key={`text-${index}-${cursor}`} className="whitespace-pre-wrap">
          {value.slice(cursor, match.start)}
        </span>
      );
    }

    const { core, trailing } = splitTrailingPunctuation(match.text);

    if (core) {
      rendered.push(renderMathNode(core, `math-${index}`));
    }

    if (trailing) {
      rendered.push(
        <span key={`punct-${index}`} className="whitespace-pre-wrap">
          {trailing}
        </span>
      );
    }

    cursor = match.end;
  });

  if (cursor < value.length) {
    rendered.push(
      <span key={`text-tail-${cursor}`} className="whitespace-pre-wrap">
        {value.slice(cursor)}
      </span>
    );
  }

  return rendered;
};

export const renderTextWithMath = (text, useBlock = false) => {
  if (text === null || text === undefined || text === "") return null;

  const value = String(text);
  const dollarSegments = value
    .split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g)
    .filter(Boolean);

  if (
    dollarSegments.length === 1 &&
    !/^(\$\$[\s\S]+?\$\$|\$[^$]+\$)$/.test(dollarSegments[0])
  ) {
    return renderPlainTextWithMathCandidates(value, useBlock);
  }

  return dollarSegments.map((segment, idx) => {
    if (/^\$\$[\s\S]+?\$\$$/.test(segment)) {
      return <BlockMath key={idx} math={formatMath(segment)} />;
    }
    if (/^\$[^$]+\$$/.test(segment)) {
      return <InlineMath key={idx} math={formatMath(segment)} />;
    }
    return (
      <React.Fragment key={idx}>
        {renderPlainTextWithMathCandidates(segment)}
      </React.Fragment>
    );
  });
};

const interleave = (items, separator) =>
  items.flatMap((item, index) => (index === 0 ? [item] : [separator, item]));

export const renderAnswerValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return <span>No answer provided</span>;
  }

  if (Array.isArray(value)) {
    const renderedItems = value.map((item, index) => (
      <React.Fragment key={index}>{renderTextWithMath(String(item))}</React.Fragment>
    ));
    return <>{interleave(renderedItems, <span key="sep">, </span>)}</>;
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([key, entryValue]) => (
          <div key={key} className="flex flex-wrap items-start gap-1">
            <span>{renderTextWithMath(String(key))}</span>
            <span aria-hidden="true">→</span>
            <span>{renderTextWithMath(String(entryValue))}</span>
          </div>
        ))}
      </div>
    );
  }

  return renderTextWithMath(String(value));
};

export const renderMultilineMathText = (text) => {
  if (!text) return null;

  return String(text)
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={index} className="h-2" />;
      }

      if (trimmed.startsWith("- ")) {
        return (
          <div key={index} className="flex items-start gap-2">
            <span aria-hidden="true">•</span>
            <span>{renderTextWithMath(trimmed.slice(2))}</span>
          </div>
        );
      }

      return (
        <div key={index}>
          {renderTextWithMath(
            trimmed,
            isStandaloneMathExpression(trimmed) && trimmed.length > 24
          )}
        </div>
      );
    });
};
