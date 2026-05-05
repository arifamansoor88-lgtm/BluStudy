import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import StudyTools from "./pages/StudyTools";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import AIFlashcards from "./pages/tools/AIFlashcards/AIFlashcards";
import VoiceNotes from "./pages/tools/VoiceNotes";
import MindMaps from "./pages/tools/Mindmaps/MindMap";
import MindMapDashboard from "./pages/tools/Mindmaps/MindMapDashboard";
import PracticeTests from "./pages/tools/PracticeTests/PracticeTests";
import StudyPlans from "./pages/tools/studyPlans/StudyPlans";
import Summarizer from "./pages/tools/summarizer";
import Workspace from "./pages/Workspace";
import FolderView from "./pages/FolderView";
import UnfiledItems from "./pages/UnfiledItems";
import TrashPage from "./pages/Trash";
import PublicLibrary from "./pages/publicLibrary";
import FlashcardStudyPage from "./pages/tools/AIFlashcards/FlashcardStudy";
import SharedItemPage from "./pages/shared/SharedItemPage";

function AppContent() {
  const location = useLocation();

  const publicRoutes = ["/", "/signin", "/signup"];
  const isPublicPage =
    publicRoutes.includes(location.pathname) ||
    location.pathname.startsWith("/share/");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isPublicPage={isPublicPage} />
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
        <Route path="/workspace/unfiled" element={<UnfiledItems />} />
        <Route path="/workspace/folder/:id" element={<FolderView />} />
        <Route path="/workspace/trash" element={<TrashPage />} />
        <Route path="/tools/flashcards/study/:deckId" element={<FlashcardStudyPage />} />
        <Route path="/public_library" element={<PublicLibrary />} />
        <Route path="/share/:token" element={<SharedItemPage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
