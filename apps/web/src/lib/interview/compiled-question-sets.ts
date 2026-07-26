import { getR2Json } from "@/lib/r2/client";

export type CompiledDifficulty = "easy" | "medium" | "hard";

export type CompiledCodingQuestionRef = {
  category: string;
  difficulty: CompiledDifficulty;
  id: string;
  source: "leetcode" | "geeksforgeeks" | "codingninjas";
  sourceCollectionUrl: string;
  title: string;
};

export type CompiledAptitudeQuestionRef = {
  category: string;
  correctOptionId: "a" | "b" | "c" | "d";
  difficulty: "easy" | "medium";
  explanation: string;
  id: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  options: [string, string, string, string];
  prompt: string;
  source: "indiabix" | "learntheta";
  sourceCollectionUrl: string;
};

type CompiledQuestionSets = {
  compiledCodingQuestionRefs: CompiledCodingQuestionRef[];
  compiledAptitudeQuestionRefs: CompiledAptitudeQuestionRef[];
};

/**
 * This bank used to be generated at module-load time from hardcoded LeetCode/GFG/CodingNinjas title seeds (coding)
 * and procedurally-built numeric aptitude questions (see compiled-sources.md for the generation notes) - all pure
 * functions of static literals, so the output is fully deterministic. To get it out of the app bundle, that
 * generation was run once and the resulting arrays were uploaded as-is to
 * R2 `interview-content/compiled-question-sets.json` (see apps/web's migration script history) - this module now
 * just fetches and caches that precomputed output instead of recomputing it on every server start.
 */
let cache: CompiledQuestionSets | null = null;
let loadPromise: Promise<CompiledQuestionSets> | null = null;

export async function ensureCompiledQuestionSetsLoaded(): Promise<CompiledQuestionSets> {
  if (cache) {
    return cache;
  }
  if (!loadPromise) {
    loadPromise = getR2Json<CompiledQuestionSets>("interview-content/compiled-question-sets.json");
  }
  cache = await loadPromise;
  return cache;
}
