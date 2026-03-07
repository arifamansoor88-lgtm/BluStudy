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
 * This is a synchronous function that performs a simple check
 * For short answer and fill_in_blank, it uses exact matching
 * Use evaluateAnswerWithAI for AI-based evaluation of short answers
 *
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
      // This is a simple exact match, the AI evaluation provides better results
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

/**
 * Determines if a question type should use AI evaluation
 * @param {string} questionType - The type of question
 * @returns {boolean} - Whether AI evaluation should be used
 */
export const shouldUseAIEvaluation = (questionType) => {
  return questionType === "short_answer" || questionType === "fill_in_blank";
};

/**
 * Enhanced topic extraction from quiz questions
 * @param {Array} questions - Array of quiz questions
 * @returns {Array} - Array of topic objects with analysis
 */
export const extractTopicsFromQuestions = (questions) => {
  console.log("extractTopicsFromQuestions called with:", questions.length, "questions");
  const topics = new Map();
  
  questions.forEach((question, index) => {
    console.log(`Processing question ${index + 1}:`, question.question.substring(0, 100) + "...");
    const extractedTopics = extractTopicsFromText(question.question, question);
    console.log(`Question ${index + 1} extracted topics:`, extractedTopics);
    
    extractedTopics.forEach(topic => {
      if (!topics.has(topic.name)) {
        topics.set(topic.name, {
          name: topic.name,
          questionIndices: [],
          correctCount: 0,
          totalCount: 0,
          accuracy: 0,
          difficulty: topic.difficulty || 'medium',
          category: topic.category || 'general',
          keywords: topic.keywords || []
        });
      }
      topics.get(topic.name).questionIndices.push(index);
      topics.get(topic.name).totalCount++;
    });
  });
  
  const result = Array.from(topics.values());
  console.log("Final extracted topics:", result);
  return result;
};

/**
 * Extract topics from question text using intelligent analysis
 * @param {string} text - Question text
 * @param {Object} question - Full question object
 * @returns {Array} - Array of topic objects
 */
export const extractTopicsFromText = (text, question = {}) => {
  console.log("extractTopicsFromText called with text:", text.substring(0, 100) + "...");
  const topics = [];
  const lowerText = text.toLowerCase();
  
  // Subject-specific topic patterns
  const subjectPatterns = {
    math: [
      'algebra', 'calculus', 'geometry', 'trigonometry', 'statistics', 'probability',
      'equations', 'functions', 'derivatives', 'integrals', 'matrices', 'vectors'
    ],
    science: [
      'biology', 'chemistry', 'physics', 'anatomy', 'physiology', 'molecular',
      'cellular', 'organic', 'inorganic', 'mechanics', 'thermodynamics', 'genetics'
    ],
    history: [
      'ancient', 'medieval', 'renaissance', 'industrial', 'revolution', 'war',
      'civilization', 'empire', 'dynasty', 'colonial', 'independence', 'reformation'
    ],
    literature: [
      'poetry', 'prose', 'drama', 'novel', 'short story', 'essay', 'metaphor',
      'symbolism', 'allegory', 'irony', 'satire', 'romanticism', 'modernism'
    ],
    language: [
      'grammar', 'syntax', 'vocabulary', 'pronunciation', 'conjugation', 'declension',
      'phonetics', 'morphology', 'semantics', 'pragmatics', 'dialect', 'accent'
    ],
    computer_science: [
      'programming', 'algorithms', 'data structures', 'databases', 'networks',
      'operating systems', 'software engineering', 'artificial intelligence', 'machine learning'
    ]
  };

  // General academic topics
  const generalTopics = [
    'fundamentals', 'basics', 'principles', 'concepts', 'theories', 'methods',
    'techniques', 'analysis', 'synthesis', 'evaluation', 'application', 'problem solving',
    'critical thinking', 'research', 'experimentation', 'observation', 'hypothesis',
    'conclusion', 'argument', 'evidence', 'reasoning', 'logic', 'deduction', 'induction'
  ];

  // Determine subject area and extract relevant topics
  let subject = 'general';
  for (const [subj, patterns] of Object.entries(subjectPatterns)) {
    if (patterns.some(pattern => lowerText.includes(pattern))) {
      subject = subj;
      break;
    }
  }

  // Extract subject-specific topics
  if (subject !== 'general') {
    const subjectTopics = subjectPatterns[subject];
    subjectTopics.forEach(topic => {
      if (lowerText.includes(topic)) {
        topics.push({
          name: topic,
          difficulty: determineDifficulty(text, question),
          category: subject,
          keywords: [topic]
        });
      }
    });
  }

  // Extract general academic topics
  generalTopics.forEach(topic => {
    if (lowerText.includes(topic)) {
      topics.push({
        name: topic,
        difficulty: determineDifficulty(text, question),
        category: 'academic_skills',
        keywords: [topic]
      });
    }
  });

  // If no specific topics found, create contextual topics
  if (topics.length === 0) {
    console.log("No specific topics found, creating contextual topic");
    const contextualTopic = createContextualTopic(text, question);
    topics.push(contextualTopic);
  }

  console.log("Final topics for this text:", topics);
  return topics;
};

