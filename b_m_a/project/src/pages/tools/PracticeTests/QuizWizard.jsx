import React, { useState, useEffect } from "react";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  Tag,
  Check,
} from "lucide-react";
import { getStudyPlans } from "../../../api/apiService";

/**
 * Component for the quiz creation wizard
 */
const QuizWizard = ({
  currentStep,
  setCurrentStep,
  selectedFile,
  setSelectedFile,
  selectedTopics,
  setSelectedTopics,
  customTopics,
  setCustomTopics,
  numQuestions,
  setNumQuestions,
  questionFormats,
  toggleQuestionFormat,
  handleNextStep,
  handlePrevStep,
  handleFileSelect,
  handleToggleTopic,
  error,
  uploading,
  quizData,
  onBack = () => {},
}) => {
  const [showDropZone, setShowDropZone] = useState(true);
  const [studyPlans, setStudyPlans] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Fetch study plans to get available tags
  useEffect(() => {
    if (currentStep === 2) {
      fetchStudyPlans();
    }
  }, [currentStep]);

  const fetchStudyPlans = async () => {
    try {
      setLoadingPlans(true);
      const plans = await getStudyPlans();
      setStudyPlans(plans);
      setLoadingPlans(false);
    } catch (error) {
      console.error("Error fetching study plans:", error);
      setLoadingPlans(false);
    }
  };

  // Extract unique tags from study plans
  const getAvailableTags = () => {
    if (!studyPlans || studyPlans.length === 0) return [];

    const allTags = studyPlans.flatMap((plan) => plan.tags || []);
    // Remove duplicates
    return [...new Set(allTags)];
  };

  // Handle tag selection
  const handleTagSelect = (e) => {
    setSelectedTag(e.target.value);
    // Add the tag to customTopics
    if (e.target.value && e.target.value !== "") {
      setCustomTopics(e.target.value);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          <div
            className={`flex items-center ${
              currentStep >= 1 ? "text-gray-900" : "text-gray-400"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${
                currentStep >= 1
                  ? "bg-gray-200 border-gray-400"
                  : "border-gray-300"
              }`}
            >
              1
            </div>
            <span className="ml-2 text-sm font-medium">Resources</span>
          </div>
          <div
            className={`w-12 h-1 mx-2 ${
              currentStep >= 2 ? "bg-gray-400" : "bg-gray-200"
            }`}
          ></div>
          <div
            className={`flex items-center ${
              currentStep >= 2 ? "text-gray-900" : "text-gray-400"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${
                currentStep >= 2
                  ? "bg-gray-200 border-gray-400"
                  : "border-gray-300"
              }`}
            >
              2
            </div>
            <span className="ml-2 text-sm font-medium">Customize</span>
          </div>
          <div
            className={`w-12 h-1 mx-2 ${
              currentStep >= 3 ? "bg-gray-400" : "bg-gray-200"
            }`}
          ></div>
          <div
            className={`flex items-center ${
              currentStep >= 3 ? "text-gray-900" : "text-gray-400"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${
                currentStep >= 3
                  ? "bg-gray-200 border-gray-400"
                  : "border-gray-300"
              }`}
            >
              3
            </div>
            <span className="ml-2 text-sm font-medium">Settings</span>
          </div>
        </div>
      </div>

      {/* Step 1: Resources */}
      {currentStep === 1 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Add resources
          </h2>
          <div className="mt-4 mb-8">
            <h3 className="text-xl font-semibold mb-4">Resources</h3>

            <div className="bg-white p-6 rounded-lg border border-gray-200 min-h-72">
              <div className="text-center py-6">
                <FileText className="h-16 w-16 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-medium text-gray-900 mb-2">
                  Add notes, lectures, textbooks, etc.
                </h2>
                <p className="text-gray-600 mb-6">
                  Your quiz will be based on the content of
                  <br />
                  the resources you add
                </p>

                <button
                  onClick={() => document.getElementById("pdf-upload").click()}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 mx-auto"
                >
                  Add resource
                </button>
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <p className="mt-4 text-green-600">
                    Selected: {selectedFile.name}
                  </p>
                )}
                {error && <p className="text-red-500 mt-4">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Customize (Topics) */}
      {currentStep === 2 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Pick topics to focus on{" "}
            <span className="text-gray-500 font-normal">(optional)</span>
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">
                Focus Topics (Optional)
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter topics separated by commas"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  value={customTopics}
                  onChange={(e) => setCustomTopics(e.target.value)}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Study Plan Tag (Optional)
              </h3>
              <div className="space-y-3">
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
                  value={selectedTag}
                  onChange={handleTagSelect}
                >
                  <option value="">Select a study plan tag</option>
                  {loadingPlans ? (
                    <option disabled>Loading tags...</option>
                  ) : (
                    getAvailableTags().map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-sm text-gray-500">
                  Linking this quiz to a study plan allows your results to be
                  used to personalize your study recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Settings */}
      {currentStep === 3 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Quiz resources
          </h2>

          <div className="mt-4 mb-4">
            <label
              htmlFor="num-questions"
              className="block text-lg font-medium text-gray-900 mb-2"
            >
              Maximum number of questions
            </label>
            <input
              type="number"
              id="num-questions"
              min="5"
              max="50"
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
              className="w-full p-4 border border-gray-300 rounded-md text-lg"
            />
            <p className="text-sm text-gray-500 mt-2">
              50 questions or fewer. You can add more later.
            </p>
          </div>

          <div className="mt-6 mb-4">
            <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-md">
              <button
                onClick={() => toggleQuestionFormat("multiple_choice")}
                className={`py-2 px-4 rounded-md flex items-center gap-2 ${
                  questionFormats.multiple_choice
                    ? "bg-white shadow-sm"
                    : "bg-transparent"
                }`}
              >
                Multiple choice
                {questionFormats.multiple_choice && (
                  <X
                    className="h-4 w-4 text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleQuestionFormat("multiple_choice");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => toggleQuestionFormat("multi_select")}
                className={`py-2 px-4 rounded-md flex items-center gap-2 ${
                  questionFormats.multi_select
                    ? "bg-white shadow-sm"
                    : "bg-transparent"
                }`}
              >
                Multi-select
                {questionFormats.multi_select && (
                  <X
                    className="h-4 w-4 text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleQuestionFormat("multi_select");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => toggleQuestionFormat("drag_and_drop")}
                className={`py-2 px-4 rounded-md flex items-center gap-2 ${
                  questionFormats.drag_and_drop
                    ? "bg-white shadow-sm"
                    : "bg-transparent"
                }`}
              >
                Drag and drop
                {questionFormats.drag_and_drop && (
                  <X
                    className="h-4 w-4 text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleQuestionFormat("drag_and_drop");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => toggleQuestionFormat("true_false")}
                className={`py-2 px-4 rounded-md flex items-center gap-2 ${
                  questionFormats.true_false
                    ? "bg-white shadow-sm"
                    : "bg-transparent"
                }`}
              >
                True or false
                {questionFormats.true_false && (
                  <X
                    className="h-4 w-4 text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleQuestionFormat("true_false");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => toggleQuestionFormat("short_response")}
                className={`py-2 px-4 rounded-md flex items-center gap-2 ${
                  questionFormats.short_response
                    ? "bg-white shadow-sm"
                    : "bg-transparent"
                }`}
              >
                Short response
                {questionFormats.short_response && (
                  <X
                    className="h-4 w-4 text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleQuestionFormat("short_response");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => toggleQuestionFormat("fill_in_blank")}
                className={`py-2 px-4 rounded-md flex items-center gap-2 ${
                  questionFormats.fill_in_blank
                    ? "bg-white shadow-sm"
                    : "bg-transparent"
                }`}
              >
                Fill in the blank
                {questionFormats.fill_in_blank && (
                  <X
                    className="h-4 w-4 text-gray-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleQuestionFormat("fill_in_blank");
                    }}
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        {currentStep > 1 ? (
          <button
            onClick={handlePrevStep}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
        ) : (
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
          >
            Back to Tests
          </button>
        )}

        <button
          onClick={handleNextStep}
          disabled={uploading}
          className={`flex items-center gap-2 px-6 py-2 ${
            currentStep === 3
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-800 hover:bg-gray-900"
          } text-white rounded-md`}
        >
          {uploading && currentStep === 3 && (
            <div className="animate-spin mr-2 h-4 w-4 border-2 rounded-full border-white border-t-transparent"></div>
          )}
          {currentStep === 3
            ? uploading
              ? "Generating..."
              : "Generate"
            : "Next"}
          {currentStep !== 3 && <ChevronRight className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
};

export default QuizWizard;
