import React from "react";

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {savedQuizzes.map((quiz, index) => (
        <div
          key={quiz.id || index}
          className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden h-full transform hover:-translate-y-1"
          onClick={() => onQuizSelect(quiz)}
        >
          <div className="h-3 bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300 group-hover:h-4"></div>
          <div className="p-8 h-full flex flex-col">
            <h3 className="font-semibold text-gray-800 text-xl mb-3 min-h-[3.5rem] leading-tight">
              {quiz.data?.title || "Untitled Quiz"}
            </h3>
            <p className="text-sm text-gray-500 mb-4 flex items-center">
              <svg
                className="w-4 h-4 mr-1 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              {quiz.createdAt
                ? new Date(quiz.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "No date"}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-auto">
              {quiz.data?.questions && (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center">
                  <svg
                    className="w-3.5 h-3.5 mr-1 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  {quiz.data.questions.length} questions
                </span>
              )}
              {quiz.data?.score !== null && (
                <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center">
                  <svg
                    className="w-3.5 h-3.5 mr-1 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  Score: {quiz.data.score}%
                </span>
              )}
              {quiz.data?.attempts && quiz.data.attempts.length > 0 && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium flex items-center">
                  <svg
                    className="w-3.5 h-3.5 mr-1 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    ></path>
                  </svg>
                  {quiz.data.attempts.length}{" "}
                  {quiz.data.attempts.length === 1 ? "Attempt" : "Attempts"}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SavedQuizzesList;
