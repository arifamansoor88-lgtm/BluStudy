import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, BookOpen, FileText, Network, Mic, CalendarDays, Zap, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useGuest } from "../context/GuestContext";

const tools = [
  { icon: BookOpen,    title: "Flashcards",      bg: "bg-blue-500",   lightBg: "bg-blue-50",   border: "border-blue-100",   text: "text-blue-700" },
  { icon: FileText,    title: "Practice Tests",  bg: "bg-red-500",    lightBg: "bg-red-50",    border: "border-red-100",    text: "text-red-700" },
  { icon: Zap,         title: "Summarizer",      bg: "bg-yellow-500", lightBg: "bg-yellow-50", border: "border-yellow-100", text: "text-yellow-700" },
  { icon: Network,     title: "Mind Maps",       bg: "bg-cyan-500",   lightBg: "bg-cyan-50",   border: "border-cyan-100",   text: "text-cyan-700" },
  { icon: Mic,         title: "Voice Notes",     bg: "bg-purple-500", lightBg: "bg-purple-50", border: "border-purple-100", text: "text-purple-700" },
  { icon: CalendarDays,title: "Study Planner",   bg: "bg-green-500",  lightBg: "bg-green-50",  border: "border-green-100",  text: "text-green-700" },
];


const Home = () => {
  const { enterGuest } = useGuest();
  const navigate = useNavigate();

  const handleTryOut = () => {
    enterGuest();
    navigate("/tools/flashcards");
  };

  return (
    <div className="min-h-screen bg-white">

      {/* Hero — split layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-12">

          {/* Left: copy */}
          <motion.div
            className="flex-1 text-left"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary-600 mb-4">
              Built for high school students
            </span>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
              Study smarter.<br />
              <span className="text-primary-600">Score higher.</span>
            </h1>
            <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-lg">
              BluStudy uses AI to turn your notes and PDFs into flashcards, quizzes, summaries, and study plans. Spend less time preparing and more time actually learning.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-7 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-base transition-colors"
              >
                Create an account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={handleTryOut}
                className="inline-flex items-center gap-2 px-7 py-3 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 text-gray-600 hover:text-primary-700 font-semibold rounded-xl text-base transition-all"
              >
                <Sparkles className="h-4 w-4" />
                Try it out
              </button>
            </div>
          </motion.div>

          {/* Right: floating tool grid preview */}
          <motion.div
            className="flex-1 w-full max-w-sm lg:max-w-none"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="grid grid-cols-2 gap-3">
              {tools.map((tool, i) => (
                <motion.div
                  key={tool.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i + 0.3 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className={`${tool.lightBg} ${tool.border} border rounded-2xl p-6 flex items-center gap-4`}
                >
                  <div className={`${tool.bg} w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <tool.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className={`text-lg font-semibold ${tool.text}`}>{tool.title}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">From notes to mastery in 3 steps</h2>
            <p className="mt-2 text-gray-500">No setup. No complicated workflows. Just results.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Upload your material", desc: "Drop in a PDF, paste your notes, record your voice, or just type in a topic you need to study.", color: "text-primary-600", bar: "bg-primary-500" },
              { n: "02", title: "Let AI do the work",   desc: "BluStudy generates flashcards, quizzes, and summaries instantly.", color: "text-purple-600", bar: "bg-purple-500" },
              { n: "03", title: "Study and improve",    desc: "Practice with your tools, track your streak, and get personalized recommendations on what to cover next based on what you have studied so far.", color: "text-green-600", bar: "bg-green-500" },
            ].map((step) => (
              <div key={step.n} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className={`text-3xl font-black ${step.color} mb-3`}>{step.n}</div>
                <div className={`h-1 w-10 ${step.bar} rounded-full mb-4`} />
                <h3 className="text-base font-bold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-base transition-colors"
            >
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
