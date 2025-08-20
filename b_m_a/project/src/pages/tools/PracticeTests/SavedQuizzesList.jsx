import React from "react";
import {
  Clock,
  CheckCircle,
  Save,
  Play,
  BookOpen,
  Calendar,
  Target,
  TrendingUp
} from "lucide-react";
import { formatTime } from "./utils";

/**
 * Component for displaying a list of saved quizzes
 */
const SavedQuizzesList = ({ savedQuizzes, onQuizSelect }) => {
  if (!savedQuizzes || savedQuizzes.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-md border-t-4 border-red-500">
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-gray-500 text-center mb-2">
            No saved quizzes yet. Create a quiz to get started!
          </p>
          <div className="w-16 h-1 bg-red-100 rounded-full mt-2"></div>
        </div>
      </div>
    );
  }

  const getProgressInfo = (quiz) => {
    const testProgress = quiz.data?.testProgress;
    const savedAnswers = quiz.data?.savedAnswers || [];
    
    if (!testProgress) {
      return {
        hasProgress: false,
        progressPercentage: 0,
        completedQuestions: 0,
        totalQuestions: quiz.data?.questions?.length || 0,
        isInProgress: false,
        isCompleted: false,
        savedAnswersCount: savedAnswers.length,
      };
    }

    const totalQuestions = quiz.data?.questions?.length || 0;
    const completedQuestions = testProgress.userAnswers?.filter(answer => answer !== null).length || 0;
    const progressPercentage = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;
    const isInProgress = !testProgress.isCompleted;
    const isCompleted = testProgress.isCompleted;

    return {
      hasProgress: true,
      progressPercentage,
      completedQuestions,
      totalQuestions,
      isInProgress,
      isCompleted,
      savedAnswersCount: savedAnswers.length,
      lastSaved: testProgress.lastSaved
    };
  };

  const getStatusBadge = (quiz) => {
    const progressInfo = getProgressInfo(quiz);
    
    if (progressInfo.isInProgress) {
      return (
        <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium flex items-center">
          <Play className="w-3.5 h-3.5 mr-1" />
          In Progress
        </span>
      );
    } else if (progressInfo.isCompleted || quiz.data?.score !== null) {
      return (
        <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center">
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          Completed
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-full text-xs font-medium flex items-center">
          <BookOpen className="w-3.5 h-3.5 mr-1" />
          Ready
        </span>
      );
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {savedQuizzes.map((quiz, index) => {
        const progressInfo = getProgressInfo(quiz);

        return (
          <div
            key={quiz.id || index}
            className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden h-full transform hover:-translate-y-1"
            onClick={() => onQuizSelect(quiz)}
          >
            <div className="h-3 bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300 group-hover:h-4"></div>
            <div className="p-6 h-full flex flex-col">
              {/* Header with title and status */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-800 text-lg leading-tight flex-1 mr-2">
                  {quiz.data?.title || "Untitled Quiz"}
                </h3>
                {getStatusBadge(quiz)}
              </div>

              {/* Progress bar for in-progress tests */}
              {progressInfo.hasProgress && progressInfo.isInProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Progress</span>
                    <span className="text-xs text-gray-500">
                      {progressInfo.completedQuestions}/{progressInfo.totalQuestions}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressInfo.progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span>{progressInfo.totalQuestions} questions</span>
                </div>

                {progressInfo.savedAnswersCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Save className="w-4 h-4 text-gray-400" />
                    <span>{progressInfo.savedAnswersCount} saved</span>
                  </div>
                )}

                {quiz.data?.score !== null && quiz.data?.score !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span>{quiz.data.score}% score</span>
                  </div>
                )}

                {quiz.data?.timeTaken && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{formatTime(quiz.data.timeTaken)}</span>
                  </div>
                )}
              </div>

              {/* Date and attempts */}
              <div className="flex items-center justify-between mt-auto">
                <p className="text-xs text-gray-500 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {quiz.createdAt
                    ? new Date(quiz.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "No date"}
                </p>

                {quiz.data?.attempts && quiz.data.attempts.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {quiz.data.attempts.length} attempt{quiz.data.attempts.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Last saved info for in-progress tests */}
              {progressInfo.hasProgress && progressInfo.isInProgress && progressInfo.lastSaved && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Last saved: {formatTimestamp(progressInfo.lastSaved)}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SavedQuizzesList;
