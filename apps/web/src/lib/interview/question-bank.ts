import {
  ensureCompiledQuestionSetsLoaded,
  type CompiledAptitudeQuestionRef,
  type CompiledCodingQuestionRef
} from "@/lib/interview/compiled-question-sets";
import {
  ensureAiRoleBankLoaded,
  type ExternalAiRoleDefinition
} from "@/lib/interview/ai-role-bank";
import {
  ensureComputerScienceBankLoaded,
  type ExternalComputerScienceTest
} from "@/lib/interview/computer-science-bank";
import { getR2Json } from "@/lib/r2/client";

export type InterviewTestType = "coding" | "aptitude" | "computer-science" | "ai";

export type InterviewQuestionDifficulty = "easy" | "medium" | "hard";

export type InterviewQuestionKind = "mcq" | "coding";

export type PracticeAttemptMode = "mcq" | "coding";

export type PracticeAttemptStatus = "ready" | "in_progress" | "submitted" | "timed_out";

export type McqOptionId = "a" | "b" | "c" | "d";

export type McqOption = {
  id: McqOptionId;
  text: string;
};

export type BaseQuestion = {
  category: string;
  id: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  kind: InterviewQuestionKind;
  prompt: string;
};

export type McqQuestion = BaseQuestion & {
  correctOptionId: McqOptionId;
  difficulty?: InterviewQuestionDifficulty;
  explanation: string;
  kind: "mcq";
  options: McqOption[];
};

export type CodingQuestion = BaseQuestion & {
  constraints: string[];
  difficulty: InterviewQuestionDifficulty;
  hints: string[];
  inputFormat: string;
  kind: "coding";
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
};

export type PracticeMcqQuestion = Omit<McqQuestion, "correctOptionId" | "explanation">;

export type PracticeQuestion = PracticeMcqQuestion | CodingQuestion;

export type InterviewTrackDefinition = {
  description: string;
  durationMinutes: number;
  id: InterviewTestType;
  mode: PracticeAttemptMode;
  questionCount: number;
  subtitle: string;
  title: string;
};

export type InterviewTestTemplate = {
  categoryFocus: string[];
  durationMinutes: number;
  id: string;
  index: number;
  mode: PracticeAttemptMode;
  questionCount: number;
  roleId?: string;
  roleName?: string;
  subtitle: string;
  summary: string;
  testType: InterviewTestType;
  title: string;
};

export type AiInterviewRole = ExternalAiRoleDefinition;

export type PracticeAttemptSeed = {
  answerKeyVersion: string;
  categories: string[];
  questions: PracticeQuestion[];
  template?: InterviewTestTemplate;
  track: InterviewTrackDefinition;
};

export type PracticeScore = {
  answered: number;
  correct: number;
  percentage: number;
  total: number;
};

const QUESTION_BANK_VERSION = "2026.06.war-room.v2";

function createMcqQuestion(input: {
  category: string;
  correctOptionId: McqOptionId;
  difficulty?: InterviewQuestionDifficulty;
  explanation: string;
  id: string;
  imageAlt?: string;
  imageSourceUrl?: string;
  imageUrl?: string;
  options: [string, string, string, string];
  prompt: string;
}): McqQuestion {
  return {
    id: input.id,
    kind: "mcq",
    category: input.category,
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt,
    imageSourceUrl: input.imageSourceUrl,
    options: [
      { id: "a", text: input.options[0] },
      { id: "b", text: input.options[1] },
      { id: "c", text: input.options[2] },
      { id: "d", text: input.options[3] }
    ],
    correctOptionId: input.correctOptionId,
    explanation: input.explanation,
    difficulty: input.difficulty
  };
}

/**
 * All of the module-level "banks" below (BASE_CODING_QUESTION_BANK through CODING_QUESTION_LOOKUP) used to be
 * `const`s computed synchronously at module-import time from hardcoded literal arrays plus two statically-imported
 * JSON files (ai-role-questions.min.json, computer-science-tests.min.json totalling ~6.5MB). That's now all been
 * moved to Cloudflare R2 (see the migration script history and lib/interview/{compiled-question-sets,ai-role-bank,
 * computer-science-bank}.ts) to keep it out of the git repo and out of the server bundle. These are declared `let`
 * and populated once, lazily, by ensureQuestionBankLoaded() below - every exported function in this file that
 * touches them calls `await ensureQuestionBankLoaded()` first. Internal (non-exported) helpers below don't need
 * their own await since they're only ever invoked after that has already resolved.
 */
