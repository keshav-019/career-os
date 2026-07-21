/**
 * Shared coding-arena problem types. See README.md in this folder for the full picture: a "paramSpec" describes a
 * problem's stdin shape, and the per-language stdin/stdout harness is generated from it (never hand-written).
 */

export type CodingParamType =
  | "int"
  | "long"
  | "double"
  | "string"
  | "intArray"
  | "stringArray"
  | "grid"
  | "charGrid"
  | "intArrayList";

export type CodingOutputKind = "int" | "long" | "double" | "bool" | "string" | "intArray" | "stringArray" | "doubleArray";

export type CodingDifficulty = "easy" | "medium" | "hard";

export type CodingLanguage = "c" | "cpp" | "java" | "javascript" | "python" | "rust";

export type CodingParamSpecEntry = {
  name: string;
  type: CodingParamType;
};

export type CodingExampleInput = {
  explanation?: string;
  input: string;
  output: string;
};

export type CodingTestCaseInput = {
  values: Record<string, unknown>;
  visible: boolean;
};

/**
 * What an admin submits - either pasted as raw JSON or assembled field-by-field in the editor UI. This shape
 * intentionally mirrors apps/desktop/scripts/coding-catalog/problems-source.js entries, so the root-level seed JSON
 * (see /coding-problems.seed.json) can be pasted in directly.
 */
export type CodingProblemSourceInput = {
  companies: string[];
  constraints: string[];
  difficulty?: CodingDifficulty;
  examples: CodingExampleInput[];
  id: string;
  inputFormat: string;
  outputFormat: string;
  outputKind: CodingOutputKind;
  paramSpec: CodingParamSpecEntry[];
  /** A plain JS function body implementing the solution, used only to compute ground-truth expected output for
   *  every test case (run once at save time, in a short-lived child process - never stored as "the solution"). */
  referenceBody: string;
  statement: string;
  tags: string[];
  testCases: CodingTestCaseInput[];
  /** Per-test-case execution time limit in milliseconds. Optional on input - defaults to
   *  DEFAULT_TIME_LIMIT_MS (see problem-builder.ts) when omitted. */
  timeLimitMs?: number;
  title: string;
};

export type CodingHarnessParts = {
  prefix: string;
  suffix: string;
};

export type CodingTestCaseRecord = {
  input: string;
  output: string;
};

/** The fully-baked record stored in Firestore's `codingProblems/{id}` documents. */
export type CodingProblemRecord = {
  companies: string[];
  constraints: string[];
  createdAt: string;
  createdBy: string;
  difficulty: CodingDifficulty;
  examples: CodingExampleInput[];
  harness: Record<CodingLanguage, CodingHarnessParts>;
  hiddenTests: CodingTestCaseRecord[];
  id: string;
  inputFormat: string;
  order: number;
  outputFormat: string;
  outputKind: CodingOutputKind;
  paramSpec: CodingParamSpecEntry[];
  referenceBody: string;
  slug: string;
  /** The exact admin-submitted CodingProblemSourceInput, JSON-stringified verbatim. Never derived from the other
   *  fields (they're lossy in the other direction - e.g. testCases.values -> serialized stdin string can't be
   *  un-serialized). Round-tripping this is what lets the admin editor reload a problem for editing without
   *  reconstructing anything. Admin-only - never included in any public-facing shape below. */
  sourceJson: string;
  starterCode: Record<CodingLanguage, string>;
  statement: string;
  tags: string[];
  /** Per-test-case execution time limit in milliseconds, enforced by the desktop judge (runtime.js).
   *  Always present on a saved record - problem-builder.ts stamps a default when the admin omits it. */
  timeLimitMs: number;
  title: string;
  updatedAt: string;
  visibleTests: CodingTestCaseRecord[];
};

/** What the coding-arena browser list shows - no statement, no code, no tests. */
export type CodingProblemPublicSummary = {
  companies: string[];
  difficulty: CodingDifficulty;
  id: string;
  order: number;
  tags: string[];
  title: string;
};

/** What the solve page's problem-statement pane shows. Still no harness, no hidden tests. */
export type CodingProblemPublicDetail = CodingProblemPublicSummary & {
  constraints: string[];
  examples: CodingExampleInput[];
  hiddenTestCount: number;
  inputFormat: string;
  outputFormat: string;
  starterCode: Record<CodingLanguage, string>;
  statement: string;
  visibleTests: CodingTestCaseRecord[];
};

/**
 * Everything the LOCAL judge needs to actually compile/run a submission: the hidden per-language harness and the
 * hidden test bank. Only ever served to the desktop helper server (a separate OS process, never the renderer/
 * browser bundle) via /api/coding-problems/[id]/judge-data.
 */
export type CodingProblemJudgeData = {
  harness: Record<CodingLanguage, CodingHarnessParts>;
  hiddenTests: CodingTestCaseRecord[];
  starterCode: Record<CodingLanguage, string>;
  /** Per-test-case execution time limit in milliseconds - the desktop judge (apps/desktop/src/coding/index.js)
   *  passes this straight through to runtime.js's runTests() as `timeoutMs`, falling back to its own fixed
   *  constants only if this is missing (e.g. an older cached record). */
  timeLimitMs: number;
  visibleTests: CodingTestCaseRecord[];
};