/**
 * Determine question difficulty based on text length and complexity
 * @param {string} text - Question text
 * @param {Object} question - Question object
 * @returns {string} - Difficulty level
 */
export const determineDifficulty = (text, question) => {
  const wordCount = text.split(' ').length;
  const hasComplexTerms = /(because|therefore|however|although|nevertheless|furthermore|consequently)/i.test(text);
  const hasMultipleSteps = text.includes('step') || text.includes('process') || text.includes('procedure');
  
  if (wordCount > 50 || hasComplexTerms || hasMultipleSteps) {
    return 'advanced';
  } else if (wordCount > 25 || question.type === 'multi_select' || question.type === 'drag_and_drop') {
    return 'intermediate';
  } else {
    return 'basic';
  }
};

/**
 * Create contextual topic when no specific topics are found
 * @param {string} text - Question text
 * @param {Object} question - Question object
 * @returns {Object} - Topic object
 */
export const createContextualTopic = (text, question) => {
  console.log("createContextualTopic called with:", { text: text.substring(0, 50) + "...", questionType: question.type });
  const wordCount = text.split(' ').length;
  const questionType = question.type || 'multiple_choice';
  
  let topicName = 'general concepts';
  let category = 'general';
  
  // Determine topic based on question characteristics
  if (wordCount < 30) {
    topicName = 'basic concepts';
  } else if (wordCount < 60) {
    topicName = 'intermediate concepts';
  } else {
    topicName = 'advanced concepts';
  }
  
  // Adjust based on question type
  if (questionType === 'short_answer' || questionType === 'fill_in_blank') {
    topicName = 'comprehensive understanding';
    category = 'application';
  } else if (questionType === 'multi_select') {
    topicName = 'multi-faceted concepts';
    category = 'analysis';
  } else if (questionType === 'drag_and_drop') {
    topicName = 'relationship mapping';
    category = 'synthesis';
  }
  
  const result = {
    name: topicName,
    difficulty: determineDifficulty(text, question),
    category: category,
    keywords: [topicName]
  };
  console.log("Created contextual topic:", result);
  return result;
};

/**
 * Analyze performance by topic
 * @param {Array} questions - Quiz questions
 * @param {Array} userAnswers - User answers
 * @param {Array} topics - Extracted topics
 * @returns {Array} - Topic performance analysis
 */