let BASE_CODING_QUESTION_BANK: CodingQuestion[] = [];
let BASE_APTITUDE_QUESTION_BANK: McqQuestion[] = [];
let LEGACY_CS_QUESTION_BANK: McqQuestion[] = [];
let LEGACY_AI_QUESTION_BANK: McqQuestion[] = [];

function mapCompiledCodingRefToQuestion(ref: CompiledCodingQuestionRef): CodingQuestion {
  return {
    id: ref.id,
    kind: "coding",
    category: ref.category,
    difficulty: ref.difficulty,
    prompt:
      `Solve the interview problem: "${ref.title}". ` +
      `Use an optimized approach and be ready to explain complexity tradeoffs.`,
    inputFormat:
      "Follow standard interview input conventions based on the original problem statement.",
    outputFormat:
      "Return or print the expected output exactly as required by the source problem statement.",
    constraints: [
      "Respect source constraints and edge cases.",
      "Aim for optimal time and space complexity for this pattern."
    ],
    sampleInput: "Refer source statement for canonical sample input.",
    sampleOutput: "Refer source statement for canonical sample output.",
    hints: [
      `Pattern focus: ${ref.category}.`,
      `Original source: ${ref.source} (${ref.sourceCollectionUrl}).`
    ]
  };
}

function mapCompiledAptitudeRefToQuestion(ref: CompiledAptitudeQuestionRef): McqQuestion {
  return createMcqQuestion({
    id: ref.id,
    category: ref.category,
    difficulty: ref.difficulty,
    prompt: ref.prompt,
    imageUrl: ref.imageUrl,
    imageAlt: ref.imageAlt,
    imageSourceUrl: ref.imageSourceUrl,
    options: ref.options,
    correctOptionId: ref.correctOptionId,
    explanation: `${ref.explanation} Source reference: ${ref.sourceCollectionUrl}`
  });
}

let CODING_QUESTION_BANK: CodingQuestion[] = [];
let APTITUDE_QUESTION_BANK: McqQuestion[] = [];

let EXTERNAL_AI_ROLE_DEFINITIONS: ExternalAiRoleDefinition[] = [];
let GENERATED_AI_QUESTION_BANK: McqQuestion[] = [];
let AI_QUESTION_BANK: McqQuestion[] = [];
let AI_ROLE_DEFINITIONS: ExternalAiRoleDefinition[] = [];
const AI_ROLE_QUESTION_IDS_BY_ROLE = new Map<string, string[]>();

let GENERATED_CS_QUESTION_BANK: McqQuestion[] = [];
let EXTERNAL_CS_TEST_DEFINITIONS: ExternalComputerScienceTest[] = [];
let CS_QUESTION_BANK: McqQuestion[] = [];

const TRACK_DEFINITIONS: Record<InterviewTestType, InterviewTrackDefinition> = {
  coding: {
    id: "coding",
    title: "Coding Simulation",
    subtitle: "1 easy + 1 medium + 1 hard",
    description:
      "Timed coding round with real interview-style prompts categorized by core DSA topics. Execution is desktop-only.",
    durationMinutes: 90,
    questionCount: 3,
    mode: "coding"
  },
  aptitude: {
    id: "aptitude",
    title: "Aptitude Sprint",
    subtitle: "40 questions / 60 minutes",
    description:
      "Quantitative aptitude, logic, and arithmetic categories used in campus and early-career screening rounds.",
    durationMinutes: 60,
    questionCount: 40,
    mode: "mcq"
  },
  "computer-science": {
    id: "computer-science",
    title: "Computer Science Technical",
    subtitle: "30 questions / 60 minutes",
    description:
      "Core CS mixed-paper assessment across OS, DBMS, networks, COA, DLD, algorithms, and programming fundamentals.",
    durationMinutes: 60,
    questionCount: 30,
    mode: "mcq"
  },
  ai: {
    id: "ai",
    title: "AI Technical",
    subtitle: "40 questions / 90 minutes",
    description:
      "Role-based AI interview prep spanning 20 tracks across ML, GenAI, research, MLOps, and AI architecture.",
    durationMinutes: 90,
    questionCount: 40,
    mode: "mcq"
  }
};

const TEST_TEMPLATE_COUNT_BY_TYPE: Record<InterviewTestType, number> = {
  coding: 100,
  aptitude: 100,
  "computer-science": 100,
  ai: 100
};

