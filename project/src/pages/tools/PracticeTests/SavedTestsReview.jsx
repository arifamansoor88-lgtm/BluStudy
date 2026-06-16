import React, { useState, useEffect } from "react";
import {
  BookOpen, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Play, 
  Save, 
  Eye,
  Calendar,
  Target,
  TrendingUp
} from "lucide-react";
import { formatTime } from "./utils";
import {
  renderAnswerValue,
  renderMultilineMathText,
  renderTextWithMath,
} from "./MathText";

/**
 * Component for reviewing saved tests and answers
 */
const SavedTestsReview = ({ 
  quiz, 
  onResumeTest, 
  onStartNewAttempt,
  savedAnswers = [],
  testProgress = null 
}) => {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  // Calculate statistics
  const totalQuestions = quiz?.questions?.length || 0;
  const completedQuestions = testProgress?.userAnswers?.filter(answer => answer !== null).length || 0;
  const savedAnswersCount = savedAnswers.length;
  const correctAnswers = savedAnswers.filter(answer => answer.isCorrect).length;
  const accuracy = savedAnswersCount > 0 ? Math.round((correctAnswers / savedAnswersCount) * 100) : 0;

  // Check if test is in progress
  const isInProgress = testProgress && !testProgress.isCompleted;
  const progressPercentage = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;

  const toggleQuestionExpansion = (questionIndex) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionIndex)) {
      newExpanded.delete(questionIndex);
    } else {
      newExpanded.add(questionIndex);
    }
    setExpandedQuestions(newExpanded);
  };

  const getQuestionStatus = (questionIndex) => {
    const savedAnswer = savedAnswers.find(answer => answer.questionIndex === questionIndex);
    const hasProgress = testProgress?.userAnswers?.[questionIndex] !== null && 
                       testProgress?.userAnswers?.[questionIndex] !== undefined;
    
    if (savedAnswer) {
      return savedAnswer.isCorrect ? "correct" : "incorrect";
    } else if (hasProgress) {
      return "answered";
    } else {
      return "unanswered";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "correct":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "incorrect":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "answered":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "correct":
        return "Correct";
      case "incorrect":
        return "Incorrect";
      case "answered":
        return "Answered";
      default:
        return "Unanswered";
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            {renderTextWithMath(quiz?.quiz_title || "Quiz Review")}
          </h2>
        </div>
        <div className="flex gap-2">
          {isInProgress && (
            <button
              onClick={() => onResumeTest(quiz, testProgress)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              Resume Test
            </button>
          )}
          <button
            onClick={() => onStartNewAttempt(quiz)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Play className="h-4 w-4" />
            Start New Attempt
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isInProgress && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">
              {completedQuestions} of {totalQuestions} questions
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Time: {formatTime(testProgress.timeElapsed)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Last saved: {formatTimestamp(testProgress.lastSaved)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedTab("overview")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === "overview"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedTab("questions")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === "questions"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Questions ({totalQuestions})
          </button>
          <button
            onClick={() => setSelectedTab("answers")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedTab === "answers"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Saved Answers ({savedAnswersCount})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {selectedTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Test Progress */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">Progress</h3>
              </div>
              <p className="text-2xl font-bold text-blue-900">{progressPercentage}%</p>
              <p className="text-sm text-blue-700">
                {completedQuestions} of {totalQuestions} questions
              </p>
            </div>

            {/* Saved Answers */}
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Save className="h-5 w-5 text-green-600" />
                <h3 className="font-medium text-green-900">Saved Answers</h3>
              </div>
              <p className="text-2xl font-bold text-green-900">{savedAnswersCount}</p>
              <p className="text-sm text-green-700">With explanations</p>
            </div>

            {/* Accuracy */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <h3 className="font-medium text-purple-900">Accuracy</h3>
              </div>
              <p className="text-2xl font-bold text-purple-900">{accuracy}%</p>
              <p className="text-sm text-purple-700">
                {correctAnswers} correct out of {savedAnswersCount}
              </p>
            </div>

            {/* Time Spent */}
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <h3 className="font-medium text-orange-900">Time Spent</h3>
              </div>
              <p className="text-2xl font-bold text-orange-900">
                {formatTime(testProgress?.timeElapsed || 0)}
              </p>
              <p className="text-sm text-orange-700">Total time</p>
            </div>
          </div>
        )}

        {selectedTab === "questions" && (
          <div className="space-y-4">
            {quiz?.questions?.map((question, index) => {
              const status = getQuestionStatus(index);
              const savedAnswer = savedAnswers.find(answer => answer.questionIndex === index);
              const isExpanded = expandedQuestions.has(index);

              return (
                <div key={index} className="border border-gray-200 rounded-lg">
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleQuestionExpansion(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <span className="font-medium text-gray-900">
                          Question {index + 1}
                        </span>
                        <span className="text-sm text-gray-500">
                          {question.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded-full ${
                          status === "correct" ? "bg-green-100 text-green-800" :
                          status === "incorrect" ? "bg-red-100 text-red-800" :
                          status === "answered" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {getStatusText(status)}
                        </span>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900 mb-2">Question:</h4>
                          <div className="text-gray-700">{renderTextWithMath(question.question)}</div>
                        </div>
                        
                        {savedAnswer && (
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-medium text-gray-900 mb-1">Your Answer:</h4>
                              <div className="text-gray-700 bg-gray-50 p-2 rounded">
                                {renderAnswerValue(savedAnswer.userAnswer)}
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="font-medium text-gray-900 mb-1">Correct Answer:</h4>
                              <div className="text-gray-700 bg-green-50 p-2 rounded">
                                {renderAnswerValue(
                                  question.correct_answer ||
                                    question.correct_answers ||
                                    question.correct_mapping
                                )}
                              </div>
                            </div>
                            
                            {savedAnswer.explanation && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-1">Explanation:</h4>
                                <div className="text-gray-700 bg-blue-50 p-2 rounded">
                                  {renderMultilineMathText(savedAnswer.explanation)}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Time spent: {formatTime(savedAnswer.timeSpent || 0)}</span>
                              <span>Saved: {formatTimestamp(savedAnswer.timestamp)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedTab === "answers" && (
          <div className="space-y-4">
            {savedAnswers.length === 0 ? (
              <div className="text-center py-8">
                <Save className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved Answers</h3>
                <p className="text-gray-500">
                  Start answering questions to save your responses with explanations.
                </p>
              </div>
            ) : (
              savedAnswers.map((answer, index) => {
                const question = quiz?.questions?.[answer.questionIndex];
                
                return (
                  <div key={answer.answerId || index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(answer.isCorrect ? "correct" : "incorrect")}
                        <span className="font-medium text-gray-900">
                          Question {answer.questionIndex + 1}
                        </span>
                        <span className="text-sm text-gray-500">
                          {question?.type?.replace('_', ' ') || 'Unknown type'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span>{formatTime(answer.timeSpent || 0)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Question:</h4>
                        <div className="text-gray-700">{renderTextWithMath(question?.question)}</div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Your Answer:</h4>
                        <div className={`p-2 rounded ${
                          answer.isCorrect ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                        }`}>
                          {renderAnswerValue(answer.userAnswer)}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Correct Answer:</h4>
                        <div className="text-gray-700 bg-gray-50 p-2 rounded">
                          {renderAnswerValue(
                            question?.correct_answer ||
                              question?.correct_answers ||
                              question?.correct_mapping
                          )}
                        </div>
                      </div>
                      
                      {answer.explanation && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">Explanation:</h4>
                          <div className="text-gray-700 bg-blue-50 p-2 rounded">
                            {renderMultilineMathText(answer.explanation)}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-sm text-gray-500">
                        Saved on: {formatTimestamp(answer.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedTestsReview;
