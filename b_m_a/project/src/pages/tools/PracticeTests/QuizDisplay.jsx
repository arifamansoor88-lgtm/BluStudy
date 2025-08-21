import React from "react";
import { Clock, ArrowRight, Check, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatTime } from "./utils";
import QuizQuestion from "./QuizQuestion";
import QuizSummary from "./QuizSummary";

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
  aiExplanation,
  loadingExplanation,
  evaluatingAnswer,
  aiEvaluatedAnswers,
  getAnswerCorrectness,
}) => {
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
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {quiz.quiz_title}
        </h2>
        <p className="text-gray-600 mb-8 text-center max-w-2xl">
          This quiz contains {quiz.questions.length} questions of various types.
          You'll be timed, but there's no time limit.
        </p>

        {showAttemptHistory && quizAttempts && quizAttempts.length > 0 ? (
          <div className="w-full max-w-3xl mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Past Attempts</h3>
              <button
                onClick={() => onToggleHistory(false)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Hide History
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Mode</th>
                    <th className="text-left py-2">Score</th>
                    <th className="text-left py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {quizAttempts.map((attempt) => (
                    <tr key={attempt.attemptId} className="border-b">
                      <td className="py-2">
                        {new Date(attempt.timestamp).toLocaleDateString()}{" "}
                        {new Date(attempt.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 capitalize">{attempt.mode}</td>
                      <td className="py-2">{attempt.score}%</td>
                      <td className="py-2">{formatTime(attempt.timeTaken)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : quizAttempts && quizAttempts.length > 0 ? (
          <button
            onClick={() => onToggleHistory(true)}
            className="mb-8 text-blue-600 hover:text-blue-800 flex items-center"
          >
            <span className="mr-1">
              View {quizAttempts.length} Past Attempts
            </span>
          </button>
        ) : null}

        <div className="space-y-4 w-full max-w-md">
          <h3 className="text-lg font-medium text-center">Choose a mode:</h3>
          <button
            onClick={() => onStartQuiz("quiz")}
            className="w-full px-6 py-3 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition"
          >
            Quiz Mode
            <p className="text-sm font-normal mt-1">
              Complete the entire quiz before seeing your results
            </p>
          </button>
          <button
            onClick={() => onStartQuiz("review")}
            className="w-full px-6 py-3 border border-red-600 text-red-600 font-medium rounded-md hover:bg-red-50 transition"
          >
            Review Mode
            <p className="text-sm font-normal mt-1">
              Check your answers after each question
            </p>
          </button>
        </div>
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
          <div className="text-gray-700">
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </div>
        </div>

        {/* Quiz Mini-map */}
        <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex flex-wrap gap-2">
            {quiz.questions.map((_, i) => {
              // Determine the button's background color based on answer status
              let bgColor = "bg-gray-200"; // Unanswered

              if (userAnswers[i] !== null) {
                if (status === "completed" || showSummary) {
                  // Use getAnswerCorrectness if available
                  const isCorrect = getAnswerCorrectness
                    ? getAnswerCorrectness(i)
                    : isAnswerCorrectInline(quiz.questions[i], userAnswers[i]);
                  bgColor = isCorrect ? "bg-green-500" : "bg-red-500"; // Correct/Incorrect
                } else {
                  bgColor = "bg-blue-500"; // Answered but not yet evaluated
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => onGoToQuestion(i)}
                  className={`${bgColor} ${
                    i === currentQuestionIndex ? "ring-2 ring-gray-800" : ""
                  } text-white w-8 h-8 flex items-center justify-center rounded-full font-medium`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <QuizQuestion
            question={currentQuestion}
            index={currentQuestionIndex}
            userAnswer={userAnswers[currentQuestionIndex]}
            onAnswerChange={onAnswerChange}
          />

          {/* Show feedback in review mode when the user checks their answer */}
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
                <div className="ml-3">
                  <h3
                    className={`text-sm font-medium ${
                      isCurrentAnswerCorrect()
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {isCurrentAnswerCorrect() ? "Correct!" : "Incorrect"}
                  </h3>
                  <div className="mt-2 text-sm">
                    {isCurrentAnswerCorrect()
                      ? "Well done! You got this right."
                      : "The correct answer is: " +
                        formatCorrectAnswer(currentQuestion)}
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
                    aiExplanation && (
                      <div className="mt-3 bg-white p-3 rounded border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-800 mb-1">
                          AI Explanation:
                        </h4>
                        <div className="text-sm text-gray-700 markdown-content">
                          <ReactMarkdown>{aiExplanation}</ReactMarkdown>
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
                userAnswers[currentQuestionIndex] !== null && (
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
                onClick={onNextQuestion}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
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
        <QuizSummary
          quiz={quiz}
          userAnswers={userAnswers}
          timer={timer}
          score={score}
          onReviewQuestions={onGoToQuestion}
          onReturnToTests={onReturnToTests}
          isSaving={isSaving}
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
      return question.correct_answers.join(", ");
    case "drag_and_drop":
      return Object.entries(question.correct_mapping)
        .map(([key, value]) => `${key} → ${value}`)
        .join(", ");
    case "short_answer":
    case "fill_in_blank":
      if (
        question.acceptable_answers &&
        question.acceptable_answers.length > 0
      ) {
        return `${
          question.correct_answer
        } (or ${question.acceptable_answers.join(", ")})`;
      }
      return question.correct_answer;
    default:
      return "";
  }
}

// Simple version of isAnswerCorrect for use within the component
function isAnswerCorrectInline(question, userAnswer) {
  if (!question || userAnswer === null || userAnswer === undefined)
    return false;

  switch (question.type) {
    case "multiple_choice":
      return userAnswer === question.correct_answer;
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
    case "fill_in_blank":
      return (
        userAnswer === question.correct_answer ||
        (question.acceptable_answers &&
          question.acceptable_answers.includes(userAnswer))
      );
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

export default QuizDisplay;
