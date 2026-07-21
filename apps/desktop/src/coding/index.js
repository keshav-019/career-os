"use strict";

/**
 * Glue layer between the raw judge engine (runtime.js) and the cloud-hosted problem catalog, consumed by the
 * Express helper endpoints wired up in main.js.
 *
 * Problem DATA (statement, harness, hidden tests) now lives in Firestore, managed through the web app's admin tool
 * (see apps/web/src/lib/coding-catalog). This module fetches it live, per request, from the web app's own API -
 * there is no local problem catalog anymore (problems.json/problems.js are gone). Actual code EXECUTION still
 * happens entirely on the user's machine, unchanged - only the problem definitions moved to the cloud.
 *
 * Hidden test cases never leave this module: /code/submit only ever returns pass/fail (plus a small amount of
 * debugging detail for the first failure) instead of the raw hidden expected output, and this module never returns
 * `harness`/`hiddenTests` from run()/submit() responses.
 */

const { createCodeRuntime } = require("./runtime.js");

const MAX_CUSTOM_TESTS = 20;
const MAX_USER_SOURCE_LENGTH = 20_000;
const RUN_TIMEOUT_MS = 6_000;
const SUBMIT_TIMEOUT_MS = 8_000;
const JUDGE_DATA_TIMEOUT_MS = 10_000;
const SUPPORTED_LANGUAGES = ["c", "cpp", "java", "javascript", "python", "rust"];

class CodingArenaUserError extends Error {}

/**
 * Rebuilds the full, runnable program from the hidden per-language harness (prefix/suffix) and whatever the user
 * currently has in their editor. The user only ever sees/edits the bare `solve` function - everything else lives in
 * `judgeData.harness` and is never sent to the client.
 */
function composeFullSource(judgeData, language, userFunctionBlock) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new CodingArenaUserError(`Unsupported language: ${language}`);
  }

  const harness = judgeData.harness?.[language];
  if (!harness) {
    throw new CodingArenaUserError(`This problem does not support ${language} yet.`);
  }

  const userCode = typeof userFunctionBlock === "string" ? userFunctionBlock : "";
  if (!userCode.trim()) {
    throw new CodingArenaUserError("Your solution is empty.");
  }
  if (userCode.length > MAX_USER_SOURCE_LENGTH) {
    throw new CodingArenaUserError("Your solution is too large.");
  }

  return `${harness.prefix}${userCode}${harness.suffix}`;
}

function createCodingArena({ log, getWebBaseUrl } = {}) {
  const runtime = createCodeRuntime({ log });

  /**
   * Fetches harness + hidden tests for one problem from the web app's own API, authenticated with the signed-in
   * user's Firebase id token (forwarded by the renderer on every run/submit call). "Live fetch every time" by
   * design - no local cache, so run/submit require the web app runtime to be reachable, same as everything else in
   * this app (it already requires Firebase Auth to sign in at all).
   */
  async function fetchJudgeData(problemId, idToken) {
    const baseUrl = typeof getWebBaseUrl === "function" ? getWebBaseUrl() : null;
    if (!baseUrl) {
      throw new CodingArenaUserError("CareerOS is still starting up. Wait a moment and try again.");
    }
    if (!idToken) {
      throw new CodingArenaUserError("Sign in to CareerOS before running or submitting code.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JUDGE_DATA_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${baseUrl}/api/coding-problems/${encodeURIComponent(problemId)}/judge-data`, {
        headers: { Authorization: `Bearer ${idToken}` },
        signal: controller.signal
      });
    } catch (err) {
      throw new CodingArenaUserError(`Could not reach CareerOS to load this problem: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new CodingArenaUserError(payload.error || `Could not load problem data (${response.status}).`);
    }

    return payload.problem;
  }

  function getRuntimeStatus() {
    return runtime.getRuntimeStatus();
  }

  function sanitizeCustomTests(customTests) {
    if (!Array.isArray(customTests)) return [];
    return customTests.slice(0, MAX_CUSTOM_TESTS).map((t, index) => ({
      input: typeof t?.input === "string" ? t.input : "",
      output: typeof t?.output === "string" && t.output.length > 0 ? t.output : undefined,
      label: typeof t?.label === "string" && t.label.trim() ? t.label.trim().slice(0, 40) : `Case ${index + 1}`
    }));
  }

  async function run({ problemId, language, source, customTests, customTestsOnly, idToken }) {
    const judgeData = await fetchJudgeData(problemId, idToken);
    const fullSource = composeFullSource(judgeData, language, source);

    const visible = judgeData.visibleTests.map((t, i) => ({ ...t, label: `Sample ${i + 1}` }));
    const custom = sanitizeCustomTests(customTests);
    const tests = customTestsOnly && custom.length > 0 ? custom : [...visible, ...custom];

    const { compileError, results } = await runtime.runTests({
      language,
      source: fullSource,
      tests,
      timeoutMs: judgeData.timeLimitMs ?? RUN_TIMEOUT_MS
    });

    if (compileError) {
      return { compileError, results: [] };
    }

    return {
      compileError: null,
      results: results.map((r, i) => ({
        label: tests[i].label,
        input: r.input,
        expectedOutput: r.expectedOutput,
        actualOutput: r.actualOutput,
        passed: r.passed,
        stderr: r.stderr,
        timedOut: Boolean(r.timedOut),
        runtimeError: Boolean(r.runtimeError),
        timeMs: r.timeMs
      }))
    };
  }

  async function submit({ problemId, language, source, idToken }) {
    const judgeData = await fetchJudgeData(problemId, idToken);
    const fullSource = composeFullSource(judgeData, language, source);

    const tests = judgeData.hiddenTests;
    const { compileError, results } = await runtime.runTests({
      language,
      source: fullSource,
      tests,
      timeoutMs: judgeData.timeLimitMs ?? SUBMIT_TIMEOUT_MS
    });

    if (compileError) {
      return { compileError, accepted: false, totalHidden: tests.length, passedHidden: 0, firstFailure: null };
    }

    const passedHidden = results.filter((r) => r.passed).length;
    const firstFailIndex = results.findIndex((r) => !r.passed);
    const firstFailure =
      firstFailIndex === -1
        ? null
        : {
            index: firstFailIndex,
            stderr: results[firstFailIndex].stderr,
            timedOut: Boolean(results[firstFailIndex].timedOut),
            runtimeError: Boolean(results[firstFailIndex].runtimeError)
          };

    return {
      compileError: null,
      accepted: passedHidden === tests.length && tests.length > 0,
      totalHidden: tests.length,
      passedHidden,
      firstFailure,
      timeMs: results.reduce((sum, r) => sum + (r.timeMs || 0), 0)
    };
  }

  return {
    getRuntimeStatus,
    run,
    submit
  };
}

module.exports = { createCodingArena };