const TEST_TEMPLATE_SUMMARIES: Record<InterviewTestType, string> = {
  coding:
    "Assesses problem solving under pressure, DSA pattern recall, optimization reasoning, and code-quality communication.",
  aptitude:
    "Assesses arithmetic fluency, logical consistency, speed vs. accuracy tradeoffs, and elimination strategy in timed MCQs.",
  "computer-science":
    "Assesses depth in OS, DBMS, networking, algorithms, and software engineering concepts for technical interview rounds.",
  ai:
    "Assesses ML and deep-learning intuition, GenAI fundamentals, model evaluation judgment, and practical AI system thinking."
};

const TEST_TEMPLATE_TITLE_PREFIX: Record<InterviewTestType, string> = {
  coding: "Coding Test",
  aptitude: "Aptitude Test",
  "computer-science": "Computer Science Test",
  ai: "AI Test"
};

const TEST_TEMPLATE_CACHE = new Map<InterviewTestType, InterviewTestTemplate[]>();
const AI_ROLE_TEMPLATE_CACHE = new Map<string, InterviewTestTemplate[]>();

const MCQ_QUESTION_LOOKUP = new Map<string, McqQuestion>();
const CODING_QUESTION_LOOKUP = new Map<string, CodingQuestion>();

let questionBankLoaded = false;
let questionBankLoadPromise: Promise<void> | null = null;

async function loadQuestionBankData(): Promise<void> {
  const [baseCoding, baseAptitude, legacyCs, legacyAi] = await Promise.all([
    getR2Json<CodingQuestion[]>("interview-content/coding-questions.json"),
    getR2Json<McqQuestion[]>("interview-content/aptitude-questions.json"),
    getR2Json<McqQuestion[]>("interview-content/legacy-cs-questions.json"),
    getR2Json<McqQuestion[]>("interview-content/legacy-ai-questions.json")
  ]);

  BASE_CODING_QUESTION_BANK = baseCoding;
  BASE_APTITUDE_QUESTION_BANK = baseAptitude;
  LEGACY_CS_QUESTION_BANK = legacyCs;
  LEGACY_AI_QUESTION_BANK = legacyAi;

  const { compiledCodingQuestionRefs, compiledAptitudeQuestionRefs } = await ensureCompiledQuestionSetsLoaded();
  const { externalAiRoles, externalAiQuestions, hasExternalAiRoleBank } = await ensureAiRoleBankLoaded();
  const { externalComputerScienceQuestions, externalComputerScienceTests, hasExternalComputerScienceBank } =
    await ensureComputerScienceBankLoaded();

  CODING_QUESTION_BANK = [
    ...BASE_CODING_QUESTION_BANK,
    ...compiledCodingQuestionRefs.map((ref) => mapCompiledCodingRefToQuestion(ref))
  ];

  APTITUDE_QUESTION_BANK = [
    ...BASE_APTITUDE_QUESTION_BANK,
    ...compiledAptitudeQuestionRefs.map((ref) => mapCompiledAptitudeRefToQuestion(ref))
  ];

  EXTERNAL_AI_ROLE_DEFINITIONS = hasExternalAiRoleBank ? externalAiRoles : [];

  GENERATED_AI_QUESTION_BANK = externalAiQuestions.map((question) =>
    createMcqQuestion({
      id: question.id,
      category: question.category,
      difficulty: question.difficulty,
      prompt: question.prompt,
      options: question.options,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation
    })
  );

  AI_QUESTION_BANK = GENERATED_AI_QUESTION_BANK.length > 0 ? GENERATED_AI_QUESTION_BANK : LEGACY_AI_QUESTION_BANK;

  AI_ROLE_DEFINITIONS =
    EXTERNAL_AI_ROLE_DEFINITIONS.length > 0
      ? EXTERNAL_AI_ROLE_DEFINITIONS
      : [
          {
            id: "general-ai",
            name: "General AI",
            imageSrc: "/war-room/ai-card.svg",
            imageAlt: "General AI role visual",
            summary: "Foundational AI interview prep across machine learning and deep learning basics.",
            focusTopics: ["Machine Learning", "Deep Learning", "MLOps", "Generative AI"],
            questionCount: LEGACY_AI_QUESTION_BANK.length
          }
        ];

  AI_ROLE_QUESTION_IDS_BY_ROLE.clear();
  if (externalAiQuestions.length > 0) {
    externalAiQuestions.forEach((question) => {
      const tracked = AI_ROLE_QUESTION_IDS_BY_ROLE.get(question.roleId) ?? [];
      tracked.push(question.id);
      AI_ROLE_QUESTION_IDS_BY_ROLE.set(question.roleId, tracked);
    });
  } else {
    AI_ROLE_QUESTION_IDS_BY_ROLE.set(
      "general-ai",
      AI_QUESTION_BANK.map((question) => question.id)
    );
  }

  GENERATED_CS_QUESTION_BANK = externalComputerScienceQuestions.map((question) =>
    createMcqQuestion({
      id: question.id,
      category: question.category,
      difficulty: question.difficulty,
      prompt: question.prompt,
      imageUrl: question.imageUrl,
      imageAlt: question.imageAlt,
      imageSourceUrl: question.imageSourceUrl,
      options: question.options,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation
    })
  );

  EXTERNAL_CS_TEST_DEFINITIONS = hasExternalComputerScienceBank ? externalComputerScienceTests : [];
  CS_QUESTION_BANK = GENERATED_CS_QUESTION_BANK.length > 0 ? GENERATED_CS_QUESTION_BANK : LEGACY_CS_QUESTION_BANK;

  MCQ_QUESTION_LOOKUP.clear();
  [...APTITUDE_QUESTION_BANK, ...CS_QUESTION_BANK, ...AI_QUESTION_BANK].forEach((question) => {
    MCQ_QUESTION_LOOKUP.set(question.id, question);
  });

  CODING_QUESTION_LOOKUP.clear();
  CODING_QUESTION_BANK.forEach((question) => {
    CODING_QUESTION_LOOKUP.set(question.id, question);
  });
}

