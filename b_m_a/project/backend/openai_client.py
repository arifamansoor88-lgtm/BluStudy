import os
from dotenv import load_dotenv
from openai import AzureOpenAI
from typing import List, Optional, Union, Dict, Any

load_dotenv()

# Create the Azure OpenAI client
client = AzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_API_KEY"),
    api_version="2024-05-01-preview"
)

DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_DEPLOYMENT_NAME")

def generate_quiz(
    text: str, 
    num_questions: int = 10, 
    focus_topics: str = "", 
    question_formats: List[str] = ["multiple_choice", "multi_select", "drag_and_drop"]
):
    # Format the question types instruction based on selected formats
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
    
    # Add focus topics instruction if provided
    focus_instruction = ""
    if focus_topics:
        focus_instruction = f"\n\n# Focus Areas:\nPay special attention to these topics: {focus_topics}"
    
    # Create the system prompt with customized instructions
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

    # Add example formats for each selected question type
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
    
    # Remove the trailing comma and close the JSON structure
    system_prompt = system_prompt.rstrip(",") + """
  ]
}

### Field Explanation:
- **quiz_title**: A concise, topic-relevant title for the quiz, inferred from the provided text.  
- **type**: Denotes the question type ("multiple_choice", "multi_select", "drag_and_drop", "short_answer", "fill_in_blank").  
- **question**: The main question or task.  
- **options**: For multiple-choice and multi-select questions, a list of answer options.  
- **correct_answer**: The correct choice for "multiple_choice" questions (a single string).  
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

    response = client.chat.completions.create(
        model=DEPLOYMENT_NAME,
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
):
    """
    Generate an explanation for why the user's answer is correct or incorrect
    
    Args:
        question: The question object with all its details
        user_answer: The answer provided by the user
        is_correct: Whether the user's answer is correct
    
    Returns:
        A string containing the AI-generated explanation
    """
    # Format the question and answer information
    question_type = question.get("type", "unknown")
    question_text = question.get("question", "")
    
    # Format correct answer(s) based on question type
    if question_type == "multiple_choice":
        correct_answer = question.get("correct_answer", "")
        options = question.get("options", [])
        correct_answer_info = f"The correct answer is: {correct_answer}"
    elif question_type == "multi_select":
        correct_answers = question.get("correct_answers", [])
        options = question.get("options", [])
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
    
    # Format user's answer based on question type
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
    
    # Create the system prompt
    system_prompt = f"""You are an educational AI tutor providing explanations for quiz answers.
Provide a clear, helpful explanation for why the user's answer to a quiz question is {("correct" if is_correct else "incorrect")}.

Be educational, supportive, and concise in your explanation. If the answer is incorrect, point out what the user may have misunderstood.
Focus on explaining the underlying concept and why the correct answer is right.

FORMAT YOUR RESPONSE USING MARKDOWN:
- Use **bold** for important concepts or terms
- Use bullet points or numbered lists where appropriate
- Use mathematical notation with proper markdown formatting when relevant
- Organize your explanation with clear structure

Aim for 3-5 sentences that are helpful for learning but not overly verbose.
"""

    # Create the user message with all relevant information
    user_message = f"""
Question: {question_text}
Question Type: {question_type}
{user_answer_formatted}
{correct_answer_info}
Is Correct: {is_correct}

Please explain why this answer is {("correct" if is_correct else "incorrect")}.
Use markdown formatting in your explanation for better readability.
"""

    # Call the API
    response = client.chat.completions.create(
        model=DEPLOYMENT_NAME,
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
    Evaluate a short answer or fill-in-blank response using OpenAI
    
    Args:
        question: The question object with all its details including correct answer(s)
        user_answer: The answer provided by the user
        
    Returns:
        Dictionary with evaluation result: {"is_correct": bool, "explanation": str}
    """
    question_type = question.get("type", "unknown")
    question_text = question.get("question", "")
    correct_answer = question.get("correct_answer", "")
    acceptable_answers = question.get("acceptable_answers", [])
    
    # Create a formatted string of correct answers
    correct_answer_text = correct_answer
    if acceptable_answers and len(acceptable_answers) > 0:
        correct_answer_text += f" (Acceptable alternatives: {', '.join(acceptable_answers)})"
    
    # Create the system prompt
    system_prompt = """You are an educational assessment AI that evaluates student answers.
Your task is to determine if a student's response to a short answer or fill-in-blank question is semantically correct.

Consider the following guidelines:
1. Focus on the meaning/concept rather than exact wording
2. Ignore minor spelling errors if the intent is clear
3. Ignore capitalization and punctuation differences
4. Accept synonyms or equivalent phrases
5. For numerical answers, consider if different formats are semantically equivalent
6. Respond with ONLY "correct" or "incorrect" without any explanation
"""

    # Create the user message with question and answer information
    user_message = f"""
Question: {question_text}
Question Type: {question_type}
Correct Answer(s): {correct_answer_text}
Student's Answer: {user_answer}

Is the student's answer semantically correct? Respond with ONLY "correct" or "incorrect".
"""

    # Call the API
    response = client.chat.completions.create(
        model=DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        max_tokens=10  # Keep response small since we only need "correct" or "incorrect"
    )
    
    # Get the result and determine if it's correct
    result = response.choices[0].message.content.strip().lower()
    is_correct = result == "correct"
    
    return {
        "is_correct": is_correct,
        "ai_response": result
    }

