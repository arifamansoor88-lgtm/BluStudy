import os
from dotenv import load_dotenv
from openai import AzureOpenAI
from typing import List, Optional, Union, Dict, Any

# Load environment variables from .env file
load_dotenv()

# ---------------------------
# Summarization Client & Function
# ---------------------------
summarizer_client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_API_KEY"),
    api_version="2024-05-01-preview"
)
SUMMARIZER_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_DEPLOYMENT_NAME")

def summarize_text(text: str, style: str = "high", format: str = "bullet") -> str:
    """
    Clean, stable, UI-friendly summarizer for Azure OpenAI.
    Supports:
      style: "high" or "detailed"
      format: "bullet", "key", "qa"
    """

    # System prompt (merged from both versions)
    system_prompts = {
        "high": (
            "You are a summarization assistant. Produce a concise, clean summary. "
            "Do NOT use markdown, symbols, or decorative formatting."
        ),
        "detailed": (
            "You are a summarization assistant. Produce a detailed summary with clear structure. "
            "Do NOT use markdown, symbols, or decorative formatting."
        )
    }

    system_msg = system_prompts.get(style, system_prompts["high"])

    # Format instructions (simplified from their version)
    if format == "bullet":
        user_msg = (
            "Summarize the text using simple bullet-style lines. "
            "Each line should start with '- '. "
            "No markdown, no headings, no nested bullets.\n\n"
            f"Text:\n{text}"
        )
    elif format == "key":
        user_msg = (
            "Extract only the essential key points as numbered sentences. "
            "No markdown or special formatting.\n\n"
            f"Text:\n{text}"
        )
    elif format == "qa":
        user_msg = (
            "Generate study-style Q&A pairs based on the most important ideas. "
            "Label them with 'Q:' and 'A:'. No markdown symbols.\n\n"
            f"Text:\n{text}"
        )
    else:
        user_msg = f"Summarize the text:\n{text}"

    # Token length (from their version)
    max_tokens = 350 if style == "high" else 900

    try:
        response = summarizer_client.chat.completions.create(
            model=SUMMARIZER_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=max_tokens,
            temperature=0.3,
        )

        raw = response.choices[0].message.content.strip()

        # Clean output
        cleaned = (
            raw.replace("**", "")
               .replace("#", "")
               .replace("\t", " ")
               .replace("\r", " ")
               .strip()
        )

        return cleaned

    except Exception as e:
        print("Azure summarization error:", str(e))
        raise Exception("Azure summarization error: " + str(e))


    

# ---------------------------
# Flashcard Client & Function
# ---------------------------
flashcard_client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_API_KEY"),
    api_version="2024-05-01-preview"
)
FLASHCARD_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_DEPLOYMENT_NAME")

def generate_flashcard(text: str,
                       num_flashcards: int = 10) -> str:
    """
   Generates Flashcards based on inputted text
    
    Args:
        text (str): The text to summarize.
        num_flashcards: The number of flashcarrds to generate
        
    Returns:
        str: JSON Flashcards
    """
    try:
        response = flashcard_client.chat.completions.create(
            model=SUMMARIZER_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a helpful AI that creates concise flashcards from educational content."},
                {"role": "user", "content": f""""
                    You are a flashcard generator for study purposes. Given the following educational text, extract {num_flashcards} key concepts or facts and convert them into flashcards. Each flashcard should consist of a concise question and a short, clear answer. Do not include explanations or extra formatting.

                    ---

                    # Output Format (as JSON array):
                    {{
                        "title": "...",
                        "cards": [
                            {{
                                "question": "...",
                                "answer": "...",
                                "difficulty": "...",
                                "important": false
                            }}
                        ]
                    }}

                    Only return valid JSON. Do not explain or include any extra text.

                    Make sure the questions are varied and focus on important points from the content.

                    ---

                    Text:
                    {text}
                """}
            ],
            max_tokens=600,
            temperature=0.5
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error while calling Azure OpenAI for flashcard generatiohn: {str(e)}")
        raise Exception(f"Azure OpenAI generation request failed: {str(e)}")


