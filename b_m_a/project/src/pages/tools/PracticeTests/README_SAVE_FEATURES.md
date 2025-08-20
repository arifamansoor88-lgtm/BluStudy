# Practice Tests - Save Features

## Overview

The Practice Tests tool now includes comprehensive save functionality that allows users to save their test progress and answers for later review. This feature ensures that users never lose their work and can continue studying at their own pace.

## Features

### 1. Auto-Save Progress
- **Automatic saving**: Test progress is automatically saved every 5 seconds when users are actively taking a test
- **Progress tracking**: Saves current question, user answers, and time elapsed
- **Visual indicator**: Shows a green notification when progress is saved
- **Resume capability**: Users can resume tests from where they left off

### 2. Save Individual Answers
- **Answer storage**: Each answer is saved with the user's response and correctness
- **AI explanations**: For review mode, AI-generated explanations are saved with each answer
- **Time tracking**: Records time spent on each question
- **Persistent storage**: Answers are stored in the database for future reference

### 3. Enhanced Review Interface
- **Saved Tests Review**: New sidebar component showing test overview, progress, and saved answers
- **Progress visualization**: Visual progress bars and statistics
- **Answer review**: Detailed view of saved answers with explanations
- **Question status**: Clear indicators showing which questions are answered, correct, or incorrect

### 4. Improved Quiz List
- **Status badges**: Shows whether tests are "Ready", "In Progress", or "Completed"
- **Progress indicators**: Visual progress bars for in-progress tests
- **Statistics**: Displays number of questions, saved answers, scores, and time taken
- **Last saved info**: Shows when progress was last saved

## Technical Implementation

### Backend API Endpoints

1. **POST /save-test-progress**
   - Saves current test progress including question position, answers, and time
   - Marks tests as drafts when not completed

2. **POST /save-answer**
   - Saves individual answers with explanations and metadata
   - Updates existing answers if they already exist

3. **GET /quizzes/{quiz_id}/saved-answers**
   - Retrieves all saved answers for a specific quiz

### Frontend Components

1. **SavedTestsReview.jsx**
   - New component for reviewing saved tests and answers
   - Tabbed interface with Overview, Questions, and Saved Answers sections
   - Progress visualization and statistics

2. **Enhanced SavedQuizzesList.jsx**
   - Shows test status, progress, and statistics
   - Visual progress bars for in-progress tests
   - Status badges and metadata

3. **Updated PracticeTests.jsx**
   - Integrated auto-save functionality
   - Sidebar toggle for saved tests review
   - Enhanced quiz loading with saved data

### Data Models

1. **TestProgress**
   - Tracks current question, user answers, time elapsed, and completion status

2. **SavedAnswer**
   - Stores individual answers with correctness, explanations, and timestamps

3. **Enhanced QuizData**
   - Includes test progress, saved answers, and draft status

## Usage

### For Students
1. **Start a test**: Create or load a quiz
2. **Answer questions**: Your progress is automatically saved
3. **Review saved answers**: Use the "Review Saved" button to see your progress
4. **Resume later**: Close the browser and return to continue where you left off
5. **Review explanations**: In review mode, get AI explanations for each answer

### For Educators
1. **Monitor progress**: See which students have started or completed tests
2. **Track performance**: View saved answers and explanations
3. **Identify gaps**: Use the review interface to see where students struggle

## Benefits

1. **No lost work**: Automatic saving prevents data loss
2. **Flexible studying**: Students can take breaks and resume later
3. **Better learning**: Saved explanations help with understanding
4. **Progress tracking**: Visual feedback on test completion
5. **Review capability**: Easy access to previous answers and explanations

## Future Enhancements

- Manual save button for immediate saving
- Export saved answers and explanations
- Comparison of multiple attempts
- Study recommendations based on saved answers
- Collaborative review features
