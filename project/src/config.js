// API Configuration
export const API_CONFIG = {
  // Backend API base URL
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  
  // API Endpoints
  ENDPOINTS: {
    // Quiz endpoints
    GENERATE_QUIZ: "/generate-quiz",
    SAVE_QUIZ: "/save-quiz",
    SAVE_QUIZ_ATTEMPT: "/save-quiz-attempt",
    GET_QUIZZES: "/quizzes",
    GET_QUIZ_WITH_HISTORY: (quizId) => `/quizzes/${quizId}/with-history`,
    
    // Flashcard endpoints
    GET_DECKS: "/decks",
    SAVE_FLASHCARD: "/save-flashcard",
    
    // Study plan endpoints
    GENERATE_STUDY_PLAN: "/generate-study-plan",
    GET_STUDY_PLANS: "/study-plans",
    GET_STUDY_PLAN: (planId) => `/study-plans/${planId}`,
    UPDATE_STUDY_PLAN: "/update-study-plan",
    
    // Other endpoints
    EXPLAIN_ANSWER: "/explain-answer",
    EVALUATE_SHORT_ANSWER: "/evaluate-short-answer",
    SUMMARIZE: "/summarize",
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}; 