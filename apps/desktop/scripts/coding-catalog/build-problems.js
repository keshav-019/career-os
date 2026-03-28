"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const os = require("os");

const { PROBLEMS } = require("./problems-source.js");
const { buildAllStarterParts, buildJavaScriptStarter } = require("./starter-templates.js");
const { serializeInput } = require("./serialize.js");

function runReferenceHarness(paramSpec, outputKind, referenceBody, stdinText) {
  const source = buildJavaScriptStarter(paramSpec, outputKind, referenceBody);
  const tmpFile = path.join(os.tmpdir(), `careeros-ref-${Date.now()}-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(tmpFile, source);
  try {
    const output = execFileSync(process.execPath, [tmpFile], {
      input: stdinText,
      encoding: "utf8",
      timeout: 10000
    });
    return output;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function slugToOrder(index) {
  return index + 1;
}

const finalProblems = [];
const errors = [];

PROBLEMS.forEach((problem, index) => {
  const { id, title, tags, companies, statement, inputFormat, outputFormat, constraints, examples, paramSpec, outputKind, referenceBody, testCases } = problem;

  let starterCode;
  let harness;
  try {
    const parts = buildAllStarterParts(paramSpec, outputKind);
    starterCode = {};
    harness = {};
    for (const lang of Object.keys(parts)) {
      starterCode[lang] = parts[lang].functionBlock;
      harness[lang] = { prefix: parts[lang].prefix, suffix: parts[lang].suffix };
    }
  } catch (err) {
    errors.push(`[${id}] starter generation failed: ${err.message}`);
    return;
  }

  const visibleTests = [];
  const hiddenTests = [];

  for (const tc of testCases) {
    let inputText;
    try {
      inputText = serializeInput(paramSpec, tc.values);
    } catch (err) {
      errors.push(`[${id}] failed to serialize test case: ${err.message}`);
      continue;
    }

    let outputText;
    try {
      outputText = runReferenceHarness(paramSpec, outputKind, referenceBody, inputText);
    } catch (err) {
      errors.push(`[${id}] reference execution failed for input:\n${inputText}\n${err.message}`);
      continue;
    }

    const entry = { input: inputText.replace(/\n+$/, ""), output: outputText.replace(/\n+$/, "") };
    if (tc.visible) visibleTests.push(entry);
    else hiddenTests.push(entry);
  }

  // Cross-check visible tests against the hand-written examples where possible.
  examples.forEach((ex, exIndex) => {
    const normalizedExpected = ex.output.replace(/\n+$/, "");
    const matchingVisible = visibleTests.find((v) => v.input.trim() === ex.input.trim());
    if (matchingVisible && matchingVisible.output.trim() !== normalizedExpected.trim()) {
      errors.push(
        `[${id}] example #${exIndex + 1} mismatch: statement says "${normalizedExpected}" but computed "${matchingVisible.output}"`
      );
    }
  });

  finalProblems.push({
    id,
    slug: id,
    title,
    difficulty: "hard",
    order: slugToOrder(index),
    tags,
    companies,
    statement,
    inputFormat,
    outputFormat,
    constraints,
    examples,
    paramSpec,
    outputKind,
    starterCode,
    harness,
    visibleTests,
    hiddenTests
  });
});

if (errors.length) {
  console.error("BUILD ERRORS:");
  for (const e of errors) console.error(" - " + e);
  process.exitCode = 1;
} else {
  console.log(`Built ${finalProblems.length} problems successfully, no errors.`);
}

const outDir = path.join(__dirname, "..", "..", "src", "coding");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "problems.json"), JSON.stringify(finalProblems, null, 2));
console.log(`Wrote ${path.join(outDir, "problems.json")}`);

// Print a quick summary table.
for (const p of finalProblems) {
  console.log(`${p.order}. ${p.title} [${p.id}] - visible=${p.visibleTests.length} hidden=${p.hiddenTests.length}`);
}
