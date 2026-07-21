const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createDesktopHelperServer } = require("../src/helper-server");

// This smoke test exercises the LOCAL JUDGE only (compile/run/submit via runtime.js + coding/index.js) - problem
// catalog data now lives in Firestore (see apps/web/src/lib/coding-catalog), fetched live by the desktop helper
// from the web app's own API. Rather than standing up a real web app + Firestore for a smoke test, this script
// mocks that one endpoint with a tiny local HTTP server serving a pre-generated fixture (the same shape
// GET /api/coding-problems/:id/judge-data returns), and points the helper's getWebBaseUrl() at it. See
// fixtures/trapping-rain-water-judge-data.json - regenerate it any time problem-builder.ts's output shape changes
// by running buildCodingProblemRecord + toJudgeData against coding-problems.seed.json's "trapping-rain-water" entry.
const JUDGE_DATA_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "trapping-rain-water-judge-data.json"), "utf8")
);
const FAKE_ID_TOKEN = "smoke-test-fake-id-token";

function startMockWebApp() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/coding-problems/trapping-rain-water/judge-data") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, problem: JUDGE_DATA_FIXTURE }));
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Unknown mock route." }));
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ close: () => new Promise((r) => server.close(r)), url: `http://127.0.0.1:${address.port}` });
    });
    server.on("error", reject);
  });
}

const CORRECT_JS_FUNCTION = `/**
 * solve(height: number[]) -> number
 */
function solve(height) {
  const n = height.length;
  if (n === 0) return 0;
  const left = new Array(n), right = new Array(n);
  left[0] = height[0];
  for (let i = 1; i < n; i++) left[i] = Math.max(left[i - 1], height[i]);
  right[n - 1] = height[n - 1];
  for (let i = n - 2; i >= 0; i--) right[i] = Math.max(right[i + 1], height[i]);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.min(left[i], right[i]) - height[i];
  return total;
}`;

const WRONG_JS_FUNCTION = `function solve(height) {
  return 12345;
}`;

const CRASHING_JS_FUNCTION = `function solve(height) {
  return height[999999].toFixed(2);
}`;

const SYNTAX_ERROR_JS_FUNCTION = `function solve(height) {
  this is not valid javascript >>> {{{
}`;

