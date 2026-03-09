import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Upload,
  AlertCircle,
  Check,
  Loader,
  ChevronRight,
  ChevronLeft,
  Tag,
  X,
  FileText,
} from "lucide-react";
import { generateStudyPlan } from "../../../api/apiService";

/**
 * Wizard component for creating a new study plan
 */
const StudyPlanWizard = ({ onBack, onPlanCreated }) => {
  // Get folderId from URL query params if present
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');
  
  // State for wizard steps
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState(null);

  // State for form inputs
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [currentTag, setCurrentTag] = useState("");
  const [tagList, setTagList] = useState([]);

  // New state for study duration
  const [duration, setDuration] = useState(4);
  const [durationUnit, setDurationUnit] = useState("weeks");

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);

    // Validate files (only PDFs allowed)
    const invalidFiles = selectedFiles.filter(
      (file) => file.type !== "application/pdf"
    );
    if (invalidFiles.length > 0) {
      setError("Only PDF files are allowed");
      return;
    }

    setError("");
    setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
  };

  // Remove a file from the selected files
  const removeFile = (index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  // Add a tag to the tag list
  const addTag = () => {
    if (currentTag.trim() && !tagList.includes(currentTag.trim())) {
      setTagList([...tagList, currentTag.trim()]);
      setCurrentTag("");
    }
  };

  // Remove a tag from the tag list
  const removeTag = (tag) => {
    setTagList(tagList.filter((t) => t !== tag));
  };

  // Handle tag input keydown (add on Enter)
  const handleTagKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  // Navigate to next step
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (files.length === 0) {
        setError("Please upload at least one PDF file");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!title.trim()) {
        setError("Please enter a title for your study plan");
        return;
      }
      setCurrentStep(3);
      handleGeneratePlan();
    } else if (currentStep === 3 && generatedPlan) {
      onPlanCreated(generatedPlan);
    }
  };

  // Navigate to previous step
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };

  // Generate the study plan
  const handleGeneratePlan = async () => {
    try {
      setUploading(true);
      setError("");

      // Format tags for API
      const tagsString = tagList.join(", ");

      // Format duration for API as metadata
      const durationInfo = {
        duration: duration,
        unit: durationUnit,
      };

      // Add duration info to description
      const enhancedDescription = description
        ? `${description}\n\nStudy Duration: ${duration} ${durationUnit}`
        : `Study Duration: ${duration} ${durationUnit}`;

      // Call API to generate study plan with duration metadata
      const result = await generateStudyPlan(
        files,
        title,
        enhancedDescription,
        tagsString,
        JSON.stringify(durationInfo), // Pass duration as metadata
        folderId // Pass folderId if present
      );

      setGeneratedPlan(result);
      setUploading(false);
    } catch (err) {
      console.error("Error generating study plan:", err);
      // More specific error message
      let errorMessage = "Failed to generate study plan";

      if (err.message && err.message.includes("422")) {
        errorMessage =
          "Backend validation error. Make sure the PDF files are valid and not corrupted.";
      } else if (err.message && err.message.includes("500")) {
        errorMessage =
          "Server error processing the files. Try with smaller or different PDFs.";
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }

      setError(errorMessage);
      setUploading(false);
    }
  };

  // Render step 1 - file upload
  const renderFileUploadStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Upload Study Materials</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            id="file-upload"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-lg font-medium">Upload your PDFs</p>
            <p className="text-sm text-gray-500 mt-1">
              Click to browse or drag and drop
            </p>
          </label>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-medium mb-2">
            Selected Files ({files.length})
          </h3>
          <div className="max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md mb-2"
              >
                <div className="flex items-center">
                  <div className="bg-primary-100 p-2 rounded-md mr-3">
                    <FileText className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  // Render step 2 - plan details
  const renderPlanDetailsStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Plan Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title*
            </label>
            <input
              type="text"
              placeholder="Enter a name for your study plan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              placeholder="Brief description of what this plan covers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Study Duration
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={duration}
                onChange={(e) =>
                  setDuration(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-24 px-4 py-2 border border-gray-300 rounded-md"
              />
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This helps the AI create a more personalized study schedule
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Tags (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add tags"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Add
              </button>
            </div>

            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-primary-600 hover:text-primary-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  // Render step 3 - generation in progress
  const renderGenerationStep = () => (
    <div className="text-center py-8">
      {uploading ? (
        <div className="flex flex-col items-center">
          <Loader className="h-12 w-12 text-primary-500 animate-spin mb-4" />
          <h3 className="text-xl font-medium mb-2">Generating Study Plan</h3>
          <p className="text-gray-500">
            Please wait while we process your files and create a personalized
            study plan...
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-medium mb-2">Study Plan Ready!</h3>
          <p className="text-gray-500 mb-6">
            Your personalized study plan has been generated and is ready to use.
          </p>
          {generatedPlan && (
            <div className="bg-gray-50 p-4 rounded-lg text-left w-full max-w-md mx-auto">
              <p className="font-medium">{generatedPlan.plan.title}</p>
              <p className="text-sm text-gray-500">
                {generatedPlan.plan.duration}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderFileUploadStep();
      case 2:
        return renderPlanDetailsStep();
      case 3:
        return renderGenerationStep();
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <button
          onClick={handlePrevStep}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-2xl font-bold ml-4">Create Study Plan</h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="mb-8">
          <div className="flex items-center">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step <= currentStep
                      ? "bg-primary-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{step}</span>
                  )}
                </div>
                {step < 3 && (
                  <div
                    className={`h-1 w-12 ${
                      step < currentStep ? "bg-primary-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span>Upload</span>
            <span>Details</span>
            <span>Generate</span>
          </div>
        </div>

        {renderCurrentStep()}

        <div className="flex justify-between mt-8">
          {currentStep > 1 ? (
            <button
              onClick={handlePrevStep}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div></div>
          )}

          <button
            onClick={handleNextStep}
            disabled={uploading}
            className={`flex items-center gap-2 px-6 py-2 ${
              currentStep === 3 && !uploading
                ? "bg-green-500 hover:bg-green-600"
                : "bg-primary-500 hover:bg-primary-600"
            } text-white rounded-md`}
          >
            {currentStep === 3
              ? uploading
                ? "Generating..."
                : "View Plan"
              : currentStep === 2
              ? "Generate Plan"
              : "Next"}
            {currentStep < 3 && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanWizard;
