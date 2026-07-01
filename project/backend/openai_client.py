import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from typing import List, Optional, Union, Dict, Any

# Load environment variables from .env file
load_dotenv()

# Single shared OpenAI client
_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "gpt-4o-mini"

# Aliases so existing call sites don't need to change
summarizer_client = _client
flashcard_client = _client
quiz_client = _client
SUMMARIZER_DEPLOYMENT_NAME = MODEL
FLASHCARD_DEPLOYMENT_NAME = MODEL
QUIZ_DEPLOYMENT_NAME = MODEL

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
        print("Summarization error:", str(e))
        raise Exception("Summarization error: " + str(e))


    

# ---------------------------
# Flashcard Client & Function
# ---------------------------

def generate_flashcard(text: str, num_flashcards: int = 10) -> str:
    """
    Generates a flashcard deck from text.
    Returns STRICT JSON ONLY.
    """
    try:
        # Larger decks need a larger output budget or the JSON gets truncated.
        max_output_tokens = min(9000, max(1200, num_flashcards * 90))

        response = flashcard_client.chat.completions.create(
            model=FLASHCARD_DEPLOYMENT_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a flashcard deck generator.\n"
                        "CRITICAL RULES:\n"
                        "- Output ONLY valid JSON\n"
                        "- NO markdown\n"
                        "- NO backticks\n"
                        "- NO explanations\n"
                        "- NO extra text\n"
                        "- Keep each question and answer concise\n"
                        "- Return exactly the requested number of cards, never more and never less\n"
                        "- Follow the schema EXACTLY\n\n"
                        "If you violate these rules, the response is invalid."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Generate a flashcard deck with exactly {num_flashcards} cards "
                        "from the following document.\n\n"
                        "JSON schema (must match exactly):\n"
                        "{\n"
                        '  "title": "Short descriptive title",\n'
                        '  "cards": [\n'
                        "    {\n"
                        '      "question": "Question",\n'
                        '      "answer": "Answer",\n'
                        '      "difficulty": "easy|medium|hard",\n'
                        '      "important": false\n'
                        "    }\n"
                        "  ]\n"
                        "}\n\n"
                        "Keep every card brief and study-friendly.\n"
                        "Return exactly the requested number of cards. Do not include extra cards.\n"
                        "Use ONLY the provided text. Do not use prior knowledge.\n\n"
                        "Document text:\n"
                        "<<<\n"
                        f"{text}\n"
                        ">>>"
                    ),
                },
            ],
            temperature=0.3,
            max_tokens=max_output_tokens,
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"OpenAI flashcard generation error: {str(e)}")
        raise Exception(f"OpenAI generation request failed: {str(e)}")



# ---------------------------
# Quiz and Study Plan Client & Functions
# ---------------------------

