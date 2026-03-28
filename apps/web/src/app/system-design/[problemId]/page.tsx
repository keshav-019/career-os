"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Maximize2,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sparkles,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { logSystemDesignAttempt, useSystemDesignAttemptStats } from "@/lib/firebase/system-design-attempt-log";
import { COMPONENT_BY_ID, type ComponentCategory } from "@/lib/system-design/component-library";
import {
  checkSystemDesignEstimate,
  checkSystemDesignFailureQuiz,
  checkSystemDesignTradeoff,
  getSystemDesignProblem,
  getSystemDesignSolution,
  validateSystemDesignPlacement,
  type EstimateResponse,
  type FailureQuizResponse,
  type SystemDesignProblemDetail,
  type SystemDesignSolution,
  type TradeoffResponse
} from "@/lib/interview/system-design-client";

type PlacedNode = { id: string; parentId: string };

type LastMessage = { type: "success" | "error"; text: string; whyItFits?: string };

function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildChildrenMap(nodes: PlacedNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of nodes) {
    const list = map.get(node.parentId) ?? [];
    list.push(node.id);
    map.set(node.parentId, list);
  }
  return map;
}

type TreeNodeProps = {
  nodeId: string;
  isRoot: boolean;
  childrenMap: Map<string, string[]>;
  readOnly: boolean;
  completed: boolean;
  justPlacedId: string | null;
  dragOverSlotKey: string | null;
  errorSlotKey: string | null;
  armed: boolean;
  whyItFitsById?: Map<string, string>;
  onDrop: (parentId: string, componentId: string) => void;
  onDragOver: (parentId: string) => void;
  onDragLeave: (parentId: string) => void;
  onSlotClick: (parentId: string) => void;
};

function CategoryDot({ category }: { category: ComponentCategory }) {
  return <span className={`sd-node-dot sd-cat-${category}`} aria-hidden="true" />;
}

