import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { protectedResources } from "../../../authConfig";

/**
 * Custom hook for timer functionality
 * @param {string} status - Current quiz status
 * @returns {Object} - Timer state and controls
 */
export const useQuizTimer = (status) => {
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  const previousTimerRef = useRef(0);

  useEffect(() => {
    if (status === "in-progress") {
      const id = setInterval(() => {
        setTimer((prev) => {
          const newValue = prev + 1;
          previousTimerRef.current = newValue;
          return newValue;
        });
      }, 1000);
      setIntervalId(id);
    } else if (intervalId) {
      clearInterval(intervalId);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status]);

  const resetTimer = useCallback(() => {
    setTimer(0);
    previousTimerRef.current = 0;
  }, []);

  const setTimerValue = useCallback((value) => {
    setTimer(value);
    previousTimerRef.current = value;
  }, []);

  return { timer, resetTimer, setTimerValue };
};

/**
 * Custom hook for managing quiz data fetching and saving
 * @returns {Object} - Methods and state for quiz data management
 */
export const useQuizData = () => {
  const { instance, accounts, inProgress } = useMsal();
  const quizzesFetchedRef = useRef(false);
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [error, setError] = useState("");

  // Get auth token silently
  const getToken = useCallback(async () => {
    console.log("=== Authentication Debug ===");
    console.log("MSAL inProgress:", inProgress);
    console.log("Accounts available:", accounts.length);
    
    // Check if MSAL is ready
    if (inProgress !== "none") {
      console.log("MSAL is still initializing...");
      throw new Error(
        "Authentication service is initializing. Please try again later."
      );
    }

    // Get active account
    let account = instance.getActiveAccount();
    console.log("Active account:", account ? "Found" : "Not found");
    
    if (!account && accounts.length > 0) {
      console.log("Setting first account as active...");
      instance.setActiveAccount(accounts[0]);
      account = accounts[0];
      console.log("Account set as active:", account?.username);
    }

    if (!account) {
      console.log("No account found - user needs to sign in");
      throw new Error("No active account found. Please sign in first.");
    }

    console.log("Getting token for account:", account.username);

    // Get token
    try {
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: protectedResources.todoListApi.scopes,
        account: account,
      });
      
      console.log("Token acquired successfully");
      return tokenResponse.accessToken;
    } catch (error) {
      console.error("Token acquisition failed:", error);
      
      // If silent token acquisition fails, try interactive login
      if (error instanceof InteractionRequiredAuthError) {
        console.log("Silent token acquisition failed, attempting interactive login...");
        try {
          const tokenResponse = await instance.acquireTokenPopup({
            scopes: protectedResources.todoListApi.scopes,
            account: account,
          });
          console.log("Token acquired via interactive login");
          return tokenResponse.accessToken;
        } catch (interactiveError) {
          console.error("Interactive authentication failed:", interactiveError);
          throw interactiveError;
        }
      }
      
      throw error;
    }
  }, [instance, accounts, inProgress]);

  // Fetch saved quizzes
  const fetchSavedQuizzes = useCallback(async () => {
    try {
      // Check if MSAL is initialized
      if (inProgress !== "none") {
        return;
      }

      quizzesFetchedRef.current = true;

      const token = await getToken();
      const response = await axios.get("http://127.0.0.1:8000/quizzes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSavedQuizzes(response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching saved quizzes:", error);
      setError("Failed to load your saved quizzes. Please try again later.");
      return [];
    }
  }, [getToken, inProgress]);

  // Fetch quiz with history
  const fetchQuizWithHistory = useCallback(
    async (quizId) => {
      if (inProgress !== "none") {
        return;
      }

      try {
        const token = await getToken();
        const response = await axios.get(
          `http://127.0.0.1:8000/quizzes/${quizId}/with-history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          response.data &&
          response.data.data &&
          response.data.data.attempts
        ) {
          setQuizAttempts(response.data.data.attempts);
        } else {
          setQuizAttempts([]);
        }

        return response.data;
      } catch (error) {
        console.error("Error fetching quiz history:", error);
        setQuizAttempts([]);
        return null;
      }
    },
    [getToken, inProgress]
  );

  // Generate a new quiz
  const generateQuiz = useCallback(
    async (
      selectedFile,
      numQuestions,
      selectedTopics,
      customTopics,
      questionFormats,
      folderId = null,
      subjectCategory = "conceptual"
    ) => {
      try {
        console.log("=== generateQuiz Hook Called ===");
        console.log("Generating quiz with:", {
          file: selectedFile?.name,
          fileSize: selectedFile?.size,
          fileType: selectedFile?.type,
          numQuestions,
          selectedTopics,
          customTopics,
          questionFormats,
          subjectCategory
        });

        const token = await getToken();
        console.log("Token acquired successfully");

        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("num_questions", numQuestions.toString()); // Convert to string
        formData.append("subject_category", subjectCategory);

        // Combine selected topics and custom topics
        const allTopics = [...selectedTopics];
        if (customTopics) {
          allTopics.push(...customTopics.split(",").map((t) => t.trim()));
        }
        // Filter out empty topics
        const filteredTopics = allTopics.filter(
          (topic) => topic && topic.trim() !== ""
        );
        formData.append("focus_topics", filteredTopics.join(", "));

        // Map UI question formats to backend expected formats
        const formatMapping = {
          multiple_choice: "multiple_choice",
          multi_select: "multi_select",
          drag_and_drop: "drag_and_drop",
          true_false: "multiple_choice", // True/false is a special case of multiple choice
          short_response: "short_answer",
          fill_in_blank: "fill_in_blank",
          numerical: "numerical",
        };

        const selectedFormats = Object.entries(questionFormats)
          .filter(([_, selected]) => selected)
          .map(([format, _]) => formatMapping[format]);

        // Ensure at least one format is selected
        if (selectedFormats.length === 0) {
          selectedFormats.push("multiple_choice");
        }

        formData.append(
          "question_formats",
          JSON.stringify(
            selectedFormats.reduce(
              (obj, format) => ({ ...obj, [format]: true }),
              {}
            )
          )
        );

        // Add folderId if provided
        if (folderId) {
          formData.append("folder_id", folderId);
        }

        // Use a direct URL string to avoid URL construction issues
        const apiUrl = "http://127.0.0.1:8000/generate-quiz";

        console.log("Sending request to:", apiUrl);
        console.log("FormData contents:");
        for (let [key, value] of formData.entries()) {
          console.log(`  ${key}:`, value);
        }

        // Send the file to the backend API
        const response = await axios.post(apiUrl, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        console.log("=== API Response Received ===");
        console.log("Response status:", response.status);
        console.log("Response data:", response.data);

        // The backend now automatically saves the quiz and returns it with an ID
        // We don't need to call saveQuiz separately
        return response.data;
      } catch (err) {
        console.error("=== generateQuiz Hook Error ===");
        console.error("Error generating quiz:", err);
        console.error("Error response:", err.response?.data);
        console.error("Error status:", err.response?.status);
        console.error("Error headers:", err.response?.headers);
        
        // Log the full error details
        if (err.response) {
          console.error("Full error response:", {
            status: err.response.status,
            statusText: err.response.statusText,
            data: err.response.data,
            headers: err.response.headers
          });
        }
        
        throw new Error(
          err.response?.data?.detail || err.message || "Failed to generate quiz"
        );
      }
    },
    [getToken]
  );

  // Generate a new quiz from a plain topic/chapter/concept
  const generateQuizFromTopic = useCallback(
    async (
      topicText,
      numQuestions,
      selectedTopics,
      customTopics,
      questionFormats,
      folderId = null,
      subjectCategory = "conceptual"
    ) => {
      try {
        console.log("=== generateQuizFromTopic Hook Called ===");
        console.log("Topic text:", topicText);
        console.log("Number of questions:", numQuestions);
        console.log("Selected topics:", selectedTopics);
        console.log("Custom topics:", customTopics);
        console.log("Question formats:", questionFormats);
        console.log("Subject category:", subjectCategory);

        const token = await getToken();
        if (!token) {
          throw new Error("No authentication token available");
        }

        console.log("Token acquired, making API request...");

        // Combine selected topics and custom topics
        const allTopics = [...selectedTopics];
        if (customTopics) {
          allTopics.push(...customTopics.split(",").map((t) => t.trim()));
        }
        const filteredTopics = allTopics.filter(
          (topic) => topic && topic.trim() !== ""
        );

        const formatMapping = {
          multiple_choice: "multiple_choice",
          multi_select: "multi_select",
          drag_and_drop: "drag_and_drop",
          true_false: "multiple_choice",
          short_response: "short_answer",
          fill_in_blank: "fill_in_blank",
          numerical: "numerical",
        };

        const selectedFormats = Object.entries(questionFormats)
          .filter(([_, selected]) => selected)
          .map(([format, _]) => formatMapping[format]);

        if (selectedFormats.length === 0) {
          selectedFormats.push("multiple_choice");
        }

        const apiUrl = "http://127.0.0.1:8000/generate-quiz-from-topic";
        const requestBody = {
          topic: topicText,
          num_questions: numQuestions,
          focus_topics: filteredTopics.join(", "),
          question_formats: selectedFormats.reduce(
            (obj, format) => ({ ...obj, [format]: true }),
            {}
          ),
          subject_category: subjectCategory,
        };

      // Add folderId if provided
      if (folderId) {
        requestBody.folder_id = folderId;
      }

      console.log("Sending request to:", apiUrl);
        console.log("RequestBody contents:", requestBody);

        const response = await axios.post(apiUrl, requestBody, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("=== API Response Received ===");
        console.log("Response status:", response.status);
        console.log("Response data:", response.data);

        return response.data;
      } catch (err) {
        console.error("=== generateQuizFromTopic Hook Error ===");
        console.error("Error generating quiz from topic:", err);
        console.error("Error response:", err.response?.data);
        console.error("Error status:", err.response?.status);
        
        throw new Error(
          err.response?.data?.detail || err.message || "Failed to generate quiz from topic"
        );
      }
    },
    [getToken]
  );

  // Save a quiz
  const saveQuiz = useCallback(
    async (
      generatedQuiz,
      userAnswers,
      quizStatus,
      timer,
      selectedFile,
      numQuestions,
      selectedTopics,
      customTopics,
      questionFormats
    ) => {
      if (!generatedQuiz) return;

      try {
        setIsSaving(true);
        setSaveSuccess(false);

        const token = await getToken();

        // Prepare quiz data
        const quizData = {
          contentType: "quiz",
          data: {
            title: generatedQuiz.quiz_title,
            questions: generatedQuiz.questions,
            userAnswers: userAnswers,
            score:
              quizStatus === "completed"
                ? calculateQuizScore(generatedQuiz.questions, userAnswers)
                : null,
            timeTaken: timer,
            resourceName: selectedFile ? selectedFile.name : "Unknown resource",
            options: {
              numQuestions,
              selectedTopics,
              customTopics,
              questionFormats,
            },
          },
        };

        // Save to API
        const response = await axios.post(
          "http://127.0.0.1:8000/save-quiz",
          quizData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        setSaveSuccess(true);
        quizzesFetchedRef.current = false;
        await fetchSavedQuizzes();
        return response.data;
      } catch (error) {
        console.error("Error saving quiz:", error);
        setError(
          "Failed to save quiz: " +
            (error.response?.data?.message || error.message)
        );
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [getToken, fetchSavedQuizzes]
  );

  // Save a quiz attempt
  const saveQuizAttempt = useCallback(
    async (generatedQuiz, userAnswers, timer, mode) => {
      if (!generatedQuiz || !generatedQuiz.id) return;

      try {
        setIsSaving(true);
        setSaveSuccess(false);

        const token = await getToken();

        // Prepare attempt data
        const attemptData = {
          quizId: generatedQuiz.id,
          score: calculateQuizScore(generatedQuiz.questions, userAnswers),
          timeTaken: timer,
          userAnswers: userAnswers,
          mode: mode,
        };

        // Save attempt
        const response = await axios.post(
          "http://127.0.0.1:8000/save-quiz-attempt",
          attemptData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        setSaveSuccess(true);
        quizzesFetchedRef.current = false;
        await fetchQuizWithHistory(generatedQuiz.id);
        await fetchSavedQuizzes();
        return response.data;
      } catch (error) {
        console.error("Error saving quiz attempt:", error);
        setError(
          "Failed to save quiz attempt: " +
            (error.response?.data?.message || error.message)
        );
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [getToken, fetchQuizWithHistory, fetchSavedQuizzes]
  );

  return {
    savedQuizzes,
    isSaving,
    saveSuccess,
    quizAttempts,
    error,
    setError,
    quizzesFetchedRef,
    fetchSavedQuizzes,
    fetchQuizWithHistory,
    generateQuiz,
    generateQuizFromTopic,
    saveQuiz,
    saveQuizAttempt,
  };
};

// Calculate quiz score function needed by the saveQuiz function
function calculateQuizScore(questions, userAnswers) {
  if (!questions || !questions.length || !userAnswers) return 0;

  let correct = 0;
  questions.forEach((question, index) => {
    if (isAnswerCorrect(question, userAnswers[index])) correct++;
  });

  return Math.round((correct / questions.length) * 100);
}

// Simple version of isAnswerCorrect for the hook implementation
function isAnswerCorrect(question, userAnswer) {
  if (!question || userAnswer === null || userAnswer === undefined) return null;

  switch (question.type) {
    case "multiple_choice":
      return userAnswer === question.correct_answer;
    case "multi_select":
      if (!Array.isArray(userAnswer)) return false;
      return (
        JSON.stringify([...userAnswer].sort()) ===
        JSON.stringify([...question.correct_answers].sort())
      );
    case "drag_and_drop":
      if (!userAnswer || typeof userAnswer !== "object") return false;
      return Object.keys(question.correct_mapping).every(
        (key) => userAnswer[key] === question.correct_mapping[key]
      );
    case "short_answer":
    case "fill_in_blank":
      return (
        userAnswer === question.correct_answer ||
        (question.acceptable_answers &&
          question.acceptable_answers.includes(userAnswer))
      );
    case "numerical": {
      if (!userAnswer) return false;
      const parsed = parseFloat(String(userAnswer).replace(/[^0-9.\-]/g, ""));
      if (isNaN(parsed)) return false;
      return Math.abs(parsed - question.correct_answer_value) <= (question.tolerance ?? 0.01);
    }
    default:
      return false;
  }
}
