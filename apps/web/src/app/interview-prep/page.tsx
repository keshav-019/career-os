"use client";

import {
  ArrowLeft,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FlaskConical,
  Laptop,
  Loader2,
  Network,
  Play,
  Sparkles,
  Target
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodingArenaBrowser from "@/components/CodingArenaBrowser";
import SystemDesignBrowser from "@/components/SystemDesignBrowser";
import { isDesktopAppEnabled } from "@/lib/desktop-mode";
import { learningAssetUrl } from "@/lib/learning/asset-url";
import { useUserJobs } from "@/lib/firebase/jobs";
import {
  createPracticeAttempt,
  useUserPracticeAttempts,
  type PracticeAttemptRecord
} from "@/lib/firebase/interview-war-room";
import { fetchAiInterviewRoles, fetchInterviewTestTemplates } from "@/lib/interview/client";
import {
  formatInterviewTestType,
  listInterviewTracks,
  type AiInterviewRole,
  type InterviewTestTemplate,
  type InterviewTestType,
  type PracticeAttemptStatus
} from "@/lib/interview/question-bank";

type TemplateFilter = "all" | "attempted" | "not_attempted";

const TRACK_ICONS: Record<InterviewTestType, typeof Target> = {
  coding: Target,
  aptitude: Target,
  "computer-science": FlaskConical,
  ai: BrainCircuit
};

const TRACK_VISUALS: Record<InterviewTestType, { imageAlt: string; imageSrc: string }> = {
  coding: {
    imageSrc: learningAssetUrl("/war-room/coding-card.svg"),
    imageAlt: "Coding interview visual"
  },
  aptitude: {
    imageSrc: learningAssetUrl("/war-room/aptitude-card.svg"),
    imageAlt: "Aptitude interview visual"
  },
  "computer-science": {
    imageSrc: learningAssetUrl("/war-room/cs-card.svg"),
    imageAlt: "Computer science interview visual"
  },
  ai: {
    imageSrc: learningAssetUrl("/war-room/ai-card.svg"),
    imageAlt: "Artificial intelligence interview visual"
  }
};

const TRACK_BACK_COPY: Record<InterviewTestType, string> = {
  coding: "Classic LeetCode-style coding rounds with local compiler execution for C, C++, Java, JavaScript, Python, and Rust.",
  aptitude: "Focused on arithmetic speed, pattern detection, and elimination strategy under timed pressure.",
  "computer-science": "Focused on OS, DBMS, networking, algorithms, and practical software engineering judgment.",
  ai: "Focused on ML and deep-learning foundations, GenAI, model evaluation, and responsible AI tradeoffs."
};

const FILTER_LABELS: Record<TemplateFilter, string> = {
  all: "All",
  attempted: "Attempted",
  not_attempted: "Not Attempted"
};

const TEMPLATE_PAGE_SIZE = 10;
const START_SIMULATION_EVENT = "careeros:start-simulation";

function statusLabel(status: PracticeAttemptStatus): string {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "timed_out") {
    return "Timed Out";
  }

  if (status === "submitted") {
    return "Submitted";
  }

  return "Ready";
}

function statusTone(status: PracticeAttemptStatus): string {
  if (status === "submitted") {
    return "success";
  }

  if (status === "timed_out") {
    return "danger";
  }

  if (status === "in_progress") {
    return "brand";
  }

  return "warning";
}

function formatAttemptDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "Not available";
  }

  return new Date(parsed).toLocaleString();
}

function formatAttemptScore(attempt: PracticeAttemptRecord): string {
  const total = attempt.score?.total ?? 0;
  if (total <= 0) {
    return "Not auto-scored";
  }

  const percentage = attempt.score?.percentage ?? 0;
  const correct = attempt.score?.correct ?? 0;
  return `${percentage}% (${correct}/${total})`;
}

function formatAttemptsCount(value: number): string {
  return value === 1 ? "1 attempt" : `${value} attempts`;
}

function hasAttemptStarted(attempt: PracticeAttemptRecord): boolean {
  if (attempt.status === "in_progress" || attempt.status === "submitted" || attempt.status === "timed_out") {
    return true;
  }

  return Boolean(attempt.startedAt);
}

function InterviewPrepPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { attempts, error: attemptsError, loading: attemptsLoading, user } = useUserPracticeAttempts();
  const { jobs } = useUserJobs();
  const [selectedTrack, setSelectedTrack] = useState<InterviewTestType | null>(null);
  const [systemDesignActive, setSystemDesignActive] = useState(false);
  const [selectedAiRoleId, setSelectedAiRoleId] = useState<string | null>(null);
  const [aiEntryTransitioning, setAiEntryTransitioning] = useState(false);
  const [aiRoleTransitioningId, setAiRoleTransitioningId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [templatePage, setTemplatePage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [launchingTemplateId, setLaunchingTemplateId] = useState<string | null>(null);
  const aiEntryTimerRef = useRef<number | null>(null);
  const aiRoleTimerRef = useRef<number | null>(null);

  /**
   * Restores the correct sub-view when arriving via a deep link like /interview-prep?track=system-design or
   * ?track=coding - used by the "Go Back" cards on /system-design/[problemId] and /coding-room/[problemId] so
   * returning from a solve page lands back on the right track instead of the bare outer grid. Reads once on
   * mount only (a plain query param, not kept in sync afterward - navigating between tracks in-page never
   * touches the URL, same as before this change).
   */
  useEffect(() => {
    const track = searchParams.get("track");
    if (track === "system-design") {
      setSystemDesignActive(true);
    } else if (track === "coding" || track === "aptitude" || track === "computer-science" || track === "ai") {
      setSelectedTrack(track);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tracks = useMemo(() => listInterviewTracks(), []);
  const [aiRoles, setAiRoles] = useState<AiInterviewRole[]>([]);
  const [templateLibrary, setTemplateLibrary] = useState<InterviewTestTemplate[]>([]);
  // Fixed-count tracks (aptitude/computer-science) show a "N compiled tests" badge on their unselected card, before
  // the user has picked a track - fetched once up front since /api/interview/templates is the only place that
  // count now lives (see lib/interview/client.ts's fetchInterviewTestTemplates(); the old synchronous
  // getInterviewTestTemplateCount() call is gone - question-bank.ts's data is R2-backed and server-only now).
  const [trackTemplateCounts, setTrackTemplateCounts] = useState<Partial<Record<InterviewTestType, number>>>({});
  const selectedAiRole = useMemo<AiInterviewRole | null>(
    () => (selectedAiRoleId ? aiRoles.find((role) => role.id === selectedAiRoleId) ?? null : null),
    [aiRoles, selectedAiRoleId]
  );

  useEffect(() => {
    let cancelled = false;
    fetchAiInterviewRoles()
      .then((roles) => {
        if (!cancelled) setAiRoles(roles);
      })
      .catch(() => {
        if (!cancelled) setAiRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      (["aptitude", "computer-science"] as const).map((testType) =>
        fetchInterviewTestTemplates(testType).then((templates) => [testType, templates.length] as const)
      )
    )
      .then((entries) => {
        if (cancelled) return;
        setTrackTemplateCounts(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setTrackTemplateCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTrack || (selectedTrack === "ai" && !selectedAiRoleId)) {
      setTemplateLibrary([]);
      return;
    }

    let cancelled = false;
    fetchInterviewTestTemplates(selectedTrack, selectedTrack === "ai" ? { roleId: selectedAiRoleId ?? undefined } : undefined)
      .then((templates) => {
        if (!cancelled) setTemplateLibrary(templates);
      })
      .catch(() => {
        if (!cancelled) setTemplateLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAiRoleId, selectedTrack]);
  const selectedTrackMeta = useMemo(
    () => (selectedTrack ? tracks.find((track) => track.id === selectedTrack) ?? null : null),
    [tracks, selectedTrack]
  );

  const metrics = useMemo(() => {
    const startedAttempts = attempts.filter((attempt) => hasAttemptStarted(attempt));
    const completed = startedAttempts.filter(
      (attempt) => attempt.status === "submitted" || attempt.status === "timed_out"
    );
    const scored = completed.filter((attempt) => (attempt.score?.total ?? 0) > 0);
    const averageScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, attempt) => sum + (attempt.score?.percentage ?? 0), 0) / scored.length)
        : 0;

    return {
      totalAttempts: startedAttempts.length,
      activeAttempts: startedAttempts.filter((attempt) => attempt.status === "in_progress").length,
      averageScore,
      interviewingJobs: jobs.filter((job) => job.status === "interviewing").length
    };
  }, [attempts, jobs]);

  const templatesWithStats = useMemo(() => {
    if (!selectedTrack) {
      return [];
    }

    const attemptsByTemplateId = new Map<string, PracticeAttemptRecord[]>();

    attempts
      .filter((attempt) => attempt.testType === selectedTrack && attempt.testTemplateId)
      .forEach((attempt) => {
        const templateId = attempt.testTemplateId as string;
        const tracked = attemptsByTemplateId.get(templateId) ?? [];
        tracked.push(attempt);
        attemptsByTemplateId.set(templateId, tracked);
      });

    return templateLibrary.map((template) => {
      const templateAttempts = attemptsByTemplateId.get(template.id) ?? [];
      const startedTemplateAttempts = templateAttempts.filter((attempt) => hasAttemptStarted(attempt));

      return {
        template,
        attempts: templateAttempts,
        attemptCount: startedTemplateAttempts.length,
        latestAttempt: templateAttempts[0] ?? null
      };
    });
  }, [attempts, selectedTrack, templateLibrary]);

  const attemptedTemplateCount = useMemo(
    () => templatesWithStats.filter((entry) => entry.attemptCount > 0).length,
    [templatesWithStats]
  );

  const visibleTemplates = useMemo(() => {
    if (filter === "attempted") {
      return templatesWithStats.filter((entry) => entry.attemptCount > 0);
    }

    if (filter === "not_attempted") {
      return templatesWithStats.filter((entry) => entry.attemptCount === 0);
    }

    return templatesWithStats;
  }, [filter, templatesWithStats]);

  const totalTemplatePages = useMemo(
    () => Math.max(1, Math.ceil(visibleTemplates.length / TEMPLATE_PAGE_SIZE)),
    [visibleTemplates.length]
  );

  const activeTemplatePage = Math.min(templatePage, totalTemplatePages);

  const paginatedTemplates = useMemo(() => {
    if (visibleTemplates.length === 0) {
      return [];
    }

    const startIndex = (activeTemplatePage - 1) * TEMPLATE_PAGE_SIZE;
    return visibleTemplates.slice(startIndex, startIndex + TEMPLATE_PAGE_SIZE);
  }, [activeTemplatePage, visibleTemplates]);

  const templateStart = visibleTemplates.length === 0 ? 0 : (activeTemplatePage - 1) * TEMPLATE_PAGE_SIZE + 1;
  const templateEnd = Math.min(activeTemplatePage * TEMPLATE_PAGE_SIZE, visibleTemplates.length);

  const recentAttempts = useMemo(() => attempts.slice(0, 8), [attempts]);

  const handleTrackSelection = useCallback((trackId: InterviewTestType) => {
    if (aiEntryTransitioning || aiRoleTransitioningId) {
      return;
    }

    setActionError(null);
    setFilter("all");
    setTemplatePage(1);
    setSelectedAiRoleId(null);

    if (trackId === "ai") {
      if (selectedTrack === "ai") {
        setSelectedTrack(null);
        return;
      }

      if (aiEntryTimerRef.current) {
        window.clearTimeout(aiEntryTimerRef.current);
      }

      setSelectedTrack(null);
      setAiEntryTransitioning(true);

      aiEntryTimerRef.current = window.setTimeout(() => {
        setSelectedTrack("ai");
        setAiEntryTransitioning(false);
        aiEntryTimerRef.current = null;
      }, 760);
      return;
    }

    setSelectedTrack((current) => (current === trackId ? null : trackId));
  }, [aiEntryTransitioning, aiRoleTransitioningId, selectedTrack]);

  const handleAiBackToTracks = useCallback(() => {
    if (aiEntryTimerRef.current) {
      window.clearTimeout(aiEntryTimerRef.current);
      aiEntryTimerRef.current = null;
    }

    if (aiRoleTimerRef.current) {
      window.clearTimeout(aiRoleTimerRef.current);
      aiRoleTimerRef.current = null;
    }

    setAiEntryTransitioning(false);
    setAiRoleTransitioningId(null);
    setSelectedAiRoleId(null);
    setSelectedTrack(null);
    setFilter("all");
    setTemplatePage(1);
  }, []);

  const handleAiRoleBack = useCallback(() => {
    if (aiRoleTimerRef.current) {
      window.clearTimeout(aiRoleTimerRef.current);
      aiRoleTimerRef.current = null;
    }

    setAiRoleTransitioningId(null);
    setSelectedAiRoleId(null);
    setFilter("all");
    setTemplatePage(1);
  }, []);

  const handleAiRoleSelect = useCallback((roleId: string) => {
    if (aiRoleTransitioningId || selectedAiRoleId === roleId) {
      return;
    }

    if (aiRoleTimerRef.current) {
      window.clearTimeout(aiRoleTimerRef.current);
    }

    setAiRoleTransitioningId(roleId);
    setFilter("all");
    setTemplatePage(1);
    setActionError(null);
    aiRoleTimerRef.current = window.setTimeout(() => {
      setSelectedAiRoleId(roleId);
      setAiRoleTransitioningId(null);
      aiRoleTimerRef.current = null;
    }, 640);
  }, [aiRoleTransitioningId, selectedAiRoleId]);

  const handleStartTemplate = useCallback(async (template: InterviewTestTemplate) => {
    if (!user) {
      setActionError("Please sign in before starting a test.");
      return;
    }

    setActionError(null);
    setLaunchingTemplateId(template.id);

    try {
      const attemptId = await createPracticeAttempt(user.uid, template.testType, template.id);
      router.push(`/test-room/${attemptId}`);
    } catch (startError) {
      setActionError(startError instanceof Error ? startError.message : "Unable to start this test right now.");
    } finally {
      setLaunchingTemplateId(null);
    }
  }, [router, user]);

  const handleQuickStartSimulation = useCallback(async () => {
    const initialTrack =
      selectedTrack && selectedTrack !== "coding" && selectedTrack !== "ai" ? selectedTrack : "aptitude";
    const candidateTracks = [initialTrack, "aptitude", "computer-science"] as const;
    const visitedTracks = new Set<string>();

    let selectedTemplate: InterviewTestTemplate | null = null;
    let selectedTemplateTrack: Exclude<InterviewTestType, "coding"> | null = null;

    for (const track of candidateTracks) {
      if (visitedTracks.has(track)) {
        continue;
      }
      visitedTracks.add(track);

      const templates = await fetchInterviewTestTemplates(track);
      if (templates.length === 0) {
        continue;
      }

      const attemptedTemplateIds = new Set(
        attempts
          .filter(
            (attempt) =>
              attempt.testType === track &&
              Boolean(attempt.testTemplateId) &&
              hasAttemptStarted(attempt)
          )
          .map((attempt) => attempt.testTemplateId as string)
      );

      selectedTemplate = templates.find((template) => !attemptedTemplateIds.has(template.id)) ?? templates[0] ?? null;
      if (selectedTemplate) {
        selectedTemplateTrack = track;
        break;
      }
    }

    if (!selectedTemplate || !selectedTemplateTrack) {
      setActionError("No simulation templates are available right now.");
      return;
    }

    setSelectedTrack(selectedTemplateTrack);
    setFilter("all");
    setTemplatePage(1);
    await handleStartTemplate(selectedTemplate);
  }, [attempts, handleStartTemplate, selectedTrack]);

  useEffect(() => {
    const onStartSimulation = () => {
      void handleQuickStartSimulation();
    };

    window.addEventListener(START_SIMULATION_EVENT, onStartSimulation);
    return () => window.removeEventListener(START_SIMULATION_EVENT, onStartSimulation);
  }, [handleQuickStartSimulation]);

  useEffect(
    () => () => {
      if (aiEntryTimerRef.current) {
        window.clearTimeout(aiEntryTimerRef.current);
      }

      if (aiRoleTimerRef.current) {
        window.clearTimeout(aiRoleTimerRef.current);
      }
    },
    []
  );

  if (systemDesignActive) {
    return (
      <div className="page-stack">
        <section className="war-room-ai-stage" aria-label="System design track">
          <div className="war-room-ai-top-grid">
            <article className="career-card highlight war-room-ai-anchor-card" data-track="system-design">
              <div className="card-header">
                <div>
                  <p className="eyebrow">System Design</p>
                  <h2>Drag-and-drop architecture practice</h2>
                  <p>
                    Build out the canonical component tree for real interview prompts, then check estimation,
                    tradeoff, and failure-mode questions.
                  </p>
                </div>
                <Network size={20} />
              </div>
              <div className="tag-cloud">
                <span>Classic + ML/MLOps</span>
                <span>Estimation, tradeoff & failure quizzes</span>
              </div>
            </article>

            <button
              aria-label="Back to interview categories"
              className="career-card war-room-go-back-card instant-tooltip-wrap"
              onClick={() => setSystemDesignActive(false)}
              type="button"
            >
              <span className="war-room-go-back-orbit" aria-hidden>
                <ArrowLeft size={28} />
              </span>
              <span className="instant-tooltip">Go Back</span>
            </button>
          </div>

          <SystemDesignBrowser />
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {attemptsError ? <p className="settings-feedback error">{attemptsError}</p> : null}
      {actionError ? <p className="settings-feedback error">{actionError}</p> : null}

      <section className="metric-grid" aria-label="War room metrics">
        <article className="metric-card">
          <p>Total Attempts</p>
          <strong>{metrics.totalAttempts}</strong>
          <span>Only rounds that were actually started.</span>
        </article>
        <article className="metric-card tone-green">
          <p>Active Tests</p>
          <strong>{metrics.activeAttempts}</strong>
          <span>Currently in progress.</span>
        </article>
        <article className="metric-card tone-amber">
          <p>Average MCQ Score</p>
          <strong>{metrics.averageScore}%</strong>
          <span>Across aptitude, CS, and AI submitted tests.</span>
        </article>
        <article className="metric-card tone-rose">
          <p>Upcoming Interviews</p>
          <strong>{metrics.interviewingJobs}</strong>
          <span>Pulled from your live Applications pipeline.</span>
        </article>
      </section>

      {selectedTrack === "ai" ? (
        <section className="war-room-ai-stage" aria-label="AI role tracks">
          <div className="war-room-ai-top-grid">
            {!selectedAiRole ? (
              <article className="career-card highlight war-room-ai-anchor-card" data-track="ai">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">AI Track</p>
                    <h2>Role-based AI interview preparation</h2>
                    <p>Choose one of the 20 AI roles to open role-specific test papers and focus areas.</p>
                  </div>
                  <BrainCircuit size={20} />
                </div>
                <div className="tag-cloud">
                  <span>{aiRoles.length} role tracks</span>
                  <span>100 tests per role</span>
                  <span>40 questions / 90 minutes</span>
                </div>
              </article>
            ) : (
              <article className="career-card highlight war-room-ai-anchor-card war-room-ai-role-focus" data-track="ai">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">Selected Role</p>
                    <h2>{selectedAiRole.name}</h2>
                    <p>{selectedAiRole.summary}</p>
                  </div>
                  <BrainCircuit size={20} />
                </div>
                <div className="tag-cloud">
                  <span>{selectedAiRole.questionCount} role questions</span>
                  <span>100 deterministic tests</span>
                  <span>40 questions / 90 minutes</span>
                </div>
              </article>
            )}

            <button
              aria-label={selectedAiRole ? "Back to AI roles" : "Back to interview categories"}
              className="career-card war-room-go-back-card instant-tooltip-wrap"
              onClick={selectedAiRole ? handleAiRoleBack : handleAiBackToTracks}
              type="button"
            >
              <span className="war-room-go-back-orbit" aria-hidden>
                <ArrowLeft size={28} />
              </span>
              <span className="instant-tooltip">Go Back</span>
            </button>
          </div>

          {!selectedAiRole ? (
            <div className="war-room-role-grid" role="list">
              {aiRoles.map((role, index) => (
                <button
                  aria-label={`Open ${role.name} tests`}
                  className={`war-room-flip-card war-room-role-card${
                    aiRoleTransitioningId
                      ? aiRoleTransitioningId === role.id
                        ? " role-focusing"
                        : " role-dimming"
                      : ""
                  }`}
                  data-track="ai"
                  key={role.id}
                  onClick={() => handleAiRoleSelect(role.id)}
                  style={{ animationDelay: `${index * 48}ms` }}
                  disabled={Boolean(aiRoleTransitioningId)}
                  type="button"
                >
                  <span className="war-room-flip-inner">
                    <span className="war-room-flip-face war-room-flip-front">
                      <span className="war-room-flip-visual">
                        <Image
                          alt={role.imageAlt}
                          fill
                          sizes="(max-width: 680px) 100vw, (max-width: 1180px) 50vw, 25vw"
                          src={learningAssetUrl(role.imageSrc)}
                        />
                      </span>
                      <span className="war-room-flip-content">
                        <span className="eyebrow">Role Track</span>
                        <strong>{role.name}</strong>
                        <span>{role.questionCount} curated questions</span>
                      </span>
                    </span>

                    <span className="war-room-flip-face war-room-flip-back">
                      <span className="war-room-flip-back-head">
                        <span className="metric-icon">
                          <BrainCircuit size={16} />
                        </span>
                        <strong>100 compiled tests</strong>
                      </span>
                      <p>40 questions / 90 minutes each</p>
                      <p>{role.summary}</p>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section
          className={`war-room-flip-grid${aiEntryTransitioning ? " transitioning-to-ai" : ""}`}
          aria-label="Interview categories"
        >
          {tracks.map((track) => {
            const Icon = TRACK_ICONS[track.id];
            const isSelected = selectedTrack === track.id;
            const visual = TRACK_VISUALS[track.id];
            const templateCount = trackTemplateCounts[track.id] ?? 0;

            return (
              <button
                aria-pressed={isSelected}
                className={`war-room-flip-card${isSelected ? " selected" : ""}${
                  aiEntryTransitioning
                    ? track.id === "ai"
                      ? " transitioning-focus"
                      : " transitioning-away"
                    : ""
                }`}
                data-track={track.id}
                key={track.id}
                onClick={() => handleTrackSelection(track.id)}
                disabled={aiEntryTransitioning}
                type="button"
              >
                <span className="war-room-flip-inner">
                  <span className="war-room-flip-face war-room-flip-front">
                    <span className="war-room-flip-visual">
                      <Image alt={visual.imageAlt} fill sizes="(max-width: 680px) 100vw, 25vw" src={visual.imageSrc} />
                    </span>

                    <span className="war-room-flip-content">
                      <span className="eyebrow">{track.mode === "coding" ? "Coding Track" : "MCQ Track"}</span>
                      <strong>{formatInterviewTestType(track.id)}</strong>
                      <span>{track.subtitle}</span>
                    </span>
                  </span>

                  <span className="war-room-flip-face war-room-flip-back">
                    <span className="war-room-flip-back-head">
                      <span className="metric-icon">
                        <Icon size={16} />
                      </span>
                      <strong>
                        {track.id === "coding"
                          ? "Desktop-only coding arena"
                          : track.id === "ai"
                            ? `${aiRoles.length} role tracks`
                            : `${templateCount} compiled tests`}
                      </strong>
                    </span>
                    <p>
                      {track.id === "coding"
                        ? "90-minute rounds with local compile support."
                        : track.id === "ai"
                          ? "Choose a role, then launch role-specific AI tests."
                          : `${track.durationMinutes} minutes per test`}
                    </p>
                    <p>{TRACK_BACK_COPY[track.id]}</p>
                  </span>
                </span>
              </button>
            );
          })}

          <button
            aria-pressed={false}
            className="war-room-flip-card"
            data-track="system-design"
            disabled={aiEntryTransitioning}
            onClick={() => setSystemDesignActive(true)}
            type="button"
          >
            <span className="war-room-flip-inner">
              <span className="war-room-flip-face war-room-flip-front">
                <span className="war-room-flip-visual">
                  <Image
                    alt="System design interview visual"
                    fill
                    sizes="(max-width: 680px) 100vw, 25vw"
                    src={learningAssetUrl("/war-room/system-design-card.svg")}
                  />
                </span>
                <span className="war-room-flip-content">
                  <span className="eyebrow">Interactive Track</span>
                  <strong>System Design</strong>
                  <span>Drag components into a top-down architecture.</span>
                </span>
              </span>

              <span className="war-room-flip-face war-room-flip-back">
                <span className="war-room-flip-back-head">
                  <span className="metric-icon">
                    <Network size={16} />
                  </span>
                  <strong>16 real architectures</strong>
                </span>
                <p>Build each design top-down, one drag at a time.</p>
                <p>
                  Google, Amazon, Meta, Uber, and Stripe favorites - plus a few originals - with hidden hints for every
                  wrong placement.
                </p>
              </span>
            </span>
          </button>
        </section>
      )}

      {selectedTrack === "coding" ? (
        isDesktopAppEnabled() ? (
          <CodingArenaBrowser />
        ) : (
          <section className="career-card highlight desktop-exclusive-card war-room-coding-desktop-card" data-track="coding">
            <div className="card-header">
              <div>
                <p className="eyebrow">Coding Track</p>
                <h2>Coding experience is available only on CareerOS Desktop</h2>
                <p>
                  Coding tests need local compilers and secure on-device execution, so this track is reserved for the Desktop
                  app. Web will continue to support Aptitude, Computer Science, and AI tests.
                </p>
              </div>
              <Laptop size={22} />
            </div>

            <div className="desktop-exclusive-actions">
              <Link className="primary-button" href="/desktop">
                <Download size={14} />
                Open Desktop Setup
              </Link>
              <button
                className="ghost-button"
                onClick={() => {
                  setSelectedAiRoleId(null);
                  setSelectedTrack("aptitude");
                  setFilter("all");
                  setTemplatePage(1);
                }}
                type="button"
              >
                Open Web MCQ Tracks
              </button>
            </div>

            <div className="topic-list war-room-coding-desktop-list">
              <div className="desktop-exclusive-row">
                <CheckCircle2 size={15} />
                <p>LeetCode-style arena with 28 hard Google &amp; Amazon interview problems.</p>
              </div>
              <div className="desktop-exclusive-row">
                <CheckCircle2 size={15} />
                <p>Local compiler stack for C, C++, Java, JavaScript, Python, and Rust to keep execution instant and reliable.</p>
              </div>
              <div className="desktop-exclusive-row">
                <CheckCircle2 size={15} />
                <p>Desktop-first setup ensures consistent environment parity for future proctoring and analytics.</p>
              </div>
            </div>
          </section>
        )
      ) : selectedTrack && selectedTrackMeta && (selectedTrack !== "ai" || Boolean(selectedAiRole)) ? (
        <section className="career-card war-room-library-shell" data-track={selectedTrack}>
          <div className="card-header">
            <div>
              <p className="eyebrow">Test Library</p>
              <h2>
                {selectedTrack === "ai" && selectedAiRole
                  ? `${selectedAiRole.name} tests`
                  : `${formatInterviewTestType(selectedTrack)} test sets`}
              </h2>
              <p>{selectedTrack === "ai" && selectedAiRole ? selectedAiRole.summary : selectedTrackMeta.description}</p>
            </div>
            <div className="row-between" style={{ gap: 8 }}>
              <span className="pill brand">
                <Clock3 size={12} />
                {selectedTrackMeta.durationMinutes} min
              </span>
              <span className="pill success">{templateLibrary.length} tests</span>
            </div>
          </div>

          <div className="war-room-template-tabs" role="tablist" aria-label="Template filters">
            {(["all", "attempted", "not_attempted"] as TemplateFilter[]).map((tab) => {
              const count =
                tab === "all"
                  ? templateLibrary.length
                  : tab === "attempted"
                    ? attemptedTemplateCount
                    : Math.max(templateLibrary.length - attemptedTemplateCount, 0);

              return (
                <button
                  aria-selected={filter === tab}
                  className={`war-room-template-tab${filter === tab ? " active" : ""}`}
                  key={tab}
                  onClick={() => {
                    setFilter(tab);
                    setTemplatePage(1);
                  }}
                  role="tab"
                  type="button"
                >
                  {FILTER_LABELS[tab]} <span>{count}</span>
                </button>
              );
            })}
          </div>

          {visibleTemplates.length === 0 ? (
            <div className="empty-drop">No tests found in this filter yet.</div>
          ) : (
            <>
              <div className="war-room-template-footer">
                <p className="war-room-template-summary">
                  Showing {templateStart}-{templateEnd} of {visibleTemplates.length} tests
                </p>
                <div className="war-room-pagination">
                  <button
                    className="ghost-button"
                    disabled={activeTemplatePage <= 1}
                    onClick={() => setTemplatePage((current) => Math.max(1, current - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="war-room-page-indicator">
                    Page {activeTemplatePage} / {totalTemplatePages}
                  </span>
                  <button
                    className="ghost-button"
                    disabled={activeTemplatePage >= totalTemplatePages}
                    onClick={() => setTemplatePage((current) => Math.min(totalTemplatePages, current + 1))}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <ul className="war-room-template-list">
                {paginatedTemplates.map(({ template, attemptCount, latestAttempt }) => {
                  const isLaunching = launchingTemplateId === template.id;
                  const canResume = latestAttempt && (latestAttempt.status === "ready" || latestAttempt.status === "in_progress");

                  return (
                    <li className="war-room-template-row" key={template.id}>
                      <div>
                        <div className="row-between" style={{ alignItems: "center", gap: 10 }}>
                          <strong>{template.title}</strong>
                          <span className={`pill ${attemptCount > 0 ? "success" : "warning"}`}>
                            {attemptCount > 0 ? formatAttemptsCount(attemptCount) : "Not attempted"}
                          </span>
                        </div>

                        <p className="muted" style={{ marginTop: 4 }}>
                          {template.subtitle}
                        </p>
                        <p className="muted" style={{ marginTop: 6 }}>
                          {template.summary}
                        </p>

                        <div className="tag-cloud" style={{ marginTop: 10 }}>
                          {template.categoryFocus.map((category) => (
                            <span key={`${template.id}-${category}`}>{category}</span>
                          ))}
                        </div>

                        {latestAttempt ? (
                          <p className="muted" style={{ marginTop: 10 }}>
                            Latest: {statusLabel(latestAttempt.status)} / {formatAttemptDate(latestAttempt.createdAt)} / Score:{" "}
                            {formatAttemptScore(latestAttempt)}
                          </p>
                        ) : null}
                      </div>

                      <div className="war-room-template-actions">
                        {canResume ? (
                          <Link className="ghost-button" href={`/test-room/${latestAttempt.id}`}>
                            Continue Attempt
                          </Link>
                        ) : null}
                        <button
                          className="primary-button"
                          disabled={isLaunching}
                          onClick={() => void handleStartTemplate(template)}
                          type="button"
                        >
                          {isLaunching ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
                          {isLaunching ? "Creating..." : attemptCount > 0 ? "Retake Test" : "Start Test"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : selectedTrack === "ai" ? null : (
        <section className="career-card war-room-library-hint">
          <div className="card-header">
            <div>
              <p className="eyebrow">Test Library</p>
              <h2>Select a category card</h2>
              <p>Choose Coding, Aptitude, Computer Science, or AI to open the compiled tests list.</p>
            </div>
            <Sparkles size={19} />
          </div>
        </section>
      )}

      <section className="two-column-grid">
        <article className="career-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Recent Attempts</p>
              <h2>Live practice history</h2>
              <p>Continue in-progress tests or review submitted performance.</p>
            </div>
            <CalendarClock size={19} />
          </div>

          {attemptsLoading ? (
            <div className="empty-drop">Loading attempts...</div>
          ) : recentAttempts.length === 0 ? (
            <div className="empty-drop">No attempts yet. Start your first test from the category cards above.</div>
          ) : (
            <ul className="war-room-attempt-list">
              {recentAttempts.map((attempt) => {
                const canResume = attempt.status === "ready" || attempt.status === "in_progress";

                return (
                  <li className="war-room-attempt-row" key={attempt.id}>
                    <div className="war-room-attempt-main">
                      <div className="war-room-attempt-top">
                        <strong className="war-room-attempt-title">{attempt.title}</strong>
                        <span className={`pill ${statusTone(attempt.status)}`}>{statusLabel(attempt.status)}</span>
                      </div>
                      <div className="war-room-attempt-details">
                        <span>Started: {attempt.startedAt ? formatAttemptDate(attempt.startedAt) : "Not started"}</span>
                        <span>Score: {formatAttemptScore(attempt)}</span>
                      </div>
                    </div>
                    <div className="war-room-attempt-actions">
                      <Link className="ghost-button" href={`/test-room/${attempt.id}`}>
                        {canResume ? "Continue" : "Review"}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <aside className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">Screen Flow</p>
              <h2>War Room experience</h2>
            </div>
            <Sparkles size={19} />
          </div>

          <ol className="topic-list war-room-flow-list">
            <li>
              <strong>Choose category + test</strong>
              <p>Pick from 100 compiled tests in each track and filter by attempted status.</p>
            </li>
            <li>
              <strong>Launch unlimited attempts</strong>
              <p>Every click creates a fresh round so candidates can retake as many times as needed.</p>
            </li>
            <li>
              <strong>Continue and review</strong>
              <p>Resume active rounds or review completed attempts with scores and timestamps.</p>
            </li>
            <li>
              <strong>Ready for analytics</strong>
              <p>Each question keeps category metadata for downstream strengths and gap analysis.</p>
            </li>
          </ol>

          <div className="row-between" style={{ marginTop: 16 }}>
            <span className="pill success">
              <CheckCircle2 size={12} /> Zero AI Mode
            </span>
            <span className="pill">Pick a track below to begin</span>
          </div>
        </aside>
      </section>
    </div>
  );
}

// useSearchParams() opts this page out of static generation unless wrapped in Suspense - this only surfaces
// under the desktop build's standalone output mode (CAREEROS_DESKTOP_BUILD=1), not the default web build.
export default function InterviewPrepPage() {
  return (
    <Suspense fallback={null}>
      <InterviewPrepPageInner />
    </Suspense>
  );
}
