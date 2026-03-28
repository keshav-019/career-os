'use client';

import { useCallback } from 'react';

const DEFAULT_HELPER_URL = 'http://127.0.0.1:43823';
const COMPILE_TIMEOUT_MS = 300_000;

export type LatexRuntimeStatus = {
  available: boolean;
  installMessage?: string;
  installState?: 'idle' | 'installing' | 'installed' | 'failed';
  kind: 'tectonic' | 'pdflatex' | 'missing';
  name: string;
  version?: string;
};

export type LatexCompileResult = {
  engine?: string;
  log?: string;
  pdf: ArrayBuffer;
};

export class LatexCompileError extends Error {
  engine: string;
  log: string;

  constructor(message: string, details?: { engine?: string; log?: string }) {
    super(message);
    this.name = 'LatexCompileError';
    this.engine = details?.engine || 'LaTeX';
    this.log = details?.log || message;
  }
}

function getHelperUrl(): string {
  return process.env.NEXT_PUBLIC_DESKTOP_HELPER_URL?.trim() || DEFAULT_HELPER_URL;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function decodeBase64Pdf(pdfBase64: string): ArrayBuffer {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export async function getLatexRuntimeStatus(): Promise<LatexRuntimeStatus> {
  const response = await fetchWithTimeout(`${getHelperUrl()}/health`, { method: 'GET' }, 4_000);
  const payload = (await response.json()) as {
    latexRuntime?: LatexRuntimeStatus;
    message?: string;
    ok?: boolean;
  };

  if (!response.ok || payload.ok !== true || !payload.latexRuntime) {
    throw new Error(payload.message || `Desktop helper health check failed (${response.status}).`);
  }

  return payload.latexRuntime;
}

export async function installLatexRuntime(): Promise<LatexRuntimeStatus> {
  const response = await fetchWithTimeout(`${getHelperUrl()}/latex/install`, { method: 'POST' }, COMPILE_TIMEOUT_MS);
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    latexRuntime?: LatexRuntimeStatus;
    message?: string;
    ok?: boolean;
  };

  if (!response.ok || payload.ok !== true || !payload.latexRuntime) {
    throw new Error(payload.error || payload.message || `Compiler install failed (${response.status}).`);
  }

  return payload.latexRuntime;
}

export function useLatexCompiler() {
  const compile = useCallback(async (source: string): Promise<LatexCompileResult> => {
    const response = await fetchWithTimeout(
      `${getHelperUrl()}/compile-latex`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      },
      COMPILE_TIMEOUT_MS
    );

    const data = (await response.json().catch(() => ({}))) as {
      engine?: string;
      error?: string;
      log?: string;
      ok?: boolean;
      pdfBase64?: string;
    };

    if (!response.ok || !data.ok || !data.pdfBase64) {
      throw new LatexCompileError(data.error || `Compilation failed (${response.status}).`, {
        engine: data.engine,
        log: data.log || data.error
      });
    }

    return {
      engine: data.engine,
      log: data.log,
      pdf: decodeBase64Pdf(data.pdfBase64)
    };
  }, []);

  return compile;
}
