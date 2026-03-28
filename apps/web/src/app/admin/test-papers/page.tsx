"use client";

/**
 * Admin-only tool for browsing, creating, and bulk-importing aptitude / computer-science / AI technical test
 * papers. Mirrors apps/web/src/app/admin/coding-problems/page.tsx exactly (same list/form/json/bulk structure),
 * adapted for a test paper made of many MCQ questions instead of one coding problem.
 *
 * Gated both here (UI, via useIsAdmin) and, more importantly, server-side by /api/admin/test-papers (requireAdmin
 * re-checks the Firestore users/{uid}.admin flag on every request - this page's client-side check is convenience
 * only, never the real security boundary).
 *
 * Why this exists: aptitude, computer-science, and AI technical questions were previously only addable by editing
 * source files and redeploying (see lib/interview/question-bank.ts, computer-science-bank.ts, ai-role-bank.ts).
 * Papers saved here go to the `customTestPapers` Firestore collection instead and are merged into
 * /api/interview/templates* alongside the compiled banks - both web and mobile pick them up immediately, no
 * redeploy needed. System Design and Coding already had this treatment (their own admin pages) before this one.
 */

import { Loader2, PenSquare, PlusCircle, ShieldAlert, UploadCloud, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/firebase/user-profile";
import type { CustomTestPaperInput, CustomTestPaperRecord } from "@/lib/interview/custom-test-papers";
import TestPaperFieldForm from "./TestPaperFieldForm";
import { TRACK_LABELS, buildPayloadFromForm, emptyForm, fetchAllTestPapers, saveOneTestPaper, type FormState } from "./shared";

const LIST_PAGE_SIZE = 10;

type EditorMode = "form" | "json" | "bulk";

const EXAMPLE_JSON = JSON.stringify(
  {
    testType: "aptitude",
    title: "Aptitude Practice Set 1",
    questions: [
      {
        category: "Quantitative Aptitude",
        prompt: "A train travels 120 km in 2 hours. What is its average speed?",
        options: ["40 km/h", "50 km/h", "60 km/h", "70 km/h"],
        correctOptionIndex: 2,
        explanation: "Average speed = distance / time = 120 / 2 = 60 km/h.",
        difficulty: "easy"
      }
    ]
  },
  null,
  2
);

export default function AdminTestPapersPage() {
  const { isAdmin, loading } = useIsAdmin();

  const [papers, setPapers] = useState<CustomTestPaperRecord[] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);

  const [mode, setMode] = useState<EditorMode>("form");
  const [jsonText, setJsonText] = useState("");
  const [form, setForm] = useState<FormState>(() => emptyForm());

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [bulkJsonText, setBulkJsonText] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const fetchPapers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setPapers(await fetchAllTestPapers());
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load test papers.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchPapers();
    }
  }, [isAdmin, fetchPapers]);

  const totalListPages = Math.max(1, Math.ceil((papers?.length ?? 0) / LIST_PAGE_SIZE));
  const activeListPage = Math.min(listPage, totalListPages);
  const paginatedPapers = useMemo(() => {
    const start = (activeListPage - 1) * LIST_PAGE_SIZE;
    return (papers ?? []).slice(start, start + LIST_PAGE_SIZE);
  }, [activeListPage, papers]);

  const handleNew = useCallback(() => {
    setSaveError(null);
    setSaveSuccess(null);
    setForm(emptyForm());
    setJsonText(EXAMPLE_JSON);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(null);

    let payload: CustomTestPaperInput;
    try {
      payload = mode === "json" ? (JSON.parse(jsonText) as CustomTestPaperInput) : buildPayloadFromForm(form);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Invalid input.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveOneTestPaper(payload);
      setSaveSuccess(`Saved "${result.title}" (${result.questions.length} questions) to ${TRACK_LABELS[result.testType]}.`);
      void fetchPapers();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this test paper.");
    } finally {
      setSaving(false);
    }
  }, [mode, jsonText, form, fetchPapers]);

  const handleBulkImport = useCallback(async () => {
    setBulkErrors([]);
    setBulkSuccess(null);

    let entries: CustomTestPaperInput[];
    try {
      const parsed = JSON.parse(bulkJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("Expected a JSON array of test papers.");
      }
      entries = parsed as CustomTestPaperInput[];
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
        await saveOneTestPaper(entry);
      } catch (error) {
        errors.push(`${entry?.title ?? "(missing title)"}: ${error instanceof Error ? error.message : "Unable to save."}`);
      }
      done += 1;
      setBulkProgress({ done, total: entries.length });
    }

    setBulkErrors(errors);
    setBulkSuccess(`Imported ${done - errors.length} / ${done} test papers.`);
    setBulkRunning(false);
    void fetchPapers();
  }, [bulkJsonText, fetchPapers]);

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
                This tool is only available to accounts with <code>admin: true</code> set on their CareerOS user
                document. If you believe this is a mistake, ask whoever manages the Firebase project to grant you
                access.
              </p>
            </div>
            <ShieldAlert size={18} />
          </div>
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
            <h2>Add Test Paper</h2>
            <p>
              Add MCQ test papers for Aptitude, Computer Science, or AI Technical - fill in the fields below, paste
              a single test paper JSON, or bulk import a JSON array. Saved papers show up immediately in the
              Interview War Room on both web and mobile, listed alongside the built-in question banks - no redeploy
              needed. Click a paper in the list to see its id, used as the JSON <code>id</code> field to edit it
              again later (re-saving with the same id overwrites it).
            </p>
          </div>
          <Wrench size={18} />
        </div>
      </section>

      <div className="admin-coding-shell">
        <section className="career-card admin-coding-list">
          <div className="card-header">
            <div>
              <p className="eyebrow">Test papers</p>
              <h2>{papers?.length ?? 0} total</h2>
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
          ) : !papers || papers.length === 0 ? (
            <div className="empty-drop">No test papers yet. Add your first one, or use Bulk Import.</div>
          ) : (
            <>
              {paginatedPapers.map((record) => (
                <div className="admin-coding-list-item" key={record.id}>
                  <strong>
                    {record.title} <PenSquare size={12} />
                  </strong>
                  <span>
                    {record.id} - {TRACK_LABELS[record.testType]}
                    {record.roleName ? ` (${record.roleName})` : ""} - {record.questions.length} questions
                  </span>
                </div>
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
              aria-selected={mode === "form"}
              className={`admin-coding-tab${mode === "form" ? " active" : ""}`}
              onClick={() => setMode("form")}
              role="tab"
              type="button"
            >
              Field-by-field
            </button>
            <button
              aria-selected={mode === "json"}
              className={`admin-coding-tab${mode === "json" ? " active" : ""}`}
              onClick={() => setMode("json")}
              role="tab"
              type="button"
            >
              Paste JSON
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

          {mode === "bulk" ? (
            <div className="admin-coding-form">
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">
                  Paste a JSON array of test papers (each shaped like the single Paste JSON example). Each entry is
                  saved one at a time via the same endpoint as the single-paper editor.
                </span>
                <textarea
                  className="mono admin-coding-json"
                  onChange={(event) => setBulkJsonText(event.target.value)}
                  placeholder="[ { ...test paper 1... }, { ...test paper 2... } ]"
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
          ) : mode === "json" ? (
            <div className="admin-coding-form">
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Test paper JSON</span>
                <textarea
                  className="mono admin-coding-json"
                  onChange={(event) => setJsonText(event.target.value)}
                  rows={26}
                  value={jsonText}
                />
              </div>
            </div>
          ) : (
            <TestPaperFieldForm form={form} onChange={setForm} />
          )}

          {mode !== "bulk" ? (
            <div className="admin-coding-actions" style={{ marginTop: 16 }}>
              <button className="primary-button" disabled={saving} onClick={() => void handleSubmit()} type="button">
                {saving ? <Loader2 className="spin" size={14} /> : null}
                Save Test Paper
              </button>
              {saveError ? <div className="admin-coding-notice error">{saveError}</div> : null}
              {saveSuccess ? <div className="admin-coding-notice success">{saveSuccess}</div> : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
