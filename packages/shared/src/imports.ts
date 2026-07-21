import type { JobImportDraft, JobSourcePayload } from "./types";

const fallback = (value: string | undefined, label: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : label;
};

const createDraftId = () =>
  `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const sanitizeSourceUrl = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
};

export function normalizeJobImport(payload: JobSourcePayload): JobImportDraft {
  const sourceUrl = sanitizeSourceUrl(payload.sourceUrl);

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
    jdText: payload.description?.trim(),
  };
}