async function ensureQuestionBankLoaded(): Promise<void> {
  if (questionBankLoaded) {
    return;
  }
  if (!questionBankLoadPromise) {
    questionBankLoadPromise = loadQuestionBankData().then(() => {
      questionBankLoaded = true;
    });
  }
  await questionBankLoadPromise;
}

function hashToSeed(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(values: T[], seed: number): T[] {
  const shuffled = [...values];
  const random = createSeededRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function pickSeededSubset<T>(values: T[], count: number, seed: number): T[] {
  if (count <= 0 || values.length === 0) {
    return [];
  }

  if (values.length <= count) {
    return seededShuffle(values, seed);
  }

  return seededShuffle(values, seed).slice(0, count);
}

function randomize<T>(values: T[]): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function pickRandomSubset<T>(values: T[], count: number): T[] {
  if (count <= 0) {
    return [];
  }

  if (values.length <= count) {
    return randomize(values);
  }

  return randomize(values).slice(0, count);
}

function toPracticeMcq(question: McqQuestion): PracticeMcqQuestion {
  return {
    id: question.id,
    kind: "mcq",
    category: question.category,
    prompt: question.prompt,
    imageUrl: question.imageUrl,
    imageAlt: question.imageAlt,
    imageSourceUrl: question.imageSourceUrl,
    difficulty: question.difficulty,
    options: question.options
  };
}

function collectCategories(questions: PracticeQuestion[]): string[] {
  return Array.from(new Set(questions.map((question) => question.category))).slice(0, 12);
}

function getAiRoleQuestionBank(roleId?: string): McqQuestion[] {
  const resolvedRoleId = resolveAiRoleId(roleId);
  if (!resolvedRoleId) {
    return [];
  }

  const questionIds = AI_ROLE_QUESTION_IDS_BY_ROLE.get(resolvedRoleId) ?? [];
  if (questionIds.length === 0) {
    return AI_QUESTION_BANK;
  }

  return questionIds
    .map((questionId) => MCQ_QUESTION_LOOKUP.get(questionId))
    .filter((question): question is McqQuestion => Boolean(question));
}

function getMcqBankForType(testType: Exclude<InterviewTestType, "coding">, aiRoleId?: string): McqQuestion[] {
  if (testType === "aptitude") {
    return APTITUDE_QUESTION_BANK;
  }

  if (testType === "computer-science") {
    return CS_QUESTION_BANK;
  }

  return getAiRoleQuestionBank(aiRoleId);
}

function listAiRoleDefinitions(): ExternalAiRoleDefinition[] {
  return AI_ROLE_DEFINITIONS;
}

function getAiRoleById(roleId: string): ExternalAiRoleDefinition | null {
  return listAiRoleDefinitions().find((role) => role.id === roleId) ?? null;
}

function getDefaultAiRoleId(): string | null {
  return listAiRoleDefinitions()[0]?.id ?? null;
}

function resolveAiRoleId(roleId?: string): string | null {
  if (roleId) {
    const matched = getAiRoleById(roleId);
    if (matched) {
      return matched.id;
    }
  }

  return getDefaultAiRoleId();
}

function getTemplateCountForType(testType: InterviewTestType, roleId?: string): number {
  if (testType === "ai") {
    return resolveAiRoleId(roleId) ? TEST_TEMPLATE_COUNT_BY_TYPE.ai : 0;
  }

  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    return EXTERNAL_CS_TEST_DEFINITIONS.length;
  }

  return TEST_TEMPLATE_COUNT_BY_TYPE[testType];
}

function selectCodingRoundQuestions(): CodingQuestion[] {
  const easyPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "easy");
  const mediumPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "medium");
  const hardPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "hard");

  const easy = pickRandomSubset(easyPool, 1)[0];
  const medium = pickRandomSubset(mediumPool, 1)[0];
  const hard = pickRandomSubset(hardPool, 1)[0];

  return [easy, medium, hard].filter((question): question is CodingQuestion => Boolean(question));
}

