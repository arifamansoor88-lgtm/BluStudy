import { useState, useRef } from "react";
import { ArrowRight, BookOpenCheck, Calculator, ChevronLeft, ChevronRight, FlaskConical, GraduationCap, Sparkles } from "lucide-react";
import { preGeneratedDecks } from "./preGeneratedDecks";

const getDeckAppearance = (categoryLabel) => {
  const c = categoryLabel.toLowerCase();
  if (c.includes("chemistry")) return { icon: FlaskConical, iconClass: "bg-emerald-100 text-emerald-700", badgeClass: "bg-emerald-50 text-emerald-700", accent: "bg-emerald-500" };
  if (c.includes("ontario"))   return { icon: GraduationCap, iconClass: "bg-amber-100 text-amber-700",   badgeClass: "bg-amber-50 text-amber-700",   accent: "bg-amber-500" };
  if (c.includes("grade"))     return { icon: Calculator,    iconClass: "bg-blue-100 text-blue-700",     badgeClass: "bg-blue-50 text-blue-700",     accent: "bg-blue-500" };
  if (c.includes("general"))   return { icon: Sparkles,      iconClass: "bg-violet-100 text-violet-700", badgeClass: "bg-violet-50 text-violet-700", accent: "bg-violet-500" };
  return                               { icon: BookOpenCheck, iconClass: "bg-slate-100 text-slate-700",   badgeClass: "bg-slate-100 text-slate-700",   accent: "bg-slate-500" };
};

const CARDS_PER_PAGE = 4;

const PreGeneratedFlashcardSection = ({ onDeckSelect }) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(preGeneratedDecks.length / CARDS_PER_PAGE);
  const visible = preGeneratedDecks.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);

  if (!preGeneratedDecks.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pre-Made Decks</h2>
          <p className="text-sm text-gray-400">{preGeneratedDecks.length} ready-to-study decks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visible.map((deck) => {
          const { icon: Icon, iconClass, badgeClass, accent } = getDeckAppearance(deck.categoryLabel);
          return (
            <button
              key={deck.id}
              type="button"
              onClick={() => onDeckSelect(deck)}
              className="group text-left bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
            >
              <div className={`h-1 ${accent}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
                    {deck.categoryLabel}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1 min-h-[2.5rem]">
                  {deck.title}
                </h3>
                <p className="text-xs text-gray-400 mb-3">{deck.cardCount} cards</p>
                <div className="flex items-center gap-1 text-xs font-medium text-primary-600 group-hover:gap-2 transition-all">
                  Study now <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-4">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`h-1.5 rounded-full transition-all ${i === page ? "w-4 bg-primary-600" : "w-1.5 bg-gray-300"}`}
          />
        ))}
      </div>
    </section>
  );
};

export default PreGeneratedFlashcardSection;
