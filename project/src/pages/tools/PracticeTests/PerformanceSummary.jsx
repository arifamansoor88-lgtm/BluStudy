import React, { useState } from "react";
import { RotateCcw, ArrowLeft, CheckCircle, XCircle, TrendingUp, Loader2, Lightbulb } from "lucide-react";
import { renderTextWithMath, renderMultilineMathText } from "./MathText";
import { getAnswerExplanation } from "../../../api/apiService";

const PerformanceSummary = ({
  quiz,
  userAnswers,
  timer,
  score,
  onReturnToTests,
  saveSuccess,
  onRetakeWrong,
  onLevelUp,
  quizAttempts,
  showAttemptHistory,
  onToggleHistory,
}) => {
  const [expanded, setExpanded] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [loadingExplanation, setLoadingExplanation] = useState(null);

  if (!quiz) return null;

  const questions = quiz.questions || [];
  const isCorrectArr = questions.map((q, i) => checkAnswer(q, userAnswers?.[i]));
  const correctCount = isCorrectArr.filter(Boolean).length;

  const fetchExplanation = async (questionIndex) => {
    if (explanations[questionIndex] || loadingExplanation === questionIndex) return;
    setLoadingExplanation(questionIndex);
    try {
      const q = questions[questionIndex];
      const ua = userAnswers?.[questionIndex];
      const isCorrect = isCorrectArr[questionIndex];
      const text = await getAnswerExplanation(q, ua, isCorrect);
      setExplanations((prev) => ({ ...prev, [questionIndex]: text }));
    } catch {
      setExplanations((prev) => ({ ...prev, [questionIndex]: "Could not load explanation." }));
    } finally {
      setLoadingExplanation(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      {/* Score header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-8">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={getScoreColor(score)} strokeWidth="3"
                strokeDasharray={`${score} 100`} strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-900">{score}%</span>
            </div>
          </div>
          <div>
            <p className={`text-2xl font-bold ${getScoreColorClass(score)}`}>{getPerformanceLevel(score)}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="text-green-600 font-semibold">{correctCount}</span>
              <span className="text-gray-400"> / {questions.length} correct</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{formatTime(timer)} · {questions.length} questions</p>
            {saveSuccess && <p className="text-xs text-green-500 mt-1">Saved</p>}
          </div>
        </div>
      </div>

      {/* Question review */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Question Review</h2>
        <p className="text-xs text-gray-400 mb-4">Click any question to see the correct answer.</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {questions.map((_, i) => {
            const correct = isCorrectArr[i];
            return (
              <button
                key={i}
                onClick={() => setExpanded(expanded === i ? null : i)}
                className={`h-9 w-9 rounded-full text-sm font-semibold transition-all border ${
                  correct
                    ? "bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
                    : "bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
                } ${expanded === i ? "ring-2 ring-offset-1 ring-primary-400" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {expanded !== null && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isCorrectArr[expanded] ? (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                )}
                <span className={`text-xs font-semibold ${isCorrectArr[expanded] ? "text-green-600" : "text-red-600"}`}>
                  {isCorrectArr[expanded] ? "Correct" : "Incorrect"}
                </span>
              </div>
              {!isCorrectArr[expanded] && !explanations[expanded] && (
                <button
                  onClick={() => fetchExplanation(expanded)}
                  disabled={loadingExplanation === expanded}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                >
                  {loadingExplanation === expanded ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Lightbulb className="h-3 w-3" />
                  )}
                  {loadingExplanation === expanded ? "Loading..." : "Explain"}
                </button>
              )}
            </div>
            <QuestionDetail
              question={questions[expanded]}
              userAnswer={userAnswers?.[expanded]}
              isCorrect={isCorrectArr[expanded]}
            />
            {/* Explanation panel */}
            {!isCorrectArr[expanded] && explanations[expanded] && (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Explanation</span>
                </div>
                <div className="text-sm text-blue-900 space-y-1 leading-relaxed">
                  {renderMultilineMathText(explanations[expanded])}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Level Up banner */}
      {score >= 70 && onLevelUp && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">You're ready for the next level!</p>
            <p className="text-xs text-green-600 mt-0.5">Generate a harder quiz on the same topic.</p>
          </div>
          <button
            onClick={onLevelUp}
            className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Level Up
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {onRetakeWrong && (
          <button
            onClick={() => onRetakeWrong(questions)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Retake Quiz
          </button>
        )}
        <button
          onClick={onReturnToTests}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Practice Tests
        </button>
      </div>

      {quizAttempts?.length > 0 && (
        <button
          onClick={() => onToggleHistory?.(!showAttemptHistory)}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          View {quizAttempts.length} past attempt{quizAttempts.length !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
};

const QuestionDetail = ({ question, userAnswer, isCorrect }) => {
  if (!question) return null;

  const correctAnswers = question.correct_answers || [];
  const correctMapping = question.correct_mapping || {};

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900">{renderTextWithMath(question.question)}</p>

      <div className="ml-1 space-y-2 text-sm">
        {/* Multiple choice */}
        {question.type === "multiple_choice" && question.options?.map((opt, i) => {
          const isUserPick = opt === userAnswer;
          const isRight = opt === question.correct_answer;
          return (
            <div
              key={i}
              className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-2 ${
                isRight
                  ? "bg-green-50 border-green-300 text-green-800"
                  : isUserPick && !isRight
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              <span>{renderTextWithMath(opt)}</span>
              <span className="text-xs flex-shrink-0">
                {isRight && "✓ correct"}
                {isUserPick && !isRight && "✗ your answer"}
              </span>
            </div>
          );
        })}

        {/* Multi-select */}
        {question.type === "multi_select" && question.options?.map((opt, i) => {
          const chosen = Array.isArray(userAnswer) && userAnswer.includes(opt);
          const isRight = correctAnswers.includes(opt);
          return (
            <div
              key={i}
              className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-2 ${
                isRight
                  ? "bg-green-50 border-green-300 text-green-800"
                  : chosen
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              <span>{renderTextWithMath(opt)}</span>
              <span className="text-xs flex-shrink-0">
                {isRight && chosen && "✓ correct"}
                {isRight && !chosen && "✓ missed"}
                {!isRight && chosen && "✗ incorrect pick"}
              </span>
            </div>
          );
        })}

        {/* Drag and drop */}
        {question.type === "drag_and_drop" && (
          <div className="space-y-2">
            {(question.prompts || []).map((prompt, i) => {
              const userVal = userAnswer?.[prompt];
              const correctVal = correctMapping[prompt];
              const pairCorrect = userVal === correctVal;
              return (
                <div key={i} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg border ${
                  pairCorrect ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
                }`}>
                  <span className="text-gray-700 min-w-[120px]">{renderTextWithMath(prompt)}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-medium ${pairCorrect ? "text-green-700" : "text-red-700"}`}>
                    {renderTextWithMath(userVal || "(no answer)")}
                  </span>
                  {!pairCorrect && (
                    <span className="text-green-700 text-xs ml-auto">correct: {renderTextWithMath(correctVal)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Short answer / fill in blank */}
        {(question.type === "short_answer" || question.type === "fill_in_blank") && (
          <div className="space-y-2">
            <div className={`px-3 py-2 rounded-lg border text-sm ${
              isCorrect ? "bg-green-50 border-green-300 text-green-800" : "bg-red-50 border-red-300 text-red-700"
            }`}>
              <span className="text-xs font-semibold block mb-1">Your answer</span>
              {renderTextWithMath(userAnswer ?? "—")}
            </div>
            {!isCorrect && (
              <div className="px-3 py-2 rounded-lg border bg-green-50 border-green-300 text-green-800 text-sm">
                <span className="text-xs font-semibold block mb-1">Correct answer</span>
                {renderTextWithMath(question.correct_answer)}
              </div>
            )}
          </div>
        )}

        {/* Numerical */}
        {question.type === "numerical" && (
          <div className="space-y-2">
            <div className={`px-3 py-2 rounded-lg border text-sm ${
              isCorrect ? "bg-green-50 border-green-300 text-green-800" : "bg-red-50 border-red-300 text-red-700"
            }`}>
              <span className="text-xs font-semibold block mb-1">Your answer</span>
              {userAnswer ?? "—"}{question.units ? ` ${question.units}` : ""}
            </div>
            {!isCorrect && (
              <div className="px-3 py-2 rounded-lg border bg-green-50 border-green-300 text-green-800 text-sm">
                <span className="text-xs font-semibold block mb-1">Correct answer</span>
                {question.correct_answer_value}{question.units ? ` ${question.units}` : ""}
                {question.tolerance ? ` (±${question.tolerance})` : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────

function normalizeAnswer(s) {
  if (s == null) return "";
  let v = String(s).trim();
  // Strip LaTeX $ delimiters the AI may have stored in correct_answer
  v = v.replace(/^\$+|\$+$/g, "").trim();
  // Lowercase
  v = v.toLowerCase();
  // Unicode math → ASCII
  v = v.replace(/−/g, "-").replace(/–/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/·/g, "*");
  // Collapse whitespace
  v = v.replace(/\s+/g, " ").trim();
  // Remove spaces around operators so "2x - 3" == "2x-3"
  v = v.replace(/\s*([-+*/=<>])\s*/g, "$1");
  // Strip leading variable assignment: "y=2x-3" → "2x-3", "m=3" → "3"
  v = v.replace(/^[a-z_][a-z0-9_]*=/, "");
  // Sort comma/semicolon-separated lists
  const parts = v.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice().sort().join(",") : v.trim();
}

// True if a and b are equal OR one is a meaningful abbreviation/prefix of the other.
// "y-int" matches "y-intercept"; "quad" does NOT match "quadratic" (too short).
function isAnswerMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length <= b.length ? b : a;
  // Prefix match: shorter must be ≥4 chars and ≥50% of the longer
  return (
    shorter.length >= 4 &&
    shorter.length / longer.length >= 0.4 &&
    longer.startsWith(shorter)
  );
}

function checkAnswer(question, userAnswer) {
  if (!question || userAnswer === null || userAnswer === undefined) return false;
  switch (question.type) {
    case "multiple_choice":
      return (
        userAnswer === question.correct_answer ||
        normalizeAnswer(userAnswer) === normalizeAnswer(question.correct_answer)
      );
    case "multi_select":
      if (!Array.isArray(userAnswer)) return false;
      return (
        JSON.stringify([...userAnswer].sort()) ===
        JSON.stringify([...(question.correct_answers || [])].sort())
      );
    case "drag_and_drop":
      if (!userAnswer || typeof userAnswer !== "object") return false;
      return Object.keys(question.correct_mapping || {}).every(
        (k) => userAnswer[k] === question.correct_mapping[k]
      );
    case "short_answer":
    case "fill_in_blank": {
      const normUser = normalizeAnswer(userAnswer);
      const allCorrect = [question.correct_answer, ...(question.acceptable_answers || [])].map(normalizeAnswer);
      return allCorrect.some((c) => isAnswerMatch(normUser, c));
    }
    case "numerical": {
      const parsed = parseFloat(String(userAnswer).replace(/[^0-9.\-]/g, ""));
      if (isNaN(parsed)) return false;
      return Math.abs(parsed - question.correct_answer_value) <= (question.tolerance ?? 0.01);
    }
    default:
      return false;
  }
}

const formatTime = (t) => {
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = (t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const getScoreColor = (s) => s >= 90 ? "#10b981" : s >= 80 ? "#3b82f6" : s >= 70 ? "#f59e0b" : s >= 60 ? "#f97316" : "#ef4444";
const getScoreColorClass = (s) => s >= 90 ? "text-green-600" : s >= 80 ? "text-blue-600" : s >= 70 ? "text-yellow-600" : s >= 60 ? "text-orange-500" : "text-red-500";
const getPerformanceLevel = (s) => s >= 90 ? "Outstanding" : s >= 80 ? "Strong" : s >= 70 ? "On Track" : s >= 60 ? "Keep Going" : "Needs Review";

export default PerformanceSummary;