function selectMcqRoundQuestions(
  testType: Exclude<InterviewTestType, "coding">,
  aiRoleId?: string
): PracticeMcqQuestion[] {
  const track = TRACK_DEFINITIONS[testType];
  const bank = getMcqBankForType(testType, aiRoleId);

  return pickRandomSubset(bank, track.questionCount).map((question) => toPracticeMcq(question));
}

function buildTemplateId(testType: InterviewTestType, templateIndex: number, aiRoleId?: string): string {
  if (testType === "ai" && aiRoleId) {
    return `ai_${aiRoleId}_test_${String(templateIndex).padStart(3, "0")}`;
  }

  return `${testType}_test_${String(templateIndex).padStart(3, "0")}`;
}

function parseAiTemplateDetails(templateId: string, roleId?: string): { roleId: string; templateIndex: number } | null {
  const rolePattern = /^ai_([a-z0-9-]+)_test_(\d{3})$/;
  const roleMatch = templateId.match(rolePattern);
  if (roleMatch) {
    const parsedRole = getAiRoleById(roleMatch[1]);
    const parsedRoleId = parsedRole?.id ?? null;
    const parsedIndex = Number(roleMatch[2]);
    if (!parsedRoleId || !Number.isInteger(parsedIndex)) {
      return null;
    }

    const maxTemplates = getTemplateCountForType("ai", parsedRoleId);
    if (parsedIndex < 1 || parsedIndex > maxTemplates) {
      return null;
    }

    return {
      roleId: parsedRoleId,
      templateIndex: parsedIndex
    };
  }

  const legacyPattern = /^ai_test_(\d{3})$/;
  const legacyMatch = templateId.match(legacyPattern);
  if (!legacyMatch) {
    return null;
  }

  const parsedRoleId = resolveAiRoleId(roleId);
  const parsedIndex = Number(legacyMatch[1]);
  if (!parsedRoleId || !Number.isInteger(parsedIndex)) {
    return null;
  }

  const maxTemplates = getTemplateCountForType("ai", parsedRoleId);
  if (parsedIndex < 1 || parsedIndex > maxTemplates) {
    return null;
  }

  return {
    roleId: parsedRoleId,
    templateIndex: parsedIndex
  };
}

function parseTemplateIndex(testType: InterviewTestType, templateId: string, roleId?: string): number | null {
  if (testType === "ai") {
    return parseAiTemplateDetails(templateId, roleId)?.templateIndex ?? null;
  }

  const prefix = `${testType}_test_`;
  if (!templateId.startsWith(prefix)) {
    return null;
  }

  const parsed = Number(templateId.slice(prefix.length));
  if (!Number.isInteger(parsed)) {
    return null;
  }

  const maxTemplates = getTemplateCountForType(testType, roleId);
  return parsed >= 1 && parsed <= maxTemplates ? parsed : null;
}

function selectCodingRoundQuestionsBySeed(seedKey: string): CodingQuestion[] {
  const seed = hashToSeed(seedKey);
  const easyPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "easy");
  const mediumPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "medium");
  const hardPool = CODING_QUESTION_BANK.filter((question) => question.difficulty === "hard");
  const fallbackPool = CODING_QUESTION_BANK;

  const easy =
    pickSeededSubset(easyPool.length > 0 ? easyPool : fallbackPool, 1, seed ^ hashToSeed("easy-selector"))[0] ?? null;
  const medium =
    pickSeededSubset(mediumPool.length > 0 ? mediumPool : fallbackPool, 1, seed ^ hashToSeed("medium-selector"))[0] ?? null;
  const hard =
    pickSeededSubset(hardPool.length > 0 ? hardPool : fallbackPool, 1, seed ^ hashToSeed("hard-selector"))[0] ?? null;

  const uniqueById = new Map<string, CodingQuestion>();
  [easy, medium, hard].forEach((question) => {
    if (question) {
      uniqueById.set(question.id, question);
    }
  });

  if (uniqueById.size < 3) {
    const fill = seededShuffle(fallbackPool, seed ^ hashToSeed("fill-selector"));
    fill.forEach((question) => {
      if (uniqueById.size < 3) {
        uniqueById.set(question.id, question);
      }
    });
  }

  return Array.from(uniqueById.values()).slice(0, 3);
}

