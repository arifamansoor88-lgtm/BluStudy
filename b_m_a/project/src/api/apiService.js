import { msalInstance, protectedResources } from "../authConfig";

const API_BASE = protectedResources.todoListApi.endpoint;
const STUDY_STREAK_UPDATE_KEY = "study_streak_recent_update";
const STUDY_STREAK_CACHE_KEY = "study_streak_last_known";
const STUDY_STREAK_UPDATE_MAX_AGE_MS = 5 * 60 * 1000;

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

const decodeJwtClaims = (token) => {
  if (!token || typeof globalThis.atob !== "function") return {};

  try {
    const payload = token.split(".")[1];
    if (!payload) return {};

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );

    return JSON.parse(globalThis.atob(padded));
  } catch (error) {
    console.warn("Unable to decode auth token claims:", error);
    return {};
  }
};

const getApiUserId = (account, accessToken) => {
  const tokenClaims = decodeJwtClaims(accessToken);
  const accountClaims = account?.idTokenClaims || {};

  return (
    tokenClaims?.sub ||
    tokenClaims?.oid ||
    tokenClaims?.userId ||
    accountClaims?.sub ||
    accountClaims?.oid ||
    accountClaims?.userId ||
    account?.localAccountId ||
    account?.homeAccountId ||
    account?.username ||
    "default"
  );
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

    // Merge headers and conditionally set Content-Type only if body is not FormData
    let headers = {
      ...options.headers,
      "X-User-Id": getApiUserId(account, response.accessToken),
      Authorization: `Bearer ${response.accessToken}`,
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

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

const callStudyStreakApi = async (endpoint, options = {}) => {
  const account = getActiveAccount();
  const headers = {
    ...options.headers,
    "X-User-Id": getApiUserId(account),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const apiResponse = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!apiResponse.ok) {
    const errorData = await apiResponse.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        `API error: ${apiResponse.status} ${apiResponse.statusText}`
    );
  }

  return apiResponse.json();
};

const getLocalStudyDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const writeJsonStorage = (storage, key, value) => {
  if (typeof window === "undefined") return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to write ${key}:`, error);
  }
};

const readJsonStorage = (storage, key) => {
  if (typeof window === "undefined") return null;

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn(`Unable to read ${key}:`, error);
    return null;
  }
};

const rememberStudyStreak = (currentStreak) => {
  if (typeof window === "undefined") return;

  writeJsonStorage(window.localStorage, STUDY_STREAK_CACHE_KEY, {
    currentStreak: currentStreak || 0,
    localDate: getLocalStudyDate(),
    updatedAt: Date.now(),
  });
};

const markStudyStreakUpdated = (result, toolKey, actionKey) => {
  if (!result?.streak_updated || typeof window === "undefined") return;

  const marker = {
    toolKey,
    actionKey,
    currentStreak: result.current_streak || 0,
    previousStreak:
      result.previous_streak ?? Math.max((result.current_streak || 1) - 1, 0),
    localDate: getLocalStudyDate(),
    updatedAt: Date.now(),
  };

  writeJsonStorage(window.sessionStorage, STUDY_STREAK_UPDATE_KEY, marker);
  window.dispatchEvent(new CustomEvent("study-streak-updated", { detail: marker }));
};

export const getCachedStudyStreak = () => {
  if (typeof window === "undefined") return null;

  const cached = readJsonStorage(window.localStorage, STUDY_STREAK_CACHE_KEY);
  if (!cached || cached.localDate !== getLocalStudyDate()) return null;

  return cached.currentStreak || 0;
};

export const consumeRecentStudyStreakUpdate = () => {
  if (typeof window === "undefined") return null;

  const marker = readJsonStorage(window.sessionStorage, STUDY_STREAK_UPDATE_KEY);
  window.sessionStorage.removeItem(STUDY_STREAK_UPDATE_KEY);

  if (!marker || marker.localDate !== getLocalStudyDate()) return null;
  if (Date.now() - (marker.updatedAt || 0) > STUDY_STREAK_UPDATE_MAX_AGE_MS) {
    return null;
  }

  return marker;
};

export const getStudyStreak = async () => {
  const result = await callStudyStreakApi(`${API_BASE}/streak`, {
    headers: {
      "X-Study-Date": getLocalStudyDate(),
    },
  });

  rememberStudyStreak(result.current_streak || 0);
  return result;
};

export const updateStudyStreak = async (toolKey, actionKey) => {
  const localDate = getLocalStudyDate();

  return callStudyStreakApi(`${API_BASE}/update-streak`, {
    method: "POST",
    headers: {
      "X-Study-Date": localDate,
    },
    body: JSON.stringify({
      activityType: "meaningful_tool_action",
      toolKey,
      actionKey,
      localDate,
    }),
  });
};

export const recordStudyToolUse = async (toolKey, actionKey) => {
  if (!toolKey || !actionKey) return null;

  try {
    const result = await updateStudyStreak(toolKey, actionKey);
    rememberStudyStreak(result?.current_streak || 0);
    markStudyStreakUpdated(result, toolKey, actionKey);
    return result;
  } catch (error) {
    console.warn("Failed to update study streak:", error);
    return null;
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
 * @param {String} folderId - Optional folder ID to save the study plan in
 * @returns {Promise<Object>} - The generated study plan
 */
export const generateStudyPlan = async (
  files,
  title,
  description = "",
  tags = "",
  durationMetadata = "",
  folderId = null
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
  
  // Add folderId if provided
  if (folderId) {
    formData.append("folder_id", folderId);
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
        // Don't set Content-Type for FormData; browser will set it automatically.
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

    const data = await apiResponse.json();
    await recordStudyToolUse("study_plan", "generate_study_plan");
    return data;
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
    await recordStudyToolUse("study_plan", "update_study_plan");
    return response;
  } catch (error) {
    console.error("Error updating study plan:", error);
    throw error;
  }
};

// Fetches Suggested Next Steps data for the dashboard from the backend API.
// This keeps dashboard API calls centralized in one service file.
export const getSuggestedNextSteps = async () => {
    const endpoint = "http://localhost:8000/dashboard/next-steps";
    return await callProtectedApi(endpoint);
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

/**
 * Generate a summary for the given input.
 * If payload is a FormData instance (i.e. file upload), it sends it as multipart/form-data.
 * Otherwise, it assumes payload is an object containing { text: "..." }.
 * @param {FormData|Object} payload - Either a FormData (for file upload) or a plain object with text.
 * @returns {Promise<Object>} - The JSON response containing the summary.
 */
export const generateSummary = async (payload) => {
  const endpoint = "http://localhost:8000/summarize";
  let options = {};

  if (payload instanceof FormData) {
    options = {
      method: "POST",
      body: payload,
      // Do not set Content-Type for FormData; browser will set it automatically.
    };
  } else {
    options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
  }

  try {
    const response = await callProtectedApi(endpoint, options);
    await recordStudyToolUse("summarizer", "generate_summary");
    return response; // Expected format: { summary: "..." }
  } catch (error) {
    console.error("Error generating summary:", error);
    throw error;
  }
};

/**
 * Analyze quiz performance and extract topics using AI
 * @param {Array} questions - Array of quiz questions
 * @param {Array} userAnswers - Array of user answers
 * @param {Object} quizMetadata - Additional quiz metadata
 * @returns {Promise<Object>} - AI-analyzed performance data with topics
 */
export const analyzeQuizPerformance = async (questions, userAnswers, quizMetadata = {}) => {
  const endpoint = "http://localhost:8000/analyze-quiz-performance";

  const requestBody = {
    questions,
    userAnswers,
    quizMetadata
  };

  const options = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    return response; // Expected format: { topics: [...], weakTopics: [...], strongTopics: [...], recommendations: [...] }
  } catch (error) {
    console.error("Error analyzing quiz performance:", error);
    throw error;
  }
};


// Mindmap API Functions

/**
 * Create a new mindmap with a title
 * @param {String} title - The title for the new mindmap
 * @returns {Promise<Object>} - The created mindmap response with id and slug
 */
export const createMindmap = async (title) => {
  const endpoint = "http://localhost:8000/create-mindmap";
  
  const options = {
    method: "POST",
    body: JSON.stringify({ title }),
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    await recordStudyToolUse("mind_map", "create_mind_map");
    return response; // Expected format: { id: "...", slug: "...", message: "..." }
  } catch (error) {
    console.error("Error creating mindmap:", error);
    throw error;
  }
};

/**
 * Save a mindmap to the database
 * @param {Object} mindmapData - The mindmap data to save
 * @param {String} folderId - Optional folder ID to save the mindmap in
 * @returns {Promise<Object>} - The saved mindmap response
 */
export const saveMindmap = async (mindmapData, folderId = null) => {
  const endpoint = "http://localhost:8000/save-mindmap";

  const requestBody = {
    contentType: "mindmap",
    data: mindmapData
  };
  
  // Add folderId if provided
  if (folderId) {
    requestBody.folder_id = folderId;
  }

  const options = {
    method: "POST",
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    await recordStudyToolUse("mind_map", "save_mind_map");
    return response; // Expected format: { id: "...", message: "..." }
  } catch (error) {
    console.error("Error saving mindmap:", error);
    throw error;
  }
};

/**
 * Update an existing mindmap in the database
 * @param {String} mindmapId - The ID of the mindmap to update
 * @param {Object} mindmapData - The updated mindmap data
 * @returns {Promise<Object>} - The update response
 */
export const updateMindmap = async (mindmapId, mindmapData) => {
  const endpoint = `http://localhost:8000/update-mindmap/${mindmapId}`;

  const requestBody = {
    contentType: "mindmap",
    data: mindmapData
  };

  const options = {
    method: "PUT",
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    await recordStudyToolUse("mind_map", "update_mind_map");
    return response; // Expected format: { id: "...", message: "..." }
  } catch (error) {
    console.error("Error updating mindmap:", error);
    throw error;
  }
};

/**
 * Get all mindmaps for the current user
 * @returns {Promise<Array>} - List of mindmaps
 */
export const getMindmaps = async () => {
  const endpoint = "http://localhost:8000/mindmaps";

  try {
    const response = await callProtectedApi(endpoint);
    return response; // Expected format: Array of mindmap documents
  } catch (error) {
    console.error("Error fetching mindmaps:", error);
    throw error;
  }
};

/**
 * Get a specific mindmap by ID
 * @param {String} mindmapId - The ID of the mindmap to retrieve
 * @returns {Promise<Object>} - The mindmap data
 */
export const getMindmap = async (mindmapId) => {
  const endpoint = `http://localhost:8000/mindmaps/${mindmapId}`;

  try {
    const response = await callProtectedApi(endpoint);
    return response; // Expected format: Mindmap document
  } catch (error) {
    console.error(`Error fetching mindmap ${mindmapId}:`, error);
    throw error;
  }
};

/**
 * Delete a mindmap
 * @param {String} mindmapId - The ID of the mindmap to delete
 * @returns {Promise<Object>} - The delete response
 */
export const deleteMindmap = async (mindmapId) => {
  const endpoint = `http://localhost:8000/delete-mindmap/${mindmapId}`;

  const options = {
    method: "DELETE",
  };

  try {
    const response = await callProtectedApi(endpoint, options);
    return response; // Expected format: { message: "..." }
  } catch (error) {
    console.error(`Error deleting mindmap ${mindmapId}:`, error);
    throw error;
  }
};
