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
