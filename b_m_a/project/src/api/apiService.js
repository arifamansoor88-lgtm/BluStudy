import { msalInstance, protectedResources } from "../authConfig";

/**
 * Gets an active account, handles fallbacks if not immediately available
 * @returns The active account or throws an error if none can be found
 */
const getActiveAccount = () => {
  // First try getting the active account
  let account = msalInstance.getActiveAccount();

  // If no active account is set but accounts exist in the cache, use the first one
  if (!account) {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      // Set the first account as active
      msalInstance.setActiveAccount(accounts[0]);
      account = accounts[0];
      console.log("Set active account from cache:", account);
    }
  }

  if (!account) {
    throw new Error("No active account! Sign in before calling the API.");
  }

  return account;
};

/**
 * Fetch data from the API with authentication token
 * @param {string} endpoint - The API endpoint to fetch from
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - The response data
 */
export const callProtectedApi = async (endpoint, options = {}) => {
  try {
    // Get active account using our helper
    const account = getActiveAccount();

    // Get token silently
    const response = await msalInstance.acquireTokenSilent({
      scopes: protectedResources.todoListApi.scopes,
      account: account,
    });

    // Add token to headers
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${response.accessToken}`,
      "Content-Type": "application/json",
    };

    // Make API call
    const apiResponse = await fetch(endpoint, {
      ...options,
      headers,
    });

    // Handle non-OK responses
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
          `API error: ${apiResponse.status} ${apiResponse.statusText}`
      );
    }

    // Return JSON data
    return await apiResponse.json();
  } catch (error) {
    console.error("API call failed:", error);

    // Handle token expiration by trying to acquire a new token with interactive login
    if (error.name === "InteractionRequiredAuthError") {
      try {
        await msalInstance.acquireTokenPopup({
          scopes: protectedResources.todoListApi.scopes,
        });

        // Retry the call after getting a new token
        return callProtectedApi(endpoint, options);
      } catch (interactiveError) {
        console.error("Interactive authentication failed:", interactiveError);
        throw interactiveError;
      }
    }

    throw error;
  }
};

/**
 * Get tasks from the API
 * @returns {Promise<Array>} - List of tasks
 */
export const getTasks = async () => {
  return callProtectedApi(protectedResources.todoListApi.endpoint);
};

/**
 * Generate an explanation for a quiz answer using the AI
 * @param {Object} question - The complete question object
 * @param {*} userAnswer - The user's answer to the question
 * @param {Boolean} isCorrect - Whether the answer is correct or not
 * @returns {Promise<string>} - The AI-generated explanation
 */
export const getAnswerExplanation = async (question, userAnswer, isCorrect) => {
  const endpoint = "http://localhost:8000/explain-answer";

  const requestBody = {
    question,
    userAnswer,
    isCorrect,
  };

  const options = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    return response.explanation;
  } catch (error) {
    console.error("Error getting explanation:", error);
    return "Unable to generate explanation at this time.";
  }
};

/**
 * Evaluate a short answer or fill-in-blank response using OpenAI
 * @param {Object} question - The complete question object
 * @param {string} userAnswer - The user's answer to the question
 * @returns {Promise<Object>} - Object with isCorrect boolean and AI response
 */
export const evaluateShortAnswer = async (question, userAnswer) => {
  const endpoint = "http://localhost:8000/evaluate-short-answer";

  const requestBody = {
    question,
    userAnswer,
  };

  const options = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    return response;
  } catch (error) {
    console.error("Error evaluating short answer:", error);
    // Return a default response if the API call fails
    return { isCorrect: false, aiResponse: "error" };
  }
};

/**
 * Generate a study plan from uploaded PDFs
 * @param {Array} files - Array of PDF files to upload
 * @param {String} title - Title/name of the study plan
 * @param {String} description - Optional description of the study plan
 * @param {String} tags - Comma-separated list of tags
 * @param {String} durationMetadata - Optional JSON string with duration info
 * @returns {Promise<Object>} - The generated study plan
 */
export const generateStudyPlan = async (
  files,
  title,
  description = "",
  tags = "",
  durationMetadata = ""
) => {
  const endpoint = "http://localhost:8000/generate-study-plan";

  // Validate inputs before sending
  if (!files || files.length === 0) {
    throw new Error("No files provided");
  }

  if (!title) {
    throw new Error("Title is required");
  }

  // Check file types
  const invalidFiles = files.filter((file) => file.type !== "application/pdf");
  if (invalidFiles.length > 0) {
    throw new Error(
      `Files must be PDFs: ${invalidFiles.map((f) => f.name).join(", ")}`
    );
  }

  // Create FormData with all inputs
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  formData.append("title", title);
  formData.append("description", description || "");
  formData.append("tags", tags || "");

  // Add duration metadata if provided
  if (durationMetadata) {
    formData.append("duration_metadata", durationMetadata);
  }

  try {
    // For FormData uploads, we need to handle authorization separately
    // Get the active account
    const account = getActiveAccount();

    // Get token silently
    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes: protectedResources.todoListApi.scopes,
      account: account,
    });

    // Make API call with FormData and only Authorization header
    const apiResponse = await fetch(endpoint, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${tokenResponse.accessToken}`,
        // Don't set Content-Type for FormData, browser will set it with boundary
      },
    });

    // Handle non-OK responses
    if (!apiResponse.ok) {
      // Try to get error details from the response
      let errorMessage = `API error: ${apiResponse.status} ${apiResponse.statusText}`;

      try {
        const errorData = await apiResponse.json();
        if (errorData && errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (parseError) {
        // If we can't parse JSON, try to get text
        try {
          const errorText = await apiResponse.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch (textError) {
          // Keep the default error message
        }
      }

      throw new Error(errorMessage);
    }

    // Return JSON data
    return await apiResponse.json();
  } catch (error) {
    console.error("Error generating study plan:", error);
    throw error;
  }
};

/**
 * Get all study plans for the current user
 * @returns {Promise<Array>} - List of study plans
 */
export const getStudyPlans = async () => {
  const endpoint = "http://localhost:8000/study-plans";

  try {
    const response = await callProtectedApi(endpoint);
    return response.study_plans;
  } catch (error) {
    console.error("Error fetching study plans:", error);
    throw error;
  }
};

/**
 * Get a specific study plan by ID
 * @param {String} planId - The ID of the study plan to retrieve
 * @returns {Promise<Object>} - The study plan data
 */
export const getStudyPlan = async (planId) => {
  const endpoint = `http://localhost:8000/study-plans/${planId}`;

  try {
    const response = await callProtectedApi(endpoint);
    return response;
  } catch (error) {
    console.error(`Error fetching study plan ${planId}:`, error);
    throw error;
  }
};

/**
 * Update a study plan based on quiz results
 * @param {String} planId - The ID of the study plan to update
 * @param {Array} quizIds - Array of quiz IDs to use for updating the plan
 * @returns {Promise<Object>} - The updated study plan
 */
export const updateStudyPlan = async (planId, quizIds) => {
  const endpoint = "http://localhost:8000/update-study-plan";

  const requestBody = {
    planId,
    quizIds,
  };

  const options = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    return response;
  } catch (error) {
    console.error("Error updating study plan:", error);
    throw error;
  }
};

/**
 * Get all quizzes for the current user
 * @returns {Promise<Array>} - List of quizzes
 */
export const getQuizzes = async () => {
  const endpoint = "http://localhost:8000/quizzes";

  try {
    const response = await callProtectedApi(endpoint);
    return response;
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    throw error;
  }
};