# ---------------------------
# Quiz and Study Plan Client & Functions
# ---------------------------
quiz_client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_API_KEY"),
    api_version="2024-05-01-preview"
)
QUIZ_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_DEPLOYMENT_NAME")

def generate_quiz(
    text: str, 
    num_questions: int = 10, 
    focus_topics: str = "", 
    question_formats: List[str] = ["multiple_choice", "multi_select", "drag_and_drop"]
) -> str:
    # Build instructions for question types
    question_types_instruction = ""
    if "multiple_choice" in question_formats:
        question_types_instruction += "\n  - **Multiple-choice (single correct answer).**"
    if "multi_select" in question_formats:
        question_types_instruction += "\n  - **Multi-select (more than one correct answer).**"
    if "drag_and_drop" in question_formats:
        question_types_instruction += "\n  - **Drag-and-drop** (e.g., matching terms to definitions, ordering events, categorizing items)."
    if "short_answer" in question_formats:
        question_types_instruction += "\n  - **Short-answer** (brief text responses to specific questions)."
    if "fill_in_blank" in question_formats:
        question_types_instruction += "\n  - **Fill-in-the-blank** (sentences with missing words to be completed)."
    
    focus_instruction = f"\n\n# Focus Areas:\nPay special attention to these topics: {focus_topics}" if focus_topics else ""
    
    system_prompt = f"""You are an AI quiz generator that creates quizzes based on input text containing a specific topic. The quiz will consist of {num_questions} questions using the following question types: {', '.join(question_formats)}. The output should be a structured JSON object.{focus_instruction}

---

# Steps:
- Analyze the input text to extract key pieces of knowledge, concepts, or important details.
- Generate a variety of question types based on the extracted information:{question_types_instruction}
- Ensure questions are clear, relevant to the input text, and appropriately varied in difficulty.
- Generate exactly {num_questions} questions, balancing the different question types proportionally.
- Provide correct answers and explanation details (if relevant) for all question types.

---

# Output Format:

Return a JSON object structured as follows:

{{
  "quiz_title": "[Generated Quiz Title Based on the Topic]",
  "questions": ["""

    if "multiple_choice" in question_formats:
        system_prompt += """
    {
      "type": "multiple_choice",
      "question": "[Insert multiple-choice question here]",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct_answer": "Option X"
    },"""
    
    if "multi_select" in question_formats:
        system_prompt += """
    {
      "type": "multi_select",
      "question": "[Insert multi-select question here]",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct_answers": ["Option X", "Option Y"]
    },"""
    
    if "drag_and_drop" in question_formats:
        system_prompt += """
    {
      "type": "drag_and_drop",
      "question": "[Insert drag-and-drop question here]",
      "prompts": ["Prompt 1", "Prompt 2", "Prompt 3"],
      "targets": ["Target 1", "Target 2", "Target 3"],
      "correct_mapping": {
        "Prompt 1": "Target X",
        "Prompt 2": "Target Y",
        "Prompt 3": "Target Z"
      }
    },"""
    
    if "short_answer" in question_formats:
        system_prompt += """
    {
      "type": "short_answer",
      "question": "[Insert short-answer question here]",
      "correct_answer": "The expected correct answer",
      "acceptable_answers": ["Alternative 1", "Alternative 2"]
    },"""
    
    if "fill_in_blank" in question_formats:
        system_prompt += """
    {
      "type": "fill_in_blank",
      "question": "This is a sentence with a [BLANK] to be filled in.",
      "correct_answer": "word",
      "acceptable_answers": ["term", "phrase"]
    },"""
    
    # Remove the trailing comma and close JSON structure
    system_prompt = system_prompt.rstrip(",") + """
  ]
}

### Field Explanation:
- **quiz_title**: A concise, topic-relevant title for the quiz, inferred from the provided text.
- **type**: Denotes the question type ("multiple_choice", "multi_select", "drag_and_drop", "short_answer", "fill_in_blank").
- **question**: The main question or task.
- **options**: For multiple-choice and multi-select questions, a list of answer options.
- **correct_answer**: The correct choice for "multiple_choice" questions.
- **correct_answers**: A list of all correct answers for "multi_select".
- **prompts**: In drag-and-drop, the items the user will drag.
- **targets**: In drag-and-drop, the drop zones or categories where items belong.
- **correct_mapping**: A dictionary showing the correct drag-and-drop pairings.
- **acceptable_answers**: For "short_answer" and "fill_in_blank", a list of alternative correct answers.

---

# Notes:
- Focus on generating questions that reflect critical concepts from the given text.
- Ensure clarity and correctness in both questions and answers.
- Proportionately balance the mix of question types across the quiz.
- Avoid ambiguity in "correct_answer" or "correct_answers" fields by making answers explicit.
This structured format will maintain consistency and ensure the generated quizzes are high-quality and easily parsable."""
    
    response = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate a quiz from the following text:\n\n{text}"}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content

