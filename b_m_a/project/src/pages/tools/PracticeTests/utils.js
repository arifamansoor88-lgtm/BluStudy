/**
 * Format time for display in mm:ss format
 * @param {number} time - Time in seconds
 * @returns {string} - Formatted time string
 */
export const formatTime = (time) => {
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (time % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

/**
 * Check if an answer is correct for a particular question
 * @param {Object} question - The question object
 * @param {any} userAnswer - The user's answer
 * @returns {boolean|null} - Whether the answer is correct, or null if can't determine
 */
export const isAnswerCorrect = (question, userAnswer) => {
  if (!question || userAnswer === null || userAnswer === undefined) return null;

  switch (question.type) {
    case "multiple_choice":
      return userAnswer === question.correct_answer;

    case "multi_select":
      // For multi-select, check if arrays have same values
      if (!Array.isArray(userAnswer)) return false;
      return (
        JSON.stringify([...userAnswer].sort()) ===
        JSON.stringify([...question.correct_answers].sort())
      );

    case "drag_and_drop":
      // For drag and drop, check if all mappings match
      if (!userAnswer || typeof userAnswer !== "object") return false;
      return Object.keys(question.correct_mapping).every(
        (key) => userAnswer[key] === question.correct_mapping[key]
      );

    case "short_answer":
    case "fill_in_blank":
      // For text inputs, check against correct answer and acceptable alternatives
      return (
        userAnswer === question.correct_answer ||
        (question.acceptable_answers &&
          question.acceptable_answers.includes(userAnswer))
      );

    default:
      return false;
  }
};

/**
 * Calculate quiz score based on user answers
 * @param {Array} questions - Array of quiz questions
 * @param {Array} userAnswers - Array of user answers
 * @returns {number} - Score as a percentage
 */
export const calculateQuizScore = (questions, userAnswers) => {
  if (!questions || !questions.length || !userAnswers) return 0;

  let correct = 0;
  questions.forEach((question, index) => {
    if (isAnswerCorrect(question, userAnswers[index])) correct++;
  });

  return Math.round((correct / questions.length) * 100);
};

/**
 * Get the count of correct answers
 * @param {Array} questions - Array of quiz questions
 * @param {Array} userAnswers - Array of user answers
 * @returns {number} - Number of correct answers
 */
export const getCorrectAnswerCount = (questions, userAnswers) => {
  if (!questions || !questions.length || !userAnswers) return 0;

  return questions.filter((question, index) =>
    isAnswerCorrect(question, userAnswers[index])
  ).length;
};
