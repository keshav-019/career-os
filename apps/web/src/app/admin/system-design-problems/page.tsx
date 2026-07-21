"use client";

/**
 * Admin-only tool for adding/editing system-design problems. Gated both here (UI, via useIsAdmin)
 * and, more importantly, server-side by /api/admin/system-design-problems (requireAdmin re-checks
 * the Firestore users/{uid}.admin flag - or the non_admin local-dev escape hatch - on every
 * request; this page's client-side check is convenience only).
 *
 * Unlike the coding-problems admin page, this is Paste JSON only - no field-by-field mode. The
 * schema here (a top-down component tree, node-tied tradeoffs, estimation tolerances, failure-quiz
 * answer keys) is too interconnected to safely decompose into individual form fields without a much
 * heavier custom tree-editor - see lib/system-design/README.md's "Adding a new problem" section for
 * the full authoring rules a pasted problem must follow. Every problem submitted here is a full
 * `CatalogProblem` object (see @/lib/system-design/catalog.server).
 *
 * A "Bulk import" box is included specifically to make the one-time migration of the 26 problems
 * that used to be hardcoded in catalog.server.ts painless: paste the whole array from the root
 * system-design-problems.seed.json and it saves each entry in turn via the same single-problem
 * save endpoint this page's own editor uses.
 *
 * Editing an EXISTING problem happens on its own dedicated screen - [id]/page.tsx - reached via the
 * "Edit" link on each list item below (same pattern as the coding-problems admin page). This page
 * only covers browsing the list, creating a NEW problem, and bulk import.
 */

