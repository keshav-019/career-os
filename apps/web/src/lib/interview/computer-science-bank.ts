import { getR2Json } from "@/lib/r2/client";

type OptionId = "a" | "b" | "c" | "d";
type Difficulty = "easy" | "medium" | "hard";

export type ExternalComputerScienceQuestion = {
  category: string;
  correctOptionId: OptionId;
  difficulty: Difficulty;
  explanation: string;
  focusTopic: string;
  id: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  options: [string, string, string, string];
  prompt: string;
  source?: string;
  sourceQuestionId?: string;
};

export type ExternalComputerScienceTest = {
  durationMinutes: number;
  focusTopics: string[];
  id: string;
  questionCount: number;
  questionIds: string[];
  summary: string;
  title: string;
  topicWeights: Record<string, number>;
};

type ComputerScienceBank = {
  externalComputerScienceQuestions: ExternalComputerScienceQuestion[];
  externalComputerScienceTests: ExternalComputerScienceTest[];
  hasExternalComputerScienceBank: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInteger(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  }

  return fallback;
}

function asStringArray(value: unknown, max = 100): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .slice(0, max);
}

function asPositiveIntMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, rawValue]) => [asString(key), Math.max(0, asInteger(rawValue, 0))] as const)
    .filter(([key]) => Boolean(key));

  return Object.fromEntries(entries);
}

function asOptionId(value: unknown): OptionId | null {
  const normalized = asString(value).toLowerCase();
  if (normalized === "a" || normalized === "b" || normalized === "c" || normalized === "d") {
    return normalized;
  }

  return null;
}

function asDifficulty(value: unknown): Difficulty {
  const normalized = asString(value).toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }

  return "medium";
}

function asOptions(value: unknown): [string, string, string, string] | null {
  if (!Array.isArray(value) || value.length !== 4) {
    return null;
  }

  const normalized = value.map((entry) => asString(entry));
  if (normalized.some((entry) => entry.length === 0)) {
    return null;
  }

  return [normalized[0], normalized[1], normalized[2], normalized[3]];
}

function parseQuestions(value: unknown): ExternalComputerScienceQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<ExternalComputerScienceQuestion | null>((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const id = asString(row.id);
      const prompt = asString(row.prompt);
      const category = asString(row.category) || "Computer Science";
      const focusTopic = asString(row.focusTopic) || category;
      const options = asOptions(row.options);
      const correctOptionId = asOptionId(row.correctOptionId);

      if (!id || !prompt || !options || !correctOptionId) {
        return null;
      }

      return {
        id,
        focusTopic,
        category,
        difficulty: asDifficulty(row.difficulty),
        prompt,
        options,
        correctOptionId,
        explanation: asString(row.explanation) || "Reference answer from imported CS bank.",
        imageUrl: asString(row.imageUrl) || undefined,
        imageAlt: asString(row.imageAlt) || undefined,
        imageSourceUrl: asString(row.imageSourceUrl) || undefined,
        source: asString(row.source) || undefined,
        sourceQuestionId: asString(row.sourceQuestionId) || undefined
      };
    })
    .filter((entry): entry is ExternalComputerScienceQuestion => entry !== null);
}

function parseTests(value: unknown, validQuestionIds: Set<string>): ExternalComputerScienceTest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<ExternalComputerScienceTest | null>((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const id = asString(row.id);
      const title = asString(row.title);

      if (!id || !title) {
        return null;
      }

      const questionIds = asStringArray(row.questionIds, 300).filter((questionId) => validQuestionIds.has(questionId));

      if (questionIds.length === 0) {
        return null;
      }

      return {
        id,
        title,
        summary: asString(row.summary) || "Mixed-topic computer science paper with weighted focus areas.",
        focusTopics: asStringArray(row.focusTopics, 12),
        durationMinutes: Math.max(1, asInteger(row.durationMinutes, 60)),
        questionCount: Math.max(1, asInteger(row.questionCount, questionIds.length)),
        questionIds,
        topicWeights: asPositiveIntMap(row.topicWeights)
      };
    })
    .filter((entry): entry is ExternalComputerScienceTest => entry !== null);
}

function parseBank(value: unknown): {
  questions: ExternalComputerScienceQuestion[];
  tests: ExternalComputerScienceTest[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      questions: [],
      tests: []
    };
  }

  const row = value as Record<string, unknown>;
  const questions = parseQuestions(row.questions);
  const validQuestionIds = new Set(questions.map((question) => question.id));
  const tests = parseTests(row.tests, validQuestionIds);

  return {
    questions,
    tests
  };
}

// Was a static `import rawBank from "./computer-science-tests.min.json"` (984KB) - now fetched from R2 on first
// use and cached in-process, same reasoning as ai-role-bank.ts's ensureAiRoleBankLoaded().
let cache: ComputerScienceBank | null = null;
let loadPromise: Promise<ComputerScienceBank> | null = null;

export async function ensureComputerScienceBankLoaded(): Promise<ComputerScienceBank> {
  if (cache) {
    return cache;
  }
  if (!loadPromise) {
    loadPromise = getR2Json<unknown>("interview-content/computer-science-tests.json").then((rawBank) => {
      const parsed = parseBank(rawBank);
      return {
        externalComputerScienceQuestions: parsed.questions,
        externalComputerScienceTests: parsed.tests,
        hasExternalComputerScienceBank: parsed.questions.length > 0 && parsed.tests.length > 0
      };
    });
  }
  cache = await loadPromise;
  return cache;
}
