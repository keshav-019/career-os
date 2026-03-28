"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import CodeArenaEditor from "@/components/CodeArenaEditor";
import StatementWithImages from "@/components/StatementWithImages";
import { auth } from "@/lib/firebase/client";
import { logCodingSubmission, useCodingSubmissionStats } from "@/lib/firebase/coding-submission-log";
import {
  CODING_LANGUAGES,
  getCodingProblem,
  runCodingSolution,
  submitCodingSolution,
  type CodingLanguage,
  type CodingProblemDetail,
  type CodingRunResponse,
  type CodingSubmitResponse
} from "@/lib/interview/coding-arena-client";
import type { CodingPaperProblem } from "@/lib/interview/coding-paper-planner";

type CaseDraft = {
  id: string;
  input: string;
  label: string;
  locked?: boolean;
  output: string;
};

type ConsoleTab = "testcase" | "result";

type CodingPaperSession = {
  id: string;
  title: string;
  durationMinutes: number;
  startedAt: number;
  problems: CodingPaperProblem[];
};

const PAPER_SESSION_PREFIX = "careeros:coding-paper:";

function makeDraftId(): string {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCountdown(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function indentBody(body: string, spaces: number): string {
  const lines = body.replace(/\s+$/, "").split("\n");
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  const minIndent =
    nonEmpty.length === 0
      ? 0
      : Math.min(
          ...nonEmpty.map((line) => {
            const match = line.match(/^\s*/);
            return match ? match[0].length : 0;
          })
        );
  const prefix = " ".repeat(spaces);
  return lines.map((line) => (line.trim().length > 0 ? `${prefix}${line.slice(minIndent)}` : "")).join("\n");
}

function indentBlock(block: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return block
    .trim()
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function getArgNames(params: string): string {
  if (!params.trim()) return "";
  return params
    .split(",")
    .map((param) => {
      const clean = param.trim().replace(/\s*=\s*.*$/, "");
      const parts = clean.split(/\s+/);
      return (parts[parts.length - 1] || "").replace(/[&*]/g, "");
    })
    .filter(Boolean)
    .join(", ");
}

function buildClassStyleStarter(language: CodingLanguage, starter: string): string {
  if (starter.includes("class Solution")) return starter;

  if (language === "javascript") {
    const match = starter.match(/^(\/\*\*[\s\S]*?\*\/\s*)?function solve\(([^)]*)\)\s*\{\n([\s\S]*)\n\}$/);
    if (!match) return starter;
    const [, comment = "", args, body] = match;
    return `${comment.trimEnd() ? `${comment.trimEnd()}\n` : ""}class Solution {
  solve(${args}) {
${indentBody(body, 4)}
  }
}

function solve(${args}) {
  return new Solution().solve(${args});
}`;
  }

  if (language === "python") {
    const match = starter.match(/^def solve\(([^)]*)\):\n([\s\S]*)$/);
    if (!match) return starter;
    const [, args, body] = match;
    const callArgs = args.trim();
    return `class Solution:
    def solve(self${callArgs ? `, ${callArgs}` : ""}):
${indentBody(body, 8)}


def solve(${args}):
    return Solution().solve(${callArgs})`;
  }

  if (language === "cpp") {
    const match = starter.match(/^(\/\*\*[\s\S]*?\*\/\s*)?([A-Za-z0-9_:<>,\s]+?)\s+solve\(([^)]*)\)\s*\{\n([\s\S]*)\n\}$/);
    if (!match) return starter;
    const [, comment = "", returnType, params, body] = match;
    const argNames = getArgNames(params);
    return `${comment.trimEnd() ? `${comment.trimEnd()}\n` : ""}class Solution {
public:
  ${returnType.trim()} solve(${params}) {
${indentBody(body, 4)}
  }
};

${returnType.trim()} solve(${params}) {
  return Solution().solve(${argNames});
}`;
  }

  if (language === "java") {
    const match = starter.match(/^(\s*\/\*\*[\s\S]*?\*\/\s*)?\s*static\s+(.+?)\s+solve\(([^)]*)\)\s*\{\n([\s\S]*)\n\s*\}$/);
    if (!match) return starter;
    const [, comment = "", returnType, params, body] = match;
    const argNames = getArgNames(params);
    return `${comment.trim() ? `${indentBlock(comment, 2)}\n` : ""}  static class Solution {
    ${returnType.trim()} solve(${params}) {
${indentBody(body, 6)}
    }
  }

  static ${returnType.trim()} solve(${params}) {
    return new Solution().solve(${argNames});
  }`;
  }

  return starter;
}

