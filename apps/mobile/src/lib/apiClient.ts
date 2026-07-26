import { auth } from "./firebase";
import { API_BASE_URL } from "../config/env";

/**
 * Thin fetch wrapper for this app's backend API routes (AI Match, interview templates, system design - see
 * apps/mobile-backend) plus, via an explicit baseUrl override, the couple of legacy web app routes that still
 * live on the original deployment (learning content - see lib/learningClient.ts). Every route already expects
 * `Authorization: Bearer <firebase-id-token>` and verifies it server-side - this mirrors that exactly, just from
 * a phone instead of a browser tab.
 */

async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export class ApiError extends Error {}

async function requestOnce<T>(path: string, init: RequestInit | undefined, baseUrl: string, idToken: string | null) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload } as { response: Response; payload: T & { error?: string } };
}

/** A cached (non-refreshed) id token can occasionally fail server-side verification right after app launch or a
 *  long background period (clock skew, a token that's about to expire, or a transient refresh hiccup that made
 *  getIdToken() above silently return null) even though the user is genuinely signed in - this showed up as
 *  System Design's "Sign in required" appearing for an already-authenticated user. One retry with a forced token
 *  refresh covers all of those cases before giving up and surfacing the error for real. */
async function request<T>(path: string, init?: RequestInit, baseUrl: string = API_BASE_URL): Promise<T> {
  const idToken = await getIdToken();
  let { response, payload } = await requestOnce<T>(path, init, baseUrl, idToken);

  if (response.status === 401 && auth.currentUser) {
    const refreshedToken = await getIdToken(true);
    if (refreshedToken && refreshedToken !== idToken) {
      ({ response, payload } = await requestOnce<T>(path, init, baseUrl, refreshedToken));
    }
  }

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed (${response.status}).`;
    throw new ApiError(message);
  }
  return payload as T;
}

export function apiGet<T>(path: string, baseUrl?: string): Promise<T> {
  return request<T>(path, { method: "GET" }, baseUrl);
}

export function apiPost<T>(path: string, body?: unknown, baseUrl?: string): Promise<T> {
  return request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }, baseUrl);
}

export function apiPatch<T>(path: string, body?: unknown, baseUrl?: string): Promise<T> {
  return request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }, baseUrl);
}
