import React from "react";
import { Calendar, Tag, Clock, ChevronRight, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Component to display a list of saved study plans
 */
const SavedStudyPlansList = ({ plans, onSelectPlan, refreshPlans }) => {
  // Format date to a relative time (e.g., "3 days ago")
  const formatRelativeTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "Unknown date";
    }
  };

  // Truncate long text with ellipsis
  const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-800">Saved Plans</h2>
        <button
          onClick={refreshPlans}
          className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {plans.map((plan) => (
        <div
          key={plan.id}
          className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {plan.title}
            </h3>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {plan.updatedAt
                ? `Updated ${formatRelativeTime(plan.updatedAt)}`
                : `Created ${formatRelativeTime(plan.createdAt)}`}
            </div>
          </div>

          <p className="text-gray-600 text-sm mb-4">
            {truncateText(plan.description)}
          </p>

          <div className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {plan.tags && plan.tags.length > 0 ? (
                plan.tags.map((tag) => (
                  <div
                    key={tag}
                    className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </div>
                ))
              ) : (
                <span className="text-gray-400 text-xs">No tags</span>
              )}
            </div>

            <button
              onClick={() => onSelectPlan(plan)}
              className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm font-medium"
            >
              View Plan
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SavedStudyPlansList;