function TreeNode(props: TreeNodeProps) {
  const {
    nodeId,
    isRoot,
    childrenMap,
    readOnly,
    completed,
    justPlacedId,
    dragOverSlotKey,
    errorSlotKey,
    armed,
    whyItFitsById,
    onDrop,
    onDragOver,
    onDragLeave,
    onSlotClick
  } = props;

  const component = COMPONENT_BY_ID[nodeId];
  const kids = childrenMap.get(nodeId) ?? [];
  const showAddSlot = !readOnly && !completed;

  return (
    <li>
      <div
        className={`sd-node${isRoot ? " sd-node-root" : ""}${justPlacedId === nodeId ? " sd-node-pop" : ""}`}
        title={component?.blurb}
      >
        {component ? <CategoryDot category={component.category} /> : null}
        {component?.label ?? nodeId}
      </div>
      {readOnly && whyItFitsById?.has(nodeId) ? (
        <p style={{ fontSize: 10, color: "var(--muted)", maxWidth: 160, textAlign: "center", margin: "4px 0 0" }}>
          {whyItFitsById.get(nodeId)}
        </p>
      ) : null}

      {kids.length > 0 || showAddSlot ? (
        <ul>
          {kids.map((kidId) => (
            <TreeNode key={kidId} {...props} nodeId={kidId} isRoot={false} />
          ))}
          {showAddSlot ? (
            <li>
              <button
                aria-label={`Add a component under ${component?.label ?? nodeId}`}
                className={`sd-add-slot${dragOverSlotKey === nodeId ? " sd-slot-dragover" : ""}${
                  errorSlotKey === nodeId ? " sd-slot-error" : ""
                }${armed ? " sd-slot-armed" : ""}`}
                onClick={() => onSlotClick(nodeId)}
                onDragLeave={() => onDragLeave(nodeId)}
                onDragOver={(event) => {
                  event.preventDefault();
                  onDragOver(nodeId);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const componentId = event.dataTransfer.getData("text/plain");
                  onDrop(nodeId, componentId);
                }}
                type="button"
              >
                +
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

export default function SystemDesignRoomPage() {
  const params = useParams<{ problemId: string }>();
  const problemId = params.problemId;

  const [problem, setProblem] = useState<SystemDesignProblemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [placedNodes, setPlacedNodes] = useState<PlacedNode[]>([]);
  const [armedComponentId, setArmedComponentId] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const [errorSlotKey, setErrorSlotKey] = useState<string | null>(null);
  const [justPlacedId, setJustPlacedId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<LastMessage | null>(null);
  const [validating, setValidating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [solution, setSolution] = useState<SystemDesignSolution | null>(null);
  const [showingSolution, setShowingSolution] = useState(false);
  const [loadingSolution, setLoadingSolution] = useState(false);

  // Back-of-envelope capacity estimation
  const [estimateAnswers, setEstimateAnswers] = useState<Record<string, string>>({});
  const [estimateResults, setEstimateResults] = useState<EstimateResponse | null>(null);
  const [estimateChecking, setEstimateChecking] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimatePanelOpen, setEstimatePanelOpen] = useState(true);

  // Technology tradeoff checkpoint, fires right after its node is placed correctly
  const [activeTradeoffNodeId, setActiveTradeoffNodeId] = useState<string | null>(null);
  const [tradeoffSelectedId, setTradeoffSelectedId] = useState<string | null>(null);
  const [tradeoffResult, setTradeoffResult] = useState<TradeoffResponse | null>(null);
  const [tradeoffChecking, setTradeoffChecking] = useState(false);
  const [answeredTradeoffNodeIds, setAnsweredTradeoffNodeIds] = useState<Set<string>>(new Set());

  // Post-completion bottleneck / failure quiz
  const [failureAnswers, setFailureAnswers] = useState<Record<string, string>>({});
  const [failureResults, setFailureResults] = useState<FailureQuizResponse | null>(null);
  const [failureChecking, setFailureChecking] = useState(false);
  const [failureError, setFailureError] = useState<string | null>(null);

  // Timed practice mode - a visible stopwatch, frozen once the design is complete
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const attemptStats = useSystemDesignAttemptStats(problem?.id ?? null);

  // draw.io-style pan/zoom canvas: content lives in an absolutely-positioned layer inside an
  // overflow:hidden viewport, so panning is done via transform instead of native scrollbars - this
  // is what keeps the tree from "vanishing" off-screen with no way back, and keeps the scrollbar
  // invisible since there isn't one.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setZoom((prev) => clamp(Math.round(prev * factor * 100) / 100, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const handleViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest(".sd-add-slot, button, input, a, label")) return;
      panPointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: pan.x,
        originY: pan.y
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanning(true);
    },
    [pan]
  );

  const handleViewportPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const active = panPointerRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setPan({ x: active.originX + (event.clientX - active.startX), y: active.originY + (event.clientY - active.startY) });
  }, []);

  const handleViewportPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const active = panPointerRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    panPointerRef.current = null;
    setIsPanning(false);
  }, []);

  // Native (non-passive) wheel listener so preventDefault actually works: ctrl/cmd+wheel zooms
  // toward the cursor (like draw.io / Figma), plain wheel (including trackpad two-finger swipe)
  // pans in both directions instead of scrolling the page.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    function onWheelNative(event: WheelEvent) {
      event.preventDefault();
      const rect = node!.getBoundingClientRect();
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;

      if (event.ctrlKey || event.metaKey) {
        setZoom((prevZoom) => {
          const nextZoom = clamp(prevZoom * (1 - event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
          setPan((prevPan) => {
            const worldX = (cursorX - prevPan.x) / prevZoom;
            const worldY = (cursorY - prevPan.y) / prevZoom;
            return { x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom };
          });
          return nextZoom;
        });
      } else {
        setPan((prevPan) => ({ x: prevPan.x - event.deltaX, y: prevPan.y - event.deltaY }));
      }
    }

    node.addEventListener("wheel", onWheelNative, { passive: false });
    return () => node.removeEventListener("wheel", onWheelNative);
  }, []);

  const resetAttemptState = useCallback(() => {
    setPlacedNodes([]);
    setArmedComponentId(null);
    setLastMessage(null);
    setActionError(null);
    setSolution(null);
    setShowingSolution(false);
    setEstimateAnswers({});
    setEstimateResults(null);
    setEstimateError(null);
    setEstimatePanelOpen(true);
    setActiveTradeoffNodeId(null);
    setTradeoffSelectedId(null);
    setTradeoffResult(null);
    setAnsweredTradeoffNodeIds(new Set());
    setFailureAnswers({});
    setFailureResults(null);
    setFailureError(null);
    setStartedAt(Date.now());
    setCompletedAt(null);
    setNowTick(Date.now());
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    resetAttemptState();

    getSystemDesignProblem(problemId)
      .then((detail) => {
        if (cancelled) return;
        setProblem(detail);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  const paletteIds = useMemo(() => {
    if (!problem) return [];
    return seededShuffle([...problem.componentIds, ...problem.distractorIds], problem.id);
  }, [problem]);

  const placedIdSet = useMemo(() => new Set(placedNodes.map((node) => node.id)), [placedNodes]);
  const childrenMap = useMemo(() => buildChildrenMap(placedNodes), [placedNodes]);
  const total = problem?.totalNodeCount ?? 0;
  const completed = total > 0 && placedNodes.length >= total;

  // Stopwatch: ticks every second until the design is complete, then freezes.
  useEffect(() => {
    if (completedAt !== null) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [completedAt]);

  useEffect(() => {
    if (!completed || completedAt !== null) return;
    setCompletedAt(Date.now());

    // Log-only: records that this user completed this problem right now, never the design itself. Best-effort -
    // see lib/firebase/system-design-attempt-log.ts.
    if (problem && auth?.currentUser) {
      void logSystemDesignAttempt(auth.currentUser.uid, problem.id);
    }
  }, [completed, completedAt, problem]);

  const elapsedMs = (completedAt ?? nowTick) - startedAt;

  const estimateResultById = useMemo(
    () => new Map((estimateResults?.results ?? []).map((entry) => [entry.questionId, entry])),
    [estimateResults]
  );

  const failureResultById = useMemo(
    () => new Map((failureResults?.results ?? []).map((entry) => [entry.questionId, entry])),
    [failureResults]
  );

  const activeTradeoff = useMemo(
    () => (activeTradeoffNodeId ? (problem?.tradeoffs.find((t) => t.nodeId === activeTradeoffNodeId) ?? null) : null),
    [activeTradeoffNodeId, problem]
  );

  useEffect(() => {
    if (!completed || !problem || solution) return;
    let cancelled = false;
    setLoadingSolution(true);
    getSystemDesignSolution(problem.id)
      .then((result) => {
        if (!cancelled) setSolution(result);
      })
      .catch(() => {
        /* the debrief is a bonus, not critical - fail silently */
      })
      .finally(() => {
        if (!cancelled) setLoadingSolution(false);
      });
    return () => {
      cancelled = true;
    };
  }, [completed, problem, solution]);

  const attemptPlacement = useCallback(
    async (parentId: string, componentId: string) => {
      if (!problem || validating || completed || !componentId) return;
      setValidating(true);
      setActionError(null);
      try {
        const result = await validateSystemDesignPlacement(problem.id, {
          parentComponentId: parentId,
          attemptedComponentId: componentId,
          placedComponentIds: placedNodes.map((node) => node.id)
        });

        if (result.correct) {
          setPlacedNodes((prev) => [...prev, { id: componentId, parentId }]);
          setJustPlacedId(componentId);
          setLastMessage({ type: "success", text: result.message, whyItFits: result.whyItFits });
          setArmedComponentId(null);
          window.setTimeout(() => setJustPlacedId((current) => (current === componentId ? null : current)), 300);

          const tradeoffForThisNode = problem.tradeoffs.find((t) => t.nodeId === componentId);
          if (tradeoffForThisNode && !answeredTradeoffNodeIds.has(componentId)) {
            setActiveTradeoffNodeId(componentId);
            setTradeoffSelectedId(null);
            setTradeoffResult(null);
          }
        } else {
          setLastMessage({ type: "error", text: result.message });
          setErrorSlotKey(parentId);
          window.setTimeout(() => setErrorSlotKey((current) => (current === parentId ? null : current)), 420);
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not check that placement.");
      } finally {
        setValidating(false);
      }
    },
    [problem, validating, completed, placedNodes, answeredTradeoffNodeIds]
  );

  const handleReset = useCallback(() => {
    resetAttemptState();
  }, [resetAttemptState]);

  const handleEstimateInputChange = useCallback((questionId: string, value: string) => {
    setEstimateAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleCheckEstimates = useCallback(async () => {
    if (!problem) return;
    const answers = problem.estimationQuestions
      .map((question) => ({ questionId: question.id, raw: estimateAnswers[question.id] ?? "" }))
      .filter((entry) => entry.raw.trim() !== "")
      .map((entry) => ({ questionId: entry.questionId, value: Number(entry.raw) }))
      .filter((entry) => Number.isFinite(entry.value));
    if (answers.length === 0) return;
    setEstimateChecking(true);
    setEstimateError(null);
    try {
      const result = await checkSystemDesignEstimate(problem.id, { answers });
      setEstimateResults(result);
    } catch (error) {
      setEstimateError(error instanceof Error ? error.message : "Could not check your estimates.");
    } finally {
      setEstimateChecking(false);
    }
  }, [problem, estimateAnswers]);

  const handleTradeoffAnswer = useCallback(
    async (optionId: string) => {
      if (!problem || !activeTradeoffNodeId || tradeoffChecking || tradeoffResult) return;
      setTradeoffChecking(true);
      setTradeoffSelectedId(optionId);
      try {
        const result = await checkSystemDesignTradeoff(problem.id, { nodeId: activeTradeoffNodeId, optionId });
        setTradeoffResult(result);
      } catch {
        /* this checkpoint is a bonus - fail silently rather than blocking the design */
      } finally {
        setTradeoffChecking(false);
      }
    },
    [problem, activeTradeoffNodeId, tradeoffChecking, tradeoffResult]
  );

  const dismissTradeoff = useCallback(() => {
    setAnsweredTradeoffNodeIds((prev) => {
      if (!activeTradeoffNodeId) return prev;
      const next = new Set(prev);
      next.add(activeTradeoffNodeId);
      return next;
    });
    setActiveTradeoffNodeId(null);
    setTradeoffSelectedId(null);
    setTradeoffResult(null);
  }, [activeTradeoffNodeId]);

  const handleFailureAnswerSelect = useCallback(
    (questionId: string, optionId: string) => {
      if (failureResults) return;
      setFailureAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    },
    [failureResults]
  );

  const handleCheckFailureQuiz = useCallback(async () => {
    if (!problem) return;
    const answers = problem.failureQuestions
      .filter((question) => failureAnswers[question.id])
      .map((question) => ({ questionId: question.id, optionId: failureAnswers[question.id] }));
    if (answers.length < problem.failureQuestions.length) return;
    setFailureChecking(true);
    setFailureError(null);
    try {
      const result = await checkSystemDesignFailureQuiz(problem.id, { answers });
      setFailureResults(result);
    } catch (error) {
      setFailureError(error instanceof Error ? error.message : "Could not check your answers.");
    } finally {
      setFailureChecking(false);
    }
  }, [problem, failureAnswers]);

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
                <p className="eyebrow">System Design Track</p>
                <h2>Could not load this problem</h2>
                <p>{loadError || "Unknown error."}</p>
              </div>
              <AlertTriangle size={20} />
            </div>
          </section>

          <Link
            aria-label="Back to interview categories"
            className="career-card war-room-go-back-card instant-tooltip-wrap"
            href="/interview-prep?track=system-design"
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

  const rootId = problem.rootComponentId;
  const isReadOnly = showingSolution && Boolean(solution);
  const displayChildrenMap = isReadOnly && solution
    ? buildChildrenMap(solution.nodes.map((node) => ({ id: node.componentId, parentId: node.parentComponentId ?? rootId })))
    : childrenMap;
  const whyItFitsById = solution ? new Map(solution.nodes.map((node) => [node.componentId, node.whyItFits])) : undefined;

  return (
    <div className="page-stack">
      <div className="war-room-ai-top-grid">
        <article className="career-card highlight" data-track="system-design">
          <div className="card-header">
            <div>
              <p className="eyebrow">System Design Track</p>
              <h2>{problem.title}</h2>
              <p>{problem.summary}</p>
            </div>
            <span
              className={`pill ${
                problem.difficulty === "easy" ? "success" : problem.difficulty === "medium" ? "warning" : "danger"
              }`}
            >
              {problem.difficulty}
            </span>
          </div>
          <div className="tag-cloud">
            {problem.companies.map((company) => (
              <span key={company}>{company}</span>
            ))}
            {problem.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </article>

        <Link
          aria-label="Back to interview categories"
          className="career-card war-room-go-back-card instant-tooltip-wrap"
          href="/interview-prep?track=system-design"
        >
          <span className="war-room-go-back-orbit" aria-hidden>
            <ArrowLeft size={28} />
          </span>
          <span className="instant-tooltip">Go Back</span>
        </Link>
      </div>

      <div className="coding-room-workbench sd-room-workbench">
        <div className="career-card coding-room-pane sd-room-pane sd-statement-pane">
          <h2 className="coding-room-title sd-room-title">{problem.title}</h2>
          <div className="tag-cloud" style={{ marginTop: 6 }}>
            {problem.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          <div className="coding-room-statement-body sd-statement-body">
            <p>{problem.statement}</p>

            <h3>Functional requirements</h3>
            <ul>
              {problem.functionalRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>

            <h3>Non-functional requirements</h3>
            <ul>
              {problem.nonFunctionalRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>

            {problem.scaleNote ? (
              <>
                <h3>Scale</h3>
                <div className="sd-scale-note">{problem.scaleNote}</div>
              </>
            ) : null}
          </div>

          {!isReadOnly && problem.estimationQuestions.length > 0 ? (
            <div className="sd-estimate-card">
              <button
                aria-expanded={estimatePanelOpen}
                className="sd-collapsible-header"
                onClick={() => setEstimatePanelOpen((value) => !value)}
                type="button"
              >
                <span>
                  <Calculator size={13} /> Back-of-envelope estimates
                </span>
                {estimatePanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {estimatePanelOpen ? (
                <div className="sd-estimate-body">
                  <p className="sd-estimate-lede">
                    Ballpark these before you design - the numbers should shape which components you reach for.
                  </p>
                  {problem.estimationQuestions.map((question) => {
                    const result = estimateResultById.get(question.id);
                    return (
                      <div className="sd-estimate-row" key={question.id}>
                        <label htmlFor={`sd-est-${question.id}`}>{question.prompt}</label>
                        <div className="sd-estimate-input-wrap">
                          <input
                            id={`sd-est-${question.id}`}
                            inputMode="decimal"
                            onChange={(event) => handleEstimateInputChange(question.id, event.target.value)}
                            placeholder={question.placeholder}
                            type="number"
                            value={estimateAnswers[question.id] ?? ""}
                          />
                          <span className="sd-estimate-unit">{question.unit}</span>
                        </div>
                        {result ? (
                          <p className={`sd-estimate-feedback ${result.withinRange ? "sd-good" : "sd-off"}`}>
                            {result.withinRange
                              ? "Reasonable ballpark."
                              : `Expected roughly ${result.expectedRangeLabel}.`}{" "}
                            {result.explanation}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  {estimateError ? <p className="settings-feedback error">{estimateError}</p> : null}
                  <button className="ghost-button" disabled={estimateChecking} onClick={() => void handleCheckEstimates()} type="button">
                    {estimateChecking ? <Loader2 className="spin" size={13} /> : <Calculator size={13} />}
                    Check my estimates
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="career-card coding-room-pane sd-room-pane sd-canvas-pane">
          <div className="row-between sd-canvas-toolbar">
            <div className="sd-progress-wrap">
              <div className="sd-progress-track">
                <div
                  className="sd-progress-fill"
                  style={{ width: `${total > 0 ? Math.round((placedNodes.length / total) * 100) : 0}%` }}
                />
              </div>
              <span className="sd-progress-label">
                {placedNodes.length} / {total} placed
              </span>
            </div>
            <div className="sd-timer" title="Time elapsed on this attempt">
              <Clock3 size={13} />
              {formatElapsed(elapsedMs)}
              {completedAt !== null ? <span className="sd-timer-done">done</span> : null}
            </div>
            {attemptStats.count > 0 ? (
              <div
                className="sd-timer"
                title={
                  attemptStats.lastCompletedAt
                    ? `Last completed ${new Date(attemptStats.lastCompletedAt).toLocaleString()}`
                    : undefined
                }
              >
                <CheckCircle2 size={13} />
                Completed {attemptStats.count}x
              </div>
            ) : null}
            <div className="sd-zoom-toolbar" title="Scroll to pan, ctrl/cmd + scroll to zoom">
              <button aria-label="Zoom out" className="sd-zoom-btn" onClick={() => zoomBy(1 / 1.2)} type="button">
                <ZoomOut size={13} />
              </button>
              <span className="sd-zoom-level">{Math.round(zoom * 100)}%</span>
              <button aria-label="Zoom in" className="sd-zoom-btn" onClick={() => zoomBy(1.2)} type="button">
                <ZoomIn size={13} />
              </button>
              <button aria-label="Reset view" className="sd-zoom-btn" onClick={resetView} type="button">
                <Maximize2 size={12} />
              </button>
            </div>
            <button className="ghost-button" onClick={handleReset} type="button">
              <RotateCcw size={13} />
              Reset
            </button>
            {solution ? (
              <button className="ghost-button" onClick={() => setShowingSolution((value) => !value)} type="button">
                <Sparkles size={13} />
                {showingSolution ? "Back to my design" : "View annotated solution"}
              </button>
            ) : null}
          </div>

          {actionError ? <p className="settings-feedback error">{actionError}</p> : null}

          {lastMessage && !isReadOnly ? (
            <div className={`sd-hint-banner ${lastMessage.type === "success" ? "sd-hint-success" : "sd-hint-error"}`}>
              {lastMessage.type === "success" ? (
                <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              ) : (
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <span>
                {lastMessage.text}
                {lastMessage.whyItFits ? ` ${lastMessage.whyItFits}` : ""}
              </span>
            </div>
          ) : null}

          {activeTradeoff && !isReadOnly ? (
            <div className="sd-tradeoff-card">
              <p className="sd-tradeoff-kicker">
                <Scale size={13} /> Design decision
              </p>
              <p className="sd-tradeoff-prompt">{activeTradeoff.prompt}</p>
              <div className="sd-tradeoff-options">
                {activeTradeoff.options.map((option) => {
                  const isSelected = tradeoffSelectedId === option.id;
                  const showAsCorrect = tradeoffResult && isSelected && tradeoffResult.correct;
                  const showAsIncorrect = tradeoffResult && isSelected && !tradeoffResult.correct;
                  return (
                    <button
                      className={`sd-tradeoff-option${showAsCorrect ? " sd-tradeoff-correct" : ""}${
                        showAsIncorrect ? " sd-tradeoff-incorrect" : ""
                      }`}
                      disabled={Boolean(tradeoffResult) || tradeoffChecking}
                      key={option.id}
                      onClick={() => void handleTradeoffAnswer(option.id)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {tradeoffResult ? (
                <div className={`sd-tradeoff-feedback ${tradeoffResult.correct ? "sd-good" : "sd-off"}`}>
                  <p>
                    {tradeoffResult.correct ? "Right call - " : "Not quite - "}
                    {tradeoffResult.chosenRationale}
                  </p>
                  {!tradeoffResult.correct ? (
                    <p className="sd-tradeoff-correct-answer">
                      Better: {tradeoffResult.correctLabel} - {tradeoffResult.correctRationale}
                    </p>
                  ) : null}
                  <button className="ghost-button" onClick={dismissTradeoff} type="button">
                    Continue designing
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {completed && !isReadOnly ? (
            <div className="sd-complete-banner">
              <h3>Design complete</h3>
              <p className="muted">Every component is in its right place - here's the whole design walked through, step by step.</p>
              {loadingSolution ? (
                <p className="muted">
                  <Loader2 className="spin" size={13} /> Loading the debrief...
                </p>
              ) : solution ? (
                <>
                  <ol className="sd-walkthrough">
                    {solution.nodes.map((node, index) => {
                      const parentId = node.parentComponentId ?? solution.rootComponentId;
                      const parentLabel = COMPONENT_BY_ID[parentId]?.label ?? parentId;
                      const nodeLabel = COMPONENT_BY_ID[node.componentId]?.label ?? node.componentId;
                      return (
                        <li className="sd-walkthrough-step" key={node.componentId}>
                          <span className="sd-walkthrough-index">{index + 1}</span>
                          <div>
                            <p className="sd-walkthrough-edge">
                              {parentLabel} <span aria-hidden="true">&rarr;</span> {nodeLabel}
                            </p>
                            <p className="sd-walkthrough-why">{node.whyItFits}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="sd-walkthrough-tldr-label">TL;DR</p>
                  <ul>
                    {solution.keyTakeaways.map((takeaway) => (
                      <li key={takeaway}>{takeaway}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {problem.failureQuestions.length > 0 ? (
                <div className="sd-failure-quiz">
                  <p className="sd-failure-quiz-label">
                    <ShieldAlert size={13} /> Bottleneck & failure check
                  </p>
                  {problem.failureQuestions.map((question) => {
                    const result = failureResultById.get(question.id);
                    return (
                      <div className="sd-failure-question" key={question.id}>
                        <p>{question.prompt}</p>
                        <div className="sd-failure-options">
                          {question.options.map((option) => {
                            const isSelected = failureAnswers[question.id] === option.id;
                            const isTheCorrectOne = result?.correctOptionId === option.id;
                            const revealCorrect = Boolean(result) && isTheCorrectOne;
                            const revealWrong = Boolean(result) && isSelected && !isTheCorrectOne;
                            return (
                              <button
                                className={`sd-failure-option${isSelected ? " sd-failure-option-selected" : ""}${
                                  revealCorrect ? " sd-failure-correct" : ""
                                }${revealWrong ? " sd-failure-incorrect" : ""}`}
                                disabled={Boolean(failureResults)}
                                key={option.id}
                                onClick={() => handleFailureAnswerSelect(question.id, option.id)}
                                type="button"
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        {result ? <p className="sd-failure-explanation">{result.explanation}</p> : null}
                      </div>
                    );
                  })}
                  {failureError ? <p className="settings-feedback error">{failureError}</p> : null}
                  {!failureResults ? (
                    <button
                      className="ghost-button"
                      disabled={
                        failureChecking ||
                        Object.keys(failureAnswers).length < problem.failureQuestions.length
                      }
                      onClick={() => void handleCheckFailureQuiz()}
                      type="button"
                    >
                      {failureChecking ? <Loader2 className="spin" size={13} /> : <ShieldAlert size={13} />}
                      Check answers
                    </button>
                  ) : (
                    <p className="sd-failure-score">
                      {failureResults.results.filter((entry) => entry.correct).length} / {failureResults.results.length}{" "}
                      correct
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className={`sd-canvas-viewport${isPanning ? " sd-canvas-panning" : ""}`}
            onPointerDown={handleViewportPointerDown}
            onPointerLeave={handleViewportPointerUp}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            ref={viewportRef}
          >
            <div
              className="sd-canvas-pan-layer"
              style={{ transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)` }}
            >
              <div className="sd-canvas-zoom-layer" style={{ transform: `scale(${zoom})` }}>
                <ul className="sd-tree">
                  <TreeNode
                    armed={Boolean(armedComponentId)}
                    childrenMap={displayChildrenMap}
                    completed={completed}
                    dragOverSlotKey={dragOverSlotKey}
                    errorSlotKey={errorSlotKey}
                    isRoot
                    justPlacedId={justPlacedId}
                    nodeId={rootId}
                    onDragLeave={(parentId) => setDragOverSlotKey((current) => (current === parentId ? null : current))}
                    onDragOver={(parentId) => setDragOverSlotKey(parentId)}
                    onDrop={(parentId, componentId) => {
                      setDragOverSlotKey(null);
                      void attemptPlacement(parentId, componentId);
                    }}
                    onSlotClick={(parentId) => {
                      if (armedComponentId) void attemptPlacement(parentId, armedComponentId);
                    }}
                    readOnly={isReadOnly}
                    whyItFitsById={whyItFitsById}
                  />
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="career-card coding-room-pane sd-room-pane sd-palette-pane">
          <div className="card-header">
            <div>
              <p className="eyebrow">Component Palette</p>
              <h2>{isReadOnly ? "Annotated solution" : "Drag onto a + slot, or tap to select then tap a slot"}</h2>
            </div>
          </div>

          {isReadOnly ? (
            <p className="muted">
              You&apos;re viewing the annotated solution. Toggle back to your own design from the toolbar to keep placing
              components.
            </p>
          ) : (
            <>
              <div className="sd-legend">
                <span className="sd-legend-item">
                  <span className="sd-node-dot sd-cat-edge" aria-hidden="true" /> Edge & routing
                </span>
                <span className="sd-legend-item">
                  <span className="sd-node-dot sd-cat-compute" aria-hidden="true" /> Compute
                </span>
                <span className="sd-legend-item">
                  <span className="sd-node-dot sd-cat-data" aria-hidden="true" /> Data & storage
                </span>
                <span className="sd-legend-item">
                  <span className="sd-node-dot sd-cat-messaging" aria-hidden="true" /> Messaging
                </span>
                <span className="sd-legend-item">
                  <span className="sd-node-dot sd-cat-coordination" aria-hidden="true" /> Coordination
                </span>
              </div>
              <div className="sd-palette-grid">
                {paletteIds.map((componentId) => {
                  const component = COMPONENT_BY_ID[componentId];
                  const used = placedIdSet.has(componentId);
                  return (
                    <button
                      className={`sd-palette-chip${armedComponentId === componentId ? " sd-chip-armed" : ""}${
                        used ? " sd-chip-used" : ""
                      }`}
                      disabled={used}
                      draggable={!used}
                      key={componentId}
                      onClick={() => setArmedComponentId((current) => (current === componentId ? null : componentId))}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", componentId)}
                      title={component?.blurb}
                      type="button"
                    >
                      {component ? <CategoryDot category={component.category} /> : null}
                      {component?.label ?? componentId}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