def generate_quiz(
    text: str, 
    num_questions: int = 10, 
    focus_topics: str = "", 
    question_formats: List[str] = ["multiple_choice", "multi_select", "drag_and_drop"],
    subject_category: str = "conceptual"
) -> str:
    # Build instructions for question types
    question_types_instruction = ""
    if "multiple_choice" in question_formats:
        question_types_instruction += "\n  - **Multiple-choice (single correct answer).**"
    if "multi_select" in question_formats:
        question_types_instruction += "\n  - **Multi-select (more than one correct answer).** CRITICAL: `correct_answers` MUST include EVERY option that is genuinely valid. The distractor options must be clearly and factually incorrect — never include an option that could plausibly be considered correct while leaving it out of `correct_answers`. Phrase the question so there is no ambiguity about which options belong in the correct set."
    if "drag_and_drop" in question_formats:
        question_types_instruction += "\n  - **Drag-and-drop** (e.g., matching terms to definitions, ordering events, categorizing items)."
    if "short_answer" in question_formats:
        question_types_instruction += "\n  - **Short-answer** (brief text responses). Use this type for: any answer with multiple values (e.g. two roots, a coordinate pair, a set), any answer that is inherently text (e.g. a method name, a formula). CRITICAL: Store `correct_answer` and `acceptable_answers` as PLAIN TEXT without $ LaTeX delimiters — write 'y = 2x - 3' not '$y = 2x - 3$'. Use regular ASCII hyphens not Unicode minus signs. `acceptable_answers` MUST be exhaustive — include full forms, abbreviations, alternate spellings, with/without spaces around operators. Examples: 'y-intercept' → also include 'y-int', 'y intercept'; 'y = 2x - 3' → also 'y=2x-3', '2x-3'."
    if "fill_in_blank" in question_formats:
        question_types_instruction += "\n  - **Fill-in-the-blank** (sentences with missing words). Use [BLANK] as the placeholder. `acceptable_answers` must cover all valid spellings/phrasings."
    if "numerical" in question_formats:
        question_types_instruction += "\n  - **Numerical** (exactly ONE numeric value with optional units — e.g. a speed, a mass, a time, a single root). Fields: `correct_answer_value` (a number), `units` (the unit string, or omit if truly dimensionless — do NOT set units to 'unitless', 'none', or 'N/A'). NEVER use numerical for: multiple roots, intercepts, coordinates, sets of values, or any problem where the student must give more than one number — use short_answer instead."
    
    focus_instruction = f"\n\n# Focus Areas:\nPay special attention to these topics: {focus_topics}" if focus_topics else ""
    
    system_prompt = f"""You are an AI quiz generator that creates quizzes based on input text containing a specific topic.

IMPORTANT FORMATTING RULES FOR MATHEMATICS:
- Any mathematical expression MUST be written using LaTeX.
- Do NOT write raw math like x^2 or sin(x). Always wrap math using $...$.
- Use LaTeX functions like \\sin, \\cos, \\ln, \\sqrt.
- Use ^ for powers.
- Because the response is JSON, every LaTeX backslash MUST be double-escaped inside strings.
- Write \\\\frac{{1}}{{x}}, \\\\ln(x), \\\\sin(x), \\\\cos(x), \\\\sqrt{{x}} inside JSON values, never \\\\frac{{1}}{{x}} or \\\\ln(x) with single backslashes.
- Prefer \\\\ln(x), \\\\sin(x), \\\\cos(x) instead of \\\\text{{ln}}(x), \\\\text{{sin}}(x), \\\\text{{cos}}(x).
- Always use braces with square roots: write \\\\sqrt{{x}}, never sqrtx or \\\\sqrtx.
- Use e^x, not \\\\text{{e}}^x.

Examples:
x squared → $x^2$
sin(x) → $\\sin(x)$
ln(x) → $\\ln(x)$
square root of x → $\\sqrt{{x}}$
absolute value → $|x|$

The quiz will consist of {num_questions} questions using the following question types: {', '.join(question_formats)}. The output should be a structured JSON object.{focus_instruction}

---

# Steps:
- Analyze the input text to extract key pieces of knowledge, concepts, or important details.
- Generate a variety of question types based on the extracted information:{question_types_instruction}
- Ensure questions are clear, relevant to the input text, and appropriately varied in difficulty.
- Generate exactly {num_questions} questions, balancing the different question types proportionally.
- Provide correct answers and explanation details (if relevant) for all question types.
"""

    if subject_category == "quantitative":
        system_prompt += """
# CRITICAL — Quantitative Subject Instructions:
This quiz is for a QUANTITATIVE/STEM subject (math, physics, chemistry, engineering, etc.).
You MUST follow these rules:

1. **Calculation-based questions:** At least 70% of questions MUST require actual numerical computation, not just concept recall. Present real problems with specific given values.
2. **Realistic values and units:** Always include concrete numbers with appropriate SI units (m, kg, s, N, J, m/s², etc.). Never ask "What is the formula for X?" — instead ask "Given [values], calculate X."
3. **Common-mistake distractors:** For multiple-choice options, derive wrong answers from typical student errors (sign errors, missing conversions, wrong formula, forgetting a step). Do NOT use obviously wrong or random numbers.
4. **Multi-step problems:** Include problems that require 2–3 steps to solve. State all necessary given information.
5. **Formulas as context, not answers:** If a formula is relevant, state it in the question stem. The answer should be the computed result, not the formula itself.
6. **Difficulty via complexity:** Easy = single-step plug-and-chug. Medium = two-step with unit conversion or rearrangement. Hard = multi-step, combining concepts, or requiring insight about which approach to use.
7. **Short answer / numerical type:** When generating short_answer or fill_in_blank questions, the correct_answer MUST be a specific number with units (e.g., "19.8 m/s", "4.9 m", "245 N"). Include acceptable_answers with common equivalent formats and reasonable rounding (e.g., ["19.8 m/s", "19.80 m/s", "≈20 m/s", "19.799 m/s"]).
8. **Drag-and-drop for process ordering:** Use drag_and_drop to test solution methodology — e.g., ordering steps of a derivation, matching variables to their meanings, or categorizing quantities as vectors vs scalars.
"""
        if "numerical" in question_formats:
            system_prompt += "\n**CRITICAL:** Since 'numerical' format is enabled, AT LEAST 50% of your questions MUST be of type 'numerical'.\n"
        
        system_prompt += """
Example of a GOOD quantitative multiple-choice question:
{
  "type": "multiple_choice",
  "question": "A 2.0 kg ball is dropped from rest at a height of 10 m. Ignoring air resistance, what is its speed just before hitting the ground? (g = 9.8 m/s²)",
  "options": ["14.0 m/s", "9.8 m/s", "19.6 m/s", "10.0 m/s"],
  "correct_answer": "14.0 m/s"
}

Example of a BAD question for this category (do NOT generate these):
{
  "type": "multiple_choice",
  "question": "What is the formula for kinetic energy?",
  "options": ["KE = mv", "KE = ½mv²", "KE = mgh", "KE = Fd"],
  "correct_answer": "KE = ½mv²"
}
"""

    elif subject_category == "mixed":
        system_prompt += """
# Mixed Subject Instructions:
Generate a balanced mix of:
- Conceptual/definitional questions (~40%) that test understanding of terms and principles
- Calculation-based questions (~40%) with specific numerical values requiring computation
- Application questions (~20%) that combine concept understanding with practical scenarios

For any calculation question, include concrete values with units. For conceptual questions, test deep understanding rather than surface-level recall.
"""

    system_prompt += """
---

# Output Format:

Return a JSON object structured as follows:

{
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

    if "numerical" in question_formats:
        system_prompt += """
    {
      "type": "numerical",
      "question": "[Full problem statement with all given values, conditions, and constants]",
      "correct_answer_value": 1.06,
      "tolerance": 0.05,
      "units": "m/s²",
      "acceptable_string_answers": ["1.06 m/s²", "1.1 m/s²"],
      "solution_steps": [
        "Step 1: [description with calculation]",
        "Step 2: [description with calculation]"
      ],
      "given_values": {
        "variable_name": "value with units"
      }
    },"""
    
    # Remove the trailing comma and close JSON structure
    system_prompt = system_prompt.rstrip(",") + """
  ]
}

