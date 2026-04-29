import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, Loader2, RotateCcw } from "lucide-react";
import { fetchSharedPreview, getSharedItemOpenPath, importSharedItem } from "../../utils/shareLinks";

const StructuredContent = ({ value, level = 0 }) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return (
      <p className={level === 0 ? "text-slate-700 whitespace-pre-wrap" : "text-slate-600 whitespace-pre-wrap"}>
        {String(value)}
      </p>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <StructuredContent value={item} level={level + 1} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(value).map(([key, nestedValue]) => (
        <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            {key.replace(/_/g, " ")}
          </h4>
          <StructuredContent value={nestedValue} level={level + 1} />
        </div>
      ))}
    </div>
  );
};

const QuizPreview = ({ questions = [] }) => (
  <div className="space-y-4">
    {questions.map((question, index) => {
      const prompt =
        question.question ||
        question.prompt ||
        question.text ||
        question.title ||
        `Question ${index + 1}`;

      const options = question.options || question.choices || question.answers || [];

      return (
        <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-500">
            Question {index + 1}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{prompt}</h3>
          {Array.isArray(options) && options.length > 0 && (
            <div className="mt-4 grid gap-3">
              {options.map((option, optionIndex) => (
                <div
                  key={optionIndex}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  {typeof option === "string" ? option : JSON.stringify(option)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const FlashcardPreview = ({ title, cards = [] }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setCurrentCard(0);
    setShowAnswer(false);
  }, [title]);

  if (!cards.length) {
    return null;
  }

  const activeCard = cards[currentCard];

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Card {currentCard + 1} of {cards.length}
        </span>
        <button
          type="button"
          onClick={() => setShowAnswer((value) => !value)}
          className="rounded-full border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAnswer ? "Show question" : "Flip card"}
        </button>
      </div>

      <div className="mt-6 rounded-[1.75rem] bg-gradient-to-br from-blue-50 via-white to-slate-50 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          {showAnswer ? "Answer" : "Question"}
        </p>
        <p className="mt-4 text-2xl font-semibold leading-relaxed text-slate-900">
          {showAnswer ? activeCard.answer : activeCard.question}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setCurrentCard((value) => Math.max(0, value - 1));
            setShowAnswer(false);
          }}
          disabled={currentCard === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => {
            setCurrentCard((value) => Math.min(cards.length - 1, value + 1));
            setShowAnswer(false);
          }}
          disabled={currentCard === cards.length - 1}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const SharedItemPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [sharedData, setSharedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchSharedPreview(token);
        setSharedData(data);
      } catch (err) {
        console.error("Failed to load shared item:", err);
        setError(err.message || "Unable to load this shared item");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadPreview();
    }
  }, [token]);

  const preview = sharedData?.preview || {};
  const contentType = sharedData?.contentType;

  const pageTitle = useMemo(() => {
    if (!preview?.title) return "Shared Study Content";
    return preview.title;
  }, [preview]);

  const handleImport = async () => {
    try {
      setImporting(true);
      const imported = await importSharedItem(token);
      navigate(getSharedItemOpenPath(imported.contentType, imported.id));
    } catch (err) {
      console.error("Failed to import shared item:", err);
      setError(err.message || "Unable to import this shared item");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_transparent_38%),linear-gradient(180deg,#f8fbff_0%,#ffffff_70%)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-3 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading shared content...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-lg font-semibold text-red-700">This share link isn't available.</p>
              <p className="mt-2 text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-6 border-b border-slate-100 pb-8 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
                    Shared Study Content
                  </p>
                  <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                    {pageTitle}
                  </h1>
                  <p className="mt-3 text-base text-slate-600">
                    Shared by {sharedData?.owner?.displayName || "a classmate"}
                  </p>
                  {preview?.subtitle && (
                    <p className="mt-2 text-sm text-slate-500">{preview.subtitle}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Add to my workspace
                    </>
                  )}
                </button>
              </div>

              <div className="mt-8">
                {contentType === "flashcard_deck" && (
                  <FlashcardPreview title={preview.title} cards={preview.cards} />
                )}

                {contentType === "quiz" && <QuizPreview questions={preview.questions} />}

                {contentType === "summary" && (
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                    {preview.description && (
                      <p className="mb-6 text-sm leading-7 text-slate-500">{preview.description}</p>
                    )}
                    <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700">
                      {preview.summary}
                    </div>
                  </div>
                )}

                {contentType === "study_plan" && (
                  <div className="space-y-6">
                    {preview.description && (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
                        {preview.description}
                      </div>
                    )}
                    {Array.isArray(preview.tags) && preview.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {preview.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <StructuredContent value={preview.content} />
                  </div>
                )}

                {!["flashcard_deck", "quiz", "summary", "study_plan"].includes(contentType) && (
                  <StructuredContent value={preview} />
                )}
              </div>

              <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
                <RotateCcw className="h-4 w-4" />
                Importing creates a separate copy in your workspace.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedItemPage;
