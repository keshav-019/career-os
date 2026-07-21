'use client';

import { auth } from '@/lib/firebase/client';

const DEFAULT_HELPER_URL = 'http://127.0.0.1:43823';
const HEALTH_TIMEOUT_MS = 3_000;
const RUN_TIMEOUT_MS = 20_000;
const SUBMIT_TIMEOUT_MS = 25_000;
const CATALOG_TIMEOUT_MS = 10_000;

export type CodingLanguage = 'c' | 'cpp' | 'java' | 'javascript' | 'python' | 'rust';

export type LanguageRuntimeStatus = {
  available: boolean;
  command?: string;
  version?: string;
  mode?: string;
  message: string;
};

export type CodingRuntimeStatus = Record<CodingLanguage, LanguageRuntimeStatus>;

export type CodingProblemSummary = {
  id: string;
  title: string;
  difficulty: string;
  order: number;
  tags: string[];
  companies: string[];
};

export type CodingExample = {
  input: string;
  output: string;
  explanation?: string;
};

export type CodingTestCase = {
  input: string;
  output: string;
};

export type CodingProblemDetail = CodingProblemSummary & {
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: CodingExample[];
  starterCode: Record<CodingLanguage, string>;
  visibleTests: CodingTestCase[];
  hiddenTestCount: number;
};

export type CodingRunResultEntry = {
  label: string;
  input: string;
  expectedOutput?: string;
  actualOutput: string;
  passed?: boolean;
  stderr: string;
  timedOut: boolean;
  runtimeError: boolean;
  timeMs: number;
};

export type CodingRunResponse = {
  compileError: string | null;
  results: CodingRunResultEntry[];
};

export type CodingSubmitResponse = {
  compileError: string | null;
  accepted: boolean;
  totalHidden: number;
  passedHidden: number;
  firstFailure: {
    index: number;
    stderr: string;
    timedOut: boolean;
    runtimeError: boolean;
  } | null;
  timeMs?: number;
};

export type CustomTestCaseInput = {
  input: string;
  label?: string;
  output?: string;
};

function getHelperUrl(): string {
  return process.env.NEXT_PUBLIC_DESKTOP_HELPER_URL?.trim() || DEFAULT_HELPER_URL;
}

/** Firebase id token for the signed-in user, or null if signed out. Both the same-origin catalog API and the local
 *  helper server (which forwards it on to the catalog API on the desktop's behalf) require this. */
async function getIdToken(): Promise<string | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getJson<T>(path: string, timeoutMs: number): Promise<T> {
  const response = await fetchWithTimeout(`${getHelperUrl()}${path}`, { method: 'GET' }, timeoutMs);
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const idToken = await getIdToken();
  const response = await fetchWithTimeout(
    `${getHelperUrl()}${path}`,
    {
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        ...(idToken ? { authorization: `Bearer ${idToken}` } : {})
      },
      method: 'POST'
    },
    timeoutMs
  );
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

/** Same-origin fetch against this web app's own /api/coding-problems routes (not the desktop helper server) - these
 *  serve the live Firestore-backed catalog and require the signed-in user's id token. */
async function getCatalogJson<T>(path: string, timeoutMs: number): Promise<T> {
  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error('Sign in to view coding problems.');
  }
  const response = await fetchWithTimeout(
    path,
    { headers: { authorization: `Bearer ${idToken}` }, method: 'GET' },
    timeoutMs
  );
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function checkCodingHelperAvailable(): Promise<boolean> {
  try {
    await fetchWithTimeout(`${getHelperUrl()}/health`, { method: 'GET' }, HEALTH_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

export async function getCodingRuntimeStatus(): Promise<CodingRuntimeStatus> {
  const payload = await getJson<{ runtime: CodingRuntimeStatus }>('/code/runtime', HEALTH_TIMEOUT_MS);
  return payload.runtime;
}

// Problem listing/detail come from this web app's own API (Firestore-backed, fetched live every call) - not the
// desktop helper server, which no longer carries a local catalog. See apps/web/src/lib/coding-catalog/README.md.
export async function listCodingProblems(): Promise<CodingProblemSummary[]> {
  const payload = await getCatalogJson<{ problems: CodingProblemSummary[] }>('/api/coding-problems', CATALOG_TIMEOUT_MS);
  return payload.problems;
}

export async function getCodingProblem(problemId: string): Promise<CodingProblemDetail> {
  const payload = await getCatalogJson<{ problem: CodingProblemDetail }>(
    `/api/coding-problems/${encodeURIComponent(problemId)}`,
    CATALOG_TIMEOUT_MS
  );
  return payload.problem;
}

export async function runCodingSolution(params: {
  problemId: string;
  language: CodingLanguage;
  source: string;
  customTests?: CustomTestCaseInput[];
  customTestsOnly?: boolean;
}): Promise<CodingRunResponse> {
  return postJson<CodingRunResponse>('/code/run', params, RUN_TIMEOUT_MS);
}

export async function submitCodingSolution(params: {
  problemId: string;
  language: CodingLanguage;
  source: string;
}): Promise<CodingSubmitResponse> {
  return postJson<CodingSubmitResponse>('/code/submit', params, SUBMIT_TIMEOUT_MS);
}

export const CODING_LANGUAGES: { id: CodingLanguage; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'rust', label: 'Rust' }
];
