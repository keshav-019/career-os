import type { JobRecord, ResumeVersion } from "@careeros/shared";
import { hasMeaningfulProfileContent } from "@/lib/profile-data";
import type { ExperienceRecord, ProfileData, ProjectRecord } from "@/lib/profile-data";
import type { ResumeData } from "@/lib/resume-types";

export type AiStatus = {
  available: boolean;
  checkedAt: string;
  configured: boolean;
  message: string;
  provider: "openrouter";
};

export type AiResumeReview = {
  atsKeywords: string[];
  gaps: string[];
  latexOrVisualNotes: string[];
  marketPosition: string;
  overallScore: number;
  recruiterSummary: string;
  strengths: string[];
  targetRoles: string[];
};

export type AiJobMatch = {
  applicationStrategy: string[];
  bestResumeId: string;
  bestResumeLabel: string;
  coverLetter: string;
  gaps: string[];
  matchedEvidence: string[];
  outreachMessage: string;
  recommendedJobTargets: string[];
  resumeTweaks: string[];
  scoreOutOf10: number;
  verdict: string;
};

export type LearningPlanSubjectInput = {
  id: string;
  order: number;
  overview: string;
  title: string;
  topicCount: number;
};

export type LearningPlanTrackInput = {
  id: string;
  subjects: LearningPlanSubjectInput[];
  title: string;
};

export type LearningPlanWeakRowInput = {
  earned: number;
  percentage: number;
  subtopic: string;
  topic: string;
  total: number;
};

export type AiLearningPlanModule = {
  priority: number;
  reason: string;
  subjectId: string;
  subjectTitle: string;
  topicCount: number;
  trackId: string;
  trackTitle: string;
};

export type AiLearningPlan = {
  hasTestHistory: boolean;
  modules: AiLearningPlanModule[];
  summary: string;
};

export type AiGeneratedResume = {
  model: string;
  resume: ResumeData;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
    native_finish_reason?: string;
  }>;
  error?: {
    code?: number | string;
    message?: string;
  };
  model?: string;
};

type ChatJsonOptions = {
  messages: Array<{ content: string; role: "system" | "user" }>;
  numCtx?: number;
  numPredict?: number;
  schema: Record<string, unknown>;
};

type AiConfig = {
  apiKey: string;
  appName: string;
  baseUrl: string;
  model: string;
  siteUrl: string;
  timeoutMs: number;
};

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const DEFAULT_TIMEOUT_MS = 90_000;

const resumeReviewSchema = {
  type: "object",
  properties: {
    overallScore: { type: "number" },
    marketPosition: { type: "string" },
    targetRoles: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    atsKeywords: { type: "array", items: { type: "string" } },
    latexOrVisualNotes: { type: "array", items: { type: "string" } },
    recruiterSummary: { type: "string" }
  },
  required: [
    "overallScore",
    "marketPosition",
    "targetRoles",
    "strengths",
    "gaps",
    "atsKeywords",
    "latexOrVisualNotes",
    "recruiterSummary"
  ]
};

const jobMatchSchema = {
  type: "object",
  properties: {
    bestResumeId: { type: "string" },
    bestResumeLabel: { type: "string" },
    scoreOutOf10: { type: "number" },
    verdict: { type: "string" },
    matchedEvidence: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    resumeTweaks: { type: "array", items: { type: "string" } },
    applicationStrategy: { type: "array", items: { type: "string" } },
    recommendedJobTargets: { type: "array", items: { type: "string" } },
    coverLetter: { type: "string" },
    outreachMessage: { type: "string" }
  },
  required: [
    "bestResumeId",
    "bestResumeLabel",
    "scoreOutOf10",
    "verdict",
    "matchedEvidence",
    "gaps",
    "resumeTweaks",
    "applicationStrategy",
    "recommendedJobTargets",
    "coverLetter",
    "outreachMessage"
  ]
};

const generateResumeSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          refId: { type: "string" },
          bullets: { type: "array", items: { type: "string" } }
        },
        required: ["refId", "bullets"]
      }
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          refId: { type: "string" },
          description: { type: "string" }
        },
        required: ["refId", "description"]
      }
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          items: { type: "array", items: { type: "string" } }
        },
        required: ["category", "items"]
      }
    }
  },
  required: ["summary", "experience", "projects", "skills"]
};

const learningPlanSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    modules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          trackId: { type: "string" },
          subjectId: { type: "string" },
          priority: { type: "number" },
          reason: { type: "string" }
        },
        required: ["trackId", "subjectId", "priority", "reason"]
      }
    }
  },
  required: ["summary", "modules"]
};

function readAiConfig(): AiConfig {
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const baseUrl = (process.env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, "");
  const siteUrl = (
    process.env.OPENROUTER_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    vercelUrl ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  const timeoutMs = Number(process.env.CAREEROS_AI_TIMEOUT_MS);

  return {
    apiKey: process.env.OPENROUTER_API_KEY?.trim() || "",
    appName: process.env.OPENROUTER_APP_NAME?.trim() || "CareerOS",
    baseUrl,
    model: process.env.OPENROUTER_MODEL?.trim() || process.env.CAREEROS_AI_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    siteUrl,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAiStatus(): Promise<AiStatus> {
  const config = readAiConfig();
  const checkedAt = new Date().toISOString();

  if (!config.apiKey) {
    return {
      available: false,
      checkedAt,
      configured: false,
      message: "Add OPENROUTER_API_KEY to .env.local or your Vercel environment variables to enable Career intelligence.",
      provider: "openrouter"
    };
  }

  return {
    available: true,
    checkedAt,
    configured: true,
    message: "Career intelligence is ready.",
    provider: "openrouter"
  };
}

function clampScore(value: unknown, max = 10): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(max, Math.round(parsed * 10) / 10));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const values = trimmed
      .split(/\n|;|(?<=\.)\s+(?=[A-Z])/)
      .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean);
    return values.length > 0 ? values.slice(0, 12) : fallback;
  }

  if (!Array.isArray(value)) {
    return fallback;
  }

  const values = value.map((item) => asString(item)).filter(Boolean);
  return values.length > 0 ? values.slice(0, 12) : fallback;
}

function parseJsonObject(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Try to recover from small amounts of model-added text around the JSON object.
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = JSON.parse(content.slice(firstBrace, lastBrace + 1));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error("The AI model did not return a JSON object.");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function unwrapSimpleLatexCommands(value: string): string {
  let text = value;
  const wrappers = ["textbf", "textit", "texttt", "emph", "textsc", "underline"];

  for (let pass = 0; pass < 4; pass += 1) {
    for (const wrapper of wrappers) {
      text = text.replace(new RegExp(`\\\\${wrapper}\\{([^{}]*)\\}`, "g"), "$1");
    }
  }

  return text;
}

function latexToPlainText(value: string): string {
  let text = value.replace(/\r\n/g, "\n");
  const documentStart = text.indexOf("\\begin{document}");
  const documentEnd = text.lastIndexOf("\\end{document}");

  if (documentStart >= 0) {
    text = text.slice(documentStart + "\\begin{document}".length, documentEnd > documentStart ? documentEnd : undefined);
  }

  text = text
    .replace(/(?<!\\)%.*$/gm, "")
    .replace(/\\href\{([^{}]*)\}\{([^{}]*)\}/g, "$2 ($1)")
    .replace(/\\url\{([^{}]*)\}/g, "$1")
    .replace(/\\section\*?\{([^{}]*)\}/g, "\n\n$1\n")
    .replace(/\\item\b/g, "\n- ")
    .replace(/\\(?:begin|end)\{[^{}]*\}/g, "\n");

  text = unwrapSimpleLatexCommands(text);

  return text
    .replace(/\\(?:fontsize|selectfont|vspace|hspace|noindent|hfill|rule|textwidth|linewidth)\b(?:\[[^\]]*\])*/g, " ")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])*/g, " ")
    .replace(/\\([%&$#_{}])/g, "$1")
    .replace(/[{}]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const resumeSignalTerms = [
  "ai",
  "angular",
  "api",
  "aws",
  "azure",
  "ci/cd",
  "cloud",
  "docker",
  "firebase",
  "gcp",
  "java",
  "javascript",
  "kubernetes",
  "latex",
  "linux",
  "machine learning",
  "microservices",
  "node.js",
  "oci",
  "postgresql",
  "python",
  "react",
  "rest",
  "spring boot",
  "sql",
  "typescript"
];

function extractResumeSignals(value: string): string[] {
  const normalized = value.toLowerCase();
  return resumeSignalTerms.filter((term) => normalized.includes(term));
}

function compactEvidenceLines(value: string): string[] {
  const lines = value
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length >= 24 && line.length <= 180);

  const signalLines = lines.filter((line) => extractResumeSignals(line).length > 0);
  return (signalLines.length > 0 ? signalLines : lines).slice(0, 6);
}

function compactLatexForMatch(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && line.length <= 180)
    .filter((line) => extractResumeSignals(line).length > 0 || /engineer|developer|intern|project/i.test(line))
    .slice(0, 10)
    .join("\n");
}

export function resumeToAiText(resume: ResumeVersion, maxLength = 2_800): string {
  const sectionText = (resume.sections ?? [])
    .map((section) => `${section.title}: ${section.plainText || stripHtml(section.contentHtml)}`)
    .filter(Boolean)
    .join("\n");
  const readableLatex = resume.latexCode ? latexToPlainText(resume.latexCode) : "";
  const targetRoles = resume.targetRoles ?? [];
  const bulletHighlights = resume.bulletHighlights ?? [];

  return truncate(
    [
      `Resume ID: ${resume.id}`,
      `Label: ${resume.label}`,
      `Mode: ${resume.editorMode ?? "builder"}`,
      `Target roles: ${targetRoles.join(", ") || "Not listed"}`,
      `Highlights:\n${bulletHighlights.join("\n") || "Not listed"}`,
      sectionText ? `Visual/builder sections:\n${sectionText}` : "",
      readableLatex ? `Readable text extracted from LaTeX resume:\n${readableLatex}` : ""
    ]
      .filter(Boolean)
      .join("\n\n"),
    maxLength
  );
}

function resumeToJobMatchText(resume: ResumeVersion): string {
  const sectionText = (resume.sections ?? [])
    .map((section) => `${section.title}: ${section.plainText || stripHtml(section.contentHtml)}`)
    .filter(Boolean)
    .join("\n");
  const targetRoles = resume.targetRoles ?? [];
  const bulletHighlights = resume.bulletHighlights ?? [];
  const structuredText = [targetRoles.join(", "), bulletHighlights.join("\n"), sectionText].filter(Boolean).join("\n");
  const latexMatchText = !structuredText && resume.latexCode ? compactLatexForMatch(latexToPlainText(resume.latexCode)) : "";
  const combinedText = [structuredText, latexMatchText]
    .filter(Boolean)
    .join("\n");
  const signals = extractResumeSignals(combinedText);
  const evidence = compactEvidenceLines(combinedText);

  return truncate(
    [
      `Resume ID: ${resume.id}`,
      `Label: ${resume.label}`,
      `Mode: ${resume.editorMode ?? "builder"}`,
      `Target roles: ${targetRoles.join(", ") || "Not listed"}`,
      `Keyword signals: ${signals.join(", ") || "Not obvious"}`,
      `Evidence:\n${evidence.map((line) => `- ${line}`).join("\n") || bulletHighlights.join("\n") || "Not listed"}`
    ].join("\n"),
    850
  );
}

function learningCatalogToAiText(tracks: LearningPlanTrackInput[]): string {
  const compactTracks = tracks.map((track) => ({
    trackId: track.id,
    title: track.title,
    subjects: track.subjects
      .slice()
      .sort((first, second) => first.order - second.order)
      .map((subject) => ({
        subjectId: subject.id,
        title: subject.title,
        topicCount: subject.topicCount,
        overview: truncate(subject.overview, 160)
      }))
  }));

  return JSON.stringify(compactTracks);
}

function learningPerformanceToAiText(weakRows: LearningPlanWeakRowInput[]): string {
  if (weakRows.length === 0) {
    return "This candidate has not completed any practice tests yet. There is no performance data to target. Build a complete study sequence that starts from the most foundational subjects and progresses in order to the most advanced subjects, across every available track.";
  }

  const rows = weakRows
    .slice(0, 12)
    .map(
      (row) =>
        `- Track "${row.topic}", topic "${row.subtopic}": ${row.earned}/${row.total} correct (${row.percentage}%).`
    )
    .join("\n");

  return `This candidate has completed practice tests. Their weakest scoring topics, worst first, are:\n${rows}\n\nPrioritize curriculum subjects that directly address these weak areas first, then fill out the rest of the plan with a sensible progression through the remaining subjects.`;
}

function clampPriority(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function jobToAiText(job: Partial<JobRecord> & Record<string, unknown>): string {
  return truncate(
    [
      `Role: ${asString(job.role) || asString(job.title) || "Not listed"}`,
      `Company: ${asString(job.company) || "Not listed"}`,
      `Location: ${asString(job.location) || "Not listed"}`,
      `Tags: ${Array.isArray(job.tags) ? job.tags.join(", ") : ""}`,
      `Description:\n${asString(job.jdText) || asString(job.description) || "No job description supplied."}`
    ].join("\n"),
    1_600
  );
}

function parseOpenRouterPayload(responseText: string): OpenRouterChatResponse {
  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText) as OpenRouterChatResponse;
  } catch {
    return {
      error: {
        message: truncate(responseText, 500)
      }
    };
  }
}

function extractMessageContent(payload: OpenRouterChatResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

async function chatJson({
  messages,
  numPredict = 750,
  schema
}: ChatJsonOptions): Promise<{ model: string; data: Record<string, unknown> }> {
  const config = readAiConfig();

  if (!config.apiKey) {
    throw new Error("Add OPENROUTER_API_KEY to .env.local before running Career intelligence.");
  }

  const schemaInstruction = `Return only a valid JSON object. It must match this schema: ${JSON.stringify(schema)}. Do not include markdown, prose, or code fences.`;
  const routedMessages =
    messages[0]?.role === "system"
      ? [{ ...messages[0], content: `${messages[0].content}\n\n${schemaInstruction}` }, ...messages.slice(1)]
      : [{ role: "system" as const, content: schemaInstruction }, ...messages];

  const maxTokens = Math.max(numPredict, 1_800);
  const response = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      body: JSON.stringify({
        max_tokens: maxTokens,
        messages: routedMessages,
        model: config.model,
        reasoning: {
          effort: "none",
          exclude: true
        },
        response_format: {
          type: "json_object"
        },
        temperature: 0.15,
        top_p: 0.9
      }),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.siteUrl,
        "X-OpenRouter-Title": config.appName,
        "X-Title": config.appName
      },
      method: "POST"
    },
    config.timeoutMs
  );

  const responseText = await response.text();
  const payload = parseOpenRouterPayload(responseText);

  if (!response.ok || payload.error) {
    const providerMessage = payload.error?.message || responseText || `AI request failed with status ${response.status}.`;
    if (response.status === 401 || response.status === 403) {
      throw new Error("Career intelligence could not authenticate. Check OPENROUTER_API_KEY.");
    }
    if (response.status === 429) {
      throw new Error("Career intelligence is temporarily rate limited. Try again in a moment.");
    }

    throw new Error(providerMessage);
  }

  const content = extractMessageContent(payload);
  const finishReason = payload.choices?.[0]?.finish_reason || payload.choices?.[0]?.native_finish_reason;

  if (!content) {
    const reasonNote = finishReason ? ` Finish reason: ${finishReason}.` : "";
    throw new Error(`Career intelligence returned an empty response.${reasonNote}`);
  }

  let data: Record<string, unknown>;
  try {
    data = parseJsonObject(content);
  } catch {
    // The model occasionally returns truncated or malformed JSON (most often when it runs out of
    // output tokens mid-response). Surface a clear, actionable message instead of the raw
    // JSON.parse error, which is meaningless to an end user.
    if (finishReason === "length") {
      throw new Error(
        "Career intelligence's response was too long and got cut off before it finished. Try again - if it keeps happening, trim down some of your longer profile entries."
      );
    }

    throw new Error("Career intelligence returned a response that couldn't be read. Please try again.");
  }

  return {
    data,
    model: payload.model || config.model
  };
}

