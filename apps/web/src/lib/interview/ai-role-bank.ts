import { getR2Json } from "@/lib/r2/client";

type OptionId = "a" | "b" | "c" | "d";
type Difficulty = "easy" | "medium" | "hard";

export type ExternalAiRoleDefinition = {
  focusTopics: string[];
  id: string;
  imageAlt: string;
  imageSrc: string;
  name: string;
  questionCount: number;
  summary: string;
};

export type ExternalAiQuestion = {
  category: string;
  correctOptionId: OptionId;
  difficulty: Difficulty;
  explanation: string;
  id: string;
  options: [string, string, string, string];
  prompt: string;
  roleId: string;
  roleName: string;
};

type AiRoleBank = {
  externalAiRoles: ExternalAiRoleDefinition[];
  externalAiQuestions: ExternalAiQuestion[];
  hasExternalAiRoleBank: boolean;
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

function parseRoles(value: unknown): ExternalAiRoleDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<ExternalAiRoleDefinition | null>((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const id = asString(row.id);
      const name = asString(row.name);

      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        imageSrc: asString(row.imageSrc) || `/war-room/ai-roles/${id}.svg`,
        imageAlt: asString(row.imageAlt) || `${name} role visual`,
        summary: asString(row.summary) || "Role-focused AI interview prep.",
        focusTopics: asStringArray(row.focusTopics, 8),
        questionCount: Math.max(0, asInteger(row.questionCount, 0))
      };
    })
    .filter((entry): entry is ExternalAiRoleDefinition => entry !== null)
    .sort((first, second) => first.name.localeCompare(second.name));
}

function parseQuestions(value: unknown, validRoleIds: Set<string>): ExternalAiQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<ExternalAiQuestion | null>((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const id = asString(row.id);
      const roleId = asString(row.roleId);
      const roleName = asString(row.roleName);
      const prompt = asString(row.prompt);
      const options = asOptions(row.options);
      const correctOptionId = asOptionId(row.correctOptionId);

      if (!id || !roleId || !roleName || !prompt || !options || !correctOptionId || !validRoleIds.has(roleId)) {
        return null;
      }

      return {
        id,
        roleId,
        roleName,
        category: asString(row.category) || "AI Fundamentals",
        difficulty: asDifficulty(row.difficulty),
        prompt,
        options,
        correctOptionId,
        explanation: asString(row.explanation) || "Role-specific AI reference answer."
      };
    })
    .filter((entry): entry is ExternalAiQuestion => entry !== null);
}

function parseBank(value: unknown): {
  questions: ExternalAiQuestion[];
  roles: ExternalAiRoleDefinition[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      questions: [],
      roles: []
    };
  }

  const row = value as Record<string, unknown>;
  const roles = parseRoles(row.roles);
  const roleIds = new Set(roles.map((role) => role.id));
  const questions = parseQuestions(row.questions, roleIds);

  return {
    questions,
    roles
  };
}

// This used to be a static `import rawBank from "./ai-role-questions.min.json"` (5.6MB), which meant every server
// bundle (and, transitively before Part 5's client rerouting, every browser bundle that imported question-bank.ts)
// paid for the full parsed bank up front. It's now fetched from R2 on first use and cached in-process - see
// ensureAiRoleBankLoaded().
let cache: AiRoleBank | null = null;
let loadPromise: Promise<AiRoleBank> | null = null;

export async function ensureAiRoleBankLoaded(): Promise<AiRoleBank> {
  if (cache) {
    return cache;
  }
  if (!loadPromise) {
    loadPromise = getR2Json<unknown>("interview-content/ai-role-questions.json").then((rawBank) => {
      const parsed = parseBank(rawBank);
      return {
        externalAiRoles: parsed.roles,
        externalAiQuestions: parsed.questions,
        hasExternalAiRoleBank: parsed.roles.length > 0 && parsed.questions.length > 0
      };
    });
  }
  cache = await loadPromise;
  return cache;
}
