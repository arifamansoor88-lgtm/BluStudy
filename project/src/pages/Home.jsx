import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Brain, BookOpen, FileText, Network, Mic, CalendarDays, Zap,
  ArrowRight, Sparkles, CheckCircle2, Clock, ShieldCheck, Smartphone,
  TrendingUp, Quote,
} from "lucide-react";
import { motion } from "framer-motion";
import { useGuest } from "../context/GuestContext";

const tools = [
  { icon: BookOpen,     title: "Flashcards",     bg: "bg-blue-500",   lightBg: "bg-blue-50",   border: "border-blue-100",   text: "text-blue-700" },
  { icon: FileText,     title: "Practice Tests", bg: "bg-red-500",    lightBg: "bg-red-50",    border: "border-red-100",    text: "text-red-700" },
  { icon: Zap,          title: "Summarizer",     bg: "bg-yellow-500", lightBg: "bg-yellow-50", border: "border-yellow-100", text: "text-yellow-700" },
  { icon: Network,      title: "Mind Maps",      bg: "bg-cyan-500",   lightBg: "bg-cyan-50",   border: "border-cyan-100",   text: "text-cyan-700" },
  { icon: Mic,          title: "Voice Notes",    bg: "bg-purple-500", lightBg: "bg-purple-50", border: "border-purple-100", text: "text-purple-700" },
  { icon: CalendarDays, title: "Study Planner",  bg: "bg-green-500",  lightBg: "bg-green-50",  border: "border-green-100",  text: "text-green-700" },
];

const toolDetails = [
  {
    icon: BookOpen, bg: "bg-blue-500", lightBg: "bg-blue-50", border: "border-blue-100", text: "text-blue-700",
    title: "Flashcards",
    desc: "Paste your notes or a topic and get a full deck in seconds — perfect for cramming vocab on the bus or reviewing before a quiz.",
  },
  {
    icon: FileText, bg: "bg-red-500", lightBg: "bg-red-50", border: "border-red-100", text: "text-red-700",
    title: "Practice Tests",
    desc: "Generate a custom quiz from anything you're studying and get instant feedback, so test day never catches you off guard.",
  },
  {
    icon: Zap, bg: "bg-yellow-500", lightBg: "bg-yellow-50", border: "border-yellow-100", text: "text-yellow-700",
    title: "Summarizer",
    desc: "Turn a 40-page reading assignment into a clean, skimmable summary you'll actually read before class.",
  },
  {
    icon: Network, bg: "bg-cyan-500", lightBg: "bg-cyan-50", border: "border-cyan-100", text: "text-cyan-700",
    title: "Mind Maps",
    desc: "See how ideas connect instead of memorizing them in isolation — great for essay outlines and big-picture units.",
  },
  {
    icon: Mic, bg: "bg-purple-500", lightBg: "bg-purple-50", border: "border-purple-100", text: "text-purple-700",
    title: "Voice Notes",
    desc: "Record a lecture or your own thoughts out loud and let AI turn it into organized, readable notes for you.",
  },
  {
    icon: CalendarDays, bg: "bg-green-500", lightBg: "bg-green-50", border: "border-green-100", text: "text-green-700",
    title: "Study Planner",
    desc: "Build a realistic schedule around your exams so you're reviewing a little each day instead of pulling an all-nighter.",
  },
];

const perks = [
  { icon: ShieldCheck,  title: "Free to start",       desc: "Try every tool as a guest — no account, no credit card." },
  { icon: Clock,        title: "Available 24/7",      desc: "Study at 7am before class or 11pm the night before a test." },
  { icon: Smartphone,   title: "Works anywhere",      desc: "Laptop, Chromebook, or phone — it's all in your browser." },
  { icon: TrendingUp,   title: "Gets smarter with you", desc: "Quizio tracks your weak spots and tells you what to review next." },
];

const subjects = [
  "Biology", "Chemistry", "Physics", "U.S. History", "World History",
  "English Lit", "Algebra", "Geometry", "Spanish", "French",
  "Psychology", "Government", "AP Exams", "SAT / ACT Prep",
];

const testimonials = [
  { name: "Maya", meta: "Grade 11", quote: "I used to spend an hour making flashcards by hand. Now I paste my notes in and I'm actually studying five minutes later." },
  { name: "Jordan", meta: "Grade 10", quote: "The practice tests are basically a preview of what my teacher actually asks. My quiz grades went up almost right away." },
  { name: "Priya", meta: "Grade 12, AP student", quote: "The study planner keeps me from cramming everything the night before finals. I just show up and do what it tells me." },
];

const faqs = [
  {
    q: "Is BluStudy actually free?",
    a: "Yes — you can try every tool as a guest with no account and no credit card. Creating a free account just lets you save your work and track your streaks.",
  },
  {
    q: "Do I need to download anything?",
    a: "Nope. BluStudy runs entirely in your browser, so it works on a school Chromebook, your laptop, or your phone.",
  },
  {
    q: "Can I use my own notes and PDFs?",
    a: "Definitely. Upload lecture notes, a textbook chapter, or a slideshow — or just type in a topic if you don't have anything to upload yet.",
  },
  {
    q: "What subjects does it work for?",
    a: "Any subject with text works — math, science, history, languages, AP classes, you name it. The AI adapts to whatever you give it.",
  },
  {
    q: "Will this actually help me study for finals or the SAT?",
    a: "That's exactly what it's built for. Build a study plan around your exam dates, generate practice tests, and let Quizio point out what to review next.",
  },
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

            <p className="mt-4 text-sm text-gray-400">
              No credit card. No downloads. Just pick a tool and start studying.
            </p>
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
        </div>
      </div>

      {/* Tool deep-dive */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Everything you need, in one place</h2>
          <p className="mt-2 text-gray-500 max-w-2xl mx-auto">
            Six tools that cover the whole study grind — from your first read-through to the night before the test.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {toolDetails.map((tool) => (
            <div key={tool.title} className={`${tool.lightBg} ${tool.border} border rounded-2xl p-6`}>
              <div className={`${tool.bg} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                <tool.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className={`text-base font-bold mb-1.5 ${tool.text}`}>{tool.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Why students like it */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Why students actually stick with it</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {perks.map((perk) => (
              <div key={perk.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                <div className="mx-auto mb-4 h-11 w-11 rounded-xl bg-primary-50 flex items-center justify-center">
                  <perk.icon className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{perk.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{perk.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subjects */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Works for whatever class is stressing you out</h2>
          <p className="mt-2 text-gray-500">If it has notes or a textbook, BluStudy can help you study it.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
          {subjects.map((subject) => (
            <span
              key={subject}
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 shadow-sm"
            >
              {subject}
            </span>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">What students are saying</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
                <Quote className="h-5 w-5 text-primary-300 mb-3" />
                <p className="text-sm text-gray-600 leading-relaxed flex-1">"{t.quote}"</p>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Questions? We got you.</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-gray-900 text-sm">
                {faq.q}
                <span className="ml-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-br from-gray-950 via-primary-900 to-gray-900 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-6">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to make studying suck less?
          </h2>
          <p className="mt-4 text-gray-400 text-lg">
            Jump in as a guest right now, or create a free account to save your progress.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-7 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-base transition-colors"
            >
              Create a free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={handleTryOut}
              className="inline-flex items-center gap-2 px-7 py-3 border-2 border-dashed border-white/20 hover:border-primary-400 hover:bg-white/5 text-white font-semibold rounded-xl text-base transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Try it without an account
            </button>
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Free forever · no credit card needed
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