export async function reviewResumeWithAi(resume: ResumeVersion): Promise<AiResumeReview & { model: string }> {
  const { data, model } = await chatJson({
    numPredict: 700,
    schema: resumeReviewSchema,
    messages: [
      {
        role: "system",
        content:
          'You are CareerOS Resume Intelligence. Review resumes for realistic software, cloud, AI, and product job markets. Return compact JSON only with exactly these keys: "overallScore", "marketPosition", "targetRoles", "strengths", "gaps", "atsKeywords", "latexOrVisualNotes", "recruiterSummary". overallScore is 0-10. Keep arrays to 4 items max, each item under 14 words. Keep prose direct and practical.'
      },
      {
        role: "user",
        content: `Review this resume. Recommend realistic job types, strengths, gaps, ATS keywords, and notes that apply to builder/visual or LaTeX resumes.\n\n${resumeToAiText(resume)}`
      }
    ]
  });

  return {
    atsKeywords: asStringArray(data.atsKeywords),
    gaps: asStringArray(data.gaps),
    latexOrVisualNotes: asStringArray(data.latexOrVisualNotes),
    marketPosition: asString(data.marketPosition),
    model,
    overallScore: clampScore(data.overallScore),
    recruiterSummary: asString(data.recruiterSummary),
    strengths: asStringArray(data.strengths),
    targetRoles: asStringArray(data.targetRoles)
  };
}

