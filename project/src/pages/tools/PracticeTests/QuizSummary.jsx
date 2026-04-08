import React from "react";
import { formatTime, getCorrectAnswerCount } from "./utils";

/**
 * Component for displaying quiz summary and results
 */
const QuizSummary = ({
  quiz,
  userAnswers,
  timer,
  score,
  quizMode,
  onReviewQuestions,
  onReturnToTests,
  isSaving,
  saveSuccess,
  quizAttempts,
  showAttemptHistory,
  onToggleHistory,
}) => {
  if (!quiz) return null;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Quiz Complete!</h2>

      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Quiz Results
              </h3>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {formatTime(timer)}
              </span>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">Your Score</p>
                <p className="text-3xl font-bold text-gray-900">{score}%</p>
              </div>
              <div className="h-20 w-20 rounded-full flex items-center justify-center border-4 border-blue-500">
                <p className="text-2xl font-bold text-blue-500">
                  {getCorrectAnswerCount(quiz.questions, userAnswers)}/
                  {quiz.questions.length}
                </p>
              </div>
            </div>

            <div className="mt-6 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">
                Question Summary
              </h4>
              <QuestionMap
                quiz={quiz}
                userAnswers={userAnswers}
                onSelectQuestion={onReviewQuestions}
              />
            </div>

            {/* Show explanations for incorrect answers in quiz mode */}
            {quizMode === "quiz" && (
              <div className="mt-6 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">
                  Review Incorrect Answers
                </h4>
                <IncorrectAnswersReview
                  quiz={quiz}
                  userAnswers={userAnswers}
                />
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 space-y-4">
            <button
              onClick={() => onReviewQuestions(0)}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
            >
              Review Questions
            </button>

            <button
              onClick={onReturnToTests}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Return to Practice Tests
            </button>

            {saveSuccess && (
              <p className="text-green-600 font-medium text-center">
                Quiz results saved successfully!
              </p>
            )}
            {isSaving && (
              <p className="text-gray-600 font-medium text-center">
                Saving quiz results...
              </p>
            )}
          </div>
        </div>
      </div>

      {quizAttempts && quizAttempts.length > 0 && (
        <AttemptHistory
          attempts={quizAttempts}
          isVisible={showAttemptHistory}
          onToggle={onToggleHistory}
        />
      )}
    </div>
  );
};

/**
 * Component for displaying the question map in the summary
 */
const QuestionMap = ({ quiz, userAnswers, onSelectQuestion }) => {
  if (!quiz || !quiz.questions || !userAnswers) return null;

  // Check if an answer is correct
  const checkAnswerCorrect = (questionIndex) => {
    const question = quiz.questions[questionIndex];
    const userAnswer = userAnswers[questionIndex];

    if (!question || userAnswer === null) return null;

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
      case "numerical": {
        if (!userAnswer) return false;
        const parsed = parseFloat(String(userAnswer).replace(/[^0-9.\-]/g, ""));
        if (isNaN(parsed)) return false;
        return Math.abs(parsed - question.correct_answer_value) <= (question.tolerance ?? 0.01);
      }
      default:
        return false;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {quiz.questions.map((_, index) => {
        const isCorrect = checkAnswerCorrect(index);
        return (
          <button
            key={index}
            onClick={() => onSelectQuestion(index)}
            className={`h-10 w-10 rounded-full flex items-center justify-center font-medium ${
              isCorrect === true
                ? "bg-green-100 text-green-800 border border-green-300"
                : isCorrect === false
                ? "bg-red-100 text-red-800 border border-red-300"
                : "bg-gray-100 text-gray-800 border border-gray-300"
            }`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Component for displaying attempt history
 */
const AttemptHistory = ({ attempts, isVisible, onToggle }) => {
  if (!attempts || !attempts.length) return null;

  if (!isVisible) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="mt-8 text-blue-600 hover:text-blue-800 flex items-center"
      >
        <span className="mr-1">View {attempts.length} Past Attempts</span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-3xl mt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Past Attempts</h3>
        <button
          onClick={() => onToggle(false)}
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
            {attempts.map((attempt) => (
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
  );
};

/**
 * Component for reviewing incorrect answers with explanations
 */
const IncorrectAnswersReview = ({ quiz, userAnswers }) => {
  const [explanations, setExplanations] = React.useState({});
  const [loading, setLoading] = React.useState({});

  // Check if an answer is correct
  const isAnswerCorrect = (question, userAnswer) => {
    if (!question || userAnswer === null) return false;

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
      case "numerical": {
        if (!userAnswer) return false;
        const parsed = parseFloat(String(userAnswer).replace(/[^0-9.\-]/g, ""));
        if (isNaN(parsed)) return false;
        return Math.abs(parsed - question.correct_answer_value) <= (question.tolerance ?? 0.01);
      }
      default:
        return false;
    }
  };

  // Format the correct answer based on question type
  const formatCorrectAnswer = (question) => {
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
      case "numerical":
        return `${question.correct_answer_value} ${question.units || ""}` +
          (question.tolerance ? ` (±${question.tolerance})` : "");
      default:
        return "";
    }
  };

  // Get explanation for an incorrect answer
  const getExplanation = async (questionIndex) => {
    if (explanations[questionIndex] || loading[questionIndex]) return;

    setLoading(prev => ({ ...prev, [questionIndex]: true }));

    try {
      const question = quiz.questions[questionIndex];
      const userAnswer = userAnswers[questionIndex];
      
      // Import the API service dynamically
      const { getAnswerExplanation } = await import('../../../api/apiService');
      
      const explanation = await getAnswerExplanation(
        question,
        userAnswer,
        false // isCorrect is false for incorrect answers
      );

      setExplanations(prev => ({ ...prev, [questionIndex]: explanation }));
    } catch (error) {
      console.error("Error getting explanation:", error);
      setExplanations(prev => ({ 
        ...prev, 
        [questionIndex]: "Failed to generate an explanation. Please try again." 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [questionIndex]: false }));
    }
  };

  // Get incorrect answers
  const incorrectAnswers = quiz.questions
    .map((question, index) => ({ question, index, userAnswer: userAnswers[index] }))
    .filter(({ question, userAnswer }) => !isAnswerCorrect(question, userAnswer));

  if (incorrectAnswers.length === 0) {
    return (
      <div className="text-center py-4 text-gray-600">
        <p>🎉 Great job! You got all questions correct!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {incorrectAnswers.map(({ question, index, userAnswer }) => (
        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h5 className="font-medium text-red-800 mb-2">
                Question {index + 1}
              </h5>
              <p className="text-sm text-gray-700 mb-2">{question.question}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1">Your Answer:</p>
                  <p className="text-sm bg-white p-2 rounded border border-red-200 text-red-700">
                    {userAnswer || "No answer provided"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-green-600 mb-1">Correct Answer:</p>
                  <p className="text-sm bg-white p-2 rounded border border-green-200 text-green-700">
                    {formatCorrectAnswer(question)}
                  </p>
                </div>
              </div>

              {/* Explanation Section */}
              <div className="mt-3">
                {loading[index] ? (
                  <div className="flex items-center text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent mr-2"></div>
                    <span className="text-sm">Generating explanation...</span>
                  </div>
                ) : explanations[index] ? (
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <h6 className="text-sm font-medium text-gray-800 mb-1">
                      Explanation:
                    </h6>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {explanations[index]}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => getExplanation(index)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Get Explanation
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuizSummary;
