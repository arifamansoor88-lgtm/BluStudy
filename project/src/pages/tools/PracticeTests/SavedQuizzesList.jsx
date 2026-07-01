import React, { useState } from "react";
import { Trash2, HelpCircle, CalendarDays } from "lucide-react";
import ShareItemButton from "../../../components/ShareItemButton";

const SavedQuizzesList = ({ savedQuizzes, onQuizSelect, onQuizDelete }) => {
  const [deletingId, setDeletingId] = useState(null);

  if (!savedQuizzes || savedQuizzes.length === 0) {
    return (
      <p className="text-sm text-gray-400">No saved quizzes yet. Create one above to get started.</p>
    );
  }

  const handleDelete = async (e, quizId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this quiz? This cannot be undone.")) return;
    setDeletingId(quizId);
    try {
      await onQuizDelete(quizId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {savedQuizzes.map((quiz, index) => (
        <div
          key={quiz.id || index}
          className="relative bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden group"
          onClick={() => onQuizSelect(quiz)}
        >
          {/* top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-red-500 to-red-400" />

          <div className="p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="font-semibold text-gray-800 text-base leading-snug">
                {quiz.data?.title || "Untitled Quiz"}
              </h3>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <ShareItemButton
                  itemId={quiz.id}
                  itemLabel="practice test"
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                />
                <button
                  onClick={(e) => handleDelete(e, quiz.id)}
                  disabled={deletingId === quiz.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Delete quiz"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {quiz.createdAt && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {new Date(quiz.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              {quiz.data?.questions && (
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  <HelpCircle className="w-3 h-3" />
                  {quiz.data.questions.length} questions
                </span>
              )}
              {quiz.data?.score != null && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {quiz.data.score}%
                </span>
              )}
              {quiz.data?.attempts?.length > 0 && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                  {quiz.data.attempts.length} {quiz.data.attempts.length === 1 ? "attempt" : "attempts"}
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
