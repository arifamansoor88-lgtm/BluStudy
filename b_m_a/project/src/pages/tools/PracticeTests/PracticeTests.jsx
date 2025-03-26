import React, { useState, useEffect } from "react";
import { TestTube, PlusCircle, Check, X } from "lucide-react";
import QuizWizard from "./QuizWizard";
import QuizDisplay from "./QuizDisplay";
import SavedQuizzesList from "./SavedQuizzesList";
import { useQuizTimer, useQuizData } from "./hooks";

/**
 * Main PracticeTests component that coordinates all other components
 */
const PracticeTests = () => {
  // State for quiz display
  const [showQuiz, setShowQuiz] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [quizStatus, setQuizStatus] = useState("idle"); // idle, loading, ready, in-progress, completed

  // Quiz display state
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [quizMode, setQuizMode] = useState("quiz"); // "quiz" or "review"
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [showAttemptHistory, setShowAttemptHistory] = useState(false);

  // Quiz wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customTopics, setCustomTopics] = useState("");
  const [numQuestions, setNumQuestions] = useState(20);
  const [questionFormats, setQuestionFormats] = useState({
    multiple_choice: true,
    multi_select: true,
    drag_and_drop: true,
    true_false: false,
    short_response: false,
    fill_in_blank: false,
  });

  // Hooks for quiz functionality
  const { timer, resetTimer, setTimerValue } = useQuizTimer(quizStatus);
  const {
    savedQuizzes,
    isSaving,
    saveSuccess,
    quizAttempts,
    error,
    setError,
    quizzesFetchedRef,
    fetchSavedQuizzes,
    fetchQuizWithHistory,
    generateQuiz,
    saveQuiz,
    saveQuizAttempt,
  } = useQuizData();

  // Fetch saved quizzes on component mount
  useEffect(() => {
    if (showQuiz && !quizzesFetchedRef.current) {
      fetchSavedQuizzes();
    }
  }, [showQuiz, fetchSavedQuizzes, quizzesFetchedRef]);

  // Create a new test
  const handleCreateTest = () => {
    setShowQuiz(false);
    setShowUpload(true);
    setCurrentStep(1);
    setSelectedFile(null);
    setSelectedTopics([]);
    setCustomTopics("");
    setNumQuestions(20);
    setQuestionFormats({
      multiple_choice: true,
      multi_select: true,
      drag_and_drop: true,
      true_false: false,
      short_response: false,
      fill_in_blank: false,
    });
    setGeneratedQuiz(null);

    // Reset the quizzesFetchedRef to ensure fresh data when returning to home screen
    quizzesFetchedRef.current = false;
  };

  // File handling
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check if the file is a PDF
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    setError("");
    setSelectedFile(file);
  };

  // Quiz wizard navigation
  const handleNextStep = () => {
    if (currentStep === 1 && !selectedFile) {
      setError("Please upload a PDF file first");
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // When on step 3 and clicking "Generate", prevent going back
      // to step 1 if we're already in the process of uploading
      if (!uploading) {
        handleGenerateQuiz();
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleQuestionFormat = (format) => {
    setQuestionFormats((prev) => ({
      ...prev,
      [format]: !prev[format],
    }));
  };

  const toggleTopic = (topic) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  // Quiz generation
  const handleGenerateQuiz = async () => {
    // Check if at least one question format is selected
    const hasSelectedFormat = Object.values(questionFormats).some(
      (value) => value
    );

    if (!hasSelectedFormat) {
      setError("Please select at least one question format");
      return;
    }

    setError("");
    setUploading(true);

    // Set quiz status to loading and transition UI to display loading spinner
    setQuizStatus("loading");
    setShowUpload(true);
    setCurrentStep(3);

    try {
      // Generate quiz using the hook
      const quizData = await generateQuiz(
        selectedFile,
        numQuestions,
        selectedTopics,
        customTopics,
        questionFormats
      );

      // Set the generated quiz data from the response
      setGeneratedQuiz(quizData);
      setQuizStatus("ready"); // Set status to ready to start

      // Initialize userAnswers array with nulls for each question
      const answerArray = Array(quizData.questions.length).fill(null);
      setUserAnswers(answerArray);

      setCurrentQuizQuestion(0);
      resetTimer();
    } catch (err) {
      console.error("Error generating quiz:", err);
      setError(err.message || "Failed to generate quiz");
      // Make sure we return to the wizard UI with an appropriate error
      setQuizStatus("idle");
      // Use a debounce to make the UI transition smoother
      setTimeout(() => {
        setShowUpload(true);
        setCurrentStep(3);
      }, 100);
    } finally {
      setUploading(false);
    }
  };

  // Quiz interaction
  const startQuiz = (mode) => {
    setQuizMode(mode);
    setQuizStatus("in-progress");
    setCurrentQuizQuestion(0);
    resetTimer();
    setShowSummary(false);
    setShowAnswerFeedback(false);
  };

  const handleQuizAnswer = (questionIndex, answerValue) => {
    const newAnswers = [...userAnswers];
    // Check if the answer is actually different before updating state
    if (
      JSON.stringify(newAnswers[questionIndex]) !== JSON.stringify(answerValue)
    ) {
      newAnswers[questionIndex] = answerValue;
      setUserAnswers(newAnswers);

      if (quizMode === "review") {
        setShowAnswerFeedback(false);
      }
    }
  };

  const nextQuizQuestion = () => {
    // Only update if actually moving to a new question
    if (currentQuizQuestion < generatedQuiz.questions.length - 1) {
      setCurrentQuizQuestion((prev) => prev + 1);

      if (quizMode === "review") {
        setShowAnswerFeedback(false);
      }
    } else {
      // Complete the quiz if this is the last question
      setQuizStatus("completed");
      setShowSummary(true);

      // Auto-save the quiz attempt when completed
      saveQuizAttempt(generatedQuiz, userAnswers, timer, quizMode);
    }
  };

  const goToQuestion = (index) => {
    // Only update if actually changing questions
    if (index !== currentQuizQuestion) {
      setCurrentQuizQuestion(index);

      if (quizMode === "review") {
        setShowAnswerFeedback(false);
      }
    }
  };

  const checkAnswer = () => {
    setShowAnswerFeedback(true);
  };

  const toggleAttemptHistory = (visible) => {
    setShowAttemptHistory(visible);
  };

  const goBack = () => {
    setShowQuiz(true);
    setShowUpload(false);
    setGeneratedQuiz(null);
    setError("");
    setCurrentStep(1);

    quizzesFetchedRef.current = false;

    // Fetch saved quizzes when going back to main screen
    fetchSavedQuizzes();
  };

  // Handle loading a saved quiz
  const handleLoadSavedQuiz = async (savedQuiz) => {
    setShowQuiz(false);
    setShowUpload(true);
    setUploading(true);

    try {
      // Fetch the quiz history
      await fetchQuizWithHistory(savedQuiz.id);

      // Set the quiz data
      const quizWithId = { ...savedQuiz.data, id: savedQuiz.id };
      setGeneratedQuiz(quizWithId);

      // If there are saved answers, load them
      if (savedQuiz.data.userAnswers && savedQuiz.data.userAnswers.length > 0) {
        setUserAnswers(savedQuiz.data.userAnswers);
      } else {
        // Initialize empty answers
        const answerArray = Array(savedQuiz.data.questions.length).fill(null);
        setUserAnswers(answerArray);
      }

      // Set timer if available
      if (savedQuiz.data.timeTaken) {
        setTimerValue(savedQuiz.data.timeTaken);
      } else {
        resetTimer();
      }

      // Set quiz status
      setQuizStatus("ready");
      setShowSummary(false);
      setShowAttemptHistory(true); // Show attempt history by default

      setCurrentQuizQuestion(0);
    } catch (error) {
      console.error("Error loading saved quiz:", error);
      setError("Failed to load saved quiz");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Enhanced header with gradient underline */}
      <div className="flex items-center mb-10">
        <div className="flex items-center gap-3">
          <TestTube className="h-9 w-9 text-red-600" />
          <h1 className="text-3xl font-bold text-gray-900">Practice Tests</h1>
        </div>
        {showUpload && quizStatus !== "idle" && (
          <button
            onClick={goBack}
            className="ml-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
          >
            Back to Tests
          </button>
        )}
      </div>

      {showQuiz && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md mb-10 overflow-hidden">
          <div className="relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-red-600"></div>
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Welcome to Practice Tests
              </h2>
              <p className="text-gray-600 text-center mb-8 max-w-2xl">
                Create personalized quizzes based on your own content or choose
                from saved quizzes below.
              </p>
              <button
                onClick={handleCreateTest}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-md"
              >
                <PlusCircle className="h-5 w-5" />
                Create New Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz creation and display */}
      {showUpload && (
        <>
          {quizStatus === "idle" ? (
            <QuizWizard
              currentStep={currentStep}
              selectedFile={selectedFile}
              selectedTopics={selectedTopics}
              customTopics={customTopics}
              numQuestions={numQuestions}
              questionFormats={questionFormats}
              error={error}
              uploading={uploading}
              onFileSelect={handleFileSelect}
              onTopicToggle={toggleTopic}
              onCustomTopicsChange={setCustomTopics}
              onNumQuestionsChange={setNumQuestions}
              onQuestionFormatToggle={toggleQuestionFormat}
              onNextStep={handleNextStep}
              onPrevStep={handlePrevStep}
              onBack={goBack}
            />
          ) : (
            <QuizDisplay
              status={quizStatus}
              quiz={generatedQuiz}
              currentQuestion={currentQuizQuestion}
              userAnswers={userAnswers}
              timer={timer}
              quizMode={quizMode}
              showSummary={showSummary}
              showAnswerFeedback={showAnswerFeedback}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
              quizAttempts={quizAttempts}
              showAttemptHistory={showAttemptHistory}
              onStartQuiz={startQuiz}
              onAnswerChange={handleQuizAnswer}
              onNextQuestion={nextQuizQuestion}
              onPreviousQuestion={() => goToQuestion(currentQuizQuestion - 1)}
              onGoToQuestion={goToQuestion}
              onCheckAnswer={checkAnswer}
              onReviewQuestions={setShowSummary}
              onReturnToTests={goBack}
              onToggleHistory={toggleAttemptHistory}
            />
          )}
        </>
      )}

      {showQuiz && !showUpload && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
            <span className="mr-2">Saved Quizzes</span>
            <div className="h-px bg-gradient-to-r from-red-500 to-transparent flex-grow ml-4"></div>
          </h2>
          <SavedQuizzesList
            savedQuizzes={savedQuizzes}
            onQuizSelect={handleLoadSavedQuiz}
          />
        </div>
      )}
    </div>
  );
};

export default PracticeTests;