### Field Explanation:
- **quiz_title**: A concise, topic-relevant title for the quiz, inferred from the provided text.
- **type**: Denotes the question type ("multiple_choice", "multi_select", "drag_and_drop", "short_answer", "fill_in_blank", "numerical").
- **question**: The main question or task.
- **options**: For multiple-choice and multi-select questions, a list of answer options.
- **correct_answer**: The correct choice for "multiple_choice" questions.
- **correct_answers**: A list of all correct answers for "multi_select".
- **prompts**: In drag-and-drop, the items the user will drag.
- **targets**: In drag-and-drop, the drop zones or categories where items belong.
- **correct_mapping**: A dictionary showing the correct drag-and-drop pairings.
- **acceptable_answers**: For "short_answer" and "fill_in_blank", a list of alternative correct answers.
- **correct_answer_value**: For "numerical", the exact numerical result (number only, no units).
- **tolerance**: For "numerical", absolute tolerance for grading (e.g., 0.05 means answers within ±0.05 of correct are accepted).
- **units**: For "numerical", the expected unit string for the answer.
- **solution_steps**: For "numerical", ordered array of solution steps, each showing the calculation performed.
- **given_values**: For "numerical", dictionary of variable names to their given values with units.
- **acceptable_string_answers**: For "numerical", alternative string representations of the correct answer for fallback matching.

