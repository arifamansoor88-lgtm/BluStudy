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
 * Enhanced topic extraction from quiz questions using AI
 * @param {Array} questions - Array of quiz questions
 * @param {Array} userAnswers - Array of user answers
 * @param {Object} quizMetadata - Additional quiz metadata
 * @returns {Promise<Array>} - Promise resolving to array of topic objects with analysis
 */
export const extractTopicsFromQuestions = async (questions, userAnswers = [], quizMetadata = {}) => {
  console.log("extractTopicsFromQuestions called with:", questions.length, "questions");
  
  try {
    // Import the AI service
    const { analyzeQuizPerformance } = await import('../../../api/apiService');
    
    // Use AI to analyze all questions and extract topics
    console.log("Calling AI for comprehensive topic analysis...");
    const aiAnalysis = await analyzeQuizPerformance(questions, userAnswers, quizMetadata);
    console.log("AI analysis result:", aiAnalysis);
    
    if (aiAnalysis && aiAnalysis.topics && aiAnalysis.topics.length > 0) {
      // Convert AI response to expected format and recalculate accuracy
      const topics = aiAnalysis.topics.map(topic => {
        // Recalculate correctCount and accuracy based on actual user answers
        let correctCount = 0;
        const questionIndices = topic.questionIndices || [];
        
        questionIndices.forEach(index => {
          if (userAnswers[index] && isAnswerCorrect(questions[index], userAnswers[index])) {
            correctCount++;
          }
        });
        
        const totalCount = questionIndices.length;
        const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        
        console.log(`Topic "${topic.name}" recalculation:`, {
          questionIndices,
          correctCount,
          totalCount,
          accuracy,
          userAnswers: questionIndices.map(i => userAnswers[i]),
          correctAnswers: questionIndices.map(i => questions[i]?.correct_answer || questions[i]?.correct_answers || questions[i]?.correct_mapping)
        });
        
        return {
          name: topic.name,
          questionIndices: questionIndices,
          correctCount: correctCount,
          totalCount: totalCount,
          accuracy: accuracy,
          category: topic.category || 'general',
          keywords: topic.keywords || [],
          reason: topic.reason || '',
          suggestions: topic.suggestions || []
        };
      });
      
      console.log("Converted AI topics:", topics);
      console.log("Total questions processed:", questions.length);
      
      // Verify all questions are covered
      const coveredQuestions = new Set();
      topics.forEach(topic => {
        topic.questionIndices.forEach(index => coveredQuestions.add(index));
      });
      
      const missingQuestions = [];
      for (let i = 0; i < questions.length; i++) {
        if (!coveredQuestions.has(i)) {
          missingQuestions.push(i);
        }
      }
      
      if (missingQuestions.length > 0) {
        console.log("Questions not covered by AI analysis:", missingQuestions.map(i => i + 1));
        
        // Add missing questions to a general topic
        const generalTopic = topics.find(t => t.name === 'General Concepts') || {
          name: 'General Concepts',
          questionIndices: [],
          correctCount: 0,
          totalCount: 0,
          accuracy: 0,
          category: 'general',
          keywords: ['general'],
          reason: 'General concepts and fundamentals',
          suggestions: ['Review basic concepts and fundamentals']
        };
        
        missingQuestions.forEach(index => {
          generalTopic.questionIndices.push(index);
          generalTopic.totalCount++;
          if (userAnswers[index] && isAnswerCorrect(questions[index], userAnswers[index])) {
            generalTopic.correctCount++;
          }
        });
        
        // Update accuracy for general topic
        generalTopic.accuracy = generalTopic.totalCount > 0 ? 
          Math.round((generalTopic.correctCount / generalTopic.totalCount) * 100) : 0;
        
        // Add general topic if it wasn't already in the list
        if (!topics.find(t => t.name === 'General Concepts')) {
          topics.push(generalTopic);
        }
      }
      
      return topics;
    } else {
      console.warn("AI analysis returned no topics, falling back to basic analysis");
      return createFallbackTopics(questions, userAnswers);
    }
    
  } catch (error) {
    console.error("Error in AI topic extraction:", error);
    console.log("Falling back to basic topic analysis");
    return createFallbackTopics(questions, userAnswers);
  }
};