def generate_answer_explanation(
    question: dict,
    user_answer,
    is_correct: bool
) -> str:
    """
    Generate an explanation for why the user's answer is correct or incorrect.
    
    Args:
        question (dict): The question object with all its details.
        user_answer: The answer provided by the user.
        is_correct (bool): Whether the user's answer is correct.
    
    Returns:
        str: The AI-generated explanation with topics to review.
    """
    question_type = question.get("type", "unknown")
    question_text = question.get("question", "")
    
    if question_type == "multiple_choice":
        correct_answer = question.get("correct_answer", "")
        correct_answer_info = f"The correct answer is: {correct_answer}"
    elif question_type == "multi_select":
        correct_answers = question.get("correct_answers", [])
        correct_answer_info = f"The correct answers are: {', '.join(correct_answers)}"
    elif question_type == "drag_and_drop":
        correct_mapping = question.get("correct_mapping", {})
        correct_answer_info = "The correct mappings are: " + ", ".join([f"{k} → {v}" for k, v in correct_mapping.items()])
    elif question_type in ["short_answer", "fill_in_blank"]:
        correct_answer = question.get("correct_answer", "")
        acceptable_answers = question.get("acceptable_answers", [])
        if acceptable_answers:
            correct_answer_info = f"The correct answer is: {correct_answer} (or alternatively: {', '.join(acceptable_answers)})"
        else:
            correct_answer_info = f"The correct answer is: {correct_answer}"
    else:
        correct_answer_info = "The correct answer information is not available."
    
    if question_type == "multiple_choice":
        user_answer_formatted = f"You selected: {user_answer}"
    elif question_type == "multi_select":
        if isinstance(user_answer, list):
            user_answer_formatted = f"You selected: {', '.join(user_answer)}"
        else:
            user_answer_formatted = f"You selected: {user_answer}"
    elif question_type == "drag_and_drop":
        if isinstance(user_answer, dict):
            user_answer_formatted = "Your mappings: " + ", ".join([f"{k} → {v}" for k, v in user_answer.items()])
        else:
            user_answer_formatted = f"Your answer: {user_answer}"
    else:
        user_answer_formatted = f"Your answer: {user_answer}"
    
    system_prompt = f"""You are an educational AI tutor providing comprehensive explanations for quiz answers.
Provide a clear, helpful explanation for why the user's answer to a quiz question is {("correct" if is_correct else "incorrect")}.

Your response should include:
1. **Explanation**: Why the answer is correct or incorrect
2. **Key Concepts**: Important terms and concepts related to this question
3. **Topics to Review**: Specific areas the student should focus on for improvement

FORMAT YOUR RESPONSE USING MARKDOWN:
- Use **bold** for important concepts or terms
- Use bullet points for lists
- Include a "📚 Topics to Review" section with specific, actionable items
- Be educational, supportive, and concise

Structure your response as:
**Explanation:**
[Your explanation here]

**Key Concepts:**
- [Concept 1]
- [Concept 2]

**📚 Topics to Review:**
- [Specific topic 1]
- [Specific topic 2]
- [Specific topic 3]

Aim for 4-6 sentences in the explanation section.
"""

    user_message = f"""
Question: {question_text}
Question Type: {question_type}
{user_answer_formatted}
{correct_answer_info}
Is Correct: {is_correct}

Please provide a comprehensive explanation with topics to review.
Use markdown formatting in your response.
"""

    response = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )
    return response.choices[0].message.content.strip()