---

# Notes:
- Focus on generating questions that reflect critical concepts from the given text.
- EVERY piece of mathematical notation — equations, formulas, variables, fractions, exponents, Greek letters, hints — MUST be wrapped in $...$ (inline) or $$...$$ (block). This applies everywhere in the JSON: question text, hints, options, correct_answer, solution_steps, etc. Never emit raw LaTeX commands (like \\left, \\frac, \\sqrt) outside of $ delimiters.
- When LaTeX is used in JSON strings, double-escape all backslashes (e.g. $\\frac{b}{2a}$ becomes $\\\\frac{b}{2a}$ in JSON).
- Ensure clarity and correctness in both questions and answers.
- Proportionately balance the mix of question types across the quiz.
- Avoid ambiguity in "correct_answer" or "correct_answers" fields by making answers explicit.
- For multi_select questions: before finalising, ask yourself "is every option I left out of correct_answers genuinely, unambiguously wrong?" If any option could be argued as correct, either add it to correct_answers or replace the option with a clearer distractor.
- For multiple_choice questions: NEVER include two options that are mathematically equivalent or just reorderings of each other (e.g. "-1, 5" and "5, -1" are the same set of roots — pick one canonical form for the correct answer and use clearly distinct wrong values as distractors).
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

def generate_harder_quiz(previous_questions: list, title: str, num_questions: int = 15) -> str:
    """Generate a harder quiz on the same topics as the previous quiz."""

    topic_sample = "\n".join(
        f"- {q.get('question', '')}" for q in previous_questions[:8]
    )

    system_prompt = f"""You are an AI quiz generator. A student has just scored 70%+ on the quiz titled "{title}".

The previous quiz covered questions like:
{topic_sample}

Your task: generate {num_questions} NEW questions on the SAME topic area but meaningfully HARDER.
Rules:
- Increase depth: require multi-step reasoning, application, or analysis — not just recall.
- Do NOT repeat any of the previous questions verbatim.
- Vary question types across: multiple_choice, multi_select, drag_and_drop, short_answer.
- For multiple_choice: NEVER include two options that are mathematically equivalent or reorderings of each other.
- Short_answer: store `correct_answer` and `acceptable_answers` as PLAIN TEXT without $ LaTeX delimiters. Use ASCII hyphens not Unicode minus. Set acceptable_answers to cover all valid phrasings, abbreviations, and operator-spacing variants.
- EVERY math expression in question text and options MUST be wrapped in $...$ (inline) or $$...$$ (block). Never emit raw LaTeX outside $ delimiters. Double-escape backslashes in JSON strings.

Return a JSON object in exactly this structure:
{{
  "quiz_title": "{title} — Advanced",
  "questions": [
    {{
      "type": "multiple_choice",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_answer": "..."
    }},
    {{
      "type": "multi_select",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_answers": ["...", "..."]
    }},
    {{
      "type": "drag_and_drop",
      "question": "...",
      "prompts": ["...", "..."],
      "options": ["...", "..."],
      "correct_mapping": {{"prompt": "answer"}}
    }},
    {{
      "type": "short_answer",
      "question": "...",
      "correct_answer": "...",
      "acceptable_answers": ["...", "..."]
    }}
  ]
}}"""

    response = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Generate the harder follow-up quiz now."}
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
    elif question_type == "numerical":
        correct_value = question.get("correct_answer_value", "")
        units = question.get("units", "")
        tolerance = question.get("tolerance", 0)
        solution_steps = question.get("solution_steps", [])
        correct_answer_info = f"The correct answer is: {correct_value} {units} (±{tolerance})"
        if solution_steps:
            correct_answer_info += "\nSolution steps:\n" + "\n".join(
                f"  {i+1}. {step}" for i, step in enumerate(solution_steps)
            )
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
    elif question_type == "numerical":
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

