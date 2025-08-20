import React from "react";
import { Clock, ArrowRight, Check, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatTime } from "./utils";
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
  aiExplanation,
  aiExplanations,
  loadingExplanation,
  evaluatingAnswer,
  aiEvaluatedAnswers,
  checkedAnswers,
  getAnswerCorrectness,
}) => {
  // State for selected attempt in review mode
  const [selectedAttempt, setSelectedAttempt] = React.useState(null);

     // Helper function to get the correct attempt number
   const getAttemptNumber = (attempt) => {
     const index = quizAttempts.findIndex(a => a.attemptId === attempt.attemptId);
     return index + 1;
   };

  // Helper function to get the current question's explanation
  const getCurrentQuestionExplanation = () => {
    if (aiExplanations && aiExplanations[currentQuestionIndex]) {
      return aiExplanations[currentQuestionIndex];
    }
    return aiExplanation; // Fallback to the legacy aiExplanation
  };

  // Helper function to check if answer is correct (for past attempts review)
  const isAnswerCorrectInline = (question, userAnswer) => {
    if (!question || userAnswer === null || userAnswer === undefined) return false;

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
  };

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

        <div className="space-y-4 w-full max-w-md mb-8">
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

        {showAttemptHistory && quizAttempts && quizAttempts.length > 0 ? (
          <div className="w-full max-w-4xl mb-8 flex flex-col items-center">
            <div className="flex justify-between items-center mb-4 w-full">
              <h3 className="text-lg font-semibold">Past Attempts Review</h3>
              <button
                onClick={() => onToggleHistory(false)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Hide History
              </button>
            </div>
            
            {/* Attempt Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 w-full">
              <div className="p-4 border-b border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3 text-center">Select an attempt to review:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 justify-items-center">
                                     {quizAttempts.map((attempt, index) => (
                     <button
                       key={attempt.attemptId}
                       onClick={() => {
                         // If clicking the same attempt, deselect it
                         if (selectedAttempt?.attemptId === attempt.attemptId) {
                           setSelectedAttempt(null);
                         } else {
                           setSelectedAttempt(attempt);
                         }
                       }}
                       className={`p-3 rounded-lg border text-center transition-colors w-full ${
                         selectedAttempt?.attemptId === attempt.attemptId
                           ? 'border-red-500 bg-red-50'
                           : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                       }`}
                     >
                      <div className="flex flex-col items-center mb-1">
                                                 <span className="text-sm font-medium text-gray-900 mb-1">
                           Attempt {index + 1}
                         </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          attempt.score >= 80 ? 'bg-green-100 text-green-800' :
                          attempt.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {attempt.score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        {new Date(attempt.timestamp).toLocaleDateString()} at{' '}
                        {new Date(attempt.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        {formatTime(attempt.timeTaken)} • {attempt.mode}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Attempt Review */}
            {selectedAttempt && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Attempt {getAttemptNumber(selectedAttempt)} Review
                      </h4>
                      <p className="text-sm text-gray-500">
                        {new Date(selectedAttempt.timestamp).toLocaleDateString()} at{' '}
                        {new Date(selectedAttempt.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">{selectedAttempt.score}%</div>
                      <div className="text-sm text-gray-500">{formatTime(selectedAttempt.timeTaken)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Questions Review */}
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">Questions & Answers</h5>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {quiz.questions.map((question, index) => {
                          const userAnswer = selectedAttempt.userAnswers[index];
                          const isCorrect = isAnswerCorrectInline(question, userAnswer);
                          
                          return (
                            <div key={index} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-sm font-medium text-gray-900">
                                  Question {index + 1}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {isCorrect ? 'Correct' : 'Incorrect'}
                                </span>
                              </div>
                              
                              <div className="text-sm text-gray-700 mb-2">
                                {question.question}
                              </div>
                              
                              <div className="space-y-1">
                                <div className="text-xs text-gray-500">Your Answer:</div>
                                <div className="text-sm bg-gray-50 p-2 rounded">
                                  {userAnswer === null || userAnswer === undefined ? (
                                    <span className="text-gray-400 italic">No answer provided</span>
                                  ) : Array.isArray(userAnswer) ? (
                                    userAnswer.join(', ')
                                  ) : (
                                    String(userAnswer)
                                  )}
                                </div>
                              </div>
                              
                              {question.type === 'multiple_choice' && (
                                <div className="mt-2">
                                  <div className="text-xs text-gray-500">Correct Answer:</div>
                                  <div className="text-sm bg-green-50 p-2 rounded text-green-800">
                                    {question.correct_answer}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Summary Stats */}
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">Performance Summary</h5>
                      <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">{selectedAttempt.score}%</div>
                              <div className="text-sm text-gray-500">Score</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-900">
                                {selectedAttempt.userAnswers.filter((answer, index) => 
                                  isAnswerCorrectInline(quiz.questions[index], answer)
                                ).length}
                              </div>
                              <div className="text-sm text-gray-500">Correct</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h6 className="font-medium text-gray-900 mb-2">Question Types</h6>
                          <div className="space-y-2">
                            {Object.entries(
                              quiz.questions.reduce((acc, question) => {
                                const type = question.type || 'unknown';
                                acc[type] = (acc[type] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([type, count]) => (
                              <div key={type} className="flex justify-between text-sm">
                                <span className="text-gray-600 capitalize">
                                  {type.replace('_', ' ')}
                                </span>
                                <span className="font-medium">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : quizAttempts && quizAttempts.length > 0 ? (
          <button
            onClick={() => onToggleHistory(true)}
            className="mb-8 text-blue-600 hover:text-blue-800 flex items-center"
          >
            <span className="mr-1">
              Review Questions & Answers from {quizAttempts.length} Past Attempts
            </span>
          </button>
        ) : null}
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

  // Helper function to check if all questions are answered
  const areAllQuestionsAnswered = () => {
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
          {/* Warning message when trying to finish with unanswered questions */}
          {currentQuestionIndex === quiz.questions.length - 1 && !areAllQuestionsAnswered() && (
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
                            {formatCorrectAnswer(currentQuestion)}
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
                          <ReactMarkdown>{getCurrentQuestionExplanation()}</ReactMarkdown>
                        </div>
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
                onClick={onNextQuestion}
                disabled={currentQuestionIndex === quiz.questions.length - 1 && !areAllQuestionsAnswered()}
                className={`px-4 py-2 flex items-center gap-2 rounded-md ${
                  currentQuestionIndex === quiz.questions.length - 1 && !areAllQuestionsAnswered()
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
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
          quizMode={quizMode}
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
          quizMode={quizMode}
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
            <li key={index}>{topic}</li>
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