def evaluate_short_answer(
    question: Dict[str, Any],
    user_answer: str
) -> Dict[str, Any]:
    """
    Evaluate a short answer or fill-in-blank response using OpenAI.
    
    Args:
        question (Dict[str, Any]): The question object with all its details.
        user_answer (str): The answer provided by the user.
        
    Returns:
        Dict[str, Any]: Evaluation result containing {"is_correct": bool, "ai_response": str}.
    """
    question_type = question.get("type", "unknown")
    question_text = question.get("question", "")
    correct_answer = question.get("correct_answer", "")
    acceptable_answers = question.get("acceptable_answers", [])
    
    correct_answer_text = correct_answer
    if acceptable_answers and len(acceptable_answers) > 0:
        correct_answer_text += f" (Acceptable alternatives: {', '.join(acceptable_answers)})"
    
    system_prompt = """You are an educational assessment AI that evaluates student answers.
Your task is to determine if a student's response to a short answer or fill-in-blank question is semantically correct.

Consider the following guidelines:
1. Focus on the meaning/concept rather than exact wording.
2. Ignore minor spelling errors if the intent is clear.
3. Ignore capitalization and punctuation differences.
4. Accept synonyms or equivalent phrases.
5. For numerical answers, consider if different formats are semantically equivalent.
Respond with ONLY "correct" or "incorrect" without any explanation.
"""
    user_message = f"""
Question: {question_text}
Question Type: {question_type}
Correct Answer(s): {correct_answer_text}
Student's Answer: {user_answer}

Is the student's answer semantically correct? Respond with ONLY "correct" or "incorrect".
"""
    response = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        max_tokens=10
    )
    result = response.choices[0].message.content.strip().lower()
    is_correct = result == "correct"
    return {
        "is_correct": is_correct,
        "ai_response": result
    }