export const analyzeTopicPerformance = (questions, userAnswers, topics) => {
  return topics.map(topic => {
    let correctCount = 0;
    let totalTime = 0;
    let difficultyBreakdown = { basic: 0, intermediate: 0, advanced: 0 };
    
    topic.questionIndices.forEach(index => {
      const question = questions[index];
      const userAnswer = userAnswers[index];
      
      if (isAnswerCorrect(question, userAnswer)) {
        correctCount++;
      }
      
      // Track difficulty distribution
      const difficulty = determineDifficulty(question.question, question);
      difficultyBreakdown[difficulty]++;
    });
    
    const accuracy = topic.totalCount > 0 ? Math.round((correctCount / topic.totalCount) * 100) : 0;
    
    return {
      ...topic,
      correctCount,
      accuracy,
      reason: getTopicReason(accuracy),
      suggestions: getTopicSuggestions(accuracy),
      difficultyBreakdown,
      averageDifficulty: calculateAverageDifficulty(difficultyBreakdown)
    };
  });
};

/**
 * Calculate average difficulty based on breakdown
 * @param {Object} difficultyBreakdown - Count of questions by difficulty
 * @returns {string} - Average difficulty
 */
export const calculateAverageDifficulty = (difficultyBreakdown) => {
  const total = difficultyBreakdown.basic + difficultyBreakdown.intermediate + difficultyBreakdown.advanced;
  if (total === 0) return 'medium';
  
  const weightedScore = (difficultyBreakdown.basic * 1 + difficultyBreakdown.intermediate * 2 + difficultyBreakdown.advanced * 3) / total;
  
  if (weightedScore < 1.5) return 'basic';
  if (weightedScore < 2.5) return 'intermediate';
  return 'advanced';
};

/**
 * Get reason for topic performance
 * @param {number} accuracy - Topic accuracy percentage
 * @returns {string} - Performance reason
 */
export const getTopicReason = (accuracy) => {
  if (accuracy >= 90) return "Excellent mastery of this topic";
  if (accuracy >= 80) return "Good understanding with minor gaps";
  if (accuracy >= 70) return "Solid foundation with some areas for improvement";
  if (accuracy >= 60) return "Basic understanding but needs more practice";
  return "Significant gaps in understanding this topic";
};

/**
 * Get suggestions for topic improvement
 * @param {number} accuracy - Topic accuracy percentage
 * @returns {Array} - Array of suggestions
 */
export const getTopicSuggestions = (accuracy) => {
  if (accuracy >= 90) return ["Maintain current study habits", "Challenge yourself with advanced material"];
  if (accuracy >= 80) return ["Review specific concepts", "Practice application questions"];
  if (accuracy >= 70) return ["Focus on weak areas", "Use flashcards for reinforcement"];
  if (accuracy >= 60) return ["Revisit foundational concepts", "Seek additional resources"];
  return ["Start with basics", "Consider tutoring or study groups", "Use multiple learning methods"];
};

/**
 * Generate comprehensive study recommendations
 * @param {Array} topicPerformance - Topic performance analysis
 * @returns {Array} - Array of recommendations
 */
export const generateRecommendations = (topicPerformance) => {
  const recommendations = [];
  
  const weakTopics = topicPerformance.filter(t => t.accuracy < 70);
  const strongTopics = topicPerformance.filter(t => t.accuracy >= 80);
  const advancedTopics = topicPerformance.filter(t => t.averageDifficulty === 'advanced');
  
  if (weakTopics.length > 0) {
    recommendations.push(`Focus on reviewing ${weakTopics.map(t => t.name).join(', ')}`);
  }
  
  if (strongTopics.length > 0) {
    recommendations.push(`Build on your strengths in ${strongTopics.map(t => t.name).join(', ')}`);
  }
  
  if (advancedTopics.length > 0) {
    recommendations.push("Consider breaking down complex topics into smaller, manageable concepts");
  }
  
  recommendations.push("Use the AI Flashcards tool to create study materials for difficult topics");
  recommendations.push("Take practice tests regularly to track your progress");
  recommendations.push("Review incorrect answers to understand your mistakes");
  recommendations.push("Create a study schedule focusing on your weakest areas");
  
  return recommendations;
};