/**
 * Create fallback topics when AI analysis fails
 * @param {Array} questions - Array of quiz questions
 * @param {Array} userAnswers - Array of user answers
 * @returns {Array} - Array of topic objects
 */
export const createFallbackTopics = (questions, userAnswers = []) => {
  console.log("Creating fallback topics for", questions.length, "questions");
  
  const topics = new Map();
  
  // Process each question and create contextual topics
  questions.forEach((question, index) => {
    const contextualTopic = createContextualTopic(question.question, question);
    
    if (!topics.has(contextualTopic.name)) {
      topics.set(contextualTopic.name, {
        name: contextualTopic.name,
        questionIndices: [],
        correctCount: 0,
        totalCount: 0,
        accuracy: 0,
        category: contextualTopic.category,
        keywords: contextualTopic.keywords,
        reason: `Performance in ${contextualTopic.name}`,
        suggestions: [`Review ${contextualTopic.name} concepts`]
      });
    }
    
    const topic = topics.get(contextualTopic.name);
    topic.questionIndices.push(index);
    topic.totalCount++;
    
    // Check if answer is correct
    if (userAnswers[index] && isAnswerCorrect(question, userAnswers[index])) {
      topic.correctCount++;
    }
  });
  
  // Calculate accuracy for each topic
  topics.forEach(topic => {
    topic.accuracy = topic.totalCount > 0 ? 
      Math.round((topic.correctCount / topic.totalCount) * 100) : 0;
  });
  
  const result = Array.from(topics.values());
  console.log("Fallback topics created:", result);
  return result;
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
  
  // Extract key terms from the question text to create more meaningful topic names
  const lowerText = text.toLowerCase();
  
  // Look for subject-specific keywords
  let topicName = 'general concepts';
  let category = 'general';
  
  // Check for common subject areas
  if (/electrical|electricity|voltage|current|resistance|power|energy|circuit|battery|capacitor/i.test(lowerText)) {
    topicName = 'electrical concepts';
    category = 'physics';
  } else if (/math|algebra|calculus|geometry|equation|formula|number|calculation/i.test(lowerText)) {
    topicName = 'mathematical concepts';
    category = 'mathematics';
  } else if (/chemical|chemistry|reaction|molecule|atom|element|compound/i.test(lowerText)) {
    topicName = 'chemical concepts';
    category = 'chemistry';
  } else if (/biological|biology|cell|organism|species|evolution|genetic/i.test(lowerText)) {
    topicName = 'biological concepts';
    category = 'biology';
  } else if (/historical|history|event|period|century|war|revolution/i.test(lowerText)) {
    topicName = 'historical concepts';
    category = 'history';
  } else if (/literary|literature|author|book|poem|novel|writing/i.test(lowerText)) {
    topicName = 'literary concepts';
    category = 'literature';
  } else {
    // Fallback to complexity-based naming
    if (wordCount < 25) {
      topicName = 'fundamental concepts';
    } else if (wordCount < 50) {
      topicName = 'intermediate concepts';
    } else {
      topicName = 'advanced concepts';
    }
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
    category: category,
    keywords: [topicName.toLowerCase().replace(/\s+/g, '_')]
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
    
    topic.questionIndices.forEach(index => {
      const question = questions[index];
      const userAnswer = userAnswers[index];
      
      if (isAnswerCorrect(question, userAnswer)) {
        correctCount++;
      }
    });
    
    const accuracy = topic.totalCount > 0 ? Math.round((correctCount / topic.totalCount) * 100) : 0;
    
    return {
      ...topic,
      correctCount,
      accuracy,
      reason: getTopicReason(accuracy),
      suggestions: getTopicSuggestions(accuracy)
    };
  });
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
  
  if (weakTopics.length > 0) {
    recommendations.push(`Focus on reviewing ${weakTopics.map(t => t.name).join(', ')}`);
  }
  
  if (strongTopics.length > 0) {
    recommendations.push(`Build on your strengths in ${strongTopics.map(t => t.name).join(', ')}`);
  }
  
  recommendations.push("Use the AI Flashcards tool to create study materials for difficult topics");
  recommendations.push("Take practice tests regularly to track your progress");
  recommendations.push("Review incorrect answers to understand your mistakes");
  recommendations.push("Create a study schedule focusing on your weakest areas");
  
  return recommendations;
};
