import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Navbar, { Sidebar, TopBar } from "./components/Navbar";
import GuestBanner from "./components/GuestBanner";
import { GuestProvider, useGuest } from "./context/GuestContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import StudyTools from "./pages/StudyTools";
import SignIn from "./pages/SignIn";
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
import Settings from "./pages/Settings";

const appRoutes = (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/tools" element={<StudyTools />} />
    <Route path="/signin" element={<SignIn />} />
    <Route path="/signup" element={<SignIn />} />
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
    <Route path="/settings" element={<Settings />} />
  </Routes>
);

// Routes guests are allowed to visit without signing in
const GUEST_ALLOWED = [
  "/tools/summarizer",
  "/tools/practice-tests",
  "/tools/flashcards",
];

function AppContent() {
  const location = useLocation();
  const { isGuest } = useGuest();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const publicRoutes = ["/", "/signin", "/signup"];
  const isPublicPage =
    publicRoutes.includes(location.pathname) ||
    location.pathname.startsWith("/share/");

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar isPublicPage={true} />
        {appRoutes}
      </div>
    );
  }

  // Guest users can only access GUEST_ALLOWED routes
  if (isGuest) {
    const allowed = GUEST_ALLOWED.some((p) => location.pathname.startsWith(p));
    if (!allowed) {
      return <Navigate to="/tools/summarizer" replace />;
    }
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} guestMode />
        <div
          className="flex-1 flex flex-col min-h-screen transition-all duration-300"
          style={{ marginLeft: sidebarOpen ? "224px" : "64px" }}
        >
          <GuestBanner />
          <main className="flex-1">{appRoutes}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} />
      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? "224px" : "64px" }}
      >
        <TopBar />
        <main className="flex-1">
          {appRoutes}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <GuestProvider>
        <AppContent />
      </GuestProvider>
    </Router>
  );
}

export default App;