function selectMcqRoundQuestionsBySeed(
  testType: Exclude<InterviewTestType, "coding">,
  seedKey: string,
  aiRoleId?: string
): PracticeMcqQuestion[] {
  const track = TRACK_DEFINITIONS[testType];
  const bank = getMcqBankForType(testType, aiRoleId);
  const seed = hashToSeed(seedKey);

  return pickSeededSubset(bank, track.questionCount, seed).map((question) => toPracticeMcq(question));
}

function selectComputerScienceTemplateQuestions(templateIndex: number): PracticeMcqQuestion[] {
  const track = TRACK_DEFINITIONS["computer-science"];
  const testDefinition = EXTERNAL_CS_TEST_DEFINITIONS[templateIndex - 1];
  if (!testDefinition) {
    return [];
  }

  const selectedQuestions: PracticeMcqQuestion[] = [];
  const selectedIds = new Set<string>();

  testDefinition.questionIds.forEach((questionId) => {
    if (selectedQuestions.length >= track.questionCount || selectedIds.has(questionId)) {
      return;
    }

    const question = MCQ_QUESTION_LOOKUP.get(questionId);
    if (!question) {
      return;
    }

    selectedQuestions.push(toPracticeMcq(question));
    selectedIds.add(questionId);
  });

  if (selectedQuestions.length >= track.questionCount) {
    return selectedQuestions.slice(0, track.questionCount);
  }

  const fallbackQuestions = seededShuffle(CS_QUESTION_BANK, hashToSeed(`cs-template-fallback-${templateIndex}`));

  fallbackQuestions.forEach((question) => {
    if (selectedQuestions.length >= track.questionCount || selectedIds.has(question.id)) {
      return;
    }

    selectedQuestions.push(toPracticeMcq(question));
    selectedIds.add(question.id);
  });

  return selectedQuestions.slice(0, track.questionCount);
}

function selectQuestionsForTemplate(
  testType: InterviewTestType,
  templateIndex: number,
  aiRoleId?: string
): PracticeQuestion[] {
  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    const questions = selectComputerScienceTemplateQuestions(templateIndex);
    if (questions.length > 0) {
      return questions;
    }
  }

  const roleScopedSeed = testType === "ai" && aiRoleId ? `${testType}-${aiRoleId}-${templateIndex}` : `${testType}-${templateIndex}`;

  if (testType === "coding") {
    return selectCodingRoundQuestionsBySeed(roleScopedSeed);
  }

  return selectMcqRoundQuestionsBySeed(testType, roleScopedSeed, aiRoleId);
}

function buildInterviewTestTemplate(
  testType: InterviewTestType,
  templateIndex: number,
  aiRoleId?: string
): InterviewTestTemplate {
  const track = TRACK_DEFINITIONS[testType];
  const resolvedAiRoleId = testType === "ai" ? resolveAiRoleId(aiRoleId) : null;
  const aiRole = testType === "ai" && resolvedAiRoleId ? getAiRoleById(resolvedAiRoleId) : null;
  const questions = selectQuestionsForTemplate(testType, templateIndex, resolvedAiRoleId ?? undefined);
  const categoryFocus = collectCategories(questions).slice(0, 4);
  const fallbackAiFocus = aiRole?.focusTopics.slice(0, 4) ?? [];
  const aiSummary =
    aiRole?.summary ||
    "Assesses ML and deep-learning intuition, GenAI fundamentals, model evaluation judgment, and practical AI system thinking.";
  const aiTitlePrefix = aiRole?.name || TEST_TEMPLATE_TITLE_PREFIX.ai;

  return {
    id: buildTemplateId(testType, templateIndex, resolvedAiRoleId ?? undefined),
    index: templateIndex,
    testType,
    title:
      testType === "ai"
        ? `${aiTitlePrefix} Test ${String(templateIndex).padStart(3, "0")}`
        : `${TEST_TEMPLATE_TITLE_PREFIX[testType]} ${String(templateIndex).padStart(3, "0")}`,
    subtitle: `${track.questionCount} questions / ${track.durationMinutes} min`,
    summary: testType === "ai" ? aiSummary : TEST_TEMPLATE_SUMMARIES[testType],
    durationMinutes: track.durationMinutes,
    questionCount: track.questionCount,
    mode: track.mode,
    categoryFocus:
      categoryFocus.length > 0
        ? categoryFocus
        : testType === "ai" && fallbackAiFocus.length > 0
          ? fallbackAiFocus
          : ["General"],
    ...(testType === "ai" && resolvedAiRoleId && aiRole
      ? {
          roleId: resolvedAiRoleId,
          roleName: aiRole.name
        }
      : {})
  };
}