export async function matchJobWithAi(
  job: Partial<JobRecord> & Record<string, unknown>,
  resumes: ResumeVersion[]
): Promise<AiJobMatch & { model: string }> {
  if (resumes.length === 0) {
    throw new Error("Add at least one resume before running AI job match.");
  }

  const resumePayload = resumes
    .slice(0, 8)
    .map((resume) => resumeToJobMatchText(resume))
    .join("\n\n---\n\n");
  const { data, model } = await chatJson({
    numCtx: 2048,
    numPredict: 520,
    schema: jobMatchSchema,
    messages: [
      {
        role: "system",
        content:
          'You are CareerOS Job Match Intelligence. Compare one job against candidate resumes. Return compact JSON only with exactly these keys: "bestResumeId", "bestResumeLabel", "scoreOutOf10", "verdict", "matchedEvidence", "gaps", "resumeTweaks", "applicationStrategy", "recommendedJobTargets", "coverLetter", "outreachMessage". scoreOutOf10 is 0-10. Pick one best resume. Keep arrays to 3 items max, each item under 12 words. Cover letter must be 80-120 words, specific, and grounded in matched evidence.'
      },
      {
        role: "user",
        content: `Job entry:\n${jobToAiText(job)}\n\nCandidate resumes:\n${resumePayload}`
      }
    ]
  });

  const fallbackResume = resumes[0];

  return {
    applicationStrategy: asStringArray(data.applicationStrategy),
    bestResumeId: asString(data.bestResumeId) || fallbackResume.id,
    bestResumeLabel: asString(data.bestResumeLabel) || fallbackResume.label,
    coverLetter: asString(data.coverLetter),
    gaps: asStringArray(data.gaps),
    matchedEvidence: asStringArray(data.matchedEvidence),
    model,
    outreachMessage: asString(data.outreachMessage),
    recommendedJobTargets: asStringArray(data.recommendedJobTargets),
    resumeTweaks: asStringArray(data.resumeTweaks),
    scoreOutOf10: clampScore(data.scoreOutOf10),
    verdict: asString(data.verdict)
  };
}