function buildStarterSources(problem: CodingProblemDetail): Partial<Record<CodingLanguage, string>> {
  return CODING_LANGUAGES.reduce<Partial<Record<CodingLanguage, string>>>((sources, { id }) => {
    sources[id] = buildClassStyleStarter(id, problem.starterCode[id] ?? "");
    return sources;
  }, {});
}

function buildCaseDrafts(problem: CodingProblemDetail): CaseDraft[] {
  return problem.visibleTests.map((test, index) => ({
    id: `sample-${index + 1}`,
    input: test.input,
    label: `Case ${index + 1}`,
    locked: true,
    output: test.output
  }));
}

function verdictText(result: CodingRunResponse): { passed: boolean; total: number; passedCount: number; runtimeMs: number } {
  const judged = result.results.filter((entry) => typeof entry.passed === "boolean");
  const passedCount = judged.filter((entry) => entry.passed).length;
  const runtimeMs = result.results.reduce((sum, entry) => sum + (entry.timeMs || 0), 0);
  return { passed: judged.length > 0 && passedCount === judged.length, total: judged.length, passedCount, runtimeMs };
}

export default function CodingRoomPage() {
  const params = useParams<{ problemId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const problemId = params.problemId;
  const paperId = searchParams.get("paper");

  const [problem, setProblem] = useState<CodingProblemDetail | null>(null);
  const [paperSession, setPaperSession] = useState<CodingPaperSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [sourcesByLanguage, setSourcesByLanguage] = useState<Partial<Record<CodingLanguage, string>>>({});
  const [caseDrafts, setCaseDrafts] = useState<CaseDraft[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeConsoleTab, setActiveConsoleTab] = useState<ConsoleTab>("testcase");

  const [runResult, setRunResult] = useState<CodingRunResponse | null>(null);
  const [submitResult, setSubmitResult] = useState<CodingSubmitResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [integrityWarnings, setIntegrityWarnings] = useState(0);
  const submissionStats = useCodingSubmissionStats(problem?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRunResult(null);
    setSubmitResult(null);
    setActionError(null);
    setActiveConsoleTab("testcase");

    getCodingProblem(problemId)
      .then((detail) => {
        if (cancelled) return;
        const drafts = buildCaseDrafts(detail);
        setProblem(detail);
        setSourcesByLanguage(buildStarterSources(detail));
        setCaseDrafts(drafts);
        setActiveCaseId(drafts[0]?.id ?? null);
        setActiveResultIndex(0);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not load this problem.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [problemId]);

  useEffect(() => {
    if (!paperId || typeof window === "undefined") {
      setPaperSession(null);
      return;
    }

    try {
      const rawSession = window.sessionStorage.getItem(`${PAPER_SESSION_PREFIX}${paperId}`);
      setPaperSession(rawSession ? (JSON.parse(rawSession) as CodingPaperSession) : null);
    } catch {
      setPaperSession(null);
    }
  }, [paperId]);

  useEffect(() => {
    if (!paperSession) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [paperSession]);

  useEffect(() => {
    if (!paperSession || typeof document === "undefined") return undefined;
    let lastWarningAt = 0;

    const registerWarning = () => {
      const currentTime = Date.now();
      if (currentTime - lastWarningAt < 1000) return;
      lastWarningAt = currentTime;
      setIntegrityWarnings((count) => count + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") registerWarning();
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) registerWarning();
    };

    window.addEventListener("blur", registerWarning);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("blur", registerWarning);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [paperSession]);

  const source = sourcesByLanguage[language] ?? "";
  const activeCase = caseDrafts.find((draft) => draft.id === activeCaseId) ?? caseDrafts[0] ?? null;
  const runVerdict = useMemo(() => (runResult ? verdictText(runResult) : null), [runResult]);
  const activeResult =
    runResult && runResult.results.length > 0
      ? runResult.results[Math.min(activeResultIndex, runResult.results.length - 1)]
      : null;

  const paperProblemIds = useMemo(() => paperSession?.problems.map((paperProblem) => paperProblem.id) ?? [], [paperSession]);
  const currentPaperIndex = paperProblemIds.findIndex((id) => id === problemId);
  const paperRemainingMs = paperSession ? paperSession.startedAt + paperSession.durationMinutes * 60_000 - now : null;
  const paperExpired = paperRemainingMs !== null && paperRemainingMs <= 0;
  const actionsDisabled = isRunning || isSubmitting || paperExpired;

  const handleSourceChange = useCallback(
    (value: string) => {
      setSourcesByLanguage((current) => ({ ...current, [language]: value }));
    },
    [language]
  );

  const handleReset = useCallback(() => {
    if (!problem) return;
    setSourcesByLanguage((current) => ({
      ...current,
      [language]: buildClassStyleStarter(language, problem.starterCode[language] ?? "")
    }));
  }, [language, problem]);

  const handleAddCase = useCallback(() => {
    setCaseDrafts((current) => {
      const nextCase = {
        id: makeDraftId(),
        input: "",
        label: `Case ${current.length + 1}`,
        output: ""
      };
      setActiveCaseId(nextCase.id);
      setActiveConsoleTab("testcase");
      return [...current, nextCase];
    });
  }, []);

  const handleRemoveCase = useCallback((id: string) => {
    setCaseDrafts((current) => {
      const next = current.filter((test) => test.id !== id || test.locked);
      if (activeCaseId === id) {
        setActiveCaseId(next[0]?.id ?? null);
      }
      return next;
    });
  }, [activeCaseId]);

  const handleUpdateCase = useCallback((id: string, field: "input" | "output", value: string) => {
    setCaseDrafts((current) => current.map((test) => (test.id === id ? { ...test, [field]: value } : test)));
  }, []);

  const handleEnterFullscreen = useCallback(async () => {
    try {
      if (typeof document !== "undefined" && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setActionError("Fullscreen was blocked by the operating system or browser.");
    }
  }, []);

  const goToPaperProblem = useCallback(
    (targetProblemId: string) => {
      if (!paperSession) return;
      router.push(`/coding-room/${targetProblemId}?paper=${encodeURIComponent(paperSession.id)}`);
    },
    [paperSession, router]
  );

  const handleRun = useCallback(async () => {
    if (!problem || paperExpired) return;

    const runnableCases = caseDrafts
      .filter((test) => test.input.trim().length > 0)
      .map((test, index) => ({
        input: test.input,
        label: test.label || `Case ${index + 1}`,
        output: test.output.trim().length > 0 ? test.output : undefined
      }));

    if (runnableCases.length === 0) {
      setActionError("Add at least one testcase input before running.");
      setActiveConsoleTab("testcase");
      return;
    }

    setIsRunning(true);
    setActionError(null);
    setSubmitResult(null);
    try {
      const result = await runCodingSolution({
        problemId: problem.id,
        language,
        source,
        customTests: runnableCases,
        customTestsOnly: true
      });
      const firstFailureIndex = result.results.findIndex((entry) => entry.passed === false);
      setRunResult(result);
      setActiveResultIndex(firstFailureIndex >= 0 ? firstFailureIndex : 0);
      setActiveConsoleTab("result");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to run your solution.");
      setActiveConsoleTab("result");
    } finally {
      setIsRunning(false);
    }
  }, [caseDrafts, language, paperExpired, problem, source]);

  const handleSubmit = useCallback(async () => {
    if (!problem || paperExpired) return;
    setIsSubmitting(true);
    setActionError(null);
    setRunResult(null);
    setActiveConsoleTab("result");
    try {
      const result = await submitCodingSolution({ problemId: problem.id, language, source });
      setSubmitResult(result);

      // Log-only: records that this user passed this problem right now, never the solution itself. Best-effort -
      // see lib/firebase/coding-submission-log.ts.
      if (result.accepted && auth?.currentUser) {
        void logCodingSubmission(auth.currentUser.uid, problem.id);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to submit your solution.");
    } finally {
      setIsSubmitting(false);
    }
  }, [language, paperExpired, problem, source]);

  if (loading) {
    return (
      <div className="page-stack">
        <div className="empty-drop">
          <Loader2 className="spin" size={16} /> Loading problem...
        </div>
      </div>
    );
  }

  if (loadError || !problem) {
    return (
      <div className="page-stack">
        <div className="war-room-ai-top-grid">
          <section className="career-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Coding Track</p>
                <h2>Could not load this problem</h2>
                <p>{loadError || "Unknown error."}</p>
              </div>
              <AlertTriangle size={20} />
            </div>
            <p className="muted">
              This arena runs entirely on your machine through CareerOS Desktop. Make sure the desktop app is open,
              then try again.
            </p>
          </section>

          <Link
            aria-label="Back to interview categories"
            className="career-card war-room-go-back-card instant-tooltip-wrap"
            href="/interview-prep?track=coding"
          >
            <span className="war-room-go-back-orbit" aria-hidden>
              <ArrowLeft size={28} />
            </span>
            <span className="instant-tooltip">Go Back</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-room-shell">
      <div className="coding-room-actionbar">
        <div className="coding-room-action-left">
          <button className="ghost-button" onClick={() => router.push("/interview-prep?track=coding")} type="button">
            <ArrowLeft size={14} />
            Arena
          </button>
          <div className="coding-room-action-title">
            <p className="eyebrow">{paperSession ? paperSession.title : "Problem practice"}</p>
            <h2>{problem.title}</h2>
            <div className="coding-room-action-meta">
              <span className="pill danger">{problem.difficulty}</span>
              <span>{problem.hiddenTestCount} hidden tests</span>
              {submissionStats.count > 0 ? (
                <span
                  className="pill success"
                  title={
                    submissionStats.lastSubmittedAt
                      ? `Last submitted ${new Date(submissionStats.lastSubmittedAt).toLocaleString()}`
                      : undefined
                  }
                >
                  <CheckCircle2 size={12} />
                  Submitted {submissionStats.count}x
                </span>
              ) : null}
              {problem.tags.slice(0, 4).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="coding-room-action-buttons">
          {paperSession ? (
            <>
              <span className={`pill ${paperExpired ? "danger" : "brand"}`}>
                <Clock3 size={12} />
                {formatCountdown(paperRemainingMs ?? 0)}
              </span>
              <span className={`pill ${integrityWarnings > 0 ? "warning" : "success"}`}>
                {integrityWarnings > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                {integrityWarnings} flags
              </span>
              <button className="ghost-button" onClick={() => void handleEnterFullscreen()} type="button">
                Fullscreen
              </button>
            </>
          ) : null}
          <button className="ghost-button" disabled={actionsDisabled} onClick={() => void handleRun()} type="button">
            {isRunning ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
            Run
          </button>
          <button className="primary-button" disabled={actionsDisabled} onClick={() => void handleSubmit()} type="button">
            {isSubmitting ? <Loader2 className="spin" size={14} /> : <Send size={14} />}
            Submit
          </button>
        </div>
      </div>

      {paperSession ? (
        <section className="coding-paper-session-bar">
          <button
            className="ghost-button"
            disabled={currentPaperIndex <= 0}
            onClick={() => goToPaperProblem(paperProblemIds[currentPaperIndex - 1] || problem.id)}
            type="button"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <div className="coding-paper-session-steps">
            {paperSession.problems.map((paperProblem, index) => (
              <button
                className={paperProblem.id === problem.id ? "active" : ""}
                key={paperProblem.id}
                onClick={() => goToPaperProblem(paperProblem.id)}
                type="button"
              >
                <span>{index + 1}</span>
                {paperProblem.title}
              </button>
            ))}
          </div>
          <button
            className="ghost-button"
            disabled={currentPaperIndex === -1 || currentPaperIndex >= paperProblemIds.length - 1}
            onClick={() => goToPaperProblem(paperProblemIds[currentPaperIndex + 1] || problem.id)}
            type="button"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </section>
      ) : null}

      {paperExpired ? (
        <div className="coding-room-result-banner fail">
          <XCircle size={16} />
          Time is up. Run and submit are locked for this paper session.
        </div>
      ) : null}

      <div className="coding-room-workbench">
        <section className="coding-room-pane coding-room-statement-pane">
          <div className="coding-room-panel-tabs">
            <span className="active">Description</span>
            <span>Companies</span>
          </div>
          <div className="coding-room-statement-scroll">
            <div className="coding-room-statement-head">
              <div>
                <p className="eyebrow">Problem statement</p>
                <h2 className="coding-room-title">{problem.title}</h2>
              </div>
              <span className="pill danger">{problem.difficulty}</span>
            </div>

            <div className="coding-room-companies">
              <strong>Asked by</strong>
              <div className="tag-cloud">
                {problem.companies.map((company) => (
                  <span key={company}>{company}</span>
                ))}
              </div>
            </div>

            <div className="coding-room-statement-body">
              <StatementWithImages statement={problem.statement} />

              <h3>Input format</h3>
              <p>{problem.inputFormat}</p>

              <h3>Output format</h3>
              <p>{problem.outputFormat}</p>

              <h3>Constraints</h3>
              <ul>
                {problem.constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>

              <h3>Examples</h3>
              {problem.examples.map((example, index) => (
                <div className="coding-room-example" key={index}>
                  <p className="coding-room-example-label">Example {index + 1}</p>
                  <pre>{`Input:\n${example.input}\n\nOutput:\n${example.output}`}</pre>
                  {example.explanation ? <p className="muted">{example.explanation}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="coding-room-pane coding-room-editor-pane">
          <div className="coding-room-code-panel">
            <div className="coding-room-editor-header">
              <strong>Code</strong>
              <div className="coding-room-editor-tools">
                <label htmlFor="coding-language-select">
                  <span>Language</span>
                  <select
                    aria-label="Programming language"
                    className="coding-room-language-select"
                    id="coding-language-select"
                    onChange={(event) => setLanguage(event.target.value as CodingLanguage)}
                    value={language}
                  >
                    {CODING_LANGUAGES.map(({ id, label }) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="ghost-button" onClick={handleReset} type="button">
                  <RotateCcw size={13} />
                  Reset
                </button>
              </div>
            </div>

            <CodeArenaEditor language={language} onChange={handleSourceChange} value={source} />
          </div>

          <div className="coding-room-console-panel">
            <div className="coding-room-console-tabs">
              <button
                className={activeConsoleTab === "testcase" ? "active" : ""}
                onClick={() => setActiveConsoleTab("testcase")}
                type="button"
              >
                <CheckCircle2 size={13} />
                Testcase
              </button>
              <button
                className={activeConsoleTab === "result" ? "active" : ""}
                onClick={() => setActiveConsoleTab("result")}
                type="button"
              >
                {runVerdict?.passed || submitResult?.accepted ? <CheckCircle2 size={13} /> : <Play size={13} />}
                Test Result
              </button>
            </div>

            <div className="coding-room-console-body">
              {activeConsoleTab === "testcase" ? (
                <div className="coding-room-testcase-editor">
                  <div className="coding-room-case-tabs">
                    {caseDrafts.map((draft) => (
                      <button
                        className={draft.id === activeCase?.id ? "active" : ""}
                        key={draft.id}
                        onClick={() => setActiveCaseId(draft.id)}
                        type="button"
                      >
                        {draft.label}
                      </button>
                    ))}
                    <button aria-label="Add testcase" className="coding-room-add-case" onClick={handleAddCase} type="button">
                      <Plus size={14} />
                    </button>
                  </div>

                  {activeCase ? (
                    <div className="coding-room-case-fields">
                      <label>
                        <span>Input</span>
                        <textarea
                          onChange={(event) => handleUpdateCase(activeCase.id, "input", event.target.value)}
                          placeholder="Input for this case"
                          value={activeCase.input}
                        />
                      </label>
                      <label>
                        <span>Expected output</span>
                        <textarea
                          onChange={(event) => handleUpdateCase(activeCase.id, "output", event.target.value)}
                          placeholder="Optional for custom cases"
                          value={activeCase.output}
                        />
                      </label>
                      {!activeCase.locked ? (
                        <button className="ghost-button coding-room-remove-case" onClick={() => handleRemoveCase(activeCase.id)} type="button">
                          <Trash2 size={14} />
                          Remove case
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="coding-room-empty-console">Add a testcase to run your code against.</div>
                  )}
                </div>
              ) : (
                <div className="coding-room-result-console">
                  {actionError ? <p className="settings-feedback error">{actionError}</p> : null}

                  {runResult?.compileError ? (
                    <div className="coding-room-compile-error">
                      <strong>Compile error</strong>
                      <pre>{runResult.compileError}</pre>
                    </div>
                  ) : null}

                  {submitResult?.compileError ? (
                    <div className="coding-room-compile-error">
                      <strong>Compile error</strong>
                      <pre>{submitResult.compileError}</pre>
                    </div>
                  ) : null}

                  {submitResult && !submitResult.compileError ? (
                    <div className={`coding-room-result-banner ${submitResult.accepted ? "pass" : "fail"}`}>
                      {submitResult.firstFailure?.timedOut ? (
                        <Clock3 size={16} />
                      ) : submitResult.accepted ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                      {submitResult.firstFailure?.timedOut
                        ? `Time Limit Exceeded - hidden test #${submitResult.firstFailure.index + 1} took too long to finish. ${submitResult.passedHidden}/${submitResult.totalHidden} hidden tests passed before that.`
                        : submitResult.accepted
                          ? `Accepted - ${submitResult.passedHidden}/${submitResult.totalHidden} hidden tests passed.`
                          : `${submitResult.passedHidden}/${submitResult.totalHidden} hidden tests passed.`}
                    </div>
                  ) : null}

                  {!runResult && !submitResult && !actionError ? (
                    <div className="coding-room-empty-console">Run your code to see testcase output here.</div>
                  ) : null}

                  {runResult && !runResult.compileError && runVerdict ? (
                    <>
                      <div className={`coding-room-result-verdict ${runVerdict.passed ? "pass" : "fail"}`}>
                        <strong>{runVerdict.passed ? "Accepted" : "Wrong Answer"}</strong>
                        <span>Runtime: {runVerdict.runtimeMs} ms</span>
                      </div>

                      <div className="coding-room-case-tabs result-tabs">
                        {runResult.results.map((result, index) => (
                          <button
                            className={index === activeResultIndex ? "active" : ""}
                            key={`${result.label}-${index}`}
                            onClick={() => setActiveResultIndex(index)}
                            type="button"
                          >
                            {result.passed === false ? (
                              <XCircle className="coding-room-fail-icon" size={13} />
                            ) : result.passed ? (
                              <CheckCircle2 className="coding-room-pass-icon" size={13} />
                            ) : null}
                            {result.label}
                          </button>
                        ))}
                      </div>

                      {activeResult ? (
                        <div className="coding-room-result-detail-grid">
                          <label>
                            <span>Input</span>
                            <pre>{activeResult.input}</pre>
                          </label>
                          <label className={activeResult.passed ? "pass" : activeResult.passed === false ? "fail" : ""}>
                            <span>Output</span>
                            <pre>{activeResult.timedOut ? "Time limit exceeded." : activeResult.actualOutput || "(empty)"}</pre>
                          </label>
                          {activeResult.expectedOutput !== undefined ? (
                            <label>
                              <span>Expected</span>
                              <pre>{activeResult.expectedOutput}</pre>
                            </label>
                          ) : null}
                          {activeResult.stderr ? (
                            <label>
                              <span>Stderr</span>
                              <pre>{activeResult.stderr}</pre>
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
