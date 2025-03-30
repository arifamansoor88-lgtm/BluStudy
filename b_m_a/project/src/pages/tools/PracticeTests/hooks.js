import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useMsal } from "@azure/msal-react";
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
    // Check if MSAL is ready
    if (inProgress !== "none") {
      throw new Error(
        "Authentication service is initializing. Please try again later."
      );
    }

    // Get active account
    let account = instance.getActiveAccount();
    if (!account && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
      account = accounts[0];
    }

    if (!account) {
      throw new Error("No active account found. Please sign in first.");
    }

    // Get token
    const tokenResponse = await instance.acquireTokenSilent({
      scopes: protectedResources.todoListApi.scopes,
      account: account,
    });

    return tokenResponse.accessToken;
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
      const response = await axios.get("http://localhost:8000/quizzes", {
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
          `http://localhost:8000/quizzes/${quizId}/with-history`,
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
      questionFormats
    ) => {
      try {
        const token = await getToken();

        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("num_questions", numQuestions.toString()); // Convert to string

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

        // Use a direct URL string to avoid URL construction issues
        const apiUrl = "http://localhost:8000/generate-quiz";

        // Send the file to the backend API
        const response = await axios.post(apiUrl, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        return response.data;
      } catch (err) {
        console.error("Error generating quiz:", err);
        throw new Error(
          err.response?.data?.detail || err.message || "Failed to generate quiz"
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
          "http://localhost:8000/save-quiz",
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
          "http://localhost:8000/save-quiz-attempt",
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
    default:
      return false;
  }
}
