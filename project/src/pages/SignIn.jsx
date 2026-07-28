import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Brain, Layers, ClipboardList, Zap, CalendarDays,
  ArrowRight, Sparkles, BookOpen, TrendingUp,
} from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { motion } from "framer-motion";
import { protectedResources } from "../authConfig";
import { useGuest } from "../context/GuestContext";

const FEATURES = [
  { icon: Zap,           label: "AI Summarizer",      desc: "Turn any PDF or notes into a clean summary in seconds." },
  { icon: Layers,        label: "Smart Flashcards",   desc: "Auto-generate decks from your material, study with spaced repetition." },
  { icon: ClipboardList, label: "Practice Tests",     desc: "Custom quizzes with instant feedback and performance tracking." },
  { icon: TrendingUp,    label: "Quizio",             desc: "AI detects your weakest topics and builds targeted practice sets." },
  { icon: CalendarDays,  label: "Study Planner",      desc: "Build a smart study schedule around your exams." },
  { icon: BookOpen,      label: "My Library",         desc: "All your study materials in one organised place." },
];

export default function SignIn() {
  const { instance, accounts } = useMsal();
  const { enterGuest } = useGuest();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (accounts.length > 0) navigate("/dashboard");
  }, [accounts, navigate]);

  const handleLogin = async () => {
    try {
      setError(null);
      setLoggingIn(true);
      const result = await instance.loginPopup({ scopes: protectedResources.todoListApi.scopes });
      if (result?.account) {
        instance.setActiveAccount(result.account);
        setTimeout(() => navigate("/dashboard"), 100);
      }
    } catch (e) {
      if (e.message?.includes("user_cancelled") || e.errorCode === "user_cancelled") return;
      if (e.errorCode === "interaction_in_progress" || e.message?.includes("interaction_in_progress")) {
        setError("A sign-in window is already open.");
        return;
      }
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleGuest = () => {
    enterGuest();
    navigate("/tools/flashcards");
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[58%] bg-gradient-to-br from-gray-950 via-primary-950 to-gray-900 flex-col justify-between p-12 relative overflow-hidden">

        {/* Background glow */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded-xl bg-primary-600 flex items-center justify-center">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">BluStudy</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-10">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight"
            >
              Study smarter.<br />
              <span className="text-primary-400">Score higher.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-4 text-base text-gray-400 leading-relaxed max-w-md"
            >
              BluStudy turns your notes and PDFs into flashcards, quizzes, summaries, and personalised study plans — all powered by AI.
            </motion.p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <f.icon className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-white">{f.label}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer quote */}
        <p className="text-xs text-gray-600 relative z-10">
          Built for students who want results, not busywork.
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8 space-y-5"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden mb-1">
            <Brain className="h-7 w-7 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">BluStudy</span>
          </div>

          <div className="text-center">
            <span className="text-3xl">👋</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in, or jump right in as a guest.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Sign in button */}
          <button
            onClick={handleLogin}
            disabled={loggingIn}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loggingIn ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Signing in…
              </span>
            ) : (
              <>Sign in <ArrowRight className="h-4 w-4" /></>
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Try as guest */}
          <button
            onClick={handleGuest}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 text-gray-600 hover:text-primary-700 font-semibold text-sm transition-all group"
          >
            <Sparkles className="h-4 w-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
            Continue as guest
          </button>
          <p className="text-center text-xs text-gray-400">
            Free forever · no credit card needed
          </p>
        </motion.div>
      </div>
    </div>
  );
}
