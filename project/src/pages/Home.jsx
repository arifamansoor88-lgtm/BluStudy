import React from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Brain,
  BookOpen,
  FileText,
  Network,
  Mic,
  CalendarDays,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: BookOpen,
    title: "Flashcards",
    description:
      "Turn your notes and study materials into quick, interactive flashcards.",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    icon: FileText,
    title: "Practice Tests",
    description:
      "Generate quizzes and test your understanding with adaptive practice.",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    icon: Brain,
    title: "Smart Summaries",
    description:
      "Break down long readings and notes into clear, focused summaries.",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    icon: Network,
    title: "Mind Maps",
    description:
      "Visualize concepts, connections, and ideas to study more effectively.",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  {
    icon: Mic,
    title: "Voice Notes",
    description:
      "Capture ideas on the go and turn them into useful study material.",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  {
    icon: CalendarDays,
    title: "Study Planner",
    description:
      "Create personalized study plans based on your workload and goals.",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
];

const Home = () => {
  return (
    <div className="bg-[#f6f7fb]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-16 sm:py-24"
        >
          <div className="text-center max-w-5xl mx-auto">
            <motion.h1
              className="text-4xl sm:text-4xl md:text-6xl leading-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                Your All-in-One Study Toolkit!
              </span>
              <br />
            </motion.h1>

            <motion.p
              className="mt-6 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              BluStudy helps students turn notes, PDFs, and ideas into
              flashcards, practice tests, summaries, mind maps, and
              personalized study plans.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Link
                to="/signup"
                className="button-primary inline-flex items-center"
              >
                Sign Up for Free
                <Sparkles className="ml-2 h-4 w-4" />
              </Link>

              <Link
                to="/signin"
                className="button-secondary inline-flex items-center"
              >
                Sign In
                <BookOpen className="ml-2 h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          <motion.div
            className="mt-24"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  color={feature.color}
                  bgColor={feature.bgColor}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            className="mt-24 bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-gray-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <h2 className="text-center text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-center text-lg text-gray-600 max-w-3xl mx-auto mb-12">
              Go from messy study materials to structured learning tools in just
              a few steps.
            </p>

            <div className="grid gap-8 grid-cols-1 md:grid-cols-3">
              <StepCard
                number="1"
                title="Upload"
                description="Add your notes, PDFs, or voice recordings to begin."
                numberBg="bg-blue-100"
                numberText="text-blue-600"
              />
              <StepCard
                number="2"
                title="Generate"
                description="Create flashcards, quizzes, summaries, and mind maps instantly."
                numberBg="bg-purple-100"
                numberText="text-purple-600"
              />
              <StepCard
                number="3"
                title="Study"
                description="Practice smarter and stay on track with your goals."
                numberBg="bg-green-100"
                numberText="text-green-600"
              />
            </div>

            <div className="mt-10 text-center">
              <Link to="/signup" className="button-primary inline-flex items-center">
                Get Started
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, description, color, bgColor }) => (
  <motion.div
    className="rounded-2xl p-6 bg-white border border-gray-100 shadow-sm"
    whileHover={{ scale: 1.02 }}
  >
    <div
      className={`${bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}
    >
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
    <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 leading-7">{description}</p>
  </motion.div>
);

const StepCard = ({ number, title, description, numberBg, numberText }) => (
  <div className="rounded-2xl border border-gray-100 p-6 text-center">
    <div
      className={`${numberBg} ${numberText} w-12 h-12 rounded-full flex items-center justify-center mx-auto text-lg font-bold`}
    >
      {number}
    </div>
    <h3 className="mt-4 text-xl font-semibold text-gray-900">{title}</h3>
    <p className="mt-2 text-gray-600 leading-7">{description}</p>
  </div>
);

export default Home;