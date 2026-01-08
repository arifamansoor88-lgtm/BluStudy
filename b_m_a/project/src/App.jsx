import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import StudyTools from "./pages/StudyTools";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import AIFlashcards from "./pages/tools/AIFlashcards/AIFlashcards";
import VoiceNotes from "./pages/tools/VoiceNotes";
import MindMaps from "./pages/tools/Mindmaps/MindMap";
import MindMapDashboard from './pages/tools/Mindmaps/MindMapDashboard';
import PracticeTests from "./pages/tools/PracticeTests/PracticeTests";
import StudyPlans from "./pages/tools/studyPlans/StudyPlans";
import Summarizer from "./pages/tools/summarizer";
import Workspace from "./pages/Workspace";
import FolderView from "./pages/FolderView";
import PublicLibrary from "./pages/publicLibrary";
import FlashcardStudyPage from './pages/tools/AIFlashcards/FlashcardStudy';

function App() {
  return (
    <Router>
      <div className="h-screen overflow-hidden bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tools" element={<StudyTools />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/tools/flashcards" element={<AIFlashcards />} />
          <Route path="/tools/voice-notes" element={<VoiceNotes />} />
          <Route path="/tools/mind-maps" element={<MindMapDashboard />} />
          <Route path="/tools/maps/:id" element={<MindMaps />} />
          <Route path="/tools/practice-tests" element={<PracticeTests />} />
          <Route path="/tools/study-planner" element={<StudyPlans />} />
          <Route path="/tools/summarizer" element={<Summarizer />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/workspace/folder/:id" element={<FolderView />} />
          <Route path="/tools/flashcards/study/:deckId" element={<FlashcardStudyPage  />} />
          <Route path="/public_Library" element={<PublicLibrary />} />
          {/* Add more routes as needed */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
