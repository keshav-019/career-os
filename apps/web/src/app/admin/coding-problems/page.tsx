"use client";

/**
 * Admin-only tool for browsing, creating, and bulk-importing coding problems. Gated both here (UI, via useIsAdmin)
 * and, more importantly, server-side by /api/admin/coding-problems (requireAdmin re-checks the Firestore
 * users/{uid}.admin flag on every request - this page's client-side check is convenience only, never the real
 * security boundary).
 *
 * Editing an EXISTING problem now happens on its own dedicated screen - [id]/page.tsx - reached via the "Edit"
 * link on each list item below. This page only covers:
 *   - Browsing the list (paginated, 10 per page).
 *   - Creating a NEW problem, either Paste JSON (a single problem object) or Field-by-field (the shared
 *     CodingProblemFieldForm component, also used by the edit screen).
 *   - Bulk Import - paste a JSON *array* of problems (e.g. the whole root /coding-problems.seed.json) and each
 *     entry is saved in turn via the same single-problem save endpoint, reporting per-entry success/failure. This
 *     is the mode to use for the seed file - pasting the array into the single-object "Paste JSON" box fails with
 *     "id must be lowercase letters..." because that box expects one problem object, not an array.
 */

import { Loader2, PenSquare, PlusCircle, ShieldAlert, UploadCloud, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/firebase/user-profile";
import type { CodingProblemRecord, CodingProblemSourceInput } from "@/lib/coding-catalog/types";
import CodingProblemFieldForm from "./CodingProblemFieldForm";
import { buildPayloadFromForm, emptyForm, fetchAllCodingProblems, saveOneCodingProblem, type FormState } from "./shared";

const LIST_PAGE_SIZE = 10;

type EditorMode = "form" | "json" | "bulk";

export default function AdminCodingProblemsPage() {
  const { isAdmin, loading } = useIsAdmin();

  const [problems, setProblems] = useState<CodingProblemRecord[] | null>(null);
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

  const fetchProblems = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setProblems(await fetchAllCodingProblems());
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
    setForm(emptyForm());
    setJsonText(
      JSON.stringify(
        {
          id: "two-sum",
          title: "Two Sum",
          difficulty: "medium",
          statement: "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
          inputFormat: "First line: the array. Second line: the target.",
          outputFormat: "Two indices, space-separated.",
          outputKind: "intArray",
          paramSpec: [
            { name: "nums", type: "intArray" },
            { name: "target", type: "int" }
          ],
          referenceBody: "function solve(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}",
          companies: ["Google"],
          tags: ["array", "hash-map"],
          constraints: ["2 <= nums.length <= 1e4"],
          examples: [{ input: "[2,7,11,15]\n9", output: "[0,1]" }],
          testCases: [
            { values: { nums: [2, 7, 11, 15], target: 9 }, visible: true },
            { values: { nums: [3, 2, 4], target: 6 }, visible: false }
          ],
          timeLimitMs: 5000
        },
        null,
        2
      )
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(null);

    let payload: CodingProblemSourceInput;
    try {
      payload = mode === "json" ? (JSON.parse(jsonText) as CodingProblemSourceInput) : buildPayloadFromForm(form);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Invalid input.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveOneCodingProblem(payload);
      setSaveSuccess(`Saved "${result.title}". Find it in the list below to edit it further.`);
      void fetchProblems();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this problem.");
    } finally {
      setSaving(false);
    }
  }, [mode, jsonText, form, fetchProblems]);

  const handleBulkImport = useCallback(async () => {
    setBulkErrors([]);
    setBulkSuccess(null);

    let entries: CodingProblemSourceInput[];
    try {
      const parsed = JSON.parse(bulkJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("Expected a JSON array of problems.");
      }
      entries = parsed as CodingProblemSourceInput[];
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
        await saveOneCodingProblem(entry);
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
                This tool is only available to accounts with <code>admin: true</code> set on their CareerOS user
                document. If you believe this is a mistake, ask whoever manages the Firebase project to grant you
                access.
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
            <h2>Add Coding Question</h2>
            <p>
              Paste a full problem JSON, or fill in the fields below. Saving generates the per-language starter code
              and hidden test harness automatically, then runs your reference solution once to compute expected
              output for every test case. Click a problem in the list to open its dedicated edit screen. See{" "}
              <code>apps/web/src/lib/coding-catalog/README.md</code> for the full pipeline, and the root{" "}
              <code>coding-problems.seed.json</code> for pasteable examples.
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
                <Link className="admin-coding-list-item" href={`/admin/coding-problems/${record.id}`} key={record.id}>
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
                  Paste a JSON array of problems (e.g. the whole root coding-problems.seed.json). Each entry is
                  saved one at a time via the same endpoint as the single-problem editor.
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
          ) : mode === "json" ? (
            <div className="admin-coding-form">
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Problem JSON</span>
                <textarea
                  className="mono admin-coding-json"
                  onChange={(event) => setJsonText(event.target.value)}
                  rows={26}
                  value={jsonText}
                />
              </div>
            </div>
          ) : (
            <CodingProblemFieldForm form={form} onChange={setForm} />
          )}

          {mode !== "bulk" ? (
            <div className="admin-coding-actions" style={{ marginTop: 16 }}>
              <button className="primary-button" disabled={saving} onClick={() => void handleSubmit()} type="button">
                {saving ? <Loader2 className="spin" size={14} /> : null}
                Create Problem
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
