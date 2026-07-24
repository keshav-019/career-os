import { normalizeJobImport, type JobSource, type JobSourcePayload } from "@careeros/shared";
import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { checkSlidingWindowRateLimit } from "@/lib/server/rate-limit";
import { validateTwoFactorSession } from "@/lib/server/two-factor-session";
import {
  getUserTwoFactorSettings,
  updateUserTwoFactorSettings
} from "@/lib/server/two-factor-store";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";
import { TWO_FACTOR_SESSION_HEADER } from "@/lib/two-factor-session";

export const runtime = "nodejs";

type RemotePolicy = "remote" | "hybrid" | "onsite" | "unknown";

type ImportPayload = JobSourcePayload & {
  aboutText?: string;
  descriptionHtml?: string;
  employmentType?: string;
  eligibilityText?: string;
  experienceText?: string;
  jobTypeText?: string;
  locationOptions?: string[];
  postedAtText?: string;
  responsibilitiesText?: string;
  selectedJobHtml?: string;
  salaryText?: string;
  skills?: string[];
  tags?: string[];
  remotePolicyHint?: RemotePolicy;
  workplaceTypeText?: string;
};

type FirestoreValue =
  | { arrayValue: { values: FirestoreValue[] } }
  | { booleanValue: boolean }
  | { doubleValue: number }
  | { integerValue: string }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { nullValue: null }
  | { stringValue: string };

const DEFAULT_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL
].filter((value): value is string => Boolean(value && value.trim()));

const CONFIGURED_ALLOWED_ORIGINS = (process.env.CAREEROS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const CONFIGURED_ALLOWED_EXTENSION_IDS = new Set(
  (process.env.CAREEROS_ALLOWED_EXTENSION_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOWED_CORS_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...CONFIGURED_ALLOWED_ORIGINS]);

const CONFIGURED_FIREBASE_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim();

const MAX_IMPORT_BODY_BYTES = 500_000;
const KNOWN_SKILLS = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c++",
  "react",
  "node.js",
  "nodejs",
  "spring",
  "sql",
  "aws",
  "docker",
  "kubernetes",
  "machine learning",
  "deep learning",
  "nlp",
  "tensorflow",
  "pytorch",
  "go",
  "golang"
];

const MAX_HTML_SNAPSHOT_LENGTH = 120000;

function decodeProjectIdFromIdToken(idToken: string): string {
  const [, payloadRaw] = idToken.split(".");
  if (!payloadRaw) {
    return "";
  }

  try {
    const normalizedPayload = payloadRaw.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    const decodedPayload = Buffer.from(paddedPayload, "base64").toString("utf8");
    const parsedPayload = JSON.parse(decodedPayload) as { aud?: unknown };
    return typeof parsedPayload.aud === "string" ? parsedPayload.aud.trim() : "";
  } catch {
    return "";
  }
}

