import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import { useMsal } from "@azure/msal-react";
import { protectedResources } from "../authConfig";
import {
  getTasks,
  getSuggestedNextSteps,
  getStudyStreak,
  getCachedStudyStreak,
  consumeRecentStudyStreakUpdate,
} from "../api/apiService";
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
  const [streakLoading, setStreakLoading] = useState(true);
  const [streakLoadError, setStreakLoadError] = useState(false);
  const recentItems = useUserRecents();
  const [suggestedNextSteps, setSuggestedNextSteps] = useState([]);
  const [focusAreas, setFocusAreas] = useState([]);
  const [displayStreak, setDisplayStreak] = useState(0);
  const [glow, setGlow] = useState(false);
  const activeAccountId =
    accounts[0]?.homeAccountId ||
    accounts[0]?.localAccountId ||
    accounts[0]?.username ||
    "";
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

  const animateStreakCount = useCallback((from, to) => {
    if (from === to) {
      setDisplayStreak(to);
      return;
    }

    const startTime = performance.now();
    const duration = 900;
    const startValue = Math.max(from, 0);
    const distance = to - startValue;

    const animate = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + distance * easeOut);

      setDisplayStreak(nextValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayStreak(to);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const celebrateStreak = useCallback((from, to) => {
    setGlow(true);

    setTimeout(() => {
      setGlow(false);
    }, 900);

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    animateStreakCount(from, to);
  }, [animateStreakCount]);

  useEffect(() => {
  handleQuizio(); 
}, []);
const handleQuizio = async () => {
  try {
    const account = instance.getActiveAccount();
    const response = await instance.acquireTokenSilent({
      scopes: protectedResources.todoListApi.scopes,
      account: account,
    });

    const token = response.accessToken;

    const res = await fetch(`${protectedResources.todoListApi.endpoint}/weak-areas`, {
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
const startFocusQuiz = async (item) => {
  const topicKey = item.topic;
  const topicText = item.display || item.topic;

  try {
    setLoadingTopic(topicKey); 

    const account = instance.getActiveAccount();
    const response = await instance.acquireTokenSilent({
      scopes: protectedResources.todoListApi.scopes,
      account: account,
    });

    const token = response.accessToken;

    const res = await fetch(`${protectedResources.todoListApi.endpoint}/generate-quiz-from-topic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        topic: topicText,
        topic_key: topicKey,
        num_questions: 10
      }),
    });

    const data = await res.json();

    navigate("/tools/practice-tests", {
      state: { 
        quiz: data,
        topic: topicKey   
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

  // Fetch the saved streak once the signed-in account is available.
  useEffect(() => {
    let cancelled = false;

    if (!accounts.length) {
      setStreakLoading(true);
      return () => {
        cancelled = true;
      };
    }

    const fetchStreak = async () => {
      setStreakLoading(true);
      setStreakLoadError(false);

      try {
        const data = await getStudyStreak();
        if (cancelled) return;

        const newStreak = data.current_streak || 0;
        const streakUpdate = consumeRecentStudyStreakUpdate();
        const shouldCelebrate =
          streakUpdate && streakUpdate.currentStreak === newStreak;

        setStreakDays(newStreak);

        if (shouldCelebrate) {
          celebrateStreak(streakUpdate.previousStreak || 0, newStreak);
        } else {
          setDisplayStreak(newStreak);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching streak:", err);

        const cachedStreak = getCachedStudyStreak();
        if (cachedStreak !== null) {
          setStreakLoadError(false);
          setStreakDays(cachedStreak);
          setDisplayStreak(cachedStreak);
        } else {
          setStreakLoadError(true);
          setStreakDays(0);
          setDisplayStreak(0);
        }
      } finally {
        if (!cancelled) {
          setStreakLoading(false);
        }
      }
    };

    fetchStreak();

    return () => {
      cancelled = true;
    };
  }, [accounts.length, activeAccountId, celebrateStreak]);

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
  const email = userData?.email || "Not available";
  // If B2C returns the email as the display name, use only the local part
  const rawFirst = userName.split(" ")[0];
  const firstName = rawFirst.includes("@") ? rawFirst.split("@")[0] : rawFirst;


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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Hero: Greeting + Streak */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-center justify-between"
      >
        <div className="text-white">
          <p className="text-primary-200 text-sm mb-1">Good to see you back</p>
          <h1 className="text-3xl font-bold">Hey, {firstName}!</h1>
        </div>

        {/* Streak pill */}
        <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-4 text-center min-w-[180px]">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-1">Study Streak</p>
          {streakLoading ? (
            <p className="text-white font-semibold text-sm mt-1">Syncing...</p>
          ) : streakLoadError ? (
            <p className="text-orange-300 font-semibold text-sm mt-1">Unavailable</p>
          ) : streakDays === 0 ? (
            <>
              <p className="text-white text-2xl font-bold">🔥</p>
              <p className="text-white/80 text-xs mt-1">Start today!</p>
            </>
          ) : (
            <>
              <p
                className={`text-4xl font-bold text-orange-300 transition-all duration-300 ${
                  glow ? "scale-110 drop-shadow-[0_0_12px_rgba(255,165,0,0.9)]" : ""
                }`}
              >
                {displayStreak}
              </p>
              <p className="text-white/70 text-xs mt-1">
                day{streakDays === 1 ? "" : "s"} in a row
              </p>
              <p className="text-green-300 text-xs font-medium mt-1">{randomMessage}</p>
            </>
          )}
        </div>
      </motion.div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Recent Tools + Quizio */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        {/* Recent Tools */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Jump back in</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const contentItems = (recentItems || []).filter(item => item.contentType !== "tool");
              return contentItems.length > 0 ? (
                contentItems.slice(0, 4).map((item, index) => (
                  <RecentItemCard key={item.id || index} item={item} navigate={navigate} />
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-gray-400">
                  <Clock className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Nothing yet. Create a flashcard deck or take a quiz to see it here.</p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Quizio */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-xl">
                <Brain className="text-purple-600" size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Quizio</h2>
                <p className="text-xs text-gray-400">AI-powered practice</p>
              </div>
            </div>
            {focusAreas.length > 0 && (
              <button
                onClick={handleQuizio}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                Re-analyze
              </button>
            )}
          </div>

          <p className="text-sm text-gray-500">
            Quizio looks at your past quiz scores, spots your weakest topics, and builds custom practice sets to help you catch up.
          </p>

          {focusAreas.length === 0 ? (
            <button
              onClick={handleQuizio}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 hover:shadow-md transition-all"
            >
              Analyze Weak Areas
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Your focus areas</p>
              {focusAreas.map((item, idx) => {
                const topic = item.topic;
                const display = item.display || topic;
                const score = item.score;

                let areaStatus = "Weak";
                let color = "text-red-500";
                if (score >= 60) { areaStatus = "Improving"; color = "text-yellow-500"; }
                if (score >= 75) { areaStatus = "Strong"; color = "text-green-500"; }

                return (
                  <button
                    key={idx}
                    onClick={() => startFocusQuiz(item)}
                    disabled={loadingTopic !== null}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl hover:shadow-sm hover:border-purple-200 transition-all flex justify-between items-center"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{formatTopic(display)}</p>
                      <p className={`text-xs font-medium ${color}`}>{areaStatus}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700">{score}%</p>
                      <p className="text-xs text-gray-400">{loadingTopic === topic ? "Generating..." : "Practice"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Suggested Next Steps */}
      {suggestedNextSteps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Suggested Next Steps</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">Smart picks based on your recent activity</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suggestedNextSteps.map((step, index) => (
              <SuggestedStepCard key={index} step={step} navigate={navigate} />
            ))}
          </div>
        </motion.div>
      )}
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
                onClick={() => {
                    if (!step.actionPath) return;
                    navigate(step.actionPath);
                }}
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
    voice_note: { bg: "bg-purple-50", text: "text-purple-600", Icon: Mic },
    flashcard: { bg: "bg-primary-50", text: "text-primary-600", Icon: Brain },
    flashcard_deck: { bg: "bg-primary-50", text: "text-primary-600", Icon: Brain },
    quiz: { bg: "bg-red-50", text: "text-red-600", Icon: TestTube },
    mindmap: { bg: "bg-green-50", text: "text-green-600", Icon: Network2 },
    study_plan: { bg: "bg-indigo-50", text: "text-indigo-600", Icon: PenTool },
    summary: { bg: "bg-yellow-50", text: "text-yellow-600", Icon: Zap },
    folder: { bg: "bg-cyan-50", text: "text-cyan-700", Icon: Folder },
  };

  const toolRouteColors = {
    "/tools/flashcards": { bg: "bg-primary-50", text: "text-primary-600", Icon: Brain },
    "/tools/voice-notes": { bg: "bg-purple-50", text: "text-purple-600", Icon: Mic },
    "/tools/mind-maps": { bg: "bg-green-50", text: "text-green-600", Icon: Network2 },
    "/tools/practice-tests": { bg: "bg-red-50", text: "text-red-600", Icon: TestTube },
    "/tools/summarizer": { bg: "bg-yellow-50", text: "text-yellow-600", Icon: Zap },
    "/tools/study-planner": { bg: "bg-indigo-50", text: "text-indigo-600", Icon: PenTool },
  };

  const routeBase = item.route ? item.route.split("?")[0] : "";
  const typeConfig =
    contentTypeColors[item.contentType] ||
    toolRouteColors[routeBase] || {
      bg: "bg-gray-50",
      text: "text-gray-700",
      Icon: BookOpen,
    };

  const displayTitle =
    item.title ||
    item.rawTitle ||
    (item.contentType === "quiz" ? "Practice Test" : "Untitled");

  const handleNavigate = useCallback(async () => {
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

    const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    try {
      const acct = instance.getActiveAccount() || accounts[0];
      const tokenRes = await instance.acquireTokenSilent({
        account: acct,
        scopes: ["openid", "profile"],
      });

      const token = tokenRes.accessToken || tokenRes.idToken;
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
