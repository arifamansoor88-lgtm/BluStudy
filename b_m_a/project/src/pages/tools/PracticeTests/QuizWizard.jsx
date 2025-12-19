import React, { useState } from "react";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
} from "lucide-react";

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
  setError,
  uploading,
  quizData,
  onBack = () => {},
  creationMode,
  setCreationMode,
}) => {
  const [showDropZone, setShowDropZone] = useState(true);

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
            Choose how you want to generate your test
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* PDF-based option */}
            <div
              className={`border rounded-lg p-6 cursor-pointer transition-shadow ${
                creationMode === "pdf"
                  ? "border-red-500 shadow-md bg-red-50/40"
                  : "border-gray-200 bg-white hover:shadow-sm"
              }`}
              onClick={() => {
                setCreationMode("pdf");
                if (setError) setError("");
              }}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <FileText className="h-10 w-10 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Upload notes, lectures, or textbooks
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a PDF and AI will generate questions directly from
                    your material.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById("pdf-upload")?.click();
                    }}
                    className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-black text-sm"
                  >
                    Upload PDF
                  </button>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {selectedFile && creationMode === "pdf" && (
                    <p className="mt-3 text-sm text-green-600">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                  {creationMode === "pdf" && error && (
                    <p className="text-sm text-red-500 mt-3">{error}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Topic-based option */}
            <div
              className={`border rounded-lg p-6 cursor-pointer transition-shadow ${
                creationMode === "topic"
                  ? "border-red-500 shadow-md bg-red-50/40"
                  : "border-gray-200 bg-white hover:shadow-sm"
              }`}
              onClick={() => {
                setCreationMode("topic");
                if (setError) setError("");
              }}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="h-10 w-10 rounded-md bg-red-100 flex items-center justify-center border border-red-200">
                    <span className="text-lg font-semibold text-red-700">
                      A+
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Type a topic, chapter, or concept
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Don't have a PDF ready! No problem! AI will generate a test for you!
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    Example topics: <span className="font-medium">“Cell division and mitosis”</span>,{" "}
                    <span className="font-medium">“Kinematics – Grade 11 Physics”</span>,{" "}
                    <span className="font-medium">“Chapter 3: Linear Relations”</span>
                  </p>
                  <textarea
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
                    rows={3}
                    placeholder="Type a topic, chapter, or concept. AI will generate the test."
                    value={customTopics}
                    onChange={(e) => setCustomTopics(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
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
              min="10"
              max="50"
              value={numQuestions || ""}
              onChange={(e) => {
                const inputValue = e.target.value;
                // Allow empty input so user can delete the number
                if (inputValue === "") {
                  setNumQuestions("");
                } else {
                  const value = parseInt(inputValue);
                  // Only set if it's a valid number
                  if (!isNaN(value)) {
                    setNumQuestions(value);
                  }
                }
                // Clear error when user changes the number
                if (setError && error) {
                  setError("");
                }
              }}
              onBlur={(e) => {
                // Only clamp to max, don't auto-correct minimum
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value > 50) {
                  setNumQuestions(50);
                }
              }}
              className="w-full p-4 border border-gray-300 rounded-md text-lg"
            />
            <p className="text-sm text-gray-500 mt-2">
              Minimum 10 questions, maximum 50 questions. You can add more later.
            </p>
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            )}
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
              ? uploading
                ? "bg-gray-400 cursor-not-allowed"
                : (isNaN(parseInt(numQuestions)) || parseInt(numQuestions) < 10)
                ? "bg-gray-400 cursor-not-allowed opacity-60"
                : "bg-red-600 hover:bg-red-700"
              : "bg-gray-800 hover:bg-gray-900"
          } text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed`}
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
