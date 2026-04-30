import type { JobImportDraft, JobSourcePayload } from "./types";

const fallback = (value: string | undefined, label: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : label;
};

const createDraftId = () =>
  `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function normalizeJobImport(payload: JobSourcePayload): JobImportDraft {
  const sourceUrl = payload.sourceUrl?.trim();

  return {
    id: createDraftId(),
    company: fallback(payload.company, "Unknown company"),
    role: fallback(payload.title, "Untitled role"),
    location: fallback(payload.location, "Not listed"),
    source: payload.source ?? "chrome-extension",
    sourceUrl,
    status: "saved",
    priority: "medium",
    tags: ["new"],
    jdText: payload.description?.trim()
  };
}