function getOrBuildTemplateCatalog(testType: InterviewTestType): InterviewTestTemplate[] {
  if (testType === "ai") {
    return [];
  }

  const cached = TEST_TEMPLATE_CACHE.get(testType);
  if (cached) {
    return cached;
  }

  const catalog =
    testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0
      ? EXTERNAL_CS_TEST_DEFINITIONS.map((testDefinition, index) => {
          const categoryFocus = testDefinition.focusTopics.slice(0, 4);
          const templateIndex = index + 1;

          return {
            id: testDefinition.id,
            index: templateIndex,
            testType,
            title: testDefinition.title || `Computer Science Test ${String(templateIndex).padStart(3, "0")}`,
            subtitle: `${testDefinition.questionCount} questions / ${testDefinition.durationMinutes} min`,
            summary:
              testDefinition.summary ||
              "Core CS mixed-paper assessment with weighted focus areas and deterministic question ordering.",
            durationMinutes: testDefinition.durationMinutes,
            questionCount: testDefinition.questionCount,
            mode: "mcq",
            categoryFocus: categoryFocus.length > 0 ? categoryFocus : ["Computer Science"]
          } satisfies InterviewTestTemplate;
        })
      : Array.from({ length: getTemplateCountForType(testType) }, (_, index) =>
          buildInterviewTestTemplate(testType, index + 1)
        );

  TEST_TEMPLATE_CACHE.set(testType, catalog);
  return catalog;
}

function getOrBuildAiRoleTemplateCatalog(roleId: string): InterviewTestTemplate[] {
  const resolvedRoleId = resolveAiRoleId(roleId);
  if (!resolvedRoleId) {
    return [];
  }

  const cacheKey = resolvedRoleId;
  const cached = AI_ROLE_TEMPLATE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const catalog = Array.from({ length: getTemplateCountForType("ai", resolvedRoleId) }, (_, index) =>
    buildInterviewTestTemplate("ai", index + 1, resolvedRoleId)
  );

  AI_ROLE_TEMPLATE_CACHE.set(cacheKey, catalog);
  return catalog;
}

export function listInterviewTracks(): InterviewTrackDefinition[] {
  return [
    TRACK_DEFINITIONS.coding,
    TRACK_DEFINITIONS.aptitude,
    TRACK_DEFINITIONS["computer-science"],
    TRACK_DEFINITIONS.ai
  ];
}

export function getInterviewTrack(testType: InterviewTestType): InterviewTrackDefinition {
  return TRACK_DEFINITIONS[testType];
}

export async function listAiInterviewRoles(): Promise<AiInterviewRole[]> {
  await ensureQuestionBankLoaded();
  return [...AI_ROLE_DEFINITIONS];
}

export function formatInterviewTestType(testType: InterviewTestType): string {
  if (testType === "computer-science") {
    return "Computer Science";
  }

  if (testType === "ai") {
    return "AI";
  }

  return testType[0].toUpperCase() + testType.slice(1);
}

export async function getInterviewTestTemplateCount(testType: InterviewTestType, roleId?: string): Promise<number> {
  await ensureQuestionBankLoaded();
  return getTemplateCountForType(testType, roleId);
}

export async function listInterviewTestTemplates(
  testType: InterviewTestType,
  limit?: number,
  roleId?: string
): Promise<InterviewTestTemplate[]> {
  await ensureQuestionBankLoaded();

  const templates =
    testType === "ai"
      ? (() => {
          const resolvedRoleId = resolveAiRoleId(roleId);
          return resolvedRoleId ? getOrBuildAiRoleTemplateCatalog(resolvedRoleId) : [];
        })()
      : getOrBuildTemplateCatalog(testType);

  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return templates;
  }

  return templates.slice(0, Math.max(0, Math.round(limit)));
}