import { Loader2, PenSquare, PlusCircle, ShieldAlert, UploadCloud, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/firebase/user-profile";
import type { SystemDesignProblemRecord, SystemDesignProblemSourceInput } from "@/lib/system-design/catalog.server";
import { fetchAllSystemDesignProblems, saveOneSystemDesignProblem } from "./shared";

const LIST_PAGE_SIZE = 10;

const EXAMPLE_JSON = JSON.stringify(
  {
    id: "example-url-shortener",
    title: "Design a URL Shortener",
    difficulty: "easy",
    companies: ["Generic"],
    tags: ["Fundamentals"],
    summary: "Turn long URLs into short, shareable codes.",
    statement: "Design a service that takes a long URL and returns a short one that redirects back to it.",
    functionalRequirements: ["Users can submit a long URL and receive a short code.", "Visiting the short URL redirects to the original."],
    nonFunctionalRequirements: ["Redirects should be fast (sub-100ms).", "Codes must not collide."],
    rootComponentId: "client",
    nodes: [
      { id: "load_balancer", parentId: null, whyItFits: "Spreads incoming redirect traffic across app servers.", misplacedHint: "This sits directly in front of the app servers, right after the client." },
      { id: "web_server", parentId: "load_balancer", whyItFits: "Handles the redirect lookup and shortening requests.", misplacedHint: "This needs the load balancer in front of it to distribute traffic." },
      { id: "url_encoder", parentId: "web_server", whyItFits: "Generates the short, collision-free code for each submitted URL.", misplacedHint: "This is called by the app server while handling a shorten request." },
      { id: "sql_db", parentId: "web_server", whyItFits: "Stores the mapping from short code to original URL.", misplacedHint: "The app server reads/writes this directly." }
    ],
    distractorIds: ["message_queue", "search_index"],
    keyTakeaways: ["A simple read-heavy service can scale a long way with just a load balancer and a database.", "Short-code generation must avoid collisions at scale."]
  },
  null,
  2
);

type EditorMode = "edit" | "bulk";

export default function AdminSystemDesignProblemsPage() {
  const { isAdmin, loading } = useIsAdmin();

  const [problems, setProblems] = useState<SystemDesignProblemRecord[] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);

  const [mode, setMode] = useState<EditorMode>("edit");
  const [jsonText, setJsonText] = useState(EXAMPLE_JSON);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [bulkJsonText, setBulkJsonText] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const fetchProblems = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setProblems(await fetchAllSystemDesignProblems());
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load problems.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchProblems();
    }
  }, [isAdmin, fetchProblems]);

  const totalListPages = Math.max(1, Math.ceil((problems?.length ?? 0) / LIST_PAGE_SIZE));
  const activeListPage = Math.min(listPage, totalListPages);
  const paginatedProblems = useMemo(() => {
    const start = (activeListPage - 1) * LIST_PAGE_SIZE;
    return (problems ?? []).slice(start, start + LIST_PAGE_SIZE);
  }, [activeListPage, problems]);

  const handleNew = useCallback(() => {
    setSaveError(null);
    setSaveSuccess(null);
    setMode("edit");
    setJsonText(EXAMPLE_JSON);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(null);

    let payload: SystemDesignProblemSourceInput;
    try {
      payload = JSON.parse(jsonText) as SystemDesignProblemSourceInput;
    } catch {
      setSaveError("Invalid JSON.");
      return;
    }

    setSaving(true);
    try {
      const problem = await saveOneSystemDesignProblem(payload);
      setSaveSuccess(`Saved "${problem.title}". Find it in the list below to edit it further.`);
      void fetchProblems();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this problem.");
    } finally {
      setSaving(false);
    }
  }, [jsonText, fetchProblems]);

  const handleBulkImport = useCallback(async () => {
    setBulkErrors([]);
    setBulkSuccess(null);

    let entries: SystemDesignProblemSourceInput[];
    try {
      const parsed = JSON.parse(bulkJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("Expected a JSON array of problems.");
      }
      entries = parsed as SystemDesignProblemSourceInput[];
    } catch (error) {
      setBulkErrors([error instanceof Error ? error.message : "Invalid JSON array."]);
      return;
    }

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: entries.length });
    const errors: string[] = [];
    let done = 0;

    for (const entry of entries) {
      try {
        await saveOneSystemDesignProblem(entry);
      } catch (error) {
        errors.push(`${entry?.id ?? "(missing id)"}: ${error instanceof Error ? error.message : "Unable to save."}`);
      }
      done += 1;
      setBulkProgress({ done, total: entries.length });
    }

    setBulkErrors(errors);
    setBulkSuccess(`Imported ${done - errors.length} / ${done} problems.`);
    setBulkRunning(false);
    void fetchProblems();
  }, [bulkJsonText, fetchProblems]);

  if (loading) {
    return (
      <div className="page-stack">
        <section className="career-card">
          <div className="empty-drop">
            <Loader2 className="spin" size={16} />
            Checking admin access...
          </div>
        </section>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page-stack">
        <section className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">Restricted</p>
              <h2>Admin access required</h2>
              <p>
                This tool is only available to accounts with <code>admin: true</code> (or the local-dev{" "}
                <code>non_admin: true</code> escape hatch) set on their CareerOS user document.
              </p>
            </div>
            <ShieldAlert size={18} />
          </div>
          <Link className="ghost-button" href="/dashboard">
            Back to Dashboard
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="career-card highlight">
        <div className="card-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Add System Design Question</h2>
            <p>
              Paste a full problem JSON (a <code>CatalogProblem</code> - see{" "}
              <code>apps/web/src/lib/system-design/catalog.server.ts</code> for the exact shape and{" "}
              <code>lib/system-design/README.md</code>&apos;s &quot;Adding a new problem&quot; section for the
              authoring rules). Use Bulk Import below to migrate the 26 problems from the root{" "}
              <code>system-design-problems.seed.json</code> in one pass. Click a problem in the list to open its
              dedicated edit screen.
            </p>
          </div>
          <Wrench size={18} />
        </div>
      </section>

      <div className="admin-coding-shell">
        <section className="career-card admin-coding-list">
          <div className="card-header">
            <div>
              <p className="eyebrow">Problems</p>
              <h2>{problems?.length ?? 0} total</h2>
            </div>
            <button className="ghost-button" onClick={handleNew} type="button">
              <PlusCircle size={14} />
              New
            </button>
          </div>

          {listLoading ? (
            <div className="empty-drop">
              <Loader2 className="spin" size={16} /> Loading...
            </div>
          ) : listError ? (
            <div className="empty-drop coding-arena-error">{listError}</div>
          ) : !problems || problems.length === 0 ? (
            <div className="empty-drop">No problems yet. Add your first one, or use Bulk Import.</div>
          ) : (
            <>
              {paginatedProblems.map((record) => (
                <Link className="admin-coding-list-item" href={`/admin/system-design-problems/${record.id}`} key={record.id}>
                  <strong>
                    {record.title} <PenSquare size={12} />
                  </strong>
                  <span>
                    {record.id} - {record.difficulty}
                  </span>
                </Link>
              ))}

              {totalListPages > 1 ? (
                <div className="analytics-pagination">
                  <button
                    className="ghost-button"
                    disabled={activeListPage <= 1}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="analytics-page-indicator">
                    Page {activeListPage} / {totalListPages}
                  </span>
                  <button
                    className="ghost-button"
                    disabled={activeListPage >= totalListPages}
                    onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="career-card">
          <div className="admin-coding-tabs" role="tablist" aria-label="Editor mode">
            <button
              aria-selected={mode === "edit"}
              className={`admin-coding-tab${mode === "edit" ? " active" : ""}`}
              onClick={() => setMode("edit")}
              role="tab"
              type="button"
            >
              Add / Edit One
            </button>
            <button
              aria-selected={mode === "bulk"}
              className={`admin-coding-tab${mode === "bulk" ? " active" : ""}`}
              onClick={() => setMode("bulk")}
              role="tab"
              type="button"
            >
              Bulk Import
            </button>
          </div>

          {mode === "edit" ? (
            <div className="admin-coding-form">
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Problem JSON (CatalogProblem)</span>
                <textarea
                  className="mono admin-coding-json"
                  onChange={(event) => setJsonText(event.target.value)}
                  rows={30}
                  value={jsonText}
                />
              </div>

              <div className="admin-coding-actions" style={{ marginTop: 16 }}>
                <button className="primary-button" disabled={saving} onClick={() => void handleSubmit()} type="button">
                  {saving ? <Loader2 className="spin" size={14} /> : null}
                  Create Problem
                </button>
                {saveError ? <div className="admin-coding-notice error">{saveError}</div> : null}
                {saveSuccess ? <div className="admin-coding-notice success">{saveSuccess}</div> : null}
              </div>
            </div>
          ) : (
            <div className="admin-coding-form">
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">
                  Paste a JSON array of problems (e.g. the whole root system-design-problems.seed.json). Each entry
                  is saved one at a time via the same endpoint as the single-problem editor.
                </span>
                <textarea
                  className="mono admin-coding-json"
                  onChange={(event) => setBulkJsonText(event.target.value)}
                  placeholder="[ { ...problem 1... }, { ...problem 2... } ]"
                  rows={16}
                  value={bulkJsonText}
                />
              </div>

              <div className="admin-coding-actions" style={{ marginTop: 16 }}>
                <button className="primary-button" disabled={bulkRunning} onClick={() => void handleBulkImport()} type="button">
                  {bulkRunning ? <Loader2 className="spin" size={14} /> : <UploadCloud size={14} />}
                  Import All
                </button>
                {bulkProgress ? (
                  <div className="admin-coding-notice">
                    {bulkProgress.done} / {bulkProgress.total} processed
                  </div>
                ) : null}
                {bulkSuccess ? <div className="admin-coding-notice success">{bulkSuccess}</div> : null}
                {bulkErrors.length > 0 ? (
                  <div className="admin-coding-notice error">
                    {bulkErrors.length} failed:
                    <ul>
                      {bulkErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