def generate_study_plan(
    text: str, 
    title: str, 
    tags: List[str] = None, 
    duration_info: dict = None
) -> str:
    """
    Generate a personalized study plan based on the provided content.
    
    Args:
        text (str): The text content extracted from uploaded materials.
        title (str): The title/name of the study plan.
        tags (List[str], optional): List of tags associated with the study plan.
        duration_info (dict, optional): Dictionary with duration and unit info.
        
    Returns:
        str: A JSON string representing the study plan.
    """
    tag_info = f"\nThis study plan is tagged with: {', '.join(tags)}" if tags and len(tags) > 0 else ""
    
    duration_instruction = ""
    if duration_info and isinstance(duration_info, dict):
        duration_value = duration_info.get('duration')
        duration_unit = duration_info.get('unit')
        if duration_value and duration_unit:
            duration_instruction = f"\n\nIMPORTANT: Create a study plan that spans exactly {duration_value} {duration_unit}. The weekly_schedule should cover this exact duration, not more or less."
    
    system_prompt = f"""You are an AI education specialist that creates personalized study plans based on educational content. Your task is to analyze the provided content and create a comprehensive, adaptive study plan titled "{title}".{tag_info}{duration_instruction}

---

# Study Plan Requirements:
- Create a structured study plan with daily and weekly goals.
- Include specific topics from the provided content.
- Organize content by difficulty and importance.
- Create a recommended schedule that is sustainable and effective.
- Recommend specific study techniques for different types of content.
- Include references to learning tools available in the application (flashcards, practice quizzes, AI summarizer).

---

# Output Format:

Return a JSON object structured as follows:

{{
  "title": "{title}",
  "description": "A brief description of this study plan",
  "duration": "Recommended duration (e.g., 4 weeks)",
  "overview": "High-level overview of what this plan covers",
  "weekly_schedule": [
    {{
      "week": 1,
      "theme": "Title of this week's focus",
      "description": "Short description of week's goals",
      "days": [
        {{
          "day": 1,
          "topics": [
            {{
              "title": "Topic title",
              "description": "Brief description",
              "activities": [
                {{
                  "type": "reading",
                  "description": "Specific reading assignment",
                  "duration": "30 minutes",
                  "priority": "high",
                  "completed": false
                }},
                {{
                  "type": "tool",
                  "tool": "flashcards",
                  "description": "Create flashcards on key terms",
                  "duration": "20 minutes",
                  "priority": "medium",
                  "completed": false
                }}
              ]
            }}
          ]
        }}
      ],
      "weekly_goals": [
        "Goal 1",
        "Goal 2"
      ],
      "assessment": "Suggested method to assess progress at week's end"
    }}
  ],
  "study_techniques": [
    {{
      "technique": "Name of study technique",
      "description": "How to apply this technique",
      "best_for": "Types of content this works best for"
    }}
  ],
  "resources": [
    {{
      "title": "Resource title",
      "type": "article/video/tool",
      "description": "Why this resource is helpful"
    }}
  ]
}}

Note: The 'weekly_schedule' should be detailed enough to guide the student through each day, but flexible enough to adapt to different learning paces. The 'completed' field for activities will initially be false.
When suggesting application tools, reference the following:
- Flashcard Generator (for memorization)
- Practice Test Generator (for assessment)
- Voice Notes (for audio learning)
- Mind Maps (for visual organization)
- AI Summarizer (for condensing key information)

Create a comprehensive plan that identifies key concepts, organizes them logically, and creates a realistic study timeline.
"""
    response = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate a study plan from the following content:\n\n{text}"}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content

def update_study_plan(original_plan: dict, quiz_results: List[dict], text: str = "") -> str:
    """
    Update an existing study plan based on quiz performance data.
    
    Args:
        original_plan (dict): The original study plan to update.
        quiz_results (List[dict]): List of quiz attempt data showing performance.
        text (str, optional): Additional text content.
        
    Returns:
        str: A JSON string representing the updated study plan.
    """
    import json
    original_plan_json = json.dumps(original_plan)
    quiz_results_json = json.dumps(quiz_results)
    
    system_prompt = """You are an AI education specialist that updates personalized study plans based on student performance data. Your task is to analyze the provided quiz results and original study plan, then create an improved, adaptive updated study plan.

---

# Your task:
- Analyze the quiz results to identify strengths and weaknesses.
- Modify the original study plan to address weak areas.
- Add additional practice for topics with low scores.
- Reinforce successful areas with advanced content.
- Adjust time allocations based on performance.
- Keep the same basic structure but with targeted improvements.
- Add specific recommendations based on performance patterns.

---

# Output Format:

Return a complete updated JSON study plan that follows the same structure as the original plan, but with modifications to address the student's needs based on quiz results. Add a new 'performance_analysis' field at the top level with:

{
  "performance_analysis": {
    "strengths": ["Topic 1", "Topic 2"],
    "areas_for_improvement": ["Topic 3", "Topic 4"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  },
  // Rest of the original study plan structure with updates
}

The updated plan should specifically address weak areas identified in the quiz results while maintaining all other aspects of the original plan. Update the description to indicate this is a revised plan based on performance data.
When suggesting tools, continue to reference:
- Flashcard Generator
- Practice Test Generator
- Voice Notes
- Mind Maps
- AI Summarizer

Create a targeted plan that addresses specific weaknesses while building on the student's strengths."""
    
    response = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Original study plan:\n{original_plan_json}\n\nQuiz results:\n{quiz_results_json}\n\nAdditional content (if any):\n{text}"}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content

