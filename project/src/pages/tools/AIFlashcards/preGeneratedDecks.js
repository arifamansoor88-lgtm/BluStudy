export const PREGENERATED_DECK_PREFIX = "pregenerated-";

const sampleDeckModules = {
  ...import.meta.glob("../../../../sample_flashcards/**/*.json", {
    eager: true,
    import: "default",
    query: "?raw",
  }),
  ...import.meta.glob("../../../../sample_flashcards/**/*.JSON", {
    eager: true,
    import: "default",
    query: "?raw",
  }),
};

const FEATURED_DECK_PATHS = [
  "general.json",
  "Chemistry 11/Unit 1.json",
  "Grade_10_Math/Linear Systems.JSON",
  "Grade_12_Math/Derivative.JSON",
];

const CATEGORY_ORDER = [
  "General",
  "Chemistry 11",
  "Ontario Grade 9 Math",
  "Grade 10 Math",
  "Grade 11 Math",
  "Grade 12 Math",
];

const stripExtension = (value = "") => value.replace(/\.[^.]+$/, "");

const toDisplayText = (value = "") =>
  value.replace(/_/g, " ").replace(/\s+/g, " ").trim();

const toComparableText = (value = "") => toDisplayText(value).toLowerCase();

const slugify = (value = "") =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const normalizeCard = (card = {}) => ({
  question: card.question ?? card.front ?? "",
  answer: card.answer ?? card.back ?? "",
  difficulty: card.difficulty ?? "medium",
  important: card.important ?? false,
});

const chooseDeckTitle = (rawTitle, fileLabel) => {
  const cleanedRawTitle = rawTitle?.trim();

  if (!cleanedRawTitle) {
    return fileLabel;
  }

  if (fileLabel.toLowerCase() === "general") {
    return cleanedRawTitle;
  }

  const comparableRawTitle = toComparableText(cleanedRawTitle);
  const comparableFileLabel = toComparableText(fileLabel);

  if (
    comparableRawTitle.includes(comparableFileLabel) ||
    comparableFileLabel.includes(comparableRawTitle)
  ) {
    return cleanedRawTitle.length >= fileLabel.length
      ? cleanedRawTitle
      : fileLabel;
  }

  if (
    /^(unit|chapter)\b/i.test(fileLabel) ||
    /exam review|final exam/i.test(fileLabel)
  ) {
    return cleanedRawTitle;
  }

  return fileLabel;
};

const getCategoryRank = (categoryLabel) => {
  const categoryIndex = CATEGORY_ORDER.indexOf(categoryLabel);
  return categoryIndex === -1 ? CATEGORY_ORDER.length : categoryIndex;
};

const parseDeckModule = (moduleValue, relativePath) => {
  try {
    return typeof moduleValue === "string"
      ? JSON.parse(moduleValue)
      : moduleValue?.default ?? moduleValue;
  } catch (error) {
    console.error(`Failed to parse sample flashcards at ${relativePath}`, error);
    return null;
  }
};

const buildPreGeneratedDeck = ([modulePath, moduleValue]) => {
  const relativePath = modulePath.split("sample_flashcards/")[1] ?? modulePath;
  const pathSegments = relativePath.split("/");
  const fileName = pathSegments.pop() ?? "deck.json";
  const folderName = pathSegments.pop() ?? "General";
  const rawDeck = parseDeckModule(moduleValue, relativePath);

  if (!rawDeck) {
    return null;
  }

  const cards = Array.isArray(rawDeck?.cards)
    ? rawDeck.cards.map(normalizeCard).filter((card) => card.question || card.answer)
    : [];
  const fileLabel = toDisplayText(stripExtension(fileName));
  const categoryLabel = toDisplayText(folderName);
  const title = chooseDeckTitle(rawDeck?.title, fileLabel);
  const slug = slugify(`${categoryLabel}-${title}`);

  return {
    id: `${PREGENERATED_DECK_PREFIX}${slug}`,
    slug,
    path: relativePath,
    categoryLabel,
    title,
    cards,
    cardCount: cards.length,
    featured: FEATURED_DECK_PATHS.includes(relativePath),
  };
};

export const preGeneratedDecks = Object.entries(sampleDeckModules)
  .map(buildPreGeneratedDeck)
  .filter((deck) => deck && deck.cardCount > 0)
  .sort((firstDeck, secondDeck) => {
    const categoryRankDifference =
      getCategoryRank(firstDeck.categoryLabel) -
      getCategoryRank(secondDeck.categoryLabel);

    if (categoryRankDifference !== 0) {
      return categoryRankDifference;
    }

    return firstDeck.title.localeCompare(secondDeck.title);
  });

export const featuredPreGeneratedDecks = [
  ...FEATURED_DECK_PATHS.map((path) =>
    preGeneratedDecks.find((deck) => deck.path === path)
  ).filter(Boolean),
  ...preGeneratedDecks.filter((deck) => !FEATURED_DECK_PATHS.includes(deck.path)),
].slice(0, 4);

export const isPreGeneratedDeckId = (deckId = "") =>
  deckId.startsWith(PREGENERATED_DECK_PREFIX);

export const getPreGeneratedDeckById = (deckIdOrSlug = "") => {
  const slug = deckIdOrSlug.startsWith(PREGENERATED_DECK_PREFIX)
    ? deckIdOrSlug.slice(PREGENERATED_DECK_PREFIX.length)
    : deckIdOrSlug;

  return preGeneratedDecks.find((deck) => deck.slug === slug) ?? null;
};
