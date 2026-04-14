import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
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

const updateStreakGlobal = async (instance, accounts) => {
  try {
    const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    const acct = instance.getActiveAccount() || accounts[0];
    const tokenRes = await instance.acquireTokenSilent({
      account: acct,
      scopes: ["openid", "profile"],
    });

    const token = tokenRes.accessToken || tokenRes.idToken;

    await fetch(`${API}/update-streak`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Global streak updated");
  } catch (err) {
    console.error("Global streak failed:", err);
  }
};

const formatTopic = (t) => {
  return t
    .replace(/(^|\s)\S/g, l => l.toUpperCase())
    .replace(/\band\b/g, "and");
};

const Dashboard = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [streakDays, setStreakDays] = useState(0);
  const [prevStreak, setPrevStreak] = useState(0);
    const recentItems = useUserRecents();
    const [suggestedNextSteps, setSuggestedNextSteps] = useState([]);
  const [focusAreas, setFocusAreas] = useState([]);
  const [displayStreak, setDisplayStreak] = useState(0);
  const [glow, setGlow] = useState(false);
  const streakMessages = [
  "Keep it going 🔥",
  "You're on fire 🚀",
  "Consistency wins 💪",
  "Small steps daily 📈",
  "Don’t break the chain ⛓️",
];

const [randomMessage] = useState(
  streakMessages[Math.floor(Math.random() * streakMessages.length)]
);
  useEffect(() => {
  handleQuizio(); 
}, []);
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

  // ONLY fetch streak 
useEffect(() => {
  if (!accounts.length) return;

  const account = instance.getActiveAccount() || accounts[0];
  const token = account?.idToken;

  const fetchStreak = async () => {
    try {
      const res = await fetch("http://localhost:8000/streak", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      const newStreak = data.current_streak || 0;

if (newStreak > prevStreak) {
  setGlow(true);

  setTimeout(() => {
    setGlow(false);
  }, 800);

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });
}

setPrevStreak(newStreak);
setStreakDays(newStreak);

    } catch (err) {
      console.error("Error fetching streak:", err);
      setStreakDays(0);
    }
  };

  fetchStreak();
}, [accounts, instance]);

useEffect(() => {
  let start = 0;
  const end = streakDays;
  const duration = 1000;
  const startTime = performance.now();

  const animate = (currentTime) => {
    const progress = Math.min((currentTime - startTime) / duration, 1);

    const easeOut = 1 - Math.pow(1 - progress, 3); // smooth easing
    const value = Math.floor(easeOut * end);

    setDisplayStreak(value);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}, [streakDays]);

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
  <h2 className="text-xl font-semibold text-gray-900 mb-4">
    Study Streak
  </h2>

  {streakDays === 0 ? (
    <div>
      <p className="text-lg font-semibold text-orange-500">
        Start your first streak 🔥
      </p>
      <p className="text-sm text-gray-500">
        Study today to begin building consistency.
      </p>
    </div>
  ) : (
    <div className="flex items-center justify-between w-full">

      {/* LEFT SIDE */}
      <div>
        <p
  className={`text-3xl font-bold text-orange-500 transition-all duration-300 ${
    glow ? "scale-110 drop-shadow-[0_0_10px_rgba(255,165,0,0.8)]" : ""
  }`}
>
          {displayStreak}
        </p>
        <p className="text-sm text-gray-500">
          Day{streakDays === 1 ? "" : "s"} in a row
        </p>
      </div>

      {/* RIGHT SIDE MESSAGE */}
      <div className="flex-1 flex justify-end items-center">
        <p className="text-green-600 font-medium pr-4 whitespace-nowrap text-sm">
          {randomMessage}
        </p>
      </div>

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
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200 flex flex-col gap-4">
          {/* Header */}
          
            <div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-3">
  <div className="bg-purple-100 p-2 rounded-lg">
    <Brain className="text-purple-600" size={18} />
  </div>

  <div>
    <h2 className="text-lg font-bold text-gray-900">
      Quizio
    </h2>
    <p className="text-xs text-gray-500">
      AI-powered practice
    </p>
  </div>
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
              className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-lg shadow hover:bg-purple-700 hover:shadow-lg hover:scale-[1.02] transition-all"
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
              <div className="flex flex-col gap-3">
                {focusAreas.map((item, idx) => {
                  const topic = item.topic;
                  const display = item.display || topic;
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
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-purple-300 transition-all flex justify-between items-center"
                    >
                      {/* Left Side */}
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatTopic(display)}
                        </p>
                        <p className={`text-xs font-medium ${color}`}>
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
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            Placeholder
          </p>
        </div>
      </motion.div>

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

// Color theme per Suggested Next Step tool type (toolKey)
const NEXT_STEP_THEME = {
    flashcard_deck: {
        card: "border-blue-200 bg-blue-50",
        button: "bg-blue-600 hover:bg-blue-700",
        text: "text-blue-900",
    },
    quiz: {
        card: "border-red-200 bg-red-50",
        button: "bg-red-600 hover:bg-red-700",
        text: "text-red-900",
    },
    voice_note: {
        card: "border-purple-200 bg-purple-50",
        button: "bg-purple-600 hover:bg-purple-700",
        text: "text-purple-900",
    },
    mind_map: {
        card: "border-green-200 bg-green-50",
        button: "bg-green-600 hover:bg-green-700",
        text: "text-green-900",
    },
    summarizer: {
        card: "border-yellow-200 bg-yellow-50",
        button: "bg-yellow-600 hover:bg-yellow-700",
        text: "text-yellow-900",
    },
};

// Reusable card component for displaying a single Suggested Next Step recommendation.
const SuggestedStepCard = ({ step, navigate }) => {
    const theme = NEXT_STEP_THEME[step.toolKey] || {
        card: "border-gray-200 bg-gray-50",
        button: "bg-primary-600 hover:bg-primary-700",
        text: "text-gray-900",
    };

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className={`border rounded-lg p-5 flex flex-col justify-between min-h-[190px] ${theme.card}`}
        >
            <div>
                <h3 className={`font-semibold text-lg mb-3 ${theme.text}`}>
                    {step.title}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                    {step.description}
                </p>
            </div>

            <button
                onClick={() => step.actionPath && navigate(step.actionPath)}
                disabled={!step.actionPath}
                className={`mt-5 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition
          ${step.actionPath ? theme.button : "bg-gray-300 cursor-not-allowed"}`}
            >
                {step.buttonText}
            </button>
        </motion.div>
    );
};
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
  const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const acct = instance.getActiveAccount() || accounts[0];
  const tokenRes = await instance.acquireTokenSilent({ 
    account: acct, 
    scopes: ["openid", "profile"] 
  });

  const token = tokenRes.accessToken || tokenRes.idToken;

  try {

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
//UPDATE STREAK HERE
    try {
  await fetch(`${API}/update-streak`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  // Fetch updated streak
  const streakRes = await fetch(`${API}/streak`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  const streakData = await streakRes.json();

  //send event to parent (for confetti later)
  console.log("Updated streak:", streakData.current_streak);
  window.location.reload();
} catch (e) {
  console.warn("Failed to update streak:", e);
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
