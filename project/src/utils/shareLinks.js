import { msalInstance, protectedResources } from "../authConfig";

const API_BASE = "http://localhost:8000";

const ensureAccount = async () => {
  let account = msalInstance.getActiveAccount();

  if (!account) {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
      account = accounts[0];
    }
  }

  if (account) {
    return account;
  }

  const loginResponse = await msalInstance.loginPopup({
    scopes: protectedResources.todoListApi.scopes,
  });

  if (loginResponse.account) {
    msalInstance.setActiveAccount(loginResponse.account);
    return loginResponse.account;
  }

  throw new Error("Unable to sign in.");
};

const getAccessToken = async () => {
  const account = await ensureAccount();

  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: protectedResources.todoListApi.scopes,
      account,
    });
    return response.accessToken;
  } catch (error) {
    const response = await msalInstance.acquireTokenPopup({
      scopes: protectedResources.todoListApi.scopes,
      account,
    });
    if (response.account) {
      msalInstance.setActiveAccount(response.account);
    }
    return response.accessToken;
  }
};

const parseJsonResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail || payload.message || "Request failed");
  }

  return payload;
};

const authenticatedRequest = async (path, options = {}) => {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  return parseJsonResponse(response);
};

export const createShareLink = async (sourceItemId, settings = {}) => {
  return authenticatedRequest("/share-links", {
    method: "POST",
    body: JSON.stringify({ sourceItemId, settings }),
  });
};

export const revokeShareLink = async (shareLinkId) => {
  return authenticatedRequest(`/share-links/${shareLinkId}/revoke`, {
    method: "POST",
  });
};

export const fetchSharedPreview = async (token) => {
  const response = await fetch(`${API_BASE}/share/${token}`);
  return parseJsonResponse(response);
};

export const importSharedItem = async (token) => {
  return authenticatedRequest(`/share/${token}/import`, {
    method: "POST",
  });
};

export const getSharedItemOpenPath = (contentType, itemId) => {
  if (contentType === "flashcard_deck") {
    return `/tools/flashcards/study/${itemId}`;
  }

  if (contentType === "quiz") {
    return `/tools/practice-tests?quizId=${itemId}`;
  }

  if (contentType === "study_plan") {
    return `/tools/study-planner?planId=${itemId}`;
  }

  if (contentType === "summary") {
    return `/tools/summarizer?summaryId=${itemId}`;
  }

  return "/workspace";
};
