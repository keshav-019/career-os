import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CodingHarnessParts,
  CodingLanguage,
  CodingOutputKind,
  CodingParamSpecEntry,
  CodingProblemRecord,
  CodingProblemSourceInput,
  CodingTestCaseRecord
} from "./types";

// starter-templates.js and serialize.js are copied unchanged from
// apps/desktop/scripts/coding-catalog/{starter-templates,serialize}.js. Both are pure string-generation logic with
// zero browser/Electron dependencies, so they're required directly here (Node-only, this module must never be
// imported from a "use client" file) rather than reimplemented in TypeScript. See this folder's README.md for why.
/* eslint-disable @typescript-eslint/no-var-requires */
const starterTemplates = require("./starter-templates.js") as {
  buildAllStarterParts: (
    paramSpec: CodingParamSpecEntry[],
    outputKind: CodingOutputKind
  ) => Record<CodingLanguage, { functionBlock: string; prefix: string; suffix: string }>;
  buildJavaScriptStarter: (paramSpec: CodingParamSpecEntry[], outputKind: CodingOutputKind, body: string) => string;
};
const serialize = require("./serialize.js") as {
  serializeInput: (paramSpec: CodingParamSpecEntry[], values: Record<string, unknown>) => string;
};
/* eslint-enable @typescript-eslint/no-var-requires */

const ALLOWED_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const REFERENCE_TIMEOUT_MS = 10_000;
/** Default per-test-case judge time limit when an admin doesn't set one explicitly. */
const DEFAULT_TIME_LIMIT_MS = 5_000;
const MIN_TIME_LIMIT_MS = 500;
const MAX_TIME_LIMIT_MS = 30_000;

export type BuildProblemContext = {
  createdBy: string;
  existingCreatedAt?: string;
  order: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function validateSourceInput(input: CodingProblemSourceInput): void {
  if (!input.id || !ALLOWED_ID_PATTERN.test(input.id)) {
    fail("id must be lowercase letters, numbers, and hyphens only (2-64 characters).");
  }
  if (!input.title?.trim()) {
    fail("title is required.");
  }
  if (!input.statement?.trim()) {
    fail("statement is required.");
  }
  if (!Array.isArray(input.paramSpec) || input.paramSpec.length === 0) {
    fail("paramSpec must have at least one entry.");
  }
  if (!input.outputKind) {
    fail("outputKind is required.");
  }
  if (!input.referenceBody?.trim()) {
    fail("referenceBody is required.");
  }
  if (!Array.isArray(input.testCases) || input.testCases.length === 0) {
    fail("At least one test case is required.");
  }
  if (!Array.isArray(input.examples) || input.examples.length === 0) {
    fail("At least one worked example is required.");
  }
  if (
    input.timeLimitMs !== undefined &&
    (!Number.isFinite(input.timeLimitMs) || input.timeLimitMs < MIN_TIME_LIMIT_MS || input.timeLimitMs > MAX_TIME_LIMIT_MS)
  ) {
    fail(`timeLimitMs must be between ${MIN_TIME_LIMIT_MS} and ${MAX_TIME_LIMIT_MS} milliseconds.`);
  }
}

/**
 * Runs the admin's JS reference solution, wrapped in the same generated harness a real submission would use, in a
 * short-lived separate Node process (never in-process eval). This mirrors
 * apps/desktop/scripts/coding-catalog/build-problems.js exactly, so hidden-test expected output always matches what
 * a real submission's harness would produce. Only ever called from an admin-gated API route - the trust boundary is
 * "the admin trusts their own reference solution", identical to the desktop build script this replaces.
 */
function runReferenceHarness(
  paramSpec: CodingParamSpecEntry[],
  outputKind: CodingOutputKind,
  referenceBody: string,
  stdinText: string
): string {
  const source = starterTemplates.buildJavaScriptStarter(paramSpec, outputKind, referenceBody);
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "careeros-coding-ref-"));
  const tmpFile = path.join(tmpDir, "reference.js");

  try {
    writeFileSync(tmpFile, source);
    return execFileSync(process.execPath, [tmpFile], {
      encoding: "utf8",
      input: stdinText,
      timeout: REFERENCE_TIMEOUT_MS
    });
  } finally {
    rmSync(tmpDir, { force: true, recursive: true });
  }
}