def evaluate_numerical_answer(
    question: Dict[str, Any],
    user_answer: str
) -> Dict[str, Any]:
    """
    Evaluate a numerical answer by having the AI independently solve the problem.
    Does NOT trust correct_answer_value — the AI recomputes the answer from the
    question text so that quiz-generation errors don't affect grading.
    """
    import json as _json

    question_text = question.get("question", "")
    units = question.get("units", "")

    system_prompt = (
        "You are a precise mathematical grader. "
        "Solve the given problem completely from scratch — do NOT rely on any stored correct answer. "
        "Then decide whether the student's answer is correct (allow small rounding differences). "
        "Return ONLY a JSON object with three keys:\n"
        '  "is_correct": true or false\n'
        '  "computed_answer": your computed value as a number\n'
        '  "explanation": one short sentence showing the key step\n'
        "No markdown, no extra text."
    )

    units_line = f"\nExpected units: {units}" if units else ""
    user_message = (
        f"Problem: {question_text}{units_line}\n"
        f"Student's answer: {user_answer}\n\n"
        "Solve the problem yourself and return the JSON."
    )

    try:
        response = quiz_client.chat.completions.create(
            model=QUIZ_DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            max_tokens=200,
        )
        data = _json.loads(response.choices[0].message.content)
        is_correct = bool(data.get("is_correct", False))
        explanation = data.get("explanation", "")
        return {
            "is_correct": is_correct,
            "ai_response": explanation,
            "computed_answer": data.get("computed_answer"),
        }
    except Exception:
        # Hard fallback: tolerance check against stored value
        import re
        correct_value = question.get("correct_answer_value")
        tolerance = question.get("tolerance", 0.01)
        cleaned = re.sub(r'[a-zA-Z°/²³\s]+$', '', str(user_answer)).strip()
        try:
            user_value = float(cleaned)
            is_correct = abs(user_value - float(correct_value)) <= float(tolerance)
            return {"is_correct": is_correct, "ai_response": "correct" if is_correct else "incorrect"}
        except (ValueError, TypeError):
            return {"is_correct": False, "ai_response": "could not parse answer"}

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
Your task is to determine if a student's response to a short answer or fill-in-blank question is correct.

Guidelines:
1. Judge based on the QUESTION itself — the student's answer must actually be correct given the question, regardless of what the "provided answer" says.
2. The "provided answer" is a hint, not ground truth — it may be incomplete or wrong. If the student's answer is factually correct for the question, mark it correct even if it differs from the provided answer.
3. Accept synonyms, equivalent phrases, different valid formulations (e.g. "table of values" and "plotting points" are both valid methods to graph a parabola).
4. Ignore minor spelling errors, capitalisation, and punctuation.
5. For questions asking to "list one method/example", any single correct example is acceptable.
Respond with ONLY "correct" or "incorrect" without any explanation.
"""
    user_message = f"""
Question: {question_text}
Question Type: {question_type}
Provided Answer (may be incomplete — verify independently): {correct_answer_text}
Student's Answer: {user_answer}

Is the student's answer correct for this question? Respond with ONLY "correct" or "incorrect".
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

