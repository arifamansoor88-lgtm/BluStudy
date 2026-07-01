import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Utility functions for exporting practice test results as PDF
 */

// Helper function to format time
const formatTime = (time) => {
  const minutes = Math.floor(time / 60).toString().padStart(2, "0");
  const seconds = (time % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

// Helper function to get score color
const getScoreColor = (score) => {
  if (score >= 90) return "#10b981"; // green
  if (score >= 80) return "#3b82f6"; // blue
  if (score >= 70) return "#f59e0b"; // yellow
  if (score >= 60) return "#f97316"; // orange
  return "#ef4444"; // red
};

// Helper function to get performance level
const getPerformanceLevel = (score) => {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Strong";
  if (score >= 70) return "On Track";
  if (score >= 60) return "Keep Going";
  return "Needs Review";
};

// Helper function to get correct answer count
const getCorrectAnswerCount = (questions, userAnswers) => {
  if (!questions || !questions.length || !userAnswers) return 0;
  return questions.filter((question, index) => {
    const userAnswer = userAnswers[index];
    if (!question || userAnswer === null) return false;
    
    switch (question.type) {
      case "multiple_choice":
        return userAnswer === question.correct_answer;
      case "multi_select":
        if (!Array.isArray(userAnswer)) return false;
        return JSON.stringify([...userAnswer].sort()) === JSON.stringify([...question.correct_answers].sort());
      case "drag_and_drop":
        if (!userAnswer || typeof userAnswer !== "object") return false;
        return Object.keys(question.correct_mapping).every(key => userAnswer[key] === question.correct_mapping[key]);
      case "short_answer":
      case "fill_in_blank":
        return userAnswer === question.correct_answer || (question.acceptable_answers && question.acceptable_answers.includes(userAnswer));
      default:
        return false;
    }
  }).length;
};

/**
 * Generate a comprehensive PDF report of practice test results
 */
export const generatePDFReport = async (quiz, userAnswers, timer, score, topicAnalysis) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    let yPosition = margin;

    // Set font styles
    doc.setFont('helvetica');
    
    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Practice Test Results Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Quiz title and date
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(quiz.quiz_title || 'Practice Test', margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, margin + 60, yPosition);
    yPosition += 15;

    // Overall Performance Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Overall Performance', margin, yPosition);
    yPosition += 10;

    // Score circle (simplified as text)
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    const scoreColor = getScoreColor(score);
    doc.setTextColor(scoreColor);
    doc.text(`${score}%`, margin + 20, yPosition);
    doc.setTextColor(0, 0, 0); // Reset to black
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Overall Score', margin + 20, yPosition);
    yPosition += 15;

    // Performance details
    doc.setFontSize(12);
    doc.text(`Correct Answers: ${getCorrectAnswerCount(quiz.questions, userAnswers)} out of ${quiz.questions.length}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Time Taken: ${formatTime(timer)}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Performance Level: ${getPerformanceLevel(score)}`, margin, yPosition);
    yPosition += 15;

    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }

    // Topic Analysis Section
    if (topicAnalysis && topicAnalysis.topics && topicAnalysis.topics.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Accuracy by Topic', margin, yPosition);
      yPosition += 10;

      topicAnalysis.topics.forEach((topic, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${topic.name}`, margin, yPosition);
        yPosition += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Accuracy: ${topic.accuracy}% (${topic.correctCount}/${topic.totalCount} correct)`, margin + 5, yPosition);
        yPosition += 5;
        
        if (topic.questionIndices && topic.questionIndices.length > 0) {
          const questionNumbers = topic.questionIndices
            .filter(i => i >= 0 && i < quiz.questions.length)
            .map(i => i + 1)
            .join(', ');
          doc.text(`Questions: ${questionNumbers}`, margin + 5, yPosition);
          yPosition += 5;
        }
        
        if (topic.difficulty) {
          doc.text(`Difficulty: ${topic.difficulty}`, margin + 5, yPosition);
          yPosition += 5;
        }
        
        yPosition += 8;
      });
    }

    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }

    // Revision Suggestions Section
    if (topicAnalysis) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Suggested Areas for Revision', margin, yPosition);
      yPosition += 10;

      // Weak Areas
      if (topicAnalysis.weakTopics && topicAnalysis.weakTopics.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38); // Red color
        doc.text('Areas Needing Improvement:', margin, yPosition);
        doc.setTextColor(0, 0, 0); // Reset to black
        yPosition += 8;

        topicAnalysis.weakTopics.forEach((topic, index) => {
          // Check if we need a new page
          if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = margin;
          }

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`• ${topic.name} (${topic.accuracy}% accuracy)`, margin + 5, yPosition);
          yPosition += 5;

          if (topic.reason) {
            doc.setFont('helvetica', 'normal');
            doc.text(`  ${topic.reason}`, margin + 10, yPosition);
            yPosition += 5;
          }

          if (topic.suggestions && topic.suggestions.length > 0) {
            topic.suggestions.forEach(suggestion => {
              doc.text(`  - ${suggestion}`, margin + 10, yPosition);
              yPosition += 4;
            });
          }
          yPosition += 5;
        });
      }

      // Strong Areas
      if (topicAnalysis.strongTopics && topicAnalysis.strongTopics.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 197, 94); // Green color
        doc.text('Strong Areas:', margin, yPosition);
        doc.setTextColor(0, 0, 0); // Reset to black
        yPosition += 8;

        topicAnalysis.strongTopics.forEach((topic, index) => {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`• ${topic.name} (${topic.accuracy}% accuracy)`, margin + 5, yPosition);
          yPosition += 6;
        });
      }

      // General Recommendations
      if (topicAnalysis.recommendations && topicAnalysis.recommendations.length > 0) {
        yPosition += 5;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246); // Blue color
        doc.text('Study Recommendations:', margin, yPosition);
        doc.setTextColor(0, 0, 0); // Reset to black
        yPosition += 8;

        topicAnalysis.recommendations.forEach((rec, index) => {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`• ${rec}`, margin + 5, yPosition);
          yPosition += 5;
        });
      }
    }

    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    // Question Review Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Question Review', margin, yPosition);
    yPosition += 10;

    // Create a summary of correct/incorrect answers
    const correctAnswers = [];
    const incorrectAnswers = [];
    const unanswered = [];

    quiz.questions.forEach((question, index) => {
      const userAnswer = userAnswers[index];
      let isCorrect = null;

      if (userAnswer !== null) {
        switch (question.type) {
          case "multiple_choice":
            isCorrect = userAnswer === question.correct_answer;
            break;
          case "multi_select":
            if (Array.isArray(userAnswer)) {
              isCorrect = JSON.stringify([...userAnswer].sort()) === JSON.stringify([...question.correct_answers].sort());
            } else {
              isCorrect = false;
            }
            break;
          case "drag_and_drop":
            if (userAnswer && typeof userAnswer === "object") {
              isCorrect = Object.keys(question.correct_mapping).every(key => userAnswer[key] === question.correct_mapping[key]);
            } else {
              isCorrect = false;
            }
            break;
          case "short_answer":
          case "fill_in_blank":
            isCorrect = userAnswer === question.correct_answer || (question.acceptable_answers && question.acceptable_answers.includes(userAnswer));
            break;
          default:
            isCorrect = false;
        }

        if (isCorrect) {
          correctAnswers.push(index + 1);
        } else {
          incorrectAnswers.push(index + 1);
        }
      } else {
        unanswered.push(index + 1);
      }
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Correct Answers: ${correctAnswers.join(', ') || 'None'}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Incorrect Answers: ${incorrectAnswers.join(', ') || 'None'}`, margin, yPosition);
    yPosition += 5;
    if (unanswered.length > 0) {
      doc.text(`Unanswered: ${unanswered.join(', ')}`, margin, yPosition);
      yPosition += 5;
    }

    // Footer
    yPosition = pageHeight - 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Generated by Study AI Platform', pageWidth / 2, yPosition, { align: 'center' });

    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Export the current performance summary as PDF
 */
export const exportResultsAsPDF = async (quiz, userAnswers, timer, score, topicAnalysis) => {
  try {
    console.log('Starting PDF export...');
    
    // Validate inputs
    if (!quiz || !quiz.questions) {
      throw new Error('Invalid quiz data provided');
    }
    
    if (!userAnswers || !Array.isArray(userAnswers)) {
      throw new Error('Invalid user answers provided');
    }
    
    const doc = await generatePDFReport(quiz, userAnswers, timer, score, topicAnalysis);
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const safeTitle = (quiz.quiz_title || 'PracticeTest').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${safeTitle}_Results_${timestamp}.pdf`;
    
    // Save the PDF
    doc.save(filename);
    
    console.log('PDF exported successfully:', filename);
    return filename;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};

/**
 * Alternative method: Export by capturing the DOM element
 */
export const exportElementAsPDF = async (elementRef, filename = 'practice-test-results.pdf') => {
  try {
    console.log('Capturing element for PDF export...');
    
    if (!elementRef || !elementRef.current) {
      throw new Error('Element reference is required');
    }

    const element = elementRef.current;
    
    // Wait a bit for any animations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false, // Disable logging for cleaner console
      width: element.scrollWidth,
      height: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    console.log('PDF exported successfully:', filename);
    return filename;
  } catch (error) {
    console.error('Error exporting element as PDF:', error);
    throw error;
  }
};
