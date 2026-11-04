export type SimilarityBand = "Very high" | "High" | "Moderate" | "Low" | "No comparison";

export type TitleMatch = {
  protocolId: string;
  title: string;
  score: number;
  cosine: number;
  jaccard: number;
  edit: number;
};

export type TitleSimilarity = {
  score: number;
  band: SimilarityBand;
  matches: TitleMatch[];
  corpusSize: number;
  assessedAt: string;
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "among", "from", "by",
  "at", "as", "is", "are", "was", "were", "be", "been", "this", "that", "these", "those", "its",
  "their", "study", "research", "investigation", "assessment", "evaluation", "analysis", "using",
  "based", "towards", "toward", "into", "over", "under", "between", "within", "without", "about",
]);

function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Light stemming keeps the estimator explainable and avoids a language-specific NLP dependency. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map(stem);
}

function frequency(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>, idf: Map<string, number>): number {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  const vocab = new Set([...a.keys(), ...b.keys()]);
  for (const token of vocab) {
    const weight = idf.get(token) ?? 1;
    const av = (a.get(token) ?? 0) * weight;
    const bv = (b.get(token) ?? 0) * weight;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  if (!aNorm || !bNorm) return 0;
  return dot / Math.sqrt(aNorm * bNorm);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size && !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let row = 1; row < rows; row += 1) {
    const current = [row];
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      current[col] = Math.min(current[col - 1] + 1, previous[col] + 1, previous[col - 1] + cost);
    }
    previous = current;
  }
  return previous[cols - 1] ?? 0;
}

function editSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (!max) return 0;
  return Math.max(0, 1 - levenshtein(a, b) / max);
}

function bandFor(score: number, hasCorpus: boolean): SimilarityBand {
  if (!hasCorpus) return "No comparison";
  if (score >= 0.85) return "Very high";
  if (score >= 0.7) return "High";
  if (score >= 0.5) return "Moderate";
  return "Low";
}

/**
 * Composite lexical similarity:
 *   TF-IDF token cosine (55%), token-set Jaccard (25%), normalized edit similarity (20%).
 * The result is a screening aid, not a finding of plagiarism or duplicate research.
 */
export function assessTitleSimilarity(
  title: string,
  corpus: { id: string; title: string }[],
): TitleSimilarity {
  const targetTokens = tokenize(title);
  const normalizedTarget = normalize(title);
  const candidates = corpus.filter((item) => item.title.trim().length > 0);
  if (!candidates.length || !targetTokens.length) {
    return {
      score: 0,
      band: "No comparison",
      matches: [],
      corpusSize: candidates.length,
      assessedAt: new Date().toISOString(),
    };
  }

  const documents = [targetTokens, ...candidates.map((item) => tokenize(item.title))];
  const documentFrequency = new Map<string, number>();
  for (const tokens of documents) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [token, df] of documentFrequency) {
    idf.set(token, Math.log((documents.length + 1) / (df + 1)) + 1);
  }

  const targetFrequency = frequency(targetTokens);
  const matches: TitleMatch[] = candidates.map((candidate, index) => {
    const candidateTokens = documents[index + 1] ?? [];
    const cosine = cosineSimilarity(targetFrequency, frequency(candidateTokens), idf);
    const jaccard = jaccardSimilarity(targetTokens, candidateTokens);
    const edit = editSimilarity(normalizedTarget, normalize(candidate.title));
    const score = Math.max(0, Math.min(1, 0.55 * cosine + 0.25 * jaccard + 0.2 * edit));
    return {
      protocolId: candidate.id,
      title: candidate.title,
      score,
      cosine,
      jaccard,
      edit,
    };
  });

  matches.sort((a, b) => b.score - a.score);
  const top = matches.slice(0, 5);
  const score = top[0]?.score ?? 0;
  return {
    score,
    band: bandFor(score, candidates.length > 0),
    matches: top,
    corpusSize: candidates.length,
    assessedAt: new Date().toISOString(),
  };
}
