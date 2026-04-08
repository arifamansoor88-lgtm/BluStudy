import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { TestTube, PlusCircle, Check, X } from "lucide-react";
import QuizWizard from "./QuizWizard";
import QuizDisplay from "./QuizDisplay";
import SavedQuizzesList from "./SavedQuizzesList";
import { useQuizTimer, useQuizData } from "./hooks";
import { isAnswerCorrect, shouldUseAIEvaluation } from "./utils";
import {
  getAnswerExplanation,
  evaluateShortAnswer,
} from "../../../api/apiService";

/**
 * Main PracticeTests component that coordinates all other components
 */
const PracticeTests = () => {
  // Get folderId from URL query params if present
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');
  
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
  const [aiExplanation, setAiExplanation] = useState(""); // Keep for backward compatibility
  const [aiExplanations, setAiExplanations] = useState({}); // New: question-specific explanations
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [checkedAnswers, setCheckedAnswers] = useState({}); // New: track which answers have been checked

  // Quiz wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customTopics, setCustomTopics] = useState("");
  const [numQuestions, setNumQuestions] = useState(20);
  const [subjectCategory, setSubjectCategory] = useState("conceptual");
  const [questionFormats, setQuestionFormats] = useState({
    multiple_choice: true,
    multi_select: true,
    drag_and_drop: true,
    true_false: false,
    short_response: false,
    fill_in_blank: false,
    numerical: false,
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
    generateQuizFromTopic,
    saveQuiz,
    saveQuizAttempt,
  } = useQuizData();

  // New state for AI-evaluated answers
  const [aiEvaluatedAnswers, setAiEvaluatedAnswers] = useState({});
  const [evaluatingAnswer, setEvaluatingAnswer] = useState(false);

  // Creation mode: "pdf" (current) or "topic"
  const [creationMode, setCreationMode] = useState("pdf");
  // Main topic for topic-based generation (separate from focus topics)
  const [mainTopic, setMainTopic] = useState("");

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
    setMainTopic(""); // Reset main topic
    setNumQuestions(20);
    setSubjectCategory("conceptual");
    setQuestionFormats({
      multiple_choice: true,
      multi_select: true,
      drag_and_drop: true,
      true_false: false,
      short_response: false,
      fill_in_blank: false,
      numerical: false,
    });
    setGeneratedQuiz(null);
    setQuizStatus("idle");
    setCurrentQuizQuestion(0);
    setUserAnswers([]);
    setShowSummary(false);
    setShowAnswerFeedback(false);
    setAiExplanation("");
    setAiExplanations({});
    setCheckedAnswers({});
    setAiEvaluatedAnswers({});
    setError("");

    // Default to PDF mode when starting a new test
    setCreationMode("pdf");

    // Reset the quizzesFetchedRef to ensure fresh data when returning to home screen
    quizzesFetchedRef.current = false;
  };

  // Auto-enable numerical and short answer for quantitative subject
  useEffect(() => {
    if (subjectCategory === "quantitative") {
      setQuestionFormats(prev => ({
        ...prev,
        numerical: true,
        short_response: true
      }));
    }
  }, [subjectCategory]);

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
    // In PDF mode, require a file on step 1
    if (creationMode === "pdf" && currentStep === 1 && !selectedFile) {
      setError("Please upload a PDF file first");
      return;
    }
    
    // In topic mode, require main topic on step 1
    if (creationMode === "topic" && currentStep === 1 && !mainTopic.trim()) {
      setError("Please type a topic to generate a test.");
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // When on step 3 and clicking "Generate", validate before generating
      if (!uploading) {
        // Validate minimum number of questions
        const questions = typeof numQuestions === 'number' ? numQuestions : parseInt(String(numQuestions));
        if (isNaN(questions) || questions < 10) {
          setError("Minimum Number of Questions is 10!");
          return;
        }
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
    // Validate minimum number of questions (safety check)
    const questions = typeof numQuestions === 'number' ? numQuestions : parseInt(numQuestions);
    if (isNaN(questions) || questions < 10) {
      setError("Minimum Number of Questions is 10!");
      setNumQuestions(10);
      return;
    }

    // Check if at least one question format is selected
    const hasSelectedFormat = Object.values(questionFormats).some(
      (value) => value
    );

    if (!hasSelectedFormat) {
      setError("Please select at least one question format");
      return;
    }

    // If we're in PDF mode, ensure a file is selected
    if (creationMode === "pdf" && !selectedFile) {
      setError("Please select a PDF file");
      return;
    }

    setError("");
    setUploading(true);

    // Set quiz status to loading and transition UI to display loading spinner
    setQuizStatus("loading");
    setShowUpload(true);
    setCurrentStep(3);

    try {
      console.log("=== Starting Quiz Generation ===");
      console.log("Creation mode:", creationMode);
      if (creationMode === "pdf") {
        console.log("File:", selectedFile);
        console.log("File name:", selectedFile.name);
        console.log("File size:", selectedFile.size);
        console.log("File type:", selectedFile.type);
      } else {
        console.log("Topic-based generation, mainTopic:", mainTopic);
        console.log("Additional focus topics:", customTopics);
      }
      console.log("Number of questions:", numQuestions);
      console.log("Selected topics:", selectedTopics);
      console.log("Custom topics:", customTopics);
      console.log("Question formats:", questionFormats);
      
      // Ensure we use a valid number (at least 10)
      const validNumQuestions = Math.max(10, questions);
      
      let quizData;
      if (creationMode === "pdf") {
        // Generate quiz using the PDF-based hook
        quizData = await generateQuiz(
          selectedFile,
          validNumQuestions,
          selectedTopics,
          customTopics,
          questionFormats,
          folderId, // Pass folderId if present
          subjectCategory
        );
      } else {
        // Generate quiz using the topic-based hook
        // Use mainTopic as the primary topic string (from Step 1)
        const topicText = mainTopic || "General concepts";
        // customTopics in Step 2 are additional focus topics
        quizData = await generateQuizFromTopic(
          topicText,
          validNumQuestions,
          selectedTopics,
          customTopics, // Additional focus topics from Step 2
          questionFormats,
          folderId, // Pass folderId if present
          subjectCategory
        );
      }

      console.log("=== Quiz Generation Successful ===");
      console.log("Quiz data received:", quizData);
      console.log("Quiz ID:", quizData.id);
      console.log("Quiz title:", quizData.quiz_title);
      console.log("Number of questions:", quizData.questions?.length);

      // Set the generated quiz data from the response
      setGeneratedQuiz(quizData);
      setQuizStatus("ready"); // Set status to ready to start

      // Initialize userAnswers array with nulls for each question
      const answerArray = Array(quizData.questions.length).fill(null);
      setUserAnswers(answerArray);

      setCurrentQuizQuestion(0);
      resetTimer();
      
      // Refresh the saved quizzes list since a new quiz was created
      quizzesFetchedRef.current = false;
      await fetchSavedQuizzes();
      
    } catch (err) {
      console.error("=== Quiz Generation Failed ===");
      console.error("Error object:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      
      if (err.response) {
        console.error("Response status:", err.response.status);
        console.error("Response data:", err.response.data);
        console.error("Response headers:", err.response.headers);
      }
      
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

      // Clear AI evaluation for this question when the answer changes
      if (aiEvaluatedAnswers[questionIndex]) {
        const newEvaluations = { ...aiEvaluatedAnswers };
        delete newEvaluations[questionIndex];
        setAiEvaluatedAnswers(newEvaluations);
      }

      // Clear checked status and explanation for this question when answer changes
      if (checkedAnswers[questionIndex]) {
        const newCheckedAnswers = { ...checkedAnswers };
        delete newCheckedAnswers[questionIndex];
        setCheckedAnswers(newCheckedAnswers);
      }
      
      if (aiExplanations[questionIndex]) {
        const newExplanations = { ...aiExplanations };
        delete newExplanations[questionIndex];
        setAiExplanations(newExplanations);
      }

      // Only auto-check in review mode for question types where a single interaction
      // completes the answer. Multi-select requires an explicit "Check My Answer" click.
      if (quizMode === "review") {
        setShowAnswerFeedback(false);
        const questionType = generatedQuiz.questions[questionIndex]?.type;
        if (questionType !== "multi_select") {
          setTimeout(() => {
            checkAnswerForQuestion(questionIndex);
          }, 500);
        }
      }
    }
  };

  // AI evaluation of answers
  const evaluateAnswerWithAI = async (questionIndex) => {
    const question = generatedQuiz.questions[questionIndex];
    const userAnswer = userAnswers[questionIndex];

    // Only evaluate short answer and fill-in-blank questions
    if (!shouldUseAIEvaluation(question.type) || !userAnswer) {
      return isAnswerCorrect(question, userAnswer);
    }

    // Check if we already have an evaluation for this answer
    const answerKey = `${questionIndex}-${userAnswer}`;
    if (aiEvaluatedAnswers[questionIndex]) {
      return aiEvaluatedAnswers[questionIndex].isCorrect;
    }

    // If not, make the API call to evaluate
    setEvaluatingAnswer(true);

    try {
      const result = await evaluateShortAnswer(question, userAnswer);

      // Save the evaluation result
      const newEvaluations = { ...aiEvaluatedAnswers };
      newEvaluations[questionIndex] = result;
      setAiEvaluatedAnswers(newEvaluations);

      return result.isCorrect;
    } catch (error) {
      console.error("Error evaluating answer:", error);
      // Fall back to the simple evaluation if AI fails
      return isAnswerCorrect(question, userAnswer);
    } finally {
      setEvaluatingAnswer(false);
    }
  };

  const checkAnswerForQuestion = async (questionIndex) => {
    // Get the question and answer
    const question = generatedQuiz.questions[questionIndex];
    const userAnswer = userAnswers[questionIndex];

    if (!userAnswer || userAnswer === null || userAnswer === undefined) {
      return; // Don't check if no answer provided
    }

    // For numerical questions, first try local tolerance check
    if (question.type === "numerical") {
      let localCheckIsCorrect = false;
      const parsed = parseFloat(String(userAnswer).replace(/[^0-9.\-]/g, ""));
      if (!isNaN(parsed)) {
         localCheckIsCorrect = Math.abs(parsed - question.correct_answer_value) <= (question.tolerance ?? 0.01);
         if(localCheckIsCorrect) {
             // mark as true, don't fallback to AI
             if (quizMode === "review") {
                if (!loadingExplanation) setLoadingExplanation(true);
                try {
                  const explanation = await getAnswerExplanation(
                    question,
                    userAnswer,
                    true
                  );
                  setAiExplanations(prev => ({
                    ...prev,
                    [questionIndex]: explanation
                  }));
                  setAiExplanation(explanation);
                } catch (error) {
                  const errorMessage = "Failed to generate an explanation. Please try again.";
                  setAiExplanations(prev => ({
                    ...prev,
                    [questionIndex]: errorMessage
                  }));
                  setAiExplanation(errorMessage);
                } finally {
                  setLoadingExplanation(false);
                }
                setCheckedAnswers(prev => ({
                  ...prev,
                  [questionIndex]: true
                }));
                setShowAnswerFeedback(true);
             }
             return;
         }
      }
    }

    // For short answer and fill-in-blank questions, evaluate with AI
    let answerIsCorrect;

    if (shouldUseAIEvaluation(question.type)) {
      // Start the AI evaluation and show loading state
      setLoadingExplanation(true);
      answerIsCorrect = await evaluateAnswerWithAI(questionIndex);
    } else {
      // For other question types, use the standard evaluation
      answerIsCorrect = isAnswerCorrect(question, userAnswer);
    }

    // Get AI explanation and show feedback only in review mode
    if (quizMode === "review") {
      if (!loadingExplanation) setLoadingExplanation(true);

      try {
        // Get explanation from the API
        const explanation = await getAnswerExplanation(
          question,
          userAnswer,
          answerIsCorrect
        );

        // Set the explanation for this specific question
        setAiExplanations(prev => ({
          ...prev,
          [questionIndex]: explanation
        }));
        
        // Also set the current explanation for backward compatibility
        setAiExplanation(explanation);
      } catch (error) {
        console.error("Error getting explanation:", error);
        const errorMessage = "Failed to generate an explanation. Please try again.";
        setAiExplanations(prev => ({
          ...prev,
          [questionIndex]: errorMessage
        }));
        setAiExplanation(errorMessage);
      } finally {
        setLoadingExplanation(false);
      }

      // Mark this answer as checked
      setCheckedAnswers(prev => ({
        ...prev,
        [questionIndex]: true
      }));

      // Show the feedback
      setShowAnswerFeedback(true);
    }
  };

  const checkAnswer = async () => {
    // Use the new function for the current question
    await checkAnswerForQuestion(currentQuizQuestion);
  };

  // For the final summary and score calculation, we need to evaluate all answers
  const evaluateAllAnswers = async () => {
    // Only do this in quiz mode when completing the quiz
    if (quizMode !== "quiz" || quizStatus !== "in-progress") return;

    // Set loading state
    setShowSummary(false);

    // Questions that need AI evaluation
    const questionsToEvaluate = generatedQuiz.questions
      .map((q, idx) => ({ question: q, index: idx }))
      .filter(
        ({ question, index }) =>
          shouldUseAIEvaluation(question.type) &&
          userAnswers[index] !== null &&
          !aiEvaluatedAnswers[index]
      );

    // If no questions need evaluation, proceed
    if (questionsToEvaluate.length === 0) {
      completeQuiz();
      return;
    }

    // Evaluate all questions that need it
    try {
      // We'll use Promise.all to evaluate all questions in parallel
      await Promise.all(
        questionsToEvaluate.map(({ index }) => evaluateAnswerWithAI(index))
      );

      // Once all evaluations are complete, complete the quiz
      completeQuiz();
    } catch (error) {
      console.error("Error evaluating all answers:", error);
      // Still complete the quiz even if there's an error
      completeQuiz();
    }
  };

  // Function to complete the quiz after evaluation
  const completeQuiz = () => {
    setQuizStatus("completed");
    setShowSummary(true);

    // Auto-save the quiz attempt when completed
    saveQuizAttempt(generatedQuiz, userAnswers, timer, quizMode);
  };

  const nextQuizQuestion = () => {
    // In review mode, check if the current question has been answered and checked
    if (quizMode === "review") {
      const currentAnswer = userAnswers[currentQuizQuestion];
      const isCurrentAnswerChecked = checkedAnswers[currentQuizQuestion];
      
      // If no answer provided or answer not checked, don't allow moving forward
      if (!currentAnswer || currentAnswer === null || currentAnswer === undefined) {
        alert("Please provide an answer before moving to the next question.");
        return;
      }
      
      if (!isCurrentAnswerChecked) {
        alert("Please check your answer before moving to the next question.");
        return;
      }
    }

    // Only update if actually moving to a new question
    if (currentQuizQuestion < generatedQuiz.questions.length - 1) {
      setCurrentQuizQuestion((prev) => prev + 1);

      if (quizMode === "review") {
        setShowAnswerFeedback(false);
        // Set the explanation for the new question if it exists
        const newQuestionIndex = currentQuizQuestion + 1;
        const newQuestionExplanation = aiExplanations[newQuestionIndex];
        if (newQuestionExplanation) {
          setAiExplanation(newQuestionExplanation);
        } else {
          setAiExplanation("");
        }
      }
    } else {
      // If this is the last question, evaluate all answers before completing
      if (quizMode === "quiz") {
        evaluateAllAnswers();
      } else {
        // In review mode, just complete the quiz
        setQuizStatus("completed");
        setShowSummary(true);

        // Auto-save the quiz attempt when completed
        saveQuizAttempt(generatedQuiz, userAnswers, timer, quizMode);
      }
    }
  };

  const goToQuestion = (index) => {
    // Only update if actually changing questions
    if (index !== currentQuizQuestion) {
      setCurrentQuizQuestion(index);

      if (quizMode === "review") {
        setShowAnswerFeedback(false);
        // Set the explanation for the new question if it exists
        const newQuestionExplanation = aiExplanations[index];
        if (newQuestionExplanation) {
          setAiExplanation(newQuestionExplanation);
        } else {
          setAiExplanation("");
        }
      }
    }
  };

  const toggleAttemptHistory = (visible) => {
    setShowAttemptHistory(visible);
  };

  const goBack = () => {
    setShowQuiz(true);
    setShowUpload(false);
    setGeneratedQuiz(null);
    setQuizStatus("idle");
    setCurrentStep(1);
    setCurrentQuizQuestion(0);
    setUserAnswers([]);
    setShowSummary(false);
    setShowAnswerFeedback(false);
    setAiExplanation("");
    setAiExplanations({});
    setCheckedAnswers({});
    setAiEvaluatedAnswers({});
    setError("");

    setSubjectCategory("conceptual");
    setQuestionFormats({
      multiple_choice: true,
      multi_select: true,
      drag_and_drop: true,
      true_false: false,
      short_response: false,
      fill_in_blank: false,
      numerical: false,
    });

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
              setCurrentStep={setCurrentStep}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              selectedTopics={selectedTopics}
              setSelectedTopics={setSelectedTopics}
              customTopics={customTopics}
              setCustomTopics={setCustomTopics}
              numQuestions={numQuestions}
              setNumQuestions={setNumQuestions}
              subjectCategory={subjectCategory}
              setSubjectCategory={setSubjectCategory}
              questionFormats={questionFormats}
              toggleQuestionFormat={toggleQuestionFormat}
              handleNextStep={handleNextStep}
              handlePrevStep={handlePrevStep}
              handleFileSelect={handleFileSelect}
              handleToggleTopic={toggleTopic}
              error={error}
              setError={setError}
              uploading={uploading}
              quizData={generatedQuiz}
              onBack={goBack}
              creationMode={creationMode}
              setCreationMode={setCreationMode}
              mainTopic={mainTopic}
              setMainTopic={setMainTopic}
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
              aiExplanation={aiExplanation}
              aiExplanations={aiExplanations}
              loadingExplanation={loadingExplanation}
              evaluatingAnswer={evaluatingAnswer}
              aiEvaluatedAnswers={aiEvaluatedAnswers}
              checkedAnswers={checkedAnswers}
              getAnswerCorrectness={(questionIndex) => {
                const question = generatedQuiz.questions[questionIndex];
                const userAnswer = userAnswers[questionIndex];

                // For questions that use AI evaluation
                if (
                  shouldUseAIEvaluation(question.type) &&
                  aiEvaluatedAnswers[questionIndex]
                ) {
                  return aiEvaluatedAnswers[questionIndex].isCorrect;
                }

                // Fall back to standard evaluation
                return isAnswerCorrect(question, userAnswer);
              }}
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
