import React, { useState, useEffect } from "react";
import { Clock, ArrowRight, Check, X, Loader2 } from "lucide-react";
import { formatTime } from "./utils";
import {
  renderAnswerValue,
  renderMultilineMathText,
  renderTextWithMath,
} from "./MathText";
import QuizQuestion from "./QuizQuestion";
import QuizSummary from "./QuizSummary";
import PerformanceSummary from "./PerformanceSummary";

/**
 * Component for displaying the quiz in different states
 */
const QuizDisplay = ({
  status,
  quiz,
  currentQuestion: currentQuestionIndex,
  userAnswers,
  timer,
  quizMode,
  showSummary,
  showAnswerFeedback,
  isSaving,
  saveSuccess,
  quizAttempts,
  showAttemptHistory,
  onStartQuiz,
  onAnswerChange,
  onNextQuestion,
  onPreviousQuestion,
  onGoToQuestion,
  onCheckAnswer,
  onReviewQuestions,
  onReturnToTests,
  onToggleHistory,
  onRetakeWrong,
  onLevelUp,
  onViewAttempt,
  aiExplanation,
  aiExplanations,
  loadingExplanation,
  evaluatingAnswer,
  aiEvaluatedAnswers,
  checkedAnswers,
  getAnswerCorrectness,
}) => {
  // State to track if user tried to click finish button with unanswered questions
  const [triedToFinishWithUnanswered, setTriedToFinishWithUnanswered] = useState(false);

  // Helper function to get the current question's explanation
  const getCurrentQuestionExplanation = () => {
    if (aiExplanations && aiExplanations[currentQuestionIndex]) {
      return aiExplanations[currentQuestionIndex];
    }
    return aiExplanation; // Fallback to the legacy aiExplanation
  };

  // Helper function to check if all questions are answered
  const areAllQuestionsAnswered = () => {
    if (!userAnswers || !Array.isArray(userAnswers)) return false;
    return userAnswers.every(answer => {
      if (answer === null || answer === undefined || answer === "") {
        return false;
      }
      if (Array.isArray(answer)) {
        return answer.length > 0;
      }
      if (typeof answer === 'object' && answer !== null) {
        return Object.values(answer).some(value => 
          value !== null && value !== undefined && value !== ""
        );
      }
      return true;
    });
  };

  // Clear the warning state when all questions are answered or when navigating away from last question
  useEffect(() => {
    if (areAllQuestionsAnswered() || (quiz && currentQuestionIndex !== quiz.questions.length - 1)) {
      setTriedToFinishWithUnanswered(false);
    }
  }, [userAnswers, currentQuestionIndex, quiz]);

  // No quiz data available
  if (!quiz && status !== "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-700">
          No quiz loaded. Please go back and generate a quiz first.
        </p>
      </div>
    );
  }

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-700">Generating your quiz...</p>
      </div>
    );
  }

  // Ready to start
  if (status === "ready") {
    const hasAttempts = quizAttempts && quizAttempts.length > 0;
    const bestScore = hasAttempts ? Math.max(...quizAttempts.map((a) => a.score)) : null;

    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Quiz card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {renderTextWithMath(quiz.quiz_title || quiz.title || "Practice Quiz")}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {quiz.questions.length} questions · timed, no limit
          </p>

          {hasAttempts && (
            <div className="flex items-center justify-center gap-6 mb-6 py-4 border-y border-gray-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600">{quizAttempts.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">attempts</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600">{bestScore}%</p>
                <p className="text-xs text-gray-400 mt-0.5">best score</p>
              </div>
            </div>
          )}

          <button
            onClick={() => onStartQuiz("quiz")}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-base"
          >
            Start Quiz
          </button>
        </div>

        {/* Past attempts */}
        {hasAttempts && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Past Attempts</h3>
              <button
                onClick={() => onToggleHistory(!showAttemptHistory)}
                className="text-xs text-primary-500 hover:text-primary-700"
              >
                {showAttemptHistory ? "Hide" : "Show"}
              </button>
            </div>

            {showAttemptHistory && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-2 font-medium">Date</th>
                    <th className="text-left px-5 py-2 font-medium">Score</th>
                    <th className="text-left px-5 py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {quizAttempts.map((attempt, i) => (
                    <tr
                      key={attempt.attemptId || i}
                      onClick={() => onViewAttempt?.(attempt)}
                      className="border-t border-gray-100 hover:bg-primary-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-600">
                        {new Date(attempt.timestamp).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}{" "}
                        <span className="text-gray-400 text-xs">
                          {new Date(attempt.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-800">{attempt.score}%</td>
                      <td className="px-5 py-3 text-gray-500">{formatTime(attempt.timeTaken)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }

  // Helper function to check if answer is correct
  const isCurrentAnswerCorrect = () => {
    if (getAnswerCorrectness) {
      return getAnswerCorrectness(currentQuestionIndex);
    }
    return isAnswerCorrectInline(
      quiz.questions[currentQuestionIndex],
      userAnswers[currentQuestionIndex]
    );
  };

  // Helper function to check if current question is answered
  const isCurrentQuestionAnswered = () => {
    const currentAnswer = userAnswers[currentQuestionIndex];
    
    // For null/undefined/empty string answers
    if (currentAnswer === null || currentAnswer === undefined || currentAnswer === "") {
      return false;
    }
    
    // For multi-select questions, check if at least one option is selected
    if (Array.isArray(currentAnswer)) {
      return currentAnswer.length > 0;
    }
    
    // For drag and drop questions, check if at least one mapping is filled
    if (typeof currentAnswer === 'object' && currentAnswer !== null) {
      return Object.values(currentAnswer).some(value => 
        value !== null && value !== undefined && value !== ""
      );
    }
    
    // For other question types (multiple choice, short answer, etc.)
    return true;
  };


  // In progress
  if (status === "in-progress") {
    const currentQuestion = quiz.questions[currentQuestionIndex];

    return (
      <div>
        {/* Timer and Progress Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center text-gray-700">
            <Clock className="h-5 w-5 mr-2" />
            <span className="font-medium">{formatTime(timer)}</span>
          </div>
          <div className="flex items-center gap-4 text-gray-700">
            <div className="text-sm">
              {userAnswers.filter(answer => {
                if (answer === null || answer === undefined || answer === "") return false;
                if (Array.isArray(answer)) return answer.length > 0;
                if (typeof answer === 'object' && answer !== null) {
                  return Object.values(answer).some(value => 
                    value !== null && value !== undefined && value !== ""
                  );
                }
                return true;
              }).length} of {quiz.questions.length} answered
            </div>
            <div>
              Question {currentQuestionIndex + 1} of {quiz.questions.length}
            </div>
          </div>
        </div>

        {/* Quiz Mini-map */}
        <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Question Progress</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Answered</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quiz.questions.map((_, i) => {
              // Helper function to check if a specific question is answered
              const isQuestionAnswered = () => {
                const answer = userAnswers[i];
                if (answer === null || answer === undefined || answer === "") {
                  return false;
                }
                if (Array.isArray(answer)) {
                  return answer.length > 0;
                }
                if (typeof answer === 'object' && answer !== null) {
                  return Object.values(answer).some(value => 
                    value !== null && value !== undefined && value !== ""
                  );
                }
                return true;
              };

              // Determine the button's background color based on answer status
              let bgColor = "bg-gray-200"; // Unanswered
              let textColor = "text-gray-600";

              if (isQuestionAnswered()) {
                if (status === "completed" || showSummary) {
                  // Use getAnswerCorrectness if available
                  const isCorrect = getAnswerCorrectness
                    ? getAnswerCorrectness(i)
                    : isAnswerCorrectInline(quiz.questions[i], userAnswers[i]);
                  bgColor = isCorrect ? "bg-green-500" : "bg-red-500"; // Correct/Incorrect
                  textColor = "text-white";
                } else {
                  bgColor = "bg-blue-500"; // Answered but not yet evaluated
                  textColor = "text-white";
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => onGoToQuestion(i)}
                  className={`${bgColor} ${
                    i === currentQuestionIndex ? "ring-2 ring-gray-800" : ""
                  } ${textColor} w-8 h-8 flex items-center justify-center rounded-full font-medium hover:opacity-80 transition-opacity`}
                  title={`Question ${i + 1}${isQuestionAnswered() ? ' - Answered' : ' - Unanswered'}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          {/* Warning message only when user tries to click finish button with unanswered questions */}
          {triedToFinishWithUnanswered && currentQuestionIndex === quiz.questions.length - 1 && !areAllQuestionsAnswered() && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    Please answer all questions before finishing the quiz. You can navigate between questions using the progress map above.
                  </p>
                </div>
              </div>
            </div>
          )}

          <QuizQuestion
            question={currentQuestion}
            index={currentQuestionIndex}
            userAnswer={userAnswers[currentQuestionIndex]}
            onAnswerChange={onAnswerChange}
          />

          {/* Show feedback only in review mode */}
          {quizMode === "review" && showAnswerFeedback && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                isCurrentAnswerCorrect()
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-start">
                <div
                  className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${
                    isCurrentAnswerCorrect() ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  {isCurrentAnswerCorrect() ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3
                    className={`text-sm font-medium ${
                      isCurrentAnswerCorrect()
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {isCurrentAnswerCorrect() ? "Correct!" : "Incorrect"}
                  </h3>
                  
                  {/* Correct Answer Section */}
                  <div className="mt-2 text-sm">
                    {isCurrentAnswerCorrect()
                      ? "Well done! You got this right."
                      : (
                        <div>
                          <p className="font-medium text-red-800 mb-1">Correct Answer:</p>
                          <p className="bg-white p-2 rounded border border-red-200 text-red-700">
                            {renderAnswerValue(formatCorrectAnswer(currentQuestion))}
                          </p>
                        </div>
                      )}
                  </div>

                  {/* Show AI explanation when available */}
                  {(loadingExplanation || evaluatingAnswer) && (
                    <div className="mt-3 flex items-center text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>
                        {evaluatingAnswer
                          ? "Evaluating your answer..."
                          : "Generating AI explanation..."}
                      </span>
                    </div>
                  )}

                  {!loadingExplanation &&
                    !evaluatingAnswer &&
                    getCurrentQuestionExplanation() && (
                      <div className="mt-3 bg-white p-3 rounded border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-800 mb-1">
                          AI Explanation:
                        </h4>
                        <div className="text-sm text-gray-700 markdown-content">
                          {renderMultilineMathText(getCurrentQuestionExplanation())}
                        </div>
                      </div>
                    )}

                  {/* Numerical Solution Steps */}
                  {!loadingExplanation && !evaluatingAnswer && currentQuestion.type === "numerical" && currentQuestion.solution_steps && (
                    <div className="mt-3 bg-gray-50 p-3 rounded border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-800 mb-2">
                        Worked Solution:
                      </h4>
                      <ol className="list-decimal list-inside space-y-2">
                        {currentQuestion.solution_steps.map((step, i) => (
                          <li key={i} className="text-sm text-gray-600 font-mono pl-2 border-l-2 border-gray-200 ml-1">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Topics to Review Section - Extract from AI explanation */}
                  {!isCurrentAnswerCorrect() && getCurrentQuestionExplanation() && (
                    <div className="mt-3 bg-blue-50 p-3 rounded border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-800 mb-1">
                        📚 Topics to Review:
                      </h4>
                      <div className="text-sm text-blue-700">
                        {extractTopicsFromExplanation(getCurrentQuestionExplanation())}
                        <p className="mt-2 text-xs text-blue-600">
                          💡 Tip: Use the AI Flashcards tool to create study materials for these topics
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <button
              onClick={onPreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className={`px-4 py-2 border rounded-md ${
                currentQuestionIndex === 0
                  ? "text-gray-400 border-gray-300"
                  : "text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              Previous
            </button>

            <div className="flex gap-2">
              {/* Check My Answer button (only in review mode and when an answer is selected and not yet evaluated) */}
              {quizMode === "review" &&
                !showAnswerFeedback &&
                userAnswers[currentQuestionIndex] !== null &&
                !checkedAnswers[currentQuestionIndex] && (
                  <button
                    onClick={onCheckAnswer}
                    className="px-4 py-2 border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50"
                    disabled={evaluatingAnswer || loadingExplanation}
                  >
                    {evaluatingAnswer || loadingExplanation ? (
                      <span className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking...
                      </span>
                    ) : (
                      "Check My Answer"
                    )}
                  </button>
                )}

              <button
                onClick={() => {
                  // If on last question and not all answered, show warning
                  if (currentQuestionIndex === quiz.questions.length - 1 && !areAllQuestionsAnswered()) {
                    setTriedToFinishWithUnanswered(true);
                    return; // Don't proceed
                  }
                  // Otherwise, proceed normally
                  onNextQuestion();
                }}
                className={`px-4 py-2 flex items-center gap-2 rounded-md ${
                  currentQuestionIndex === quiz.questions.length - 1 && !areAllQuestionsAnswered()
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {currentQuestionIndex === quiz.questions.length - 1
                  ? "Finish Quiz"
                  : "Next Question"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed
  if (status === "completed") {
    // For quiz mode, always show the performance summary directly
    if (quizMode === "quiz") {
      const score = calculateScore(quiz.questions, userAnswers);
      
      return (
        <PerformanceSummary
          quiz={quiz}
          userAnswers={userAnswers}
          timer={timer}
          score={score}
          onReturnToTests={onReturnToTests}
          onRetakeWrong={onRetakeWrong}
          onLevelUp={onLevelUp}
          saveSuccess={saveSuccess}
          quizAttempts={quizAttempts}
          showAttemptHistory={showAttemptHistory}
          onToggleHistory={onToggleHistory}
        />
      );
    }

    // For review mode, show the question review first
    if (!showSummary) {
      const currentQuestion = quiz.questions[currentQuestionIndex];

      return (
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Quiz Complete!
          </h2>

          <div className="w-full max-w-3xl">
            {/* Individual question content */}
            <QuizQuestion
              question={currentQuestion}
              index={currentQuestionIndex}
              userAnswer={userAnswers[currentQuestionIndex]}
              onAnswerChange={() => {}} // Read-only in completed state
            />

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8">
              {currentQuestionIndex > 0 && (
                <button
                  onClick={() => onGoToQuestion(currentQuestionIndex - 1)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
                >
                  Previous
                </button>
              )}
              <div className="flex-1"></div>
              {currentQuestionIndex < quiz.questions.length - 1 && (
                <button
                  onClick={() => onGoToQuestion(currentQuestionIndex + 1)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
                >
                  Next
                </button>
              )}
            </div>

            <button
              onClick={() => onReviewQuestions(true)}
              className="w-full mt-8 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              View Summary
            </button>
          </div>
        </div>
      );
    } else {
      // Calculate score
      const score = calculateScore(quiz.questions, userAnswers);

      return (
        <PerformanceSummary
          quiz={quiz}
          userAnswers={userAnswers}
          timer={timer}
          score={score}
          onReturnToTests={onReturnToTests}
          onRetakeWrong={onRetakeWrong}
          saveSuccess={saveSuccess}
          quizAttempts={quizAttempts}
          showAttemptHistory={showAttemptHistory}
          onToggleHistory={onToggleHistory}
        />
      );
    }
  }

  // Fallback
  return null;
};

// Helper functions

// Format the correct answer based on question type
function formatCorrectAnswer(question) {
  if (!question) return "";

  switch (question.type) {
    case "multiple_choice":
      return question.correct_answer;
    case "multi_select":
      return question.correct_answers || [];
    case "drag_and_drop":
      return question.correct_mapping || {};
    case "short_answer":
    case "fill_in_blank":
      if (
        question.acceptable_answers &&
        question.acceptable_answers.length > 0
      ) {
        return [question.correct_answer, ...question.acceptable_answers];
      }
      return question.correct_answer;
    case "numerical":
      return `${question.correct_answer_value} ${question.units || ""}` +
        (question.tolerance ? ` (±${question.tolerance})` : "");
    default:
      return "";
  }
}

// Simple version of isAnswerCorrect for use within the component
function normalizeAnswer(s) {
  if (s == null) return "";
  let v = String(s).trim();
  v = v.replace(/^\$+|\$+$/g, "").trim();
  v = v.toLowerCase();
  v = v.replace(/−/g, "-").replace(/–/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/·/g, "*");
  v = v.replace(/\s+/g, " ").trim();
  v = v.replace(/\s*([-+*/=<>])\s*/g, "$1");
  v = v.replace(/^[a-z_][a-z0-9_]*=/, "");
  const parts = v.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice().sort().join(",") : v.trim();
}

function isAnswerMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length <= b.length ? b : a;
  return (
    shorter.length >= 4 &&
    shorter.length / longer.length >= 0.4 &&
    longer.startsWith(shorter)
  );
}

function isAnswerCorrectInline(question, userAnswer) {
  if (!question || userAnswer === null || userAnswer === undefined)
    return false;

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
        JSON.stringify([...question.correct_answers].sort())
      );
    case "drag_and_drop":
      if (!userAnswer || typeof userAnswer !== "object") return false;
      return Object.keys(question.correct_mapping).every(
        (key) => userAnswer[key] === question.correct_mapping[key]
      );
    case "short_answer":
    case "fill_in_blank": {
      const normUser = normalizeAnswer(userAnswer);
      const allCorrect = [question.correct_answer, ...(question.acceptable_answers || [])].map(normalizeAnswer);
      return allCorrect.some((c) => isAnswerMatch(normUser, c));
    }
    case "numerical": {
      if (!userAnswer) return false;
      const parsed = parseFloat(String(userAnswer).replace(/[^0-9.\-]/g, ""));
      if (isNaN(parsed)) return false;
      return Math.abs(parsed - question.correct_answer_value) <= (question.tolerance ?? 0.01);
    }
    default:
      return false;
  }
}

// Calculate score for the quiz
function calculateScore(questions, userAnswers) {
  if (!questions || !questions.length || !userAnswers) return 0;

  let correct = 0;
  questions.forEach((question, index) => {
    if (isAnswerCorrectInline(question, userAnswers[index])) correct++;
  });

  return Math.round((correct / questions.length) * 100);
}

// Extract topics to review from AI explanation
function extractTopicsFromExplanation(explanation) {
  if (!explanation) {
    return (
      <ul className="list-disc list-inside space-y-1">
        <li>Key concepts related to this question</li>
        <li>Common misconceptions in this area</li>
        <li>Related foundational knowledge</li>
      </ul>
    );
  }

  // Look for the "📚 Topics to Review:" section
  const topicsMatch = explanation.match(/📚 Topics to Review:\s*\n((?:- .*\n?)*)/);
  
  if (topicsMatch && topicsMatch[1]) {
    const topicsText = topicsMatch[1];
    const topics = topicsText
      .split('\n')
      .filter(line => line.trim().startsWith('- '))
      .map(line => line.trim().substring(2))
      .filter(topic => topic.length > 0);

    if (topics.length > 0) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {topics.map((topic, index) => (
            <li key={index}>{renderTextWithMath(topic)}</li>
          ))}
        </ul>
      );
    }
  }

  // Fallback to default topics if no specific topics found
  return (
    <ul className="list-disc list-inside space-y-1">
      <li>Key concepts related to this question</li>
      <li>Common misconceptions in this area</li>
      <li>Related foundational knowledge</li>
    </ul>
  );
}

export default QuizDisplay;