export async function generateLearningPlanWithAi(
  tracks: LearningPlanTrackInput[],
  weakRows: LearningPlanWeakRowInput[]
): Promise<AiLearningPlan & { model: string }> {
  const availableTracks = tracks.filter((track) => track.subjects.length > 0);
  if (availableTracks.length === 0) {
    throw new Error("No curriculum subjects are available yet to build a plan.");
  }

  const hasTestHistory = weakRows.length > 0;
  const { data, model } = await chatJson({
    numPredict: 900,
    schema: learningPlanSchema,
    messages: [
      {
        role: "system",
        content:
          'You are CareerOS Learning Intelligence. You build personalized study plans from a curriculum catalog and a candidate\'s practice test performance. Return compact JSON only with exactly these keys: "summary", "modules". "summary" is 1-2 sentences under 40 words explaining the plan\'s focus. "modules" is an ordered array (5-10 items) of the curriculum subjects to study, each with "trackId", "subjectId", "priority" (1 = study first, increasing thereafter), and "reason" (under 16 words, specific to this candidate). You must only use trackId and subjectId values copied exactly from the curriculum catalog provided - never invent or rename ids. If no performance data is given, order modules from the most foundational subject to the most advanced across the whole curriculum so the candidate can start from the basics and work up. If performance data is given, put subjects tied to the weakest topics first, then continue with a sensible remaining progression.'
      },
      {
        role: "user",
        content: `Curriculum catalog (JSON, one entry per track with its subjects):\n${learningCatalogToAiText(availableTracks)}\n\nCandidate performance:\n${learningPerformanceToAiText(weakRows)}`
      }
    ]
  });

  const subjectsById = new Map<string, { subject: LearningPlanSubjectInput; trackId: string; trackTitle: string }>();
  availableTracks.forEach((track) => {
    track.subjects.forEach((subject) => {
      subjectsById.set(`${track.id}::${subject.id}`, { subject, trackId: track.id, trackTitle: track.title });
    });
  });

  const rawModules = Array.isArray(data.modules) ? data.modules : [];
  const seen = new Set<string>();
  const modules: AiLearningPlanModule[] = [];

  rawModules.forEach((rawModule, index) => {
    if (!rawModule || typeof rawModule !== "object") {
      return;
    }

    const moduleRecord = rawModule as Record<string, unknown>;
    const trackId = asString(moduleRecord.trackId);
    const subjectId = asString(moduleRecord.subjectId);
    const lookupKey = `${trackId}::${subjectId}`;
    const match = subjectsById.get(lookupKey);

    if (!match || seen.has(lookupKey)) {
      return;
    }

    seen.add(lookupKey);
    modules.push({
      priority: clampPriority(moduleRecord.priority, index + 1),
      reason: asString(moduleRecord.reason) || "Recommended by Career Intelligence.",
      subjectId: match.subject.id,
      subjectTitle: match.subject.title,
      topicCount: match.subject.topicCount,
      trackId: match.trackId,
      trackTitle: match.trackTitle
    });
  });

  if (modules.length === 0) {
    throw new Error("Career intelligence could not match its recommendations to the curriculum. Try again.");
  }

  modules.sort((first, second) => first.priority - second.priority);

  return {
    hasTestHistory,
    model,
    modules: modules.slice(0, 10),
    summary: asString(data.summary) || "Personalized study plan generated from your curriculum and test history."
  };
}

type TaggedExperienceRecord = ExperienceRecord & { source: "internship" | "employment" };

