import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { getTasks } from "../api/apiService";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Trophy,
  Star,
  Target,
  BookOpen,
  Calendar,
  User,
} from "lucide-react";
import { motion } from "framer-motion";

const Dashboard = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [streakDays, setStreakDays] = useState(0);

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

  const teachers = [
    {
      name: "Dr. Sarah Wilson",
      subject: "Mathematics",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    },
    {
      name: "Prof. Michael Chen",
      subject: "Physics",
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
    },
  ];

  const schedule = [
    {
      subject: "Mathematics",
      time: "09:00 - 10:30 AM",
      teacher: "Dr. Sarah Wilson",
    },
    {
      subject: "Physics",
      time: "11:00 - 12:30 PM",
      teacher: "Prof. Michael Chen",
    },
    {
      subject: "Study Group",
      time: "02:00 - 03:30 PM",
      teacher: "Peer Learning",
    },
  ];

  const goals = [
    { title: "Complete Calculus Module", progress: 75 },
    { title: "Physics Lab Report", progress: 40 },
    { title: "Weekly Quiz Prep", progress: 90 },
  ];

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
      {/* User greeting */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, {firstName}!
        </h1>
        <p className="text-gray-600">
          You're signed in as <span className="font-medium">{email}</span>
        </p>
      </div>
      {/* Study Streak Box */}
      <div className="bg-gradient-to-r from-orange-500 to-yellow-400 text-black px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 w-fit border border-orange-500">
        <span className="text-2xl">🔥</span>
          <span className="text-lg font-bold tracking-wide">
            {streakDays === 0
    ? "Hey! Let's create a study streak 🚀"
    : `${streakDays} Day${streakDays === 1 ? "" : "s"} Streak`}
</span>
  <span className="text-2xl">⭐</span>
</div>
      {/* Achievements Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm p-6 mb-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Recent Achievements
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AchievementCard
            icon={Trophy}
            title="7 Day Streak"
            description="Consistent learning pays off!"
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <AchievementCard
            icon={Star}
            title="Top Student"
            description="Ranked #1 in Physics"
            color="text-yellow-600"
            bgColor="bg-yellow-100"
          />
          <AchievementCard
            icon={BookOpen}
            title="Quick Learner"
            description="Completed 5 modules this week"
            color="text-green-600"
            bgColor="bg-green-100"
          />
        </div>
      </motion.div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tasks section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Tasks</h2>

        {loading ? (
          <p className="text-gray-500">Loading tasks...</p>
        ) : tasks.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {tasks.map((task, index) => (
              <li key={index} className="py-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    readOnly
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <span className="ml-3 text-gray-900">{task.title}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No tasks available.</p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8"
      >
        {/* Teachers Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <User className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Your Teachers
            </h2>
          </div>
          <div className="space-y-4">
            {teachers.map((teacher, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <img
                  src={teacher.image}
                  alt={teacher.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-medium text-gray-900">{teacher.name}</h3>
                  <p className="text-sm text-gray-500">{teacher.subject}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Schedule Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Today's Schedule
            </h2>
          </div>
          <div className="space-y-4">
            {schedule.map((item, index) => (
              <div key={index} className="p-4 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{item.subject}</h3>
                  <span className="text-sm text-primary-600">{item.time}</span>
                </div>
                <p className="text-sm text-gray-500">{item.teacher}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Goals Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Target className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Learning Goals
            </h2>
          </div>
          <div className="space-y-6">
            {goals.map((goal, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-900">
                    {goal.title}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {goal.progress}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.progress}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-primary-600 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
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

export default Dashboard;