export async function getInterviewTestTemplate(
  testType: InterviewTestType,
  templateId: string,
  roleId?: string
): Promise<InterviewTestTemplate | null> {
  await ensureQuestionBankLoaded();

  if (testType === "ai") {
    const parsed = parseAiTemplateDetails(templateId, roleId);
    if (!parsed) {
      return null;
    }

    return getOrBuildAiRoleTemplateCatalog(parsed.roleId)[parsed.templateIndex - 1] ?? null;
  }

  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    const template = getOrBuildTemplateCatalog(testType).find((entry) => entry.id === templateId);
    return template ?? null;
  }

  const templateIndex = parseTemplateIndex(testType, templateId, roleId);
  if (templateIndex === null) {
    return null;
  }

  return getOrBuildTemplateCatalog(testType)[templateIndex - 1] ?? null;
}

export async function buildPracticeAttemptSeed(testType: InterviewTestType, templateId?: string): Promise<PracticeAttemptSeed> {
  await ensureQuestionBankLoaded();

  const track = getInterviewTrack(testType);
  const template = templateId ? await getInterviewTestTemplate(testType, templateId) : null;

  if (template) {
    const questions = selectQuestionsForTemplate(
      testType,
      template.index,
      template.testType === "ai" ? template.roleId : undefined
    );
    return {
      track,
      questions,
      categories: collectCategories(questions),
      answerKeyVersion: QUESTION_BANK_VERSION,
      template
    };
  }

  if (testType === "computer-science" && EXTERNAL_CS_TEST_DEFINITIONS.length > 0) {
    const defaultTemplate = getOrBuildTemplateCatalog("computer-science")[0] ?? undefined;
    const questions = selectComputerScienceTemplateQuestions(1);

    return {
      track,
      questions,
      categories: collectCategories(questions),
      answerKeyVersion: QUESTION_BANK_VERSION,
      template: defaultTemplate
    };
  }

  if (track.mode === "coding") {
    const questions = selectCodingRoundQuestions();

    return {
      track,
      questions,
      categories: collectCategories(questions),
      answerKeyVersion: QUESTION_BANK_VERSION
    };
  }

  const fallbackAiRoleId = testType === "ai" ? resolveAiRoleId() ?? undefined : undefined;
  const questions = selectMcqRoundQuestions(
    testType as Exclude<InterviewTestType, "coding">,
    fallbackAiRoleId
  );

  return {
    track,
    questions,
    categories: collectCategories(questions),
    answerKeyVersion: QUESTION_BANK_VERSION
  };
}

export async function getMcqQuestionById(questionId: string): Promise<McqQuestion | null> {
  await ensureQuestionBankLoaded();
  return MCQ_QUESTION_LOOKUP.get(questionId) ?? null;
}

export async function getCodingQuestionById(questionId: string): Promise<CodingQuestion | null> {
  await ensureQuestionBankLoaded();
  return CODING_QUESTION_LOOKUP.get(questionId) ?? null;
}

export async function getPracticeQuestionById(questionId: string): Promise<PracticeQuestion | null> {
  const mcqQuestion = await getMcqQuestionById(questionId);
  if (mcqQuestion) {
    return toPracticeMcq(mcqQuestion);
  }

  return getCodingQuestionById(questionId);
}

/** Note: after Part 5's client-side rerouting, the one former caller of this (interview-war-room.ts's
 *  submitPracticeAttempt) was switched to /api/interview/mcq-review instead (mirrors how mobile scores an
 *  attempt), so this has no remaining callers in-repo. Left in place (now async, since it depends on the R2-backed
 *  question bank) as public API in case a future server-side caller needs local scoring without a network hop. */
export async function scorePracticeMcqResponses(
  questions: PracticeQuestion[],
  mcqAnswers: Record<string, string>
): Promise<PracticeScore> {
  const mcqQuestions = questions.filter((question): question is PracticeMcqQuestion => question.kind === "mcq");

  if (mcqQuestions.length === 0) {
    return {
      correct: 0,
      total: 0,
      answered: 0,
      percentage: 0
    };
  }

  let correct = 0;
  let answered = 0;

  for (const question of mcqQuestions) {
    const selectedOption = (mcqAnswers[question.id] ?? "").trim().toLowerCase();
    if (!selectedOption) {
      continue;
    }

    answered += 1;

    const canonical = await getMcqQuestionById(question.id);
    if (!canonical) {
      continue;
    }

    if (canonical.correctOptionId === selectedOption) {
      correct += 1;
    }
  }

  const total = mcqQuestions.length;

  return {
    correct,
    total,
    answered,
    percentage: total > 0 ? Math.round((correct / total) * 100) : 0
  };
}

export function hasDesktopOnlyExecution(mode: PracticeAttemptMode): boolean {
  return mode === "coding";
}