async function main() {
  const app = {
    getPath() {
      return path.resolve(__dirname, "..", ".tmp-helper-user-data");
    },
    getVersion() {
      return "0.1.0-smoke";
    },
    isPackaged: false
  };

  const helper = createDesktopHelperServer({
    app,
    log: {
      error(...args) {
        console.error("[helper:error]", ...args);
      },
      info() {},
      warn() {}
    },
    port: 0
  });

  const mockWebApp = await startMockWebApp();
  helper.setWebBaseUrl(mockWebApp.url);

  const authedJsonPost = (url, body) =>
    fetch(url, {
      body: JSON.stringify(body),
      headers: { authorization: `Bearer ${FAKE_ID_TOKEN}`, "content-type": "application/json" },
      method: "POST"
    }).then((r) => r.json());

  const { url } = await helper.start();
  try {
    const runtime = await fetch(`${url}/code/runtime`).then((r) => r.json());
    if (!runtime.ok) throw new Error(`Unexpected /code/runtime payload: ${JSON.stringify(runtime)}`);
    console.log("Runtime status:", JSON.stringify(runtime.runtime, null, 2));

    // Problem catalog listing/detail are no longer served by this helper (they come from the web app's own
    // /api/coding-problems routes - see apps/web/src/lib/interview/coding-arena-client.ts). This smoke test only
    // exercises /code/run and /code/submit, using the pre-generated judge-data fixture as the "visible starter".
    const stubSource = JUDGE_DATA_FIXTURE.starterCode.javascript;
    console.log("Visible starter (what the user sees):\n" + stubSource);

    const runStub = await authedJsonPost(`${url}/code/run`, {
      problemId: "trapping-rain-water",
      language: "javascript",
      source: stubSource
    });
    if (!runStub.ok || runStub.results.some((r) => r.passed)) {
      throw new Error(`Expected the unedited stub to fail every sample, got: ${JSON.stringify(runStub)}`);
    }
    console.log("PASS: unedited stub fails all samples (as expected).");

    const runWrong = await authedJsonPost(`${url}/code/run`, {
      problemId: "trapping-rain-water",
      language: "javascript",
      source: WRONG_JS_FUNCTION
    });
    if (!runWrong.ok || runWrong.results.every((r) => r.passed)) {
      throw new Error(`Expected the "always return 12345" solution to fail: ${JSON.stringify(runWrong)}`);
    }
    if (runWrong.results[0].actualOutput.trim() !== "12345") {
      throw new Error(`Expected actualOutput to cleanly show 12345, got: ${JSON.stringify(runWrong.results[0])}`);
    }
    console.log("PASS: wrong-logic solution fails with a clean actual/expected diff (12345 vs 6).");

    const runCrash = await authedJsonPost(`${url}/code/run`, {
      problemId: "trapping-rain-water",
      language: "javascript",
      source: CRASHING_JS_FUNCTION
    });
    if (!runCrash.ok) throw new Error(`Expected a 200 ok:true envelope even for a runtime crash: ${JSON.stringify(runCrash)}`);
    const crashResult = runCrash.results[0];
    if (crashResult.passed !== false || !crashResult.stderr || !/TypeError/i.test(crashResult.stderr)) {
      throw new Error(`Expected a clean TypeError in stderr for the crashing solution, got: ${JSON.stringify(crashResult)}`);
    }
    console.log("PASS: runtime crash (undefined.toFixed) surfaces a real TypeError in stderr, not a harness explosion.");
    console.log("  stderr snippet:", crashResult.stderr.split("\n")[0]);

    const runSyntaxError = await authedJsonPost(`${url}/code/run`, {
      problemId: "trapping-rain-water",
      language: "javascript",
      source: SYNTAX_ERROR_JS_FUNCTION
    });
    if (!runSyntaxError.ok) throw new Error(`Unexpected envelope for syntax error: ${JSON.stringify(runSyntaxError)}`);
    const syntaxCrash = runSyntaxError.results[0];
    if (syntaxCrash.passed !== false || !syntaxCrash.stderr || !/SyntaxError/i.test(syntaxCrash.stderr)) {
      throw new Error(`Expected a clean SyntaxError in stderr, got: ${JSON.stringify(syntaxCrash)}`);
    }
    console.log("PASS: malformed JS surfaces a real SyntaxError in stderr (Node has no separate compile step for JS).");

    const runCorrect = await authedJsonPost(`${url}/code/run`, {
      customTests: [{ input: "3\n1 1 1", output: "0" }],
      language: "javascript",
      problemId: "trapping-rain-water",
      source: CORRECT_JS_FUNCTION
    });
    if (!runCorrect.ok || !runCorrect.results.every((r) => r.passed)) {
      throw new Error(`Expected correct solution to pass all run tests: ${JSON.stringify(runCorrect)}`);
    }
    console.log(`PASS: correct solution passes run (samples + custom): ${runCorrect.results.length}/${runCorrect.results.length}.`);

    const submitCorrect = await authedJsonPost(`${url}/code/submit`, {
      language: "javascript",
      problemId: "trapping-rain-water",
      source: CORRECT_JS_FUNCTION
    });
    if (!submitCorrect.ok || !submitCorrect.accepted) {
      throw new Error(`Expected submit to be accepted: ${JSON.stringify(submitCorrect)}`);
    }
    console.log(`PASS: submit accepted: ${submitCorrect.passedHidden}/${submitCorrect.totalHidden} hidden tests passed.`);

    const emptySource = await authedJsonPost(`${url}/code/run`, {
      problemId: "trapping-rain-water",
      language: "javascript",
      source: ""
    });
    if (emptySource.ok !== false || !/empty/i.test(emptySource.error || "")) {
      throw new Error(`Expected a clean "empty solution" error, got: ${JSON.stringify(emptySource)}`);
    }
    console.log("PASS: empty source gives a clean user-facing error, not a crash.");

    const noAuthResponse = await fetch(`${url}/code/run`, {
      body: JSON.stringify({ problemId: "trapping-rain-water", language: "javascript", source: CORRECT_JS_FUNCTION }),
      headers: { "content-type": "application/json" },
      method: "POST"
    }).then((r) => r.json());
    if (noAuthResponse.ok !== false) {
      throw new Error(`Expected a run with no Authorization header to fail (no idToken to forward): ${JSON.stringify(noAuthResponse)}`);
    }
    console.log("PASS: run without a signed-in user's id token is rejected before reaching the mock catalog.");

    console.log(JSON.stringify({ ok: true }, null, 2));
  } finally {
    await helper.close();
    await mockWebApp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