def evaluate_all_answers(questions: List[Dict], user_answers: List[Any]) -> List[Dict]:
    """
    Grade all quiz answers in a single AI call.
    AI independently verifies correctness — does NOT trust stored correct_answer fields.
    """
    import json as _json

    lines = []
    for i, (q, ua) in enumerate(zip(questions, user_answers)):
        qtype = q.get("type", "")
        qtext = q.get("question", "")
        stored_hint = ""

        if qtype == "multiple_choice":
            opts = " | ".join(q.get("options", []))
            stored_hint = f"Stored answer (unverified): {q.get('correct_answer', '')}"
            student = ua or "(no answer)"
            lines.append(f"Q{i+1} [multiple_choice]\nQuestion: {qtext}\nOptions: {opts}\nStudent chose: {student}\n{stored_hint}")

        elif qtype == "multi_select":
            opts = " | ".join(q.get("options", []))
            stored_hint = f"Stored answers (may be incomplete): {', '.join(q.get('correct_answers', []))}"
            student = ", ".join(ua) if isinstance(ua, list) else str(ua or "(no answer)")
            lines.append(f"Q{i+1} [multi_select]\nQuestion: {qtext}\nOptions: {opts}\nStudent selected: {student}\n{stored_hint}")

        elif qtype == "drag_and_drop":
            mapping = ua or {}
            stored = q.get("correct_mapping", {})
            student_pairs = "; ".join(f'"{p}" → "{mapping.get(p, "(blank)")}"' for p in q.get("prompts", []))
            stored_pairs = "; ".join(f'"{p}" → "{stored.get(p, "")}"' for p in q.get("prompts", []))
            lines.append(f"Q{i+1} [drag_and_drop]\nQuestion: {qtext}\nStudent mapped: {student_pairs}\nStored mapping (unverified): {stored_pairs}")

        elif qtype in ("short_answer", "fill_in_blank"):
            acc = q.get("acceptable_answers", [])
            stored_hint = q.get("correct_answer", "") + (f" (also: {', '.join(acc)})" if acc else "")
            lines.append(f"Q{i+1} [{qtype}]\nQuestion: {qtext}\nStudent answered: {ua or '(no answer)'}\nStored answer (unverified): {stored_hint}")

        elif qtype == "numerical":
            units = q.get("units", "")
            lines.append(f"Q{i+1} [numerical]\nQuestion: {qtext}\nStudent answered: {ua or '(no answer)'}{' ' + units if units else ''}\nStored answer (unverified): {q.get('correct_answer_value', '')}{' ' + units if units else ''}")

        else:
            lines.append(f"Q{i+1} [{qtype}]\nQuestion: {qtext}\nStudent: {ua or '(no answer)'}")

    system_prompt = """You are an expert quiz grader. Grade every question using your own knowledge — the stored answers are hints only and may be WRONG.

Rules:
- multiple_choice: choose the single best correct option independently; ignore stored answer if it is wrong.
- multi_select: mark correct only if the student selected ALL valid options and NO invalid ones. If a student selected a valid option not in the stored list, that is still correct.
- drag_and_drop: verify each mapping is factually/conceptually correct.
- short_answer / fill_in_blank: accept any correct phrasing, synonym, or equivalent formulation.
- numerical: SOLVE the problem yourself from the question text. Do not trust the stored value.

Return ONLY a JSON object: {"grades": [{"index": 0, "is_correct": true}, ...]}
One entry per question in the same order. No extra text."""

    response = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n\n---\n\n".join(lines)},
        ],
        response_format={"type": "json_object"},
        max_tokens=600,
    )

    try:
        data = _json.loads(response.choices[0].message.content)
        grades = data.get("grades", [])
        result_map = {g["index"]: g["is_correct"] for g in grades if isinstance(g, dict)}
        return [{"is_correct": bool(result_map.get(i, False)), "ai_response": ""} for i in range(len(questions))]
    except Exception as e:
        print(f"Error parsing batch evaluation: {e}")
        return [{"is_correct": False, "ai_response": "error"} for _ in questions]


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
            elif question.get("type") == "numerical":
                try:
                    user_val = float(str(user_answer).replace(question.get("units", ""), "").strip())
                    correct_val = float(question.get("correct_answer_value", 0))
                    tolerance = float(question.get("tolerance", 0.01))
                    is_correct = abs(user_val - correct_val) <= tolerance
                except (ValueError, TypeError):
                    is_correct = False
            
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
        print(f"Error while calling OpenAI for quiz performance analysis: {str(e)}")
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
        elif question.get("type") == "numerical":
            try:
                user_val = float(str(user_answer).replace(question.get("units", ""), "").strip())
                correct_val = float(question.get("correct_answer_value", 0))
                tolerance = float(question.get("tolerance", 0.01))
                if abs(user_val - correct_val) <= tolerance:
                    correct_answers += 1
            except (ValueError, TypeError):
                pass
    
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
            "performanceLevel": "Outstanding" if overall_accuracy >= 90 else "Strong" if overall_accuracy >= 80 else "On Track" if overall_accuracy >= 70 else "Keep Going" if overall_accuracy >= 60 else "Needs Review",
            "keyInsights": [f"Scored {correct_answers} out of {total_questions} questions correctly"],
            "studyPriorities": ["Review incorrect answers", "Practice weak areas"]
        }
    }

