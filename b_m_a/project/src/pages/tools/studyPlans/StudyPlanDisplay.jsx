import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Calendar,
  CheckCircle2,
  BookOpen,
  Tag,
  ArrowUpRight,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  BookMarked,
  Zap,
  BrainCircuit,
  Mic,
  Network,
  Search,
} from "lucide-react";
import {
  getStudyPlan,
  updateStudyPlan,
  getQuizzes,
} from "../../../api/apiService";
import { formatDistanceToNow } from "date-fns";

/**
 * Component to display a study plan and allow updating it
 */
const StudyPlanDisplay = ({ plan, onBack, planStatus, setPlanStatus }) => {
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [expandedDays, setExpandedDays] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studyPlan, setStudyPlan] = useState(null);
  const [completedActivities, setCompletedActivities] = useState({});
  const [quizIds, setQuizIds] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  // New state for available quizzes
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [matchingQuizzes, setMatchingQuizzes] = useState([]);
  const [selectedQuizzes, setSelectedQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);

  // Fetch complete study plan on mount
  useEffect(() => {
    fetchStudyPlan();
    fetchQuizzes();
  }, [plan.id]);

  // Filter quizzes when study plan or quizzes change
  useEffect(() => {
    if (studyPlan && availableQuizzes.length > 0) {
      filterMatchingQuizzes();
    }
  }, [studyPlan, availableQuizzes]);

  // Function to fetch all quizzes
  const fetchQuizzes = async () => {
    try {
      setLoadingQuizzes(true);
      const quizzes = await getQuizzes();
      setAvailableQuizzes(quizzes);
      setLoadingQuizzes(false);
    } catch (err) {
      console.error("Error fetching quizzes:", err);
      setLoadingQuizzes(false);
    }
  };

  // Function to filter quizzes that have matching tags with the study plan
  const filterMatchingQuizzes = () => {
    if (!studyPlan || !studyPlan.data || !studyPlan.data.tags) return;

    const planTags = studyPlan.data.tags || [];
    if (planTags.length === 0) {
      // If no tags on the plan, show all quizzes
      setMatchingQuizzes(availableQuizzes);
      return;
    }

    // Filter quizzes that have at least one matching tag
    const filtered = availableQuizzes.filter((quiz) => {
      if (!quiz.data || !quiz.data.options) return false;

      // Check if any quiz tag matches any plan tag
      const quizTopics = quiz.data.options.selectedTopics || [];
      const quizCustomTopics = quiz.data.options.customTopics || "";

      // Create an array of all quiz topics
      const allQuizTopics = [...quizTopics];
      if (quizCustomTopics) {
        allQuizTopics.push(...quizCustomTopics.split(",").map((t) => t.trim()));
      }

      // Check for any overlap between quiz topics and plan tags
      return planTags.some((planTag) =>
        allQuizTopics.some(
          (quizTopic) =>
            quizTopic.toLowerCase().includes(planTag.toLowerCase()) ||
            planTag.toLowerCase().includes(quizTopic.toLowerCase())
        )
      );
    });

    setMatchingQuizzes(filtered);
  };

  const fetchStudyPlan = async () => {
    try {
      setLoading(true);
      const fullPlan = await getStudyPlan(plan.id);
      setStudyPlan(fullPlan);

      // Initialize expanded states with all weeks open, first week's days open
      const weeks = fullPlan?.data?.content?.weekly_schedule || [];
      const initialExpandedWeeks = {};
      const initialExpandedDays = {};

      weeks.forEach((week, index) => {
        initialExpandedWeeks[`week-${week.week}`] = index === 0;

        if (index === 0 && week.days) {
          week.days.forEach((day) => {
            initialExpandedDays[`week-${week.week}-day-${day.day}`] = true;
          });
        }
      });

      setExpandedWeeks(initialExpandedWeeks);
      setExpandedDays(initialExpandedDays);

      // Initialize completed activities from saved state, if any
      const savedCompleted =
        fullPlan?.data?.content?.completed_activities || {};
      setCompletedActivities(savedCompleted);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching study plan:", err);
      setError("Failed to load study plan");
      setLoading(false);
    }
  };

  // Toggle expansion of a week
  const toggleWeek = (weekId) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekId]: !prev[weekId],
    }));
  };

  // Toggle expansion of a day
  const toggleDay = (dayId) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayId]: !prev[dayId],
    }));
  };

  // Format date to a relative time (e.g., "3 days ago")
  const formatRelativeTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "Unknown date";
    }
  };

  // Toggle completion status of an activity
  const toggleActivityComplete = (
    weekNum,
    dayNum,
    topicIndex,
    activityIndex
  ) => {
    const activityKey = `w${weekNum}d${dayNum}t${topicIndex}a${activityIndex}`;

    setCompletedActivities((prev) => {
      const newState = {
        ...prev,
        [activityKey]: !prev[activityKey],
      };

      // Save the updated state to the plan
      saveCompletedActivities(newState);

      return newState;
    });
  };

  // Save completed activities to the backend
  const saveCompletedActivities = async (activities) => {
    if (!studyPlan) return;

    try {
      // Create a copy of the study plan content
      const updatedContent = {
        ...studyPlan.data.content,
        completed_activities: activities,
      };

      // Update the study plan with the new content
      studyPlan.data.content = updatedContent;

      // We'd ideally have an API endpoint to save this, but for now we just update local state
    } catch (err) {
      console.error("Error saving activity state:", err);
    }
  };

  // Update the study plan based on quiz results
  const handleUpdatePlan = async () => {
    try {
      setIsUpdating(true);
      setError("");

      // Get the IDs from selected quizzes
      const selectedIds = selectedQuizzes.map((quiz) => quiz.id);

      // Validate that we have quiz IDs
      if (selectedIds.length === 0) {
        setError("Please select at least one quiz");
        setIsUpdating(false);
        return;
      }

      // Call API to update study plan
      const result = await updateStudyPlan(plan.id, selectedIds);

      // Update the local state with the updated plan
      setStudyPlan({
        ...studyPlan,
        data: {
          ...studyPlan.data,
          content: result.updatedPlan,
          updatedAt: new Date().toISOString(),
        },
      });

      // Clear selection after successful update
      setSelectedQuizzes([]);
      setIsUpdating(false);
    } catch (err) {
      console.error("Error updating study plan:", err);
      setError(err.message || "Failed to update study plan");
      setIsUpdating(false);
    }
  };

  // Toggle selection of a quiz
  const toggleQuizSelection = (quiz) => {
    setSelectedQuizzes((prevSelected) => {
      const isSelected = prevSelected.some((q) => q.id === quiz.id);

      if (isSelected) {
        // Remove if already selected
        return prevSelected.filter((q) => q.id !== quiz.id);
      } else {
        // Add if not selected
        return [...prevSelected, quiz];
      }
    });
  };

  // Check if a quiz is selected
  const isQuizSelected = (quizId) => {
    return selectedQuizzes.some((quiz) => quiz.id === quizId);
  };

  // Get the quiz title or fallback
  const getQuizTitle = (quiz) => {
    return quiz.data?.title || `Quiz ${quiz.id.substring(0, 8)}`;
  };

  // Get icon for activity type
  const getActivityIcon = (type, tool) => {
    switch (type) {
      case "tool":
        switch (tool) {
          case "flashcards":
            return <BrainCircuit className="h-4 w-4" />;
          case "quiz":
          case "practice_test":
            return <BookMarked className="h-4 w-4" />;
          case "summarizer":
            return <Zap className="h-4 w-4" />;
          case "voice_notes":
            return <Mic className="h-4 w-4" />;
          case "mind_maps":
            return <Network className="h-4 w-4" />;
          default:
            return <BookOpen className="h-4 w-4" />;
        }
      case "reading":
        return <BookOpen className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  // Determine color class based on priority
  const getPriorityColorClass = (priority) => {
    switch (priority) {
      case "high":
        return "text-red-600";
      case "medium":
        return "text-orange-500";
      case "low":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  // Check if an activity is complete
  const isActivityComplete = (weekNum, dayNum, topicIndex, activityIndex) => {
    const activityKey = `w${weekNum}d${dayNum}t${topicIndex}a${activityIndex}`;
    return completedActivities[activityKey] || false;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="h-10 w-10 text-primary-500 animate-spin mb-4" />
        <p className="text-gray-600">Loading study plan...</p>
      </div>
    );
  }

  // Error state
  if (error && !studyPlan) {
    return (
      <div className="py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-medium">Error loading study plan</p>
            <p>{error}</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 mt-4 text-primary-600 hover:text-primary-800"
        >
          <ChevronLeft className="h-5 w-5" />
          Back to Study Plans
        </button>
      </div>
    );
  }

  // If plan content is not available
  if (!studyPlan || !studyPlan.data || !studyPlan.data.content) {
    return (
      <div className="py-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-md">
          Study plan content is not available
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 mt-4 text-primary-600 hover:text-primary-800"
        >
          <ChevronLeft className="h-5 w-5" />
          Back to Study Plans
        </button>
      </div>
    );
  }

  const content = studyPlan.data.content;

  return (
    <div>
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-2xl font-bold ml-4">{content.title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview section */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-500" />
              Overview
            </h2>
            <p className="text-gray-700 mb-4">{content.overview}</p>

            <div className="bg-primary-50 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-primary-800">Duration</h3>
                  <p className="text-primary-700">{content.duration}</p>
                </div>
              </div>
            </div>

            {content.performance_analysis && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-gray-800 mb-3">
                  Performance Analysis
                </h3>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-green-700 mb-1">
                      Strengths:
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-700">
                      {content.performance_analysis.strengths.map(
                        (strength, index) => (
                          <li key={index}>{strength}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-red-700 mb-1">
                      Areas for Improvement:
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-700">
                      {content.performance_analysis.areas_for_improvement.map(
                        (area, index) => (
                          <li key={index}>{area}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-blue-700 mb-1">
                      Recommendations:
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-700">
                      {content.performance_analysis.recommendations.map(
                        (rec, index) => (
                          <li key={index}>{rec}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly overview */}
            <div className="mt-6">
              <h3 className="font-medium text-gray-800 mb-3">
                Weekly Plan Overview
              </h3>
              <div className="space-y-3">
                {content.weekly_schedule.map((week) => (
                  <div
                    key={`overview-week-${week.week}`}
                    className="border border-gray-200 p-3 rounded-md"
                  >
                    <p className="font-medium text-gray-800">
                      Week {week.week}: {week.theme}
                    </p>
                    <p className="text-sm text-gray-600">{week.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly schedule section */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-500" />
              Weekly Schedule
            </h2>

            <div className="space-y-4">
              {content.weekly_schedule.map((week) => (
                <div
                  key={`week-${week.week}`}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleWeek(`week-${week.week}`)}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100"
                  >
                    <div>
                      <h3 className="font-medium text-gray-800">
                        Week {week.week}: {week.theme}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {week.description}
                      </p>
                    </div>
                    {expandedWeeks[`week-${week.week}`] ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {expandedWeeks[`week-${week.week}`] && (
                    <div className="p-4">
                      {/* Weekly goals */}
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-700 mb-2">
                          Weekly Goals:
                        </h4>
                        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                          {week.weekly_goals.map((goal, index) => (
                            <li key={index}>{goal}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Daily schedule */}
                      <div className="space-y-3">
                        {week.days.map((day) => (
                          <div
                            key={`day-${week.week}-${day.day}`}
                            className="border border-gray-200 rounded-md overflow-hidden"
                          >
                            <button
                              onClick={() =>
                                toggleDay(`week-${week.week}-day-${day.day}`)
                              }
                              className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100"
                            >
                              <h4 className="font-medium text-gray-800">
                                Day {day.day}
                              </h4>
                              {expandedDays[
                                `week-${week.week}-day-${day.day}`
                              ] ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              )}
                            </button>

                            {expandedDays[
                              `week-${week.week}-day-${day.day}`
                            ] && (
                              <div className="p-3">
                                {day.topics.map((topic, topicIndex) => (
                                  <div
                                    key={`topic-${week.week}-${day.day}-${topicIndex}`}
                                    className="mb-4"
                                  >
                                    <h5 className="font-medium text-gray-700">
                                      {topic.title}
                                    </h5>
                                    <p className="text-sm text-gray-600 mb-2">
                                      {topic.description}
                                    </p>

                                    <div className="space-y-2 pl-2">
                                      {topic.activities.map(
                                        (activity, activityIndex) => (
                                          <div
                                            key={`activity-${week.week}-${day.day}-${topicIndex}-${activityIndex}`}
                                            className="flex items-start gap-2 p-2 rounded-md bg-gray-50"
                                          >
                                            <button
                                              onClick={() =>
                                                toggleActivityComplete(
                                                  week.week,
                                                  day.day,
                                                  topicIndex,
                                                  activityIndex
                                                )
                                              }
                                              className="flex-shrink-0 mt-0.5"
                                            >
                                              {isActivityComplete(
                                                week.week,
                                                day.day,
                                                topicIndex,
                                                activityIndex
                                              ) ? (
                                                <CheckSquare className="h-5 w-5 text-primary-600" />
                                              ) : (
                                                <Square className="h-5 w-5 text-gray-400" />
                                              )}
                                            </button>

                                            <div className="flex-grow">
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className={`flex-shrink-0 ${getPriorityColorClass(
                                                    activity.priority
                                                  )}`}
                                                >
                                                  {getActivityIcon(
                                                    activity.type,
                                                    activity.tool
                                                  )}
                                                </span>
                                                <span className="font-medium text-gray-800">
                                                  {activity.type === "tool"
                                                    ? `Use ${activity.tool}`
                                                    : activity.type}
                                                </span>
                                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                                  {activity.duration}
                                                </span>
                                                <span
                                                  className={`text-xs px-2 py-0.5 rounded ${
                                                    activity.priority === "high"
                                                      ? "bg-red-100 text-red-800"
                                                      : activity.priority ===
                                                        "medium"
                                                      ? "bg-orange-100 text-orange-800"
                                                      : "bg-blue-100 text-blue-800"
                                                  }`}
                                                >
                                                  {activity.priority}
                                                </span>
                                              </div>
                                              <p className="text-sm text-gray-600 mt-1">
                                                {activity.description}
                                              </p>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Assessment */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-md">
                        <h4 className="font-medium text-blue-900 mb-1">
                          Assessment:
                        </h4>
                        <p className="text-sm text-blue-800">
                          {week.assessment}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Study techniques section */}
          {content.study_techniques && content.study_techniques.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary-500" />
                Study Techniques
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.study_techniques.map((technique, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-800 mb-2">
                      {technique.technique}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {technique.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Best for:</span>{" "}
                      {technique.best_for}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Plan metadata card */}
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <h3 className="font-medium text-gray-800 mb-3">Plan Details</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-800">
                  {formatRelativeTime(studyPlan.createdAt)}
                </span>
              </div>

              {studyPlan.data.updatedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last updated:</span>
                  <span className="text-gray-800">
                    {formatRelativeTime(studyPlan.data.updatedAt)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="text-gray-800">{content.duration}</span>
              </div>

              <div className="pt-2">
                <span className="text-gray-600 block mb-2">Tags:</span>
                <div className="flex flex-wrap gap-2">
                  {studyPlan.data.tags && studyPlan.data.tags.length > 0 ? (
                    studyPlan.data.tags.map((tag) => (
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
              </div>
            </div>
          </div>

          {/* Update plan card */}
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <h3 className="font-medium text-gray-800 mb-3">Update Plan</h3>
            <p className="text-sm text-gray-600 mb-4">
              Link your practice quiz results to update this study plan with
              personalized recommendations.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {loadingQuizzes ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 text-gray-400 animate-spin mr-2" />
                  <span className="text-gray-500">Loading quizzes...</span>
                </div>
              ) : matchingQuizzes.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Select quizzes with matching tags
                    </label>
                    <span className="text-xs text-gray-500">
                      {selectedQuizzes.length} selected
                    </span>
                  </div>

                  <div className="border border-gray-200 rounded-md overflow-hidden max-h-60 overflow-y-auto">
                    {matchingQuizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className={`flex items-center p-3 border-b border-gray-200 last:border-0 cursor-pointer hover:bg-gray-50 ${
                          isQuizSelected(quiz.id) ? "bg-primary-50" : ""
                        }`}
                        onClick={() => toggleQuizSelection(quiz)}
                      >
                        <div className="mr-3">
                          {isQuizSelected(quiz.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary-500" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {getQuizTitle(quiz)}
                          </p>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <BookOpen className="h-3 w-3 mr-1" />
                            <span>
                              {quiz.data?.questions?.length || 0} questions
                            </span>
                            {quiz.data?.options?.customTopics && (
                              <>
                                <Tag className="h-3 w-3 ml-2 mr-1" />
                                <span className="truncate max-w-[150px]">
                                  {quiz.data.options.customTopics}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md p-4 text-center">
                  <Search className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-1">
                    No matching quizzes found
                  </p>
                  <p className="text-xs text-gray-500">
                    Create quizzes with tags matching this study plan
                  </p>
                </div>
              )}

              <button
                onClick={handleUpdatePlan}
                disabled={isUpdating || selectedQuizzes.length === 0}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Update Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanDisplay;
