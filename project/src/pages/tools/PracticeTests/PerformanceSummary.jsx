import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Target, BookOpen, AlertTriangle, CheckCircle, XCircle, Download } from "lucide-react";
import { exportResultsAsPDF, exportElementAsPDF } from "./pdfExport";
import { renderTextWithMath } from "./MathText";

/**
 * Component for displaying comprehensive performance summary
 */
const PerformanceSummary = ({
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
  console.log("PerformanceSummary component rendered with props:", {
    quiz: !!quiz,
    userAnswers: !!userAnswers,
    timer,
    score,
    quizMode
  });
  const [topicAnalysis, setTopicAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [selectedAttemptAnalysis, setSelectedAttemptAnalysis] = useState(null);
  const [loadingAttemptAnalysis, setLoadingAttemptAnalysis] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const summaryRef = useRef(null);

  useEffect(() => {
    console.log("useEffect triggered with quiz and userAnswers:", {
      hasQuiz: !!quiz,
      hasUserAnswers: !!userAnswers,
      quizLength: quiz?.questions?.length,
      userAnswersLength: userAnswers?.length
    });
    
    if (quiz && userAnswers) {
      console.log("Starting analysis...");
      analyzePerformance();
    } else {
      console.log("Missing quiz or userAnswers, skipping analysis");
    }
  }, [quiz, userAnswers]);

  const analyzePerformance = async () => {
    setLoadingAnalysis(true);
    try {
      console.log("Starting performance analysis...");
      // Use the real topic analysis
      const analysis = await performTopicAnalysis(quiz, userAnswers);
      console.log("Analysis completed:", analysis);
      setTopicAnalysis(analysis);
    } catch (error) {
      console.error("Error analyzing performance:", error);
      // Fallback to basic analysis if AI analysis fails
      console.log("Falling back to basic analysis...");
      const basicAnalysis = await performBasicAnalysis(quiz, userAnswers);
      console.log("Basic analysis result:", basicAnalysis);
      setTopicAnalysis(basicAnalysis);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const analyzePastAttempt = async (attempt) => {
    setLoadingAttemptAnalysis(true);
    setSelectedAttemptId(attempt.attemptId);
    try {
      console.log("Analyzing past attempt:", attempt);
      const analysis = await performTopicAnalysis(quiz, attempt.userAnswers);
      console.log("Past attempt analysis completed:", analysis);
      setSelectedAttemptAnalysis(analysis);
    } catch (error) {
      console.error("Error analyzing past attempt:", error);
      const basicAnalysis = await performBasicAnalysis(quiz, attempt.userAnswers);
      setSelectedAttemptAnalysis(basicAnalysis);
    } finally {
      setLoadingAttemptAnalysis(false);
    }
  };

  const clearAttemptAnalysis = () => {
    setSelectedAttemptAnalysis(null);
    setSelectedAttemptId(null);
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    setExportSuccess(false);
    try {
      console.log('Starting PDF export...');
      await exportResultsAsPDF(quiz, userAnswers, timer, score, topicAnalysis);
      setExportSuccess(true);
      console.log('PDF exported successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setExportSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportElementPDF = async () => {
    setExportingPDF(true);
    setExportSuccess(false);
    try {
      console.log('Starting element-based PDF export...');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${quiz.quiz_title || 'PracticeTest'}_Results_${timestamp}.pdf`;
      await exportElementAsPDF(summaryRef, filename);
      setExportSuccess(true);
      console.log('Element-based PDF exported successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setExportSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error exporting element PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  if (!quiz) {
    console.log("No quiz data available");
    return null;
  }

  console.log("Rendering PerformanceSummary with:", {
    quiz: !!quiz,
    userAnswers: !!userAnswers,
    topicAnalysis: !!topicAnalysis,
    loadingAnalysis,
    score
  });

  try {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Summary</h2>

      <div className="w-full max-w-4xl" ref={summaryRef}>
        {/* Score Overview */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Overall Performance
              </h3>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {formatTime(timer)}
              </span>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score */}
              <div className="text-center">
                <div className="relative">
                  <svg className="w-24 h-24 mx-auto" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={getScoreColor(score)}
                      strokeWidth="3"
                      strokeDasharray={`${score}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-900">{score}%</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-600">Overall Score</p>
              </div>

              {/* Correct Answers */}
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {getCorrectAnswerCount(quiz.questions, userAnswers)}
                </div>
                <p className="text-sm text-gray-600">Correct Answers</p>
                <p className="text-xs text-gray-500">
                  out of {quiz.questions.length} questions
                </p>
              </div>

              {/* Performance Level */}
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {getPerformanceLevel(score)}
                </div>
                <p className="text-sm text-gray-600">Performance Level</p>
                <p className="text-xs text-gray-500">
                  {getPerformanceDescription(score)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Topic Analysis */}
        {loadingAnalysis ? (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Topic Analysis
              </h3>
            </div>
            <div className="px-6 py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-600 border-t-transparent mx-auto"></div>
              <p className="mt-2 text-gray-600">Analyzing your performance by topic...</p>
            </div>
          </div>
        ) : topicAnalysis ? (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Accuracy by Topic
              </h3>
            </div>
                         <div className="px-6 py-4">
               <TopicBreakdown analysis={topicAnalysis} quiz={quiz} />
             </div>
          </div>
        ) : null}

        {/* Suggested Areas for Revision */}
        {topicAnalysis && (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Suggested Areas for Revision
              </h3>
            </div>
            <div className="px-6 py-4">
              <RevisionSuggestions analysis={topicAnalysis} />
            </div>
          </div>
        )}

        {/* Question Review */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Question Review
            </h3>
          </div>
          <div className="px-6 py-4">
            <QuestionMap
              quiz={quiz}
              userAnswers={userAnswers}
              onSelectQuestion={onReviewQuestions}
            />
          </div>
        </div>

                 {/* Action Buttons */}
         <div className="bg-white rounded-lg shadow overflow-hidden">
           <div className="px-6 py-4 space-y-4">
             <div className="flex flex-col sm:flex-row gap-3">
               <button
                 onClick={() => setShowReviewMode(!showReviewMode)}
                 className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 flex items-center justify-center"
               >
                 <BookOpen className="h-4 w-4 mr-2" />
                 {showReviewMode ? "Hide" : "Show"} Review Mode
               </button>
               <button
                 onClick={() => onReviewQuestions(0)}
                 className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
               >
                 Review Questions
               </button>
               <button
                 onClick={onReturnToTests}
                 className="flex-1 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700"
               >
                 Return to Practice Tests
               </button>
             </div>

             {/* PDF Export Buttons */}
             <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
               <button
                 onClick={handleExportPDF}
                 disabled={exportingPDF}
                 className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 flex items-center justify-center"
               >
                 <Download className="h-4 w-4 mr-2" />
                 {exportingPDF ? "Generating PDF..." : "Export as PDF"}
               </button>
               <button
                 onClick={handleExportElementPDF}
                 disabled={exportingPDF}
                 className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-400 flex items-center justify-center"
               >
                 <Download className="h-4 w-4 mr-2" />
                 {exportingPDF ? "Generating PDF..." : "Export Visual PDF"}
               </button>
             </div>

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
             {exportSuccess && (
               <p className="text-green-600 font-medium text-center">
                 PDF exported successfully! Check your downloads folder.
               </p>
             )}
          </div>
        </div>

        {/* Review Mode Panel */}
        {showReviewMode && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3 flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Review Mode
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              Use this mode to go through your answers with detailed explanations and focus on areas that need improvement.
            </p>
            <div className="flex flex-wrap gap-2">
              {topicAnalysis?.weakTopics?.map((topic, index) => (
                <button
                  key={index}
                  onClick={() => onReviewQuestions(topic.questionIndices[0])}
                  className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200"
                >
                  <span>Review </span>
                  {renderTextWithMath(topic.name)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {quizAttempts && quizAttempts.length > 0 && (
        <AttemptHistory
          attempts={quizAttempts}
          isVisible={showAttemptHistory}
          onToggle={onToggleHistory}
          onAnalyzeAttempt={analyzePastAttempt}
          selectedAttemptAnalysis={selectedAttemptAnalysis}
          loadingAttemptAnalysis={loadingAttemptAnalysis}
          selectedAttemptId={selectedAttemptId}
          onClearAnalysis={clearAttemptAnalysis}
          quiz={quiz}
        />
      )}
    </div>
    );
  } catch (error) {
    console.error("Error rendering PerformanceSummary:", error);
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Summary</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Summary</h3>
          <p className="text-red-700 mb-4">
            There was an error loading your performance summary. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
};

/**
 * Component for displaying topic breakdown
 */
const TopicBreakdown = ({ analysis, quiz }) => {
  console.log("TopicBreakdown rendering with analysis:", analysis);
  if (!analysis || !analysis.topics) {
    console.log("TopicBreakdown: No analysis or topics available");
    return null;
  }

  return (
    <div className="space-y-4">
             {analysis.topics.map((topic, index) => {
         console.log(`Topic "${topic.name}" question indices:`, {
           indices: topic.questionIndices,
           validIndices: topic.questionIndices.filter(i => i >= 0 && i < quiz.questions.length),
           questionNumbers: topic.questionIndices
             .filter(i => i >= 0 && i < quiz.questions.length)
             .map(i => i + 1)
         });
         return (
         <div key={index} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">{renderTextWithMath(topic.name)}</h4>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getScoreColorClass(topic.accuracy)}`}>
                {topic.accuracy}%
              </span>
              {topic.accuracy >= 80 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : topic.accuracy >= 60 ? (
                <Target className="h-4 w-4 text-yellow-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreColorClass(topic.accuracy)}`}
                style={{ width: `${topic.accuracy}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-500">
              {topic.correctCount}/{topic.totalCount}
            </span>
          </div>
          
                     <div className="flex items-center gap-4 text-xs text-gray-600">
             <span>Questions: {topic.questionIndices
               .filter(i => i >= 0 && i < quiz.questions.length)
               .map(i => i + 1)
               .join(', ')}</span>
             <span>Difficulty: {topic.difficulty}</span>
                      </div>
         </div>
       );
       })}
    </div>
  );
};

/**
 * Component for displaying revision suggestions
 */
const RevisionSuggestions = ({ analysis }) => {
  try {
    console.log("RevisionSuggestions rendering with analysis:", analysis);
    if (!analysis) {
      console.log("RevisionSuggestions: No analysis available");
      return null;
    }

    // Ensure all properties exist and are arrays
    const weakTopics = analysis.weakTopics || [];
    const strongTopics = analysis.strongTopics || [];
    const recommendations = analysis.recommendations || [];
  
  console.log("RevisionSuggestions extracted data:", {
    weakTopics: weakTopics,
    strongTopics: strongTopics,
    recommendations: recommendations,
    weakTopicsType: typeof weakTopics,
    strongTopicsType: typeof strongTopics,
    recommendationsType: typeof recommendations
  });

  return (
    <div className="space-y-6">
      {/* Weak Areas */}
      {console.log("Rendering weakTopics section:", { 
        weakTopics, 
        weakTopicsLength: weakTopics?.length,
        isArray: Array.isArray(weakTopics)
      })}
      {Array.isArray(weakTopics) && weakTopics.length > 0 && (
        <div>
          <h4 className="font-medium text-red-800 mb-3 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Areas Needing Improvement
          </h4>
          <div className="space-y-3">
            {weakTopics.map((topic, index) => {
              console.log("Rendering weak topic:", topic);
              // Ensure topic has required properties
              const safeTopic = {
                name: topic?.name || 'Unknown Topic',
                accuracy: topic?.accuracy || 0,
                reason: topic?.reason || 'No reason provided',
                suggestions: Array.isArray(topic?.suggestions) ? topic.suggestions : ['Review this topic']
              };
              
              return (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-red-800">{renderTextWithMath(safeTopic.name)}</h5>
                    <span className="text-sm text-red-600">{safeTopic.accuracy}% accuracy</span>
                  </div>
                  <p className="text-sm text-red-700 mb-2">{renderTextWithMath(safeTopic.reason)}</p>
                  <div className="flex flex-wrap gap-2">
                    {safeTopic.suggestions.map((suggestion, idx) => (
                      <span key={idx} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                        {renderTextWithMath(suggestion)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strong Areas */}
      {Array.isArray(strongTopics) && strongTopics.length > 0 && (
        <div>
          <h4 className="font-medium text-green-800 mb-3 flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Strong Areas
          </h4>
          <div className="space-y-2">
            {strongTopics.map((topic, index) => {
              // Ensure topic has required properties
              const safeTopic = {
                name: topic?.name || 'Unknown Topic',
                accuracy: topic?.accuracy || 0
              };
              
              return (
                <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-green-800">{renderTextWithMath(safeTopic.name)}</h5>
                    <span className="text-sm text-green-600">{safeTopic.accuracy}% accuracy</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* General Recommendations */}
      {Array.isArray(recommendations) && recommendations.length > 0 && (
        <div>
          <h4 className="font-medium text-blue-800 mb-3 flex items-center">
            <BookOpen className="h-4 w-4 mr-2" />
            Study Recommendations
          </h4>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-blue-800 flex items-start">
                  <span className="mr-2">•</span>
                  {renderTextWithMath(rec || "No recommendation provided")}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {/* Fallback if no sections have data */}
      {(!Array.isArray(weakTopics) || weakTopics.length === 0) && 
       (!Array.isArray(strongTopics) || strongTopics.length === 0) && 
       (!Array.isArray(recommendations) || recommendations.length === 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-center">
            No specific revision suggestions available. Review your incorrect answers to identify areas for improvement.
          </p>
        </div>
      )}
    </div>
  );
  } catch (error) {
    console.error("Error in RevisionSuggestions:", error);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-center">
          Error loading revision suggestions. Please try refreshing the page.
        </p>
      </div>
    );
  }
};

/**
 * Component for displaying the question map
 */
const QuestionMap = ({ quiz, userAnswers, onSelectQuestion }) => {
  if (!quiz || !quiz.questions || !userAnswers) return null;

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
                ? "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200"
                : isCorrect === false
                ? "bg-red-100 text-red-800 border border-red-300 hover:bg-red-200"
                : "bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200"
            }`}
            title={`Question ${index + 1} - ${isCorrect === true ? 'Correct' : isCorrect === false ? 'Incorrect' : 'Unanswered'}`}
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
const AttemptHistory = ({ 
  attempts, 
  isVisible, 
  onToggle, 
  onAnalyzeAttempt, 
  selectedAttemptAnalysis, 
  loadingAttemptAnalysis, 
  selectedAttemptId, 
  onClearAnalysis,
  quiz
}) => {
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
    <div className="w-full max-w-4xl mt-8">
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
              <th className="text-left py-2">Analysis</th>
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
                <td className="py-2">
                  <button
                    onClick={() => onAnalyzeAttempt(attempt)}
                    disabled={loadingAttemptAnalysis && selectedAttemptId === attempt.attemptId}
                    className={`px-3 py-1 text-sm rounded ${
                      loadingAttemptAnalysis && selectedAttemptId === attempt.attemptId
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {loadingAttemptAnalysis && selectedAttemptId === attempt.attemptId ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></div>
                        Analyzing...
                      </span>
                    ) : (
                      "View Analysis"
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

             {/* Selected Attempt Analysis */}
       {selectedAttemptAnalysis && (
         <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
           <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
             <h4 className="text-lg font-semibold text-gray-900">
               Topic Analysis for Selected Attempt
             </h4>
             <div className="flex items-center gap-2">
               <button
                 onClick={async () => {
                   try {
                     const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                     const filename = `${quiz.quiz_title || 'PracticeTest'}_PastAttempt_${timestamp}.pdf`;
                     await exportResultsAsPDF(quiz, selectedAttemptAnalysis.userAnswers || [], 0, selectedAttemptAnalysis.score || 0, selectedAttemptAnalysis);
                   } catch (error) {
                     console.error('Error exporting past attempt PDF:', error);
                     alert('Failed to export PDF. Please try again.');
                   }
                 }}
                 className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center"
               >
                 <Download className="h-3 w-3 mr-1" />
                 Export PDF
               </button>
               <button
                 onClick={onClearAnalysis}
                 className="text-sm text-gray-600 hover:text-gray-800"
               >
                 Close Analysis
               </button>
             </div>
           </div>
                      <div className="px-6 py-4">
              <TopicBreakdown analysis={selectedAttemptAnalysis} quiz={quiz} />
              <div className="mt-6">
                <RevisionSuggestions analysis={selectedAttemptAnalysis} />
              </div>
            </div>
         </div>
       )}
    </div>
  );
};

// Helper functions
const formatTime = (time) => {
  const minutes = Math.floor(time / 60).toString().padStart(2, "0");
  const seconds = (time % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const getCorrectAnswerCount = (questions, userAnswers) => {
  if (!questions || !questions.length || !userAnswers) return 0;
  return questions.filter((question, index) => {
    const userAnswer = userAnswers[index];
    if (!question || userAnswer === null) return false;
    
    switch (question.type) {
      case "multiple_choice":
        return userAnswer === question.correct_answer;
      case "multi_select":
        if (!Array.isArray(userAnswer)) return false;
        return JSON.stringify([...userAnswer].sort()) === JSON.stringify([...question.correct_answers].sort());
      case "drag_and_drop":
        if (!userAnswer || typeof userAnswer !== "object") return false;
        return Object.keys(question.correct_mapping).every(key => userAnswer[key] === question.correct_mapping[key]);
      case "short_answer":
      case "fill_in_blank":
        return userAnswer === question.correct_answer || (question.acceptable_answers && question.acceptable_answers.includes(userAnswer));
      case "numerical": {
        if (!userAnswer) return false;
        const parsed = parseFloat(String(userAnswer).replace(/[^0-9.\-]/g, ""));
        if (isNaN(parsed)) return false;
        return Math.abs(parsed - question.correct_answer_value) <= (question.tolerance ?? 0.01);
      }
      default:
        return false;
    }
  }).length;
};

const getScoreColor = (score) => {
  if (score >= 90) return "#10b981"; // green
  if (score >= 80) return "#3b82f6"; // blue
  if (score >= 70) return "#f59e0b"; // yellow
  if (score >= 60) return "#f97316"; // orange
  return "#ef4444"; // red
};

const getScoreColorClass = (score) => {
  if (score >= 90) return "text-green-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 60) return "text-orange-600";
  return "text-red-600";
};

const getPerformanceLevel = (score) => {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Fair";
  if (score >= 60) return "Needs Work";
  return "Poor";
};

const getPerformanceDescription = (score) => {
  if (score >= 90) return "Outstanding performance!";
  if (score >= 80) return "Solid understanding";
  if (score >= 70) return "Good foundation";
  if (score >= 60) return "Some gaps to address";
  return "Needs significant review";
};

const performBasicAnalysis = async (quiz, userAnswers) => {
  try {
    console.log("Starting basic analysis...");
    // Import the enhanced utility functions
    const { 
      extractTopicsFromQuestions, 
      analyzeTopicPerformance, 
      generateRecommendations 
    } = await import('./utils');
    
    console.log("Utils imported successfully");
    
    console.log("Extracting topics from questions...");
    console.log("Quiz questions:", quiz.questions.map(q => ({ question: q.question, type: q.type })));
    // Extract topics from questions and analyze performance
    const topics = extractTopicsFromQuestions(quiz.questions);
    console.log("Topics extracted:", topics);
    
    console.log("Analyzing topic performance...");
    const topicPerformance = analyzeTopicPerformance(quiz.questions, userAnswers, topics);
    console.log("Topic performance analyzed:", topicPerformance);
    
    console.log("Generating recommendations...");
    const recommendations = generateRecommendations(topicPerformance);
    console.log("Recommendations generated:", recommendations);
    
    const weakTopics = topicPerformance.filter(t => t.accuracy < 70);
    const strongTopics = topicPerformance.filter(t => t.accuracy >= 80);
    
    console.log("Filtered weakTopics:", weakTopics);
    console.log("Filtered strongTopics:", strongTopics);
    
    // Ensure we have the proper structure
    const result = {
      topics: topicPerformance,
      weakTopics: weakTopics || [],
      strongTopics: strongTopics || [],
      recommendations: recommendations || []
    };
    
    console.log("Basic analysis result:", result);
    console.log("Final result structure:", {
      topicsCount: result.topics.length,
      weakTopicsCount: result.weakTopics.length,
      strongTopicsCount: result.strongTopics.length,
      recommendationsCount: result.recommendations.length
    });
    return result;
  } catch (error) {
    console.error("Error in basic analysis:", error);
    // Return a minimal fallback
    return {
      topics: [],
      weakTopics: [],
      strongTopics: [],
      recommendations: ["Unable to analyze performance at this time."]
    };
  }
};

const performTopicAnalysis = async (quiz, userAnswers) => {
  try {
    console.log("Attempting AI-powered analysis...");
    // Try to use AI-powered analysis first
    const { analyzeQuizPerformance } = await import('../../../api/apiService');
    
    const quizMetadata = {
      title: quiz.quiz_title,
      totalQuestions: quiz.questions.length,
      timestamp: new Date().toISOString()
    };
    
    console.log("Calling AI analysis with metadata:", quizMetadata);
    console.log("Quiz structure check:", {
      totalQuestions: quiz.questions.length,
      questionIndices: quiz.questions.map((_, i) => i),
      questionNumbers: quiz.questions.map((_, i) => i + 1)
    });
    const aiAnalysis = await analyzeQuizPerformance(quiz.questions, userAnswers, quizMetadata);
    console.log("AI analysis successful:", aiAnalysis);
    console.log("AI analysis structure:", {
      hasTopics: !!aiAnalysis.topics,
      hasWeakTopics: !!aiAnalysis.weakTopics,
      hasStrongTopics: !!aiAnalysis.strongTopics,
      hasRecommendations: !!aiAnalysis.recommendations,
      weakTopicsCount: aiAnalysis.weakTopics?.length || 0,
      strongTopicsCount: aiAnalysis.strongTopics?.length || 0
    });
    
    // Ensure weakTopics and strongTopics are properly populated
    if (aiAnalysis.topics && (!aiAnalysis.weakTopics || !aiAnalysis.strongTopics)) {
      console.log("Fixing AI analysis structure - deriving weakTopics and strongTopics from topics");
      aiAnalysis.weakTopics = aiAnalysis.topics.filter(t => t.accuracy < 70);
      aiAnalysis.strongTopics = aiAnalysis.topics.filter(t => t.accuracy >= 80);
      console.log("Fixed AI analysis:", {
        weakTopicsCount: aiAnalysis.weakTopics.length,
        strongTopicsCount: aiAnalysis.strongTopics.length
      });
    }
    
    // Ensure all required properties exist
    if (!aiAnalysis.weakTopics) aiAnalysis.weakTopics = [];
    if (!aiAnalysis.strongTopics) aiAnalysis.strongTopics = [];
    if (!aiAnalysis.recommendations) aiAnalysis.recommendations = [];
    
    // Validate and convert question indices in topics
    if (aiAnalysis.topics) {
      const maxValidIndex = quiz.questions.length - 1;
      aiAnalysis.topics.forEach(topic => {
        if (topic.questionIndices) {
          const originalIndices = [...topic.questionIndices]; // Keep original for warning
          // Convert to 0-indexed 
          const validIndices = originalIndices
            .map(index => (index > 0 && index <= quiz.questions.length ? index - 1 : index)) // Convert 1-indexed to 0-indexed
            .filter(index => index >= 0 && index <= maxValidIndex);
          
          if (validIndices.length !== originalIndices.length) {
            console.warn(`Topic "${topic.name}" had invalid question indices:`, {
              original: originalIndices,
              convertedAndValid: validIndices,
              maxValidIndex
            });
          }
          topic.questionIndices = validIndices;
          topic.totalCount = validIndices.length;
        }
      });
    }
    
    console.log("Final AI analysis structure:", {
      topicsCount: aiAnalysis.topics?.length || 0,
      weakTopicsCount: aiAnalysis.weakTopics?.length || 0,
      strongTopicsCount: aiAnalysis.strongTopics?.length || 0,
      recommendationsCount: aiAnalysis.recommendations?.length || 0,
      weakTopicsType: typeof aiAnalysis.weakTopics,
      strongTopicsType: typeof aiAnalysis.strongTopics,
      recommendationsType: typeof aiAnalysis.recommendations
    });
    
    return aiAnalysis;
  } catch (error) {
    console.error("AI analysis failed, falling back to basic analysis:", error);
    // Fallback to basic analysis if AI analysis fails
    console.log("Using basic analysis fallback...");
    return await performBasicAnalysis(quiz, userAnswers);
  }
};



export default PerformanceSummary;
