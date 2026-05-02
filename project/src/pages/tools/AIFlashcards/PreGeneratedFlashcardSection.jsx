import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import {
  featuredPreGeneratedDecks,
  preGeneratedDecks,
} from "./preGeneratedDecks";

const getDeckAppearance = (categoryLabel) => {
  const normalizedCategory = categoryLabel.toLowerCase();

  if (normalizedCategory.includes("chemistry")) {
    return {
      icon: FlaskConical,
      badgeClass: "bg-emerald-50 text-emerald-700",
      iconClass: "bg-emerald-100 text-emerald-700",
      buttonClass:
        "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white",
    };
  }

  if (normalizedCategory.includes("ontario")) {
    return {
      icon: GraduationCap,
      badgeClass: "bg-amber-50 text-amber-700",
      iconClass: "bg-amber-100 text-amber-700",
      buttonClass:
        "bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white",
    };
  }

  if (normalizedCategory.includes("grade")) {
    return {
      icon: Calculator,
      badgeClass: "bg-blue-50 text-blue-700",
      iconClass: "bg-blue-100 text-blue-700",
      buttonClass:
        "bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white",
    };
  }

  if (normalizedCategory.includes("general")) {
    return {
      icon: Sparkles,
      badgeClass: "bg-violet-50 text-violet-700",
      iconClass: "bg-violet-100 text-violet-700",
      buttonClass:
        "bg-violet-50 text-violet-700 group-hover:bg-violet-600 group-hover:text-white",
    };
  }

  return {
    icon: BookOpenCheck,
    badgeClass: "bg-slate-100 text-slate-700",
    iconClass: "bg-slate-200 text-slate-700",
    buttonClass:
      "bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white",
  };
};

const DeckCard = ({ deck, onDeckSelect }) => {
  const appearance = getDeckAppearance(deck.categoryLabel);
  const Icon = appearance.icon;

  return (
    <button
      type="button"
      onClick={() => onDeckSelect(deck)}
      className="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${appearance.iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${appearance.badgeClass}`}
        >
          {deck.categoryLabel}
        </span>
      </div>

      <h3 className="mt-5 min-h-[3.5rem] text-lg font-semibold leading-7 text-gray-900">
        {deck.title}
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        {deck.cardCount} flashcards ready to study
      </p>

      <div
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${appearance.buttonClass}`}
      >
        Study Deck
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  );
};

const PreGeneratedFlashcardSection = ({ onDeckSelect }) => {
  const [showAllDecks, setShowAllDecks] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  if (!preGeneratedDecks.length) {
    return null;
  }

  const categories = [
    "All",
    ...new Set(preGeneratedDecks.map((deck) => deck.categoryLabel)),
  ];

  const filteredDecks =
    selectedCategory === "All"
      ? preGeneratedDecks
      : preGeneratedDecks.filter(
          (deck) => deck.categoryLabel === selectedCategory
        );

  const previewDecks = featuredPreGeneratedDecks.length
    ? featuredPreGeneratedDecks
    : preGeneratedDecks.slice(0, 4);

  const visibleDecks = showAllDecks ? filteredDecks : previewDecks;

  return (
    <section className="mt-20">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Explore Pre-Generated Flashcard Decks
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Jump straight into ready-made decks from the sample library, or
            browse the full collection of {preGeneratedDecks.length} decks.
          </p>
        </div>

        {showAllDecks && (
          <p className="text-sm text-gray-500">
            {filteredDecks.length} deck{filteredDecks.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {showAllDecks && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => {
            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {visibleDecks.map((deck) => (
          <DeckCard
            key={deck.id}
            deck={deck}
            onDeckSelect={onDeckSelect}
          />
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => {
            setShowAllDecks((previousState) => !previousState);
            setSelectedCategory("All");
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
        >
          {showAllDecks
            ? "Show featured decks"
            : `Browse all ${preGeneratedDecks.length} pre-generated flashcards`}
          {showAllDecks ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
    </section>
  );
};

export default PreGeneratedFlashcardSection;
