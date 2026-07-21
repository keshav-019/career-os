/**
 * Pure logic shared between the system-design-problems admin list page (page.tsx - list, add/edit one, bulk
 * import) and the dedicated single-problem edit screen ([id]/page.tsx).
 */

import { auth } from "@/lib/firebase/client";
import type { SystemDesignProblemRecord, SystemDesignProblemSourceInput } from "@/lib/system-design/catalog.server";

export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!auth?.currentUser) {
    throw new Error("Sign in before using the admin tool.");
  }
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${idToken}`
    }
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function fetchAllSystemDesignProblems(): Promise<SystemDesignProblemRecord[]> {
  const payload = await authedRequest<{ problems: SystemDesignProblemRecord[] }>("/api/admin/system-design-problems", {
    method: "GET"
  });
  return payload.problems;
}

export async function saveOneSystemDesignProblem(
  payload: SystemDesignProblemSourceInput
): Promise<SystemDesignProblemRecord> {
  const result = await authedRequest<{ problem: SystemDesignProblemRecord }>("/api/admin/system-design-problems", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return result.problem;
}