/**
 * Builds a fully judge-ready problem record from admin input: generates the per-language starter code + hidden
 * harness from paramSpec/outputKind, then runs the reference solution against every test case to compute expected
 * output. Throws with a human-readable message (safe to show the admin directly) on any failure - nothing is
 * partially written to Firestore by the caller if this throws.
 */
export function buildCodingProblemRecord(
  input: CodingProblemSourceInput,
  context: BuildProblemContext
): CodingProblemRecord {
  validateSourceInput(input);

  let parts: Record<CodingLanguage, { functionBlock: string; prefix: string; suffix: string }>;
  try {
    parts = starterTemplates.buildAllStarterParts(input.paramSpec, input.outputKind);
  } catch (error) {
    fail(`Starter/harness generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const starterCode = {} as Record<CodingLanguage, string>;
  const harness = {} as Record<CodingLanguage, CodingHarnessParts>;
  (Object.keys(parts) as CodingLanguage[]).forEach((lang) => {
    starterCode[lang] = parts[lang].functionBlock;
    harness[lang] = { prefix: parts[lang].prefix, suffix: parts[lang].suffix };
  });

  const visibleTests: CodingTestCaseRecord[] = [];
  const hiddenTests: CodingTestCaseRecord[] = [];
  const errors: string[] = [];

  input.testCases.forEach((testCase, index) => {
    let inputText: string;
    try {
      inputText = serialize.serializeInput(input.paramSpec, testCase.values);
    } catch (error) {
      errors.push(`Test case #${index + 1}: failed to serialize input - ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    let outputText: string;
    try {
      outputText = runReferenceHarness(input.paramSpec, input.outputKind, input.referenceBody, inputText);
    } catch (error) {
      errors.push(
        `Test case #${index + 1}: reference solution failed for input:\n${inputText}\n${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    const entry: CodingTestCaseRecord = {
      input: inputText.replace(/\n+$/, ""),
      output: outputText.replace(/\n+$/, "")
    };
    if (testCase.visible) {
      visibleTests.push(entry);
    } else {
      hiddenTests.push(entry);
    }
  });

  input.examples.forEach((example, index) => {
    const normalizedExpected = example.output.replace(/\n+$/, "");
    const matchingVisible = visibleTests.find((test) => test.input.trim() === example.input.trim());
    if (matchingVisible && matchingVisible.output.trim() !== normalizedExpected.trim()) {
      errors.push(
        `Example #${index + 1} mismatch: the statement says "${normalizedExpected}" but the reference solution computed "${matchingVisible.output}".`
      );
    }
  });

  if (errors.length > 0) {
    fail(errors.join("\n"));
  }

  if (visibleTests.length === 0) {
    fail("At least one test case must be marked visible (shown to the user as a sample).");
  }
  if (hiddenTests.length === 0) {
    fail("At least one test case must be marked hidden (used to judge submissions).");
  }

  const now = new Date().toISOString();

  return {
    companies: input.companies ?? [],
    constraints: input.constraints ?? [],
    createdAt: context.existingCreatedAt ?? now,
    createdBy: context.createdBy,
    difficulty: input.difficulty ?? "hard",
    examples: input.examples,
    harness,
    hiddenTests,
    id: input.id,
    inputFormat: input.inputFormat ?? "",
    order: context.order,
    outputFormat: input.outputFormat ?? "",
    outputKind: input.outputKind,
    paramSpec: input.paramSpec,
    referenceBody: input.referenceBody,
    slug: input.id,
    sourceJson: JSON.stringify(input, null, 2),
    starterCode,
    statement: input.statement,
    tags: input.tags ?? [],
    timeLimitMs: input.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS,
    title: input.title.trim(),
    updatedAt: now,
    visibleTests
  };
}