async def analyze_quiz_performance(
    questions: List[Dict[str, Any]], 
    user_answers: List[Any], 
    quiz_metadata: Dict[str, Any] = {}
) -> Dict[str, Any]:
    """
    Analyze quiz performance and extract topics using Azure OpenAI GPT model.
    
    Args:
        questions (List[Dict[str, Any]]): List of quiz questions with their content and answers.
        user_answers (List[Any]): List of user answers corresponding to each question.
        quiz_metadata (Dict[str, Any]): Additional metadata about the quiz.
        
    Returns:
        Dict[str, Any]: Analysis results including topics, performance breakdown, and recommendations.
    """
    try:
        # Prepare the quiz data for analysis
        quiz_data = []
        for i, (question, user_answer) in enumerate(zip(questions, user_answers)):
            # Determine if the answer is correct
            is_correct = False
            if question.get("type") == "multiple_choice":
                is_correct = user_answer == question.get("correct_answer")
            elif question.get("type") == "multi_select":
                is_correct = set(user_answer or []) == set(question.get("correct_answers", []))
            elif question.get("type") == "drag_and_drop":
                is_correct = user_answer == question.get("correct_mapping")
            elif question.get("type") in ["short_answer", "fill_in_blank"]:
                correct_answer = question.get("correct_answer")
                acceptable_answers = question.get("acceptable_answers", [])
                is_correct = user_answer == correct_answer or user_answer in acceptable_answers
            
            quiz_data.append({
                "question_number": i + 1,
                "question_text": question.get("question", ""),
                "question_type": question.get("type", ""),
                "user_answer": user_answer,
                "correct_answer": question.get("correct_answer") or question.get("correct_answers") or question.get("correct_mapping"),
                "is_correct": is_correct
            })
        
        system_prompt = """You are an AI educational analyst that provides comprehensive performance analysis for quiz results. Your goal is to help students understand their strengths and weaknesses and provide actionable recommendations for improvement.

# Analysis Requirements:
1. **Topic Extraction**: Identify the main topics and subtopics covered in the quiz questions
2. **Performance Analysis**: Analyze performance by topic, question type, and difficulty level
3. **Strengths and Weaknesses**: Identify areas of strength and areas needing improvement
4. **Recommendations**: Provide specific, actionable study recommendations

# Output Format:
Return a JSON object with the following structure:

{
  "topics": [
    {
      "name": "Topic name",
      "questionIndices": [1, 3, 5],
      "correctCount": 2,
      "totalCount": 3,
      "accuracy": 67,
      "difficulty": "intermediate",
      "category": "subject_area",
      "keywords": ["keyword1", "keyword2"],
      "reason": "Explanation of performance",
      "suggestions": ["suggestion1", "suggestion2"]
    }
  ],
  "weakTopics": [
    // Topics with accuracy < 70%
  ],
  "strongTopics": [
    // Topics with accuracy >= 80%
  ],
  "recommendations": [
    "Specific study recommendation 1",
    "Specific study recommendation 2"
  ],
  "overallAnalysis": {
    "totalQuestions": 10,
    "correctAnswers": 7,
    "overallAccuracy": 70,
    "performanceLevel": "Fair",
    "keyInsights": ["insight1", "insight2"],
    "studyPriorities": ["priority1", "priority2"]
  }
}

# Guidelines:
- Extract meaningful topics from question content (e.g., "Algebra Fundamentals", "Chemical Reactions", "Historical Events")
- Provide specific, actionable recommendations
- Consider question difficulty and type in your analysis
- Focus on helping the student improve their weakest areas
- Suggest connections to other study tools (flashcards, practice tests, etc.)"""

        user_prompt = f"""Quiz Metadata:
{quiz_metadata}

Quiz Performance Data:
{quiz_data}

Please provide a comprehensive analysis of this quiz performance, including topic extraction, performance breakdown, and specific recommendations for improvement."""

        response = quiz_client.chat.completions.create(
            model=QUIZ_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=3000,
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        # Parse the JSON response
        import json
        analysis_result = json.loads(response.choices[0].message.content.strip())
        
        return analysis_result
        
    except Exception as e:
        print(f"Error while calling Azure OpenAI for quiz performance analysis: {str(e)}")
        # Return a fallback analysis if AI analysis fails
        return create_fallback_analysis(questions, user_answers, quiz_metadata)

def create_fallback_analysis(
    questions: List[Dict[str, Any]], 
    user_answers: List[Any], 
    quiz_metadata: Dict[str, Any] = {}
) -> Dict[str, Any]:
    """
    Create a basic fallback analysis when AI analysis fails.
    
    Args:
        questions (List[Dict[str, Any]]): List of quiz questions.
        user_answers (List[Any]): List of user answers.
        quiz_metadata (Dict[str, Any]): Quiz metadata.
        
    Returns:
        Dict[str, Any]: Basic analysis results.
    """
    # Calculate basic statistics
    total_questions = len(questions)
    correct_answers = 0
    
    for i, (question, user_answer) in enumerate(zip(questions, user_answers)):
        if question.get("type") == "multiple_choice":
            if user_answer == question.get("correct_answer"):
                correct_answers += 1
        elif question.get("type") == "multi_select":
            if set(user_answer or []) == set(question.get("correct_answers", [])):
                correct_answers += 1
        elif question.get("type") == "drag_and_drop":
            if user_answer == question.get("correct_mapping"):
                correct_answers += 1
        elif question.get("type") in ["short_answer", "fill_in_blank"]:
            correct_answer = question.get("correct_answer")
            acceptable_answers = question.get("acceptable_answers", [])
            if user_answer == correct_answer or user_answer in acceptable_answers:
                correct_answers += 1
    
    overall_accuracy = round((correct_answers / total_questions) * 100) if total_questions > 0 else 0
    
    # Create basic topic analysis
    topics = [{
        "name": "General Concepts",
        "questionIndices": list(range(total_questions)),
        "correctCount": correct_answers,
        "totalCount": total_questions,
        "accuracy": overall_accuracy,
        "difficulty": "mixed",
        "category": "general",
        "keywords": ["concepts", "understanding"],
        "reason": f"Overall performance: {overall_accuracy}% accuracy",
        "suggestions": ["Review all questions", "Focus on incorrect answers", "Practice similar questions"]
    }]
    
    weak_topics = topics if overall_accuracy < 70 else []
    strong_topics = topics if overall_accuracy >= 80 else []
    
    recommendations = [
        "Review all incorrect answers to understand your mistakes",
        "Use the AI Flashcards tool to create study materials",
        "Take more practice tests to improve your skills",
        "Focus on areas where you made the most mistakes"
    ]
    
    if overall_accuracy < 70:
        recommendations.append("Consider seeking additional help or tutoring")
    elif overall_accuracy >= 80:
        recommendations.append("Challenge yourself with more difficult questions")
    
    return {
        "topics": topics,
        "weakTopics": weak_topics,
        "strongTopics": strong_topics,
        "recommendations": recommendations,
        "overallAnalysis": {
            "totalQuestions": total_questions,
            "correctAnswers": correct_answers,
            "overallAccuracy": overall_accuracy,
            "performanceLevel": "Excellent" if overall_accuracy >= 90 else "Good" if overall_accuracy >= 80 else "Fair" if overall_accuracy >= 70 else "Needs Improvement",
            "keyInsights": [f"Scored {correct_answers} out of {total_questions} questions correctly"],
            "studyPriorities": ["Review incorrect answers", "Practice weak areas"]
        }
    }