# Generates "Suggested Next Steps"
def generate_suggested_next_steps_ai(targets: list[dict]):
    """
    AI generates titles/descriptions/buttons, BUT the backend controls IDs.
    targets input example:
      [
        {"toolKey":"flashcard_deck","targetId":"abc","toolName":"AI Flashcards","context":"Biology 101 - Cell Structure"},
        {"toolKey":"quiz","targetId":"def","toolName":"Practice Tests","context":"Calculus - Derivatives"},
        {"toolKey":"voice_note","targetId":"ghi","toolName":"Voice Notes","context":"World History - Chapter 5"}
        {"toolKey":"mind_map","targetId":"mmm","toolName":"Mind Maps","context":"..."},
        {"toolKey":"summarizer","targetId":"sss","toolName":"Summarizer","context":"..."}
      ]
    Output schema:
      {"items": [{"toolKey","targetId","title","description","buttonText"}]}
    """
    prompt = f"""
You are a study coach inside an education platform.

Generate EXACTLY {len(targets)} suggested next steps using the targets below.
IMPORTANT:
Generate EXACTLY {len(targets)} suggested next steps using the targets below.

IMPORTANT RULES:
- You MUST keep each toolKey and targetId exactly as provided.
- Each suggestion must clearly be about the specific item described by the target.
- Your title and description MUST reference the target’s "context" (or paraphrase it clearly).
  Example: if context is "Biology 101 - Cell Structure", mention "Cell Structure" or "Biology 101" in the title/description.
- Do NOT use generic titles like "Review with AI Flashcards" or "Test Knowledge with Quiz".
  Every title must be specific to the context.
- Title: 4–7 words
- Description: exactly 1 sentence
- ButtonText: 1–3 words (e.g., "Resume Deck", "Start Quiz", "Open Notes")

Return ONLY valid JSON in this exact schema:

{{
  "items": [
    {{
      "toolKey": "flashcard_deck|quiz|voice_note|mind_map|summarizer",
      "targetId": "string",
      "title": "string",
      "description": "string",
      "buttonText": "string"
    }}
  ]
}}

Targets (do NOT change toolKey/targetId). Use toolName + context to make wording specific:
{json.dumps(targets)}
"""

    resp = quiz_client.chat.completions.create(
        model=QUIZ_DEPLOYMENT_NAME,
        messages=[
            {"role": "system", "content": "Return ONLY JSON. No extra text."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )

    content = resp.choices[0].message.content.strip()

    # Strip ```json fences if present
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) >= 2:
            content = parts[1].strip()

    return json.loads(content)
