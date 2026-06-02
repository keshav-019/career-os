"use client";

export type DesktopHelperHealth = {
  app: string;
  latexAvailable: boolean;
  message: string;
  ok: boolean;
  version: string;
};

const DEFAULT_HELPER_URL = "http://127.0.0.1:43823";
const HEALTH_TIMEOUT_MS = 2_500;
const COMPILE_TIMEOUT_MS = 120_000;

function getDesktopHelperUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DESKTOP_HELPER_URL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_HELPER_URL;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkDesktopHelperStatus(): Promise<DesktopHelperHealth> {
  const helperUrl = getDesktopHelperUrl();
  const response = await fetchWithTimeout(
    `${helperUrl}/health`,
    {
      method: "GET"
    },
    HEALTH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Desktop helper health check failed (${response.status}).`);
  }

  const payload = (await response.json()) as Partial<DesktopHelperHealth>;
  if (!payload || payload.ok !== true) {
    throw new Error("Desktop helper did not return a valid health payload.");
  }

  return {
    app: payload.app ?? "unknown",
    latexAvailable: Boolean(payload.latexAvailable),
    message: payload.message ?? "",
    ok: true,
    version: payload.version ?? "unknown"
  };
}

export async function compileLatexWithDesktopHelper(sourceCode: string): Promise<string> {
  const source = sourceCode.trim();
  if (!source) {
    throw new Error("LaTeX source is empty.");
  }

  const helperUrl = getDesktopHelperUrl();
  const response = await fetchWithTimeout(
    `${helperUrl}/compile-latex`,
    {
      body: JSON.stringify({ source }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    COMPILE_TIMEOUT_MS
  );

  const payload = (await response.json()) as {
    error?: string;
    ok?: boolean;
    pdfBase64?: string;
  };

  if (!response.ok || payload.ok !== true || !payload.pdfBase64) {
    throw new Error(payload.error || `Desktop compile failed (${response.status}).`);
  }

  return `data:application/pdf;base64,${payload.pdfBase64}`;
}