function firestoreBaseUrl(idToken: string): string {
  const projectId = CONFIGURED_FIREBASE_PROJECT_ID || decodeProjectIdFromIdToken(idToken);
  return projectId
    ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`
    : "";
}

function isAllowedCorsOrigin(origin: string): boolean {
  const extensionId = getBrowserExtensionId(origin);
  if (extensionId) {
    if (extensionId.protocol === "moz-extension") {
      return true;
    }

    if (CONFIGURED_ALLOWED_EXTENSION_IDS.size > 0) {
      return CONFIGURED_ALLOWED_EXTENSION_IDS.has(extensionId.id);
    }

    // During local development we allow unpacked extension ids when an explicit allow-list is not configured.
    return !IS_PRODUCTION;
  }

  return ALLOWED_CORS_ORIGINS.has(origin);
}

function getBrowserExtensionId(origin: string): { id: string; protocol: "chrome-extension" | "moz-extension" } | null {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "chrome-extension:" && parsed.protocol !== "moz-extension:") {
      return null;
    }

    return {
      id: parsed.hostname,
      protocol: parsed.protocol === "moz-extension:" ? "moz-extension" : "chrome-extension"
    };
  } catch {
    return null;
  }
}

function isAllowedCorsOriginForRequest(request: Request, origin: string): boolean {
  try {
    if (origin === new URL(request.url).origin) {
      return true;
    }
  } catch {
    // Ignore malformed request URLs and continue with explicit allow-list checks.
  }

  return isAllowedCorsOrigin(origin);
}

function buildCorsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-2FA-Session",
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    Vary: "Origin"
  });
  const origin = request.headers.get("origin");
  if (origin && isAllowedCorsOriginForRequest(request, origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function jsonWithCors(request: Request, data: unknown, status = 200) {
  return NextResponse.json(data, {
    headers: buildCorsHeaders(request),
    status
  });
}

function readContentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function validateImportRequest(request: Request): string | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return "Expected application/json payload.";
  }

  const contentLength = readContentLength(request);
  if (contentLength !== null && contentLength > MAX_IMPORT_BODY_BYTES) {
    return "Payload is too large.";
  }

  return null;
}

async function validateTwoFactorForImport(
  request: Request,
  auth: Awaited<ReturnType<typeof verifyRequestAuth>>
): Promise<NextResponse | null> {
  if (auth.signInProvider === "google.com" || auth.signInProvider === "github.com") {
    return null;
  }

  const settings = await getUserTwoFactorSettings(auth.idToken, auth.userId);
  if (!settings.twoFactorEnabled) {
    return null;
  }

  if (!settings.twoFactorSecret) {
    await updateUserTwoFactorSettings(auth.idToken, auth.userId, {
      twoFactorEnabled: false,
      twoFactorPendingSecret: null,
      twoFactorSessionHash: null,
      twoFactorSessionIssuedAt: null
    });

    return null;
  }

  const validation = validateTwoFactorSession({
    authTimeMs: auth.authTimeMs,
    issuedAtMs: settings.twoFactorSessionIssuedAtMs,
    providedToken: request.headers.get(TWO_FACTOR_SESSION_HEADER),
    storedTokenHash: settings.twoFactorSessionHash
  });

  if (validation.valid) {
    return null;
  }

  return jsonWithCors(
    request,
    {
      code: "TWO_FACTOR_REQUIRED",
      error: "Authenticator verification is required before saving jobs from the extension.",
      reason: validation.reason
    },
    401
  );
}

function readUtf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function parseImportPayload(rawBody: string): ImportPayload {
  const parsed = JSON.parse(rawBody) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid JSON object payload.");
  }

  return parsed as ImportPayload;
}

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function sanitizeSourceUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const raw = value.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString().slice(0, 2048);
  } catch {
    return "";
  }
}

function sanitizeImageUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const raw = value.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString().slice(0, 2048);
  } catch {
    return "";
  }
}

function sanitizeHtmlSnippet(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, MAX_HTML_SNAPSHOT_LENGTH);
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToPlainText(html: string): string {
  if (!html) {
    return "";
  }

  const withoutBlockedTags = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const withLineBreaks = withoutBlockedTags
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/div>/gi, "\n");
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeBasicHtmlEntities(withoutTags);

  return sanitizeText(decoded);
}

function extractFirstHeadingFromHtml(html: string): string {
  if (!html) {
    return "";
  }

  const headingMatch = html.match(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/i);
  if (!headingMatch?.[1]) {
    return "";
  }

  return sanitizeText(htmlToPlainText(headingMatch[1]));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const cleaned = value
    .map((entry) => sanitizeText(entry))
    .filter(Boolean)
    .slice(0, 40);

  return Array.from(new Set(cleaned));
}

function inferSource(payload: ImportPayload): JobSource {
  const sourceUrl = sanitizeText(payload.sourceUrl).toLowerCase();
  if (sourceUrl.includes("linkedin.")) {
    return "linkedin";
  }

  if (sourceUrl.includes("indeed.")) {
    return "indeed";
  }

  if (sourceUrl.includes("naukri.")) {
    return "other";
  }

  return payload.source ?? "chrome-extension";
}

function inferRemotePolicy(payload: ImportPayload): RemotePolicy {
  if (payload.remotePolicyHint) {
    return payload.remotePolicyHint;
  }

  const mergedText = [
    sanitizeText(payload.location),
    toStringArray(payload.locationOptions).join(" "),
    sanitizeText(payload.description),
    sanitizeText(payload.employmentType),
    sanitizeText(payload.workplaceTypeText),
    sanitizeText(payload.jobTypeText)
  ]
    .join(" ")
    .toLowerCase();

  if (mergedText.includes("hybrid")) {
    return "hybrid";
  }

  if (
    mergedText.includes("remote")
    || mergedText.includes("work from home")
    || mergedText.includes("wfh")
  ) {
    return "remote";
  }

  if (mergedText.includes("on-site") || mergedText.includes("on site") || mergedText.includes("onsite")) {
    return "onsite";
  }

  return "unknown";
}

function inferEmploymentType(payload: ImportPayload): string {
  const explicit = sanitizeText(payload.employmentType) || sanitizeText(payload.jobTypeText);
  if (explicit) {
    return explicit;
  }

  const mergedText = [sanitizeText(payload.description), sanitizeText(payload.title)].join(" ").toLowerCase();
  if (mergedText.includes("intern")) {
    return "Internship";
  }

  if (mergedText.includes("contract")) {
    return "Contract";
  }

  if (mergedText.includes("part-time") || mergedText.includes("part time")) {
    return "Part-time";
  }

  if (mergedText.includes("full-time") || mergedText.includes("full time")) {
    return "Full-time";
  }

  return "Not specified";
}

function inferSalaryText(payload: ImportPayload): string {
  const explicit = sanitizeText(payload.salaryText);
  if (explicit) {
    return explicit;
  }

  const combinedText = [sanitizeText(payload.title), sanitizeText(payload.description), sanitizeText(payload.location)].join(" ");
  const match = combinedText.match(
    /(₹|inr|\$|usd|eur|gbp)\s?[0-9][0-9,.\s]*(?:-|to)\s?(₹|inr|\$|usd|eur|gbp)?\s?[0-9][0-9,.\s]*(?:a year|per year|a month|per month|a day|per day)?/i
  );

  return match?.[0]?.replace(/\s+/g, " ").trim() ?? "";
}

function inferSkills(payload: ImportPayload): string[] {
  const explicitSkills = toStringArray(payload.skills);
  const lowerText = [sanitizeText(payload.description), sanitizeText(payload.title)]
    .join(" ")
    .toLowerCase();

  const detected = KNOWN_SKILLS.filter((skill) => lowerText.includes(skill.toLowerCase())).map((skill) =>
    skill.toUpperCase() === "AWS" ? "AWS" : skill
  );

  return Array.from(new Set([...explicitSkills, ...detected])).slice(0, 20);
}

function buildTags(payload: ImportPayload, source: JobSource, remotePolicy: RemotePolicy, skills: string[]): string[] {
  const explicitTags = toStringArray(payload.tags);
  const remoteTag =
    remotePolicy === "remote" ? "remote" : remotePolicy === "hybrid" ? "hybrid" : remotePolicy === "onsite" ? "onsite" : "";

  return Array.from(
    new Set(
      ["new", source, remoteTag, ...explicitTags, ...skills.map((skill) => skill.toLowerCase().replace(/\s+/g, "-"))].filter(Boolean)
    )
  ).slice(0, 20);
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }

    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => toFirestoreValue(entry))
      }
    };
  }

  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};

    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (entry === undefined) {
        return;
      }

      fields[key] = toFirestoreValue(entry);
    });

    return {
      mapValue: {
        fields
      }
    };
  }

  return { nullValue: null };
}

function toFirestoreFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};

  Object.entries(value).forEach(([key, entry]) => {
    if (entry === undefined) {
      return;
    }

    fields[key] = toFirestoreValue(entry);
  });

  return fields;
}

async function persistImportedJob(
  idToken: string,
  userId: string,
  jobId: string,
  record: Record<string, unknown>
): Promise<void> {
  if (isFirebaseAdminConfigured) {
    try {
      await getAdminDb()
        .collection("users")
        .doc(userId)
        .collection("jobs")
        .doc(jobId)
        .set(record, { merge: true });
      return;
    } catch {
      // Fall back to the signed-in user's REST write below. This keeps imports working when
      // local/prod Admin SDK credentials can verify auth but cannot write Firestore documents.
    }
  }

  const documentsBaseUrl = firestoreBaseUrl(idToken);
  if (!documentsBaseUrl) {
    throw new Error("Firestore project is not configured for import route.");
  }

  const fields = toFirestoreFields(record);
  const updateMask = new URLSearchParams();
  Object.keys(fields).forEach((fieldName) => {
    updateMask.append("updateMask.fieldPaths", fieldName);
  });

  const response = await fetch(
    `${documentsBaseUrl}/users/${encodeURIComponent(userId)}/jobs/${encodeURIComponent(jobId)}?${updateMask.toString()}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Failed to persist imported job.");
  }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedCorsOriginForRequest(request, origin)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403, headers: buildCorsHeaders(request) });
  }

  return new NextResponse(null, {
    headers: buildCorsHeaders(request),
    status: 204
  });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && !isAllowedCorsOriginForRequest(request, origin)) {
      return jsonWithCors(request, { error: "Origin is not allowed." }, 403);
    }

    const validationError = validateImportRequest(request);
    if (validationError) {
      return jsonWithCors(request, { error: validationError }, 400);
    }

    const auth = await verifyRequestAuth(request.headers.get("authorization"));
    const twoFactorResponse = await validateTwoFactorForImport(request, auth);
    if (twoFactorResponse) {
      return twoFactorResponse;
    }

    const rateLimit = checkSlidingWindowRateLimit({
      key: `jobs-import:${auth.userId}`,
      maxRequests: 90,
      windowMs: 60_000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many import requests. Please retry shortly." },
        {
          status: 429,
          headers: (() => {
            const headers = buildCorsHeaders(request);
            headers.set("Retry-After", String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))));
            return headers;
          })()
        }
      );
    }

    const rawBody = await request.text();
    if (readUtf8ByteLength(rawBody) > MAX_IMPORT_BODY_BYTES) {
      return jsonWithCors(request, { error: "Payload is too large." }, 413);
    }

    let payload: ImportPayload;
    try {
      payload = parseImportPayload(rawBody);
    } catch {
      return jsonWithCors(request, { error: "Invalid JSON payload." }, 400);
    }

    if (!sanitizeText(payload.title) && !sanitizeText(payload.sourceUrl)) {
      return jsonWithCors(request, { error: "A job title or source URL is required." }, 400);
    }

    const selectedJobHtml = sanitizeHtmlSnippet(payload.selectedJobHtml);
    const descriptionHtml = sanitizeHtmlSnippet(payload.descriptionHtml);
    const htmlTitle = extractFirstHeadingFromHtml(selectedJobHtml || descriptionHtml);
    const htmlDescription = htmlToPlainText(descriptionHtml || selectedJobHtml);

    const normalizedDescription = (sanitizeText(payload.description) || htmlDescription).slice(0, 30000);
    const normalizedTitle = (sanitizeText(payload.title) || htmlTitle).slice(0, 280);

    const normalizedPayload: ImportPayload = {
      ...payload,
      aboutText: sanitizeText(payload.aboutText).slice(0, 7000),
      company: sanitizeText(payload.company),
      companyLogoUrl: sanitizeImageUrl(payload.companyLogoUrl),
      description: normalizedDescription,
      descriptionHtml,
      eligibilityText: sanitizeText(payload.eligibilityText).slice(0, 7000),
      jobTypeText: sanitizeText(payload.jobTypeText).slice(0, 220),
      location: sanitizeText(payload.location),
      locationOptions: toStringArray(payload.locationOptions).slice(0, 12),
      postedAtText: sanitizeText(payload.postedAtText).slice(0, 220),
      responsibilitiesText: sanitizeText(payload.responsibilitiesText).slice(0, 7000),
      selectedJobHtml,
      sourceUrl: sanitizeSourceUrl(payload.sourceUrl),
      title: normalizedTitle,
      workplaceTypeText: sanitizeText(payload.workplaceTypeText).slice(0, 220)
    };

    const source = inferSource(normalizedPayload);
    const remotePolicy = inferRemotePolicy(normalizedPayload);
    const employmentType = inferEmploymentType(normalizedPayload);
    const salaryText = inferSalaryText(normalizedPayload);
    const skills = inferSkills(normalizedPayload);
    const tags = buildTags(normalizedPayload, source, remotePolicy, skills);

    const draft = normalizeJobImport({
      ...normalizedPayload,
      source
    });

    const nowIso = new Date().toISOString();
    const persistedRecord = {
      company: draft.company,
      companyLogoUrl: normalizedPayload.companyLogoUrl || undefined,
      createdAt: nowIso,
      aboutText: normalizedPayload.aboutText,
      employmentType,
      eligibilityText: normalizedPayload.eligibilityText,
      experienceText: sanitizeText(normalizedPayload.experienceText),
      fitScore: 0,
      id: draft.id,
      jdText: draft.jdText ?? "",
      location: draft.location,
      locationOptions: normalizedPayload.locationOptions,
      jobTypeText: normalizedPayload.jobTypeText,
      postedAtText: normalizedPayload.postedAtText,
      priority: draft.priority,
      remotePolicy,
      role: draft.role,
      responsibilitiesText: normalizedPayload.responsibilitiesText,
      salaryText,
      savedAt: nowIso,
      source: draft.source,
      sourceUrl: draft.sourceUrl ?? "",
      status: draft.status,
      tags,
      updatedAt: nowIso,
      userId: auth.userId,
      workplaceTypeText: normalizedPayload.workplaceTypeText
    };

    await persistImportedJob(auth.idToken, auth.userId, draft.id, persistedRecord);

    return jsonWithCors(
      request,
      {
        draft: {
          ...draft,
          tags
        },
        persisted: true
      },
      201
    );
  } catch (error: unknown) {
    const message = error instanceof Error && error.message ? error.message : "Failed to import job.";
    const status =
      message.includes("Bearer")
      || message.includes("authentication token")
      || message.includes("expired")
      || message.includes("Invalid or expired")
        ? 401
        : 500;

    const safeMessage = status === 401 ? "Invalid or expired authentication token." : "Failed to import job.";
    return jsonWithCors(
      request,
      {
        error: safeMessage,
        ...(process.env.NODE_ENV === "production" ? {} : { detail: message })
      },
      status
    );
  }
}
