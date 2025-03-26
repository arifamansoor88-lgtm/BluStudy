import React from "react";
import { FileText, ChevronRight, ChevronLeft, X } from "lucide-react";

/**
 * Component for the quiz creation wizard
 */
const QuizWizard = ({
  currentStep,
  selectedFile,
  selectedTopics,
  customTopics,
  numQuestions,
  questionFormats,
  error,
  uploading,
  onFileSelect,
  onTopicToggle,
  onCustomTopicsChange,
  onNumQuestionsChange,
  onQuestionFormatToggle,
  onNextStep,
  onPrevStep,
  onBack,
}) => {
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
                  onChange={onFileSelect}
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

          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Custom topics
            </h3>
            <textarea
              value={customTopics}
              onChange={(e) => onCustomTopicsChange(e.target.value)}
              placeholder="e.g. statistics, probability, integration, inverse, determinant, youtube, eigenvalues, eigenvectors, diagonalisation, waves, error, linear algebra, leeds university, wolfram math-world, notation"
              className="w-full p-4 border border-gray-300 rounded-md text-sm bg-gray-100"
              rows="4"
            />
            <p className="text-sm text-gray-500 mt-2">
              Separate custom topics with a comma
            </p>
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
              onChange={(e) => onNumQuestionsChange(parseInt(e.target.value))}
              className="w-full p-4 border border-gray-300 rounded-md text-lg"
            />
            <p className="text-sm text-gray-500 mt-2">
              50 questions or fewer. You can add more later.
            </p>
          </div>

          <div className="mt-6 mb-4">
            <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-md">
              <button
                onClick={() => onQuestionFormatToggle("multiple_choice")}
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
                      onQuestionFormatToggle("multiple_choice");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => onQuestionFormatToggle("multi_select")}
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
                      onQuestionFormatToggle("multi_select");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => onQuestionFormatToggle("drag_and_drop")}
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
                      onQuestionFormatToggle("drag_and_drop");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => onQuestionFormatToggle("true_false")}
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
                      onQuestionFormatToggle("true_false");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => onQuestionFormatToggle("short_response")}
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
                      onQuestionFormatToggle("short_response");
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => onQuestionFormatToggle("fill_in_blank")}
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
                      onQuestionFormatToggle("fill_in_blank");
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
            onClick={onPrevStep}
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
          onClick={onNextStep}
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