function sortByRecency<T extends { endDate: string; isCurrent?: boolean; startDate: string }>(items: T[]): T[] {
  return [...items].sort((first, second) => {
    const firstCurrent = first.isCurrent ?? false;
    const secondCurrent = second.isCurrent ?? false;
    if (firstCurrent !== secondCurrent) {
      return firstCurrent ? -1 : 1;
    }

    const firstDate = first.endDate || first.startDate;
    const secondDate = second.endDate || second.startDate;
    return secondDate.localeCompare(firstDate);
  });
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function experienceToAiText(entries: TaggedExperienceRecord[]): string {
  return entries
    .map((entry) =>
      [
        `refId: ${entry.id}`,
        `type: ${entry.source}`,
        `company: ${entry.company || "Not listed"}`,
        `role: ${entry.role || "Not listed"}`,
        `dates: ${entry.startDate || "?"} to ${entry.isCurrent ? "present" : entry.endDate || "?"}`,
        `original description: ${entry.description || "Not listed"}`,
        `skills gained: ${entry.skillsGained || "Not listed"}`
      ].join("\n")
    )
    .join("\n---\n");
}

function projectsToAiText(entries: ProjectRecord[]): string {
  return entries
    .map((entry) =>
      [
        `refId: ${entry.id}`,
        `title: ${entry.title || "Not listed"}`,
        `type: ${entry.projectType}`,
        `tech stack: ${entry.techStack || "Not listed"}`,
        `original description: ${entry.description || "Not listed"}`,
        `skills gained: ${entry.skillsGained || "Not listed"}`
      ].join("\n")
    )
    .join("\n---\n");
}

/**
 * Generates an ATS-tailored Visual Mode resume for a specific job, on the spot.
 *
 * To keep AI usage minimal and factual, only one chat completion call is made, and only
 * the parts that genuinely benefit from rewriting are AI-authored: the professional summary,
 * experience bullets, a short list of the most relevant project descriptions, and a
 * job-relevant skills grouping. Every factual field (company names, roles, dates, education,
 * certifications) is copied directly from the user's profile record matched by a stable
 * `refId`, never invented by the model. Nothing generated here is persisted - this is meant to
 * be called fresh every time the user asks for a resume tailored to a job.
 */
export async function generateAtsResumeWithAi(
  profile: ProfileData,
  job: Partial<JobRecord> & Record<string, unknown>
): Promise<AiGeneratedResume> {
  const taggedInternships: TaggedExperienceRecord[] = profile.internships.map((entry) => ({
    ...entry,
    source: "internship"
  }));
  const taggedEmployment: TaggedExperienceRecord[] = profile.employmentHistory.map((entry) => ({
    ...entry,
    source: "employment"
  }));
  const allExperience = sortByRecency([...taggedInternships, ...taggedEmployment]).slice(0, 6);
  const allProjects = sortByRecency(profile.projects).slice(0, 8);

  if (!hasMeaningfulProfileContent(profile)) {
    throw new Error(
      "Your profile doesn't have enough detail yet for Career AI to write a tailored resume. Add some real experience, project, or education details in Profile first, or fill in the resume fields yourself below."
    );
  }

  const { data, model } = await chatJson({
    numPredict: 2_600,
    schema: generateResumeSchema,
    messages: [
      {
        role: "system",
        content:
          'You are CareerOS Resume Intelligence. You write ATS-friendly resume content tailored to one specific job, using only the facts provided about a candidate - never invent companies, dates, titles, or achievements. Return compact JSON only with exactly these keys: "summary", "experience", "projects", "skills". "summary" is a 2-3 sentence professional summary (under 55 words) tailored to the job, grounded in the candidate\'s actual background. "experience" must include exactly one entry for every refId given in the candidate\'s work history, each with 2-4 rewritten bullet points (under 22 words each) that emphasize what is most relevant to the job, drawing on the "skills gained" notes. Never drop a refId and never invent one. "projects" should include only the 2-4 most relevant projects for this job (fewer if fewer are available), each keyed by its exact original refId with one rewritten description (under 45 words) emphasizing job-relevant impact and skills. "skills" is 3-5 categories (e.g. "Languages", "Frameworks", "Cloud & DevOps"), each with up to 8 items, ordered so the most job-relevant skills and categories come first, drawn from the candidate\'s listed key skills, skills gained, and tech stacks - do not invent skills the candidate never mentioned.'
      },
      {
        role: "user",
        content: `Target job:\n${jobToAiText(job)}\n\nCandidate key skills: ${profile.keySkills || "Not listed"}\n\nCandidate profile summary: ${profile.profileSummary || "Not listed"}\n\nCandidate work history:\n${experienceToAiText(allExperience) || "None listed."}\n\nCandidate projects:\n${projectsToAiText(allProjects) || "None listed."}`
      }
    ]
  });

  const summary = asString(data.summary) || profile.profileSummary;

  const experienceByRefId = new Map<string, TaggedExperienceRecord>(allExperience.map((entry) => [entry.id, entry]));
  const aiExperienceBullets = new Map<string, string[]>();
  if (Array.isArray(data.experience)) {
    data.experience.forEach((rawEntry) => {
      if (!rawEntry || typeof rawEntry !== "object") return;
      const entryRecord = rawEntry as Record<string, unknown>;
      const refId = asString(entryRecord.refId);
      if (!experienceByRefId.has(refId)) return;
      const bullets = asStringArray(entryRecord.bullets);
      if (bullets.length > 0) {
        aiExperienceBullets.set(refId, bullets);
      }
    });
  }

  const experience: ResumeData["experience"] = allExperience.map((entry) => ({
    id: entry.id,
    company: entry.company,
    position: entry.role,
    location: "",
    startDate: entry.startDate,
    endDate: entry.endDate,
    current: entry.isCurrent,
    description:
      aiExperienceBullets.get(entry.id) ??
      (entry.description ? [entry.description] : entry.skillsGained ? [entry.skillsGained] : [])
  }));

  const projectsByRefId = new Map<string, ProjectRecord>(allProjects.map((entry) => [entry.id, entry]));
  const aiProjectSelections: Array<{ refId: string; description: string }> = [];
  if (Array.isArray(data.projects)) {
    data.projects.forEach((rawEntry) => {
      if (!rawEntry || typeof rawEntry !== "object") return;
      const entryRecord = rawEntry as Record<string, unknown>;
      const refId = asString(entryRecord.refId);
      const description = asString(entryRecord.description);
      if (projectsByRefId.has(refId) && description) {
        aiProjectSelections.push({ refId, description });
      }
    });
  }

  const chosenProjects = aiProjectSelections.length > 0 ? aiProjectSelections.slice(0, 4) : allProjects.slice(0, 3).map((entry) => ({ refId: entry.id, description: entry.description }));

  const projects: ResumeData["projects"] = chosenProjects.map(({ refId, description }) => {
    const source = projectsByRefId.get(refId);
    return {
      id: refId,
      name: source?.title || "Project",
      description,
      technologies: source ? splitCommaList(source.techStack) : [],
      link: ""
    };
  });

  const skills: ResumeData["skills"] = Array.isArray(data.skills)
    ? data.skills
        .map((rawEntry, index) => {
          if (!rawEntry || typeof rawEntry !== "object") return null;
          const entryRecord = rawEntry as Record<string, unknown>;
          const category = asString(entryRecord.category);
          const items = asStringArray(entryRecord.items);
          if (!category || items.length === 0) return null;
          return { id: `skill-${index}`, category, items: items.slice(0, 8) };
        })
        .filter((entry): entry is { id: string; category: string; items: string[] } => entry !== null)
        .slice(0, 5)
    : [];

  const fallbackSkills: ResumeData["skills"] =
    skills.length > 0
      ? skills
      : splitCommaList(profile.keySkills).length > 0
        ? [{ id: "skill-0", category: "Skills", items: splitCommaList(profile.keySkills).slice(0, 12) }]
        : [];

  const { firstName, lastName } = splitFullName(profile.fullName);
  const targetTitle = asString(job.role) || asString(job.title) || allExperience[0]?.role || "";

  const education: ResumeData["education"] = profile.education.map((entry) => ({
    id: entry.id,
    institution: entry.institute,
    degree: entry.degree,
    field: entry.fieldOfStudy,
    startDate: entry.startDate,
    endDate: entry.isPursuing ? "" : entry.endDate,
    gpa: entry.score ? `${entry.score} ${entry.gradingType}` : "",
    description: ""
  }));

  const certifications: ResumeData["certifications"] = profile.certifications
    .filter((entry) => entry.title)
    .map((entry) => ({
      id: entry.id,
      name: entry.title,
      issuer: entry.issuer,
      date: entry.issueDate
    }));

  const resume: ResumeData = {
    personal: {
      firstName,
      lastName,
      title: targetTitle,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin: "",
      github: "",
      portfolio: "",
      summary
    },
    education,
    experience,
    skills: fallbackSkills,
    projects,
    certifications
  };

  return { model, resume };
}
