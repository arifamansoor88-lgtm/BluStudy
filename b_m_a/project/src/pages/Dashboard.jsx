import React, { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { getTasks, getSuggestedNextSteps } from "../api/apiService";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Star,
  Target,
  BookOpen,
  Calendar,
  ArrowRight,
  Brain,
  Play,
  Mic,
  Network as Network2,
  TestTube,
  Zap,
  PenTool,
  Folder,
} from "lucide-react";
import { motion } from "framer-motion";
import { useUserRecents } from "../hooks/useUserRecents";

const Dashboard = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [streakDays, setStreakDays] = useState(0);
    const recentItems = useUserRecents();
    const [suggestedNextSteps, setSuggestedNextSteps] = useState([]);
  const [focusAreas, setFocusAreas] = useState([]);
const handleQuizio = async () => {
  try {
    const account = instance.getActiveAccount();
    const response = await instance.acquireTokenSilent({
      scopes: ["https://bluemarbleacademy.onmicrosoft.com/966d3bf1-5512-4c9c-9af0-554ad974a7f5/access"],
      account: account,
    });

    const token = response.accessToken;

    const res = await fetch("http://localhost:8000/weak-areas", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    setFocusAreas(data.focusAreas || []);

  } catch (err) {
    console.error("Failed to fetch focus areas:", err);
  }
};
// Quizio Quiz Generation
const startFocusQuiz = async (topic) => {
  try {
    setLoadingTopic(topic); 

    const account = instance.getActiveAccount();
    const response = await instance.acquireTokenSilent({
      scopes: ["https://bluemarbleacademy.onmicrosoft.com/966d3bf1-5512-4c9c-9af0-554ad974a7f5/access"],
      account: account,
    });

    const token = response.accessToken;

    const res = await fetch("http://localhost:8000/generate-quiz-from-topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        topic: topic,
        num_questions: 10
      }),
    });

    const data = await res.json();

    navigate("/tools/practice-tests", {
      state: { 
        quiz: data,
        topic: topic   
      }
    });

  } catch (err) {
    console.error("Failed to start quiz:", err);
  } finally {
    setLoadingTopic(null); 
  }
};
const [loadingTopic, setLoadingTopic] = useState(null);
  // Redirect to sign in if not authenticated
  useEffect(() => {
    // If no accounts, redirect to sign in
    if (accounts.length === 0) {
      navigate("/signin");
      return;
    }

    // Set active account if not already set
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }

    // Get user data from active account
    const account = instance.getActiveAccount() || accounts[0];

    // Debug account information
    console.log("Dashboard - Account details:", account);

    // Extract name from multiple possible locations
    const name =
      account?.name ||
      account?.idTokenClaims?.name ||
      account?.idTokenClaims?.given_name ||
      account?.idTokenClaims?.identity?.displayName ||
      account?.idTokenClaims?.identity?.firstName ||
      (account?.idTokenClaims?.emails && account?.idTokenClaims?.emails[0]) ||
      account?.username?.split("@")[0] ||
      "User";

    // Extract email from multiple possible locations
    const email =
      account?.username ||
      (account?.idTokenClaims?.emails && account?.idTokenClaims?.emails[0]) ||
      account?.idTokenClaims?.email ||
      "Not available";

    setUserData({
      name: name,
      email: email,
      id: account.localAccountId,
    });
  }, [instance, accounts, navigate]);

  // Fetch tasks when component mounts and we have user data
  useEffect(() => {
    if (!userData) return;

    const fetchTasks = async () => {
      try {
        setLoading(true);
        const taskData = await getTasks();
        setTasks(taskData);
        setError(null);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        setError("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [userData]);

  // Fetch Study Streak
useEffect(() => {
  if (!accounts.length) return;

  const account = instance.getActiveAccount() || accounts[0];
  const token = account?.idToken;

  const updateAndFetchStreak = async () => {
    try {
      // 1️⃣ Update streak
      await fetch("http://localhost:8000/update-streak", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 2️⃣ Fetch updated streak
      const res = await fetch("http://localhost:8000/streak", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      // 3️⃣ Set new streak value
      setStreakDays(data.current_streak || 0);

    } catch (err) {
      console.error("Error fetching streak:", err);
      setStreakDays(0);
    }
  };

  updateAndFetchStreak();
}, [accounts, instance]);

    // Loads Suggested Next Steps for the dashboard.
    // If the backend request fails, fallback placeholder data is used so the UI still renders.
    useEffect(() => {
        if (!userData) return;

        const fetchSuggestedNextSteps = async () => {
            try {
                const data = await getSuggestedNextSteps();
                setSuggestedNextSteps(data.items || []);
            } catch (error) {
                console.error("Error fetching suggested next steps:", error);

                // fallback placeholder if backend fails
                setSuggestedNextSteps([
                    {
                        title: "Resume AI Flashcards",
                        description:
                            "You recently used AI Flashcards for Biology 101. Continue with Cell Structure to reinforce learning.",
                        buttonText: "Resume Tool",
                    },
                    {
                        title: "Continue Practice Test",
                        description:
                            "You recently completed a Calculus quiz. Try another short practice test on derivatives.",
                        buttonText: "Start Practice",
                    },
                    {
                        title: "Open Smart Summarizer",
                        description:
                            "You recently summarized World History notes. Continue with Chapter 5 to stay on track.",
                        buttonText: "Open Tool",
                    },
                ]);
            }
        };

        fetchSuggestedNextSteps();
    }, [userData]);

useEffect(() => {
  if (!userData) return;

  const fetchSuggestedNextSteps = async () => {
    try {
      const data = await getSuggestedNextSteps();
      setSuggestedNextSteps(data.items || []);
    } catch (error) {
      console.error("Error fetching suggested next steps:", error);
      setSuggestedNextSteps([
        {
          title: "Resume AI Flashcards",
          description:
            "You recently used AI Flashcards for Biology 101. Continue with Cell Structure to reinforce learning.",
          buttonText: "Resume Tool",
        },
        {
          title: "Continue Practice Test",
          description:
            "You recently completed a Calculus quiz. Try another short practice test on derivatives.",
          buttonText: "Start Practice",
        },
        {
          title: "Open Smart Summarizer",
          description:
            "You recently summarized World History notes. Continue with Chapter 5 to stay on track.",
          buttonText: "Open Tool",
        },
      ]);
    }
  };

  fetchSuggestedNextSteps();
}, [userData]);

  // Display loading state if still loading
  if (loading && !userData) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Get user information
  const userName = userData?.name || "User";
  const firstName = userName.split(" ")[0];
  const email = userData?.email || "Not available";


  const studyGoals = [
    {
      title: "Biology 101",
      progress: 65,
      tasks: [
        "Complete cell structure chapter",
        "Review photosynthesis notes",
        "Practice mitosis diagrams"
      ]
    },
    {
      title: "World History",
      progress: 80,
      tasks: [
        "Read Chapter 5: Industrial Revolution",
        "Complete timeline assignment",
        "Study key figures quiz"
      ]
    },
    {
      title: "Calculus",
      progress: 45,
      tasks: [
        "Master derivative rules",
        "Solve integration problems",
        "Complete practice set 3"
      ]
    },
    {
      title: "Chemistry",
      progress: 90,
      tasks: [
        "Review periodic table trends",
        "Complete lab report",
        "Study reaction mechanisms"
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-lg shadow mb-6 p-4 flex flex-col md:flex-row gap-4 items-center justify-between"
      >
        {/* User greeting */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {firstName}!
          </h1>
          <p className="text-gray-600">
            You're signed in as <span className="font-medium">{email}</span>
          </p>
        </div>

        {/* Study Streak Card */}
        <div className="flex-1 bg-blue-50 rounded-xl shadow-sm p-5 border border-gray-100 w-full md:w-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Study Streak</h2>
          {streakDays === 0 ? (
            <div>
              <p className="text-lg font-semibold text-orange-500">Start your first streak</p>
              <p className="text-sm text-gray-500">Study today to begin building consistency.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-orange-500">{streakDays}</p>
                <p className="text-sm text-gray-500">Day{streakDays === 1 ? "" : "s"} in a row</p>
              </div>
              <p className="text-green-600 font-medium">Keep it going</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Recent Tools and Quizio Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
      >
        {/* Recent Tools - Left Half */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Jump back into your recent tools:
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentItems && recentItems.length > 0 ? (
              recentItems.slice(0, 4).map((item, index) => (
                <RecentItemCard key={item.id || index} item={item} navigate={navigate} />
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No recent tools yet. Start using tools to see them here!</p>
              </div>
            )}
          </div>
        </div>

        {/* Quizio - Right Half */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="text-purple-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">
                Quizio
              </h2>
            </div>

            {focusAreas.length > 0 && (
              <button
                onClick={handleQuizio}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Re-analyze
              </button>
            )}
          </div>

          {/* Subtext */}
          <p className="text-sm text-gray-500 mb-4">
            Practice based on your weak areas.
          </p>

          {/* STATE 1: NO FOCUS AREAS */}
          {focusAreas.length === 0 ? (
            <button
              onClick={handleQuizio}
              className="w-full flex items-center justify-center gap-2 bg-purple-400 text-white py-3 rounded-lg hover:bg-purple-700 transition"
            >
              Analyze Weak Areas
            </button>
          ) : (
            <>
              {/* Label */}
              <p className="text-sm text-gray-600 mb-3">
                Focus areas based on your performance:
              </p>

              {/* Focus Area Cards */}
              <div className="grid grid-cols-1 gap-3">
                {focusAreas.map((item, idx) => {
                  const topic = item.topic;
                  const score = item.score;

                  let status = "Weak";
                  let color = "text-red-500";
                  if (score >= 60) {
                    status = "Improving";
                    color = "text-yellow-500";
                  }
                  if (score >= 75) {
                    status = "Strong";
                    color = "text-green-500";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => startFocusQuiz(topic)}
                      disabled={loadingTopic !== null}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-purple-400 hover:shadow-sm transition flex justify-between items-center"
                    >
                      {/* Left Side */}
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">
                          {topic}
                        </p>
                        <p className={`text-xs ${color}`}>
                          {status}
                        </p>
                      </div>

                      {/* Right Side */}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-700">
                          {score}%
                        </p>
                        <p className="text-xs text-gray-400">
                          {loadingTopic === topic ? "Generating..." : "Practice"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

          {/* Suggested Next Steps */}
          <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-xl shadow-sm p-6 mt-8"
          >
              <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                      Suggested Next Steps
                  </h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                  Smart recommendations based on your recent activity
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {suggestedNextSteps.map((step, index) => (
                      <SuggestedStepCard key={index} step={step} navigate={navigate} />
                  ))}
              </div>
          </motion.div>

      {/* Study Goals Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-xl shadow-sm p-6 mt-8"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Next in Your Study Plan:
        </h2>
        <div className="relative">
          <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {studyGoals.map((goal, index) => (
              <StudyGoalCard key={index} goal={goal} />
            ))}
          </div>
          {/* Scroll indicator */}
          <div className="flex justify-center mt-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AchievementCard = ({
  icon: Icon,
  title,
  description,
  color,
  bgColor,
}) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="p-4 rounded-lg bg-gray-50 flex items-start gap-4"
  >
    <div className={`${bgColor} p-3 rounded-lg`}>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
    <div>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  </motion.div>
);

// Reusable card component for displaying a single Suggested Next Step recommendation.
const SuggestedStepCard = ({ step, navigate }) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        className="bg-gray-50 rounded-lg p-5 flex flex-col justify-between min-h-[190px]"
    >
        <div>
            <h3 className="font-semibold text-gray-900 text-lg mb-3">
                {step.title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
                {step.description}
            </p>
        </div>

        <button
            onClick={() => step.actionPath && navigate(step.actionPath)}
            disabled={!step.actionPath}
            className={`mt-5 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition
        ${step.actionPath ? "bg-primary-600 hover:bg-primary-700" : "bg-gray-300 cursor-not-allowed"}`}
        >
            {step.buttonText}
        </button>
    </motion.div>
);

const StudyGoalCard = ({ goal }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="min-w-[280px] bg-gray-50 rounded-lg p-4 relative"
  >
    {/* Percentage in top-right corner */}
    <div className="absolute top-4 right-4 text-sm font-medium text-primary-600">
      {goal.progress}%
    </div>

    {/* Subject title */}
    <h3 className="font-bold text-gray-900 text-lg mb-3 pr-12">
      {goal.title}
    </h3>

    {/* Study tasks as bullet points */}
    <ul className="space-y-2 mb-4">
      {goal.tasks.map((task, index) => (
        <li key={index} className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
          <span className="text-sm text-gray-700">{task}</span>
        </li>
      ))}
    </ul>

    {/* Progress bar */}
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${goal.progress}%` }}
        transition={{ duration: 1, delay: 0.7 }}
        className="h-full bg-primary-600 rounded-full"
      />
    </div>
  </motion.div>
);

const RecentItemCard = ({ item, navigate }) => {
  const { instance, accounts } = useMsal();

  const contentTypeColors = {
    voice_note: { bg: "bg-purple-50", text: "text-purple-700", Icon: Mic },
    flashcard: { bg: "bg-primary-50", text: "text-primary-600", Icon: Brain },
    flashcard_deck: { bg: "bg-primary-50", text: "text-primary-600", Icon: Brain },
    quiz: { bg: "bg-red-50", text: "text-red-600", Icon: TestTube },
    mindmap: { bg: "bg-green-50", text: "text-green-600", Icon: Network2 },
    study_plan: { bg: "bg-indigo-50", text: "text-indigo-600", Icon: PenTool },
    summary: { bg: "bg-yellow-50", text: "text-yellow-600", Icon: Zap },
    folder: { bg: "bg-cyan-50", text: "text-cyan-700", Icon: Folder },
  };

  const typeConfig = contentTypeColors[item.contentType] || {
    bg: "bg-gray-50",
    text: "text-gray-700",
    Icon: BookOpen,
  };

  const displayTitle =
    item.title ||
    item.rawTitle ||
    (item.contentType === "quiz" ? "Practice Test" : "Untitled");

  const handleNavigate = useCallback(async () => {
    // Track the access to this tool
    try {
      const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      
      // Get auth token
      const acct = instance.getActiveAccount() || accounts[0];
      const tokenRes = await instance.acquireTokenSilent({ 
        account: acct, 
        scopes: ["openid", "profile"] 
      });
      const token = tokenRes.accessToken || tokenRes.idToken;

      // Call track-access with auth
      const res = await fetch(`${API}/api/track-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ item_id: item.id }),
      });

      if (res.ok) {
        console.log("Track-access successful for item:", item.id);
      } else {
        console.warn("Track-access returned status:", res.status);
      }
    } catch (e) {
      console.warn("Failed to track access:", e);
    }

    const routeMap = {
      voice_note: `/tools/voice-notes?noteId=${item.id}`,
      flashcard: `/tools/flashcards/study/${item.id}`,
      flashcard_deck: `/tools/flashcards/study/${item.id}`,
      quiz: `/tools/practice-tests?quizId=${item.id}`,
      mindmap: `/tools/maps/${item.id}`,
      study_plan: `/tools/study-planner?planId=${item.id}`,
      summary: `/tools/summarizer`,
      folder: `/workspace/folder/${item.id}`,
      tool: item.route || "/tools",
    };

    let route = item.contentType === "tool" ? item.route : routeMap[item.contentType];
    route = route || item.route || "/tools";
    console.log("RecentItemCard navigation:", { item: item.id, contentType: item.contentType, route });
    
    if (route) {
      navigate(route);
    } else {
      console.warn(`No route found for content type: ${item.contentType}`);
    }
  }, [item, navigate, instance, accounts]);

  const Icon = typeConfig.Icon;

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      onClick={handleNavigate}
      className={`${typeConfig.bg} rounded-lg p-4 cursor-pointer transition-all`}
    >
      <div className="flex items-start justify-between mb-2">
        <Icon className={`h-6 w-6 ${typeConfig.text}`} />
        <ArrowRight className={`h-4 w-4 ${typeConfig.text}`} />
      </div>
      <h3 className={`font-semibold ${typeConfig.text} text-sm truncate`}>
        {displayTitle}
      </h3>
      <p className="text-xs text-gray-500 mt-1 capitalize">
        {item.contentType?.replace(/_/g, " ")}
      </p>
      {(item.updatedAt || item.createdAt) && (
        <p className="text-[10px] text-gray-400 mt-1">
          last accessed {new Date(item.updatedAt || item.createdAt).toLocaleString()}
        </p>
      )}
    </motion.div>
  );
};

export default Dashboard;
