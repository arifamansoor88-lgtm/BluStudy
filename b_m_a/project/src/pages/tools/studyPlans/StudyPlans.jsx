import React, { useState, useEffect } from "react";
import {
  Book,
  PlusCircle,
  FileText,
  RefreshCw,
  Calendar,
  Tag,
  ChevronRight,
  Search,
  Filter,
  Check,
} from "lucide-react";
import { getStudyPlans, recordStudyToolUse } from "../../../api/apiService";
import StudyPlanWizard from "./StudyPlanWizard";
import StudyPlanDisplay from "./StudyPlanDisplay";
import SavedStudyPlansList from "./SavedStudyPlansList";

/**
 * Main StudyPlans component that coordinates all other components
 */
const StudyPlans = () => {
  // State for component display
  const [showCreate, setShowCreate] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planStatus, setPlanStatus] = useState("idle"); // idle, loading, ready, updating

  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // State for study plans
  const [studyPlans, setStudyPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch saved study plans on component mount
  useEffect(() => {
    if (showPlanner) {
      fetchStudyPlans();
    }
  }, [showPlanner]);

  const fetchStudyPlans = async () => {
    try {
      setLoading(true);
      const plans = await getStudyPlans();
      setStudyPlans(plans || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching study plans:", err);
      setError("Failed to load study plans");
      setLoading(false);
    }
  };

  // Create a new study plan
  const handleCreatePlan = () => {
    setShowPlanner(false);
    setShowCreate(true);
    setCurrentPlan(null);
    setPlanStatus("idle");
  };

  // Go back to the planner view
  const handleBack = () => {
    setShowPlanner(true);
    setShowCreate(false);
    setCurrentPlan(null);
    fetchStudyPlans(); // Refresh the list when returning
  };

  // Load a saved study plan
  const handleSelectPlan = async (plan) => {
    await recordStudyToolUse("study_plan");
    setCurrentPlan(plan);
    setShowPlanner(false);
  };

  // Filter study plans based on search and tag
  const filteredPlans = studyPlans.filter((plan) => {
    const matchesSearch =
      searchQuery === "" ||
      plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag =
      filterTag === "" || (plan.tags && plan.tags.includes(filterTag));

    return matchesSearch && matchesTag;
  });

  // Get all unique tags from study plans
  const getAllTags = () => {
    if (!studyPlans || studyPlans.length === 0) return [];
    const allTags = studyPlans.flatMap((plan) => plan.tags || []);
    return [...new Set(allTags)];
  };

  // Render the planner home view
  const renderPlannerHome = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary-500" />
          Study Plans
        </h1>
        <button
          onClick={handleCreatePlan}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
        >
          <PlusCircle className="h-5 w-5" />
          New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
            <div className="flex gap-3">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Search plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <div className="relative w-1/3">
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">All Tags</option>
                  {getAllTags().map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <Tag className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              {error}
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                No study plans found
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery || filterTag
                  ? "Try adjusting your search or filter"
                  : "Get started by creating your first study plan"}
              </p>
              {!searchQuery && !filterTag && (
                <button
                  onClick={handleCreatePlan}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors mx-auto"
                >
                  <PlusCircle className="h-5 w-5" />
                  Create Plan
                </button>
              )}
            </div>
          ) : (
            <SavedStudyPlansList
              plans={filteredPlans}
              onSelectPlan={handleSelectPlan}
              refreshPlans={fetchStudyPlans}
            />
          )}
        </div>

        <div className="md:col-span-1">
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-6 rounded-lg shadow-sm text-white">
            <h3 className="text-xl font-bold mb-3">AI-Powered Study Plans</h3>
            <p className="mb-4 text-white/90">
              Personalized learning paths that adapt to your performance and
              help you focus on what matters most.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2">
                <div className="bg-white/20 p-1 rounded-full mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-sm">
                  Adapts based on your quiz results
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="bg-white/20 p-1 rounded-full mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-sm">Daily and weekly study goals</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="bg-white/20 p-1 rounded-full mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-sm">Targets your weak areas</span>
              </li>
            </ul>
            <button
              onClick={handleCreatePlan}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary-700 rounded-md hover:bg-white/90 transition-colors w-full justify-center"
            >
              Get Started
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm mt-4">
            <h3 className="text-lg font-medium mb-3">How It Works</h3>
            <ol className="space-y-4 text-gray-600">
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                  1
                </div>
                <p className="text-sm">Upload your study materials as PDFs</p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                  2
                </div>
                <p className="text-sm">Name your plan and add optional tags</p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                  3
                </div>
                <p className="text-sm">
                  Tag practice quizzes with your plan name
                </p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                  4
                </div>
                <p className="text-sm">
                  Update your plan based on quiz results
                </p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render method
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {showPlanner ? (
        renderPlannerHome()
      ) : showCreate ? (
        <StudyPlanWizard
          onBack={handleBack}
          onPlanCreated={(plan) => {
            setCurrentPlan(plan);
            setShowCreate(false);
          }}
        />
      ) : currentPlan ? (
        <StudyPlanDisplay
          plan={currentPlan}
          onBack={handleBack}
          planStatus={planStatus}
          setPlanStatus={setPlanStatus}
        />
      ) : null}
    </div>
  );
};

export default StudyPlans;
