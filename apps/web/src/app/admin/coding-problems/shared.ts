/**
 * Pure logic shared between the coding-problems admin list page (page.tsx - list, create, bulk import) and the
 * dedicated single-problem edit screen ([id]/page.tsx). Kept out of either page component so neither has to
 * duplicate form-state conversion or the authed-fetch helpers.
 */

import { auth } from "@/lib/firebase/client";
import type {
  CodingDifficulty,
  CodingOutputKind,
  CodingParamSpecEntry,
  CodingParamType,
  CodingProblemRecord,
  CodingProblemSourceInput
} from "@/lib/coding-catalog/types";

export const PARAM_TYPES: CodingParamType[] = [
  "int",
  "long",
  "double",
  "string",
  "intArray",
  "stringArray",
  "grid",
  "charGrid",
  "intArrayList"
];

export const OUTPUT_KINDS: CodingOutputKind[] = ["int", "long", "double", "bool", "string", "intArray", "stringArray", "doubleArray"];

export const DIFFICULTIES: CodingDifficulty[] = ["easy", "medium", "hard"];

/** Mirrors problem-builder.ts's DEFAULT_TIME_LIMIT_MS - shown as the form's placeholder/default. */
export const DEFAULT_TIME_LIMIT_MS = 5_000;

export type ExampleRow = { input: string; output: string; explanation: string };

export type FormState = {
  id: string;
  title: string;
  difficulty: CodingDifficulty;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  outputKind: CodingOutputKind;
  referenceBody: string;
  companiesText: string;
  tagsText: string;
  constraintsText: string;
  paramSpec: CodingParamSpecEntry[];
  examples: ExampleRow[];
  testCasesJson: string;
  /** Kept as text while editing so the field can be blank/mid-typing without fighting a number input. */
  timeLimitMsText: string;
};

const EMPTY_TEST_CASES_JSON = JSON.stringify(
  [{ values: {}, visible: true }, { values: {}, visible: false }],
  null,
  2
);

export function emptyForm(): FormState {
  return {
    id: "",
    title: "",
    difficulty: "hard",
    statement: "",
    inputFormat: "",
    outputFormat: "",
    outputKind: "int",
    referenceBody: "function solve() {\n  \n}",
    companiesText: "",
    tagsText: "",
    constraintsText: "",
    paramSpec: [{ name: "", type: "int" }],
    examples: [{ input: "", output: "", explanation: "" }],
    testCasesJson: EMPTY_TEST_CASES_JSON,
    timeLimitMsText: String(DEFAULT_TIME_LIMIT_MS)
  };
}

export function sourceToForm(input: CodingProblemSourceInput): FormState {
  return {
    id: input.id ?? "",
    title: input.title ?? "",
    difficulty: input.difficulty ?? "hard",
    statement: input.statement ?? "",
    inputFormat: input.inputFormat ?? "",
    outputFormat: input.outputFormat ?? "",
    outputKind: input.outputKind ?? "int",
    referenceBody: input.referenceBody ?? "",
    companiesText: (input.companies ?? []).join(", "),
    tagsText: (input.tags ?? []).join(", "),
    constraintsText: (input.constraints ?? []).join("\n"),
    paramSpec: input.paramSpec?.length ? input.paramSpec.map((p) => ({ ...p })) : [{ name: "", type: "int" }],
    examples: input.examples?.length
      ? input.examples.map((e) => ({ input: e.input ?? "", output: e.output ?? "", explanation: e.explanation ?? "" }))
      : [{ input: "", output: "", explanation: "" }],
    testCasesJson: JSON.stringify(input.testCases ?? [], null, 2),
    timeLimitMsText: String(input.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS)
  };
}

export function splitCommaList(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildPayloadFromForm(form: FormState): CodingProblemSourceInput {
  let testCases: CodingProblemSourceInput["testCases"];
  try {
    testCases = JSON.parse(form.testCasesJson);
  } catch {
    throw new Error("Test cases must be valid JSON (an array of { values, visible }).");
  }
  if (!Array.isArray(testCases)) {
    throw new Error("Test cases must be a JSON array.");
  }

  const paramSpec = form.paramSpec.filter((p) => p.name.trim());
  if (paramSpec.length === 0) {
    throw new Error("Add at least one param spec entry.");
  }

  const examples = form.examples.filter((e) => e.input.trim() || e.output.trim());
  if (examples.length === 0) {
    throw new Error("Add at least one worked example.");
  }

  const trimmedTimeLimit = form.timeLimitMsText.trim();
  let timeLimitMs: number | undefined;
  if (trimmedTimeLimit) {
    timeLimitMs = Number(trimmedTimeLimit);
    if (!Number.isFinite(timeLimitMs)) {
      throw new Error("Time limit must be a number (milliseconds).");
    }
  }

  return {
    id: form.id.trim(),
    title: form.title.trim(),
    difficulty: form.difficulty,
    statement: form.statement,
    inputFormat: form.inputFormat,
    outputFormat: form.outputFormat,
    outputKind: form.outputKind,
    referenceBody: form.referenceBody,
    companies: splitCommaList(form.companiesText),
    tags: splitCommaList(form.tagsText),
    constraints: splitLines(form.constraintsText),
    paramSpec,
    examples: examples.map((e) => ({
      input: e.input,
      output: e.output,
      explanation: e.explanation.trim() || undefined
    })),
    testCases,
    timeLimitMs
  };
}

export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!auth?.currentUser) {
    throw new Error("Sign in before using the admin tool.");
  }
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${idToken}`
    }
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function fetchAllCodingProblems(): Promise<CodingProblemRecord[]> {
  const payload = await authedRequest<{ problems: CodingProblemRecord[] }>("/api/admin/coding-problems", {
    method: "GET"
  });
  return payload.problems;
}

export async function saveOneCodingProblem(payload: CodingProblemSourceInput): Promise<CodingProblemRecord> {
  const result = await authedRequest<{ problem: CodingProblemRecord }>("/api/admin/coding-problems", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return result.problem;
}
