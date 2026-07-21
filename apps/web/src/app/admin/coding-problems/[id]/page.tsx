"use client";

/**
 * Dedicated screen for editing exactly ONE existing coding problem - reached via the "Edit" link on each row of
 * the main /admin/coding-problems list. Full field access: hidden vs. visible test cases, worked examples,
 * per-problem time limit, statement images, everything the create flow on the main page can set. Paste JSON is
 * also available here for a quick raw-JSON edit.
 *
 * Loads the record by re-fetching the full admin list and finding this id in it (there's no single-problem admin
 * GET route - the list is small and already fully returned by /api/admin/coding-problems, so this avoids adding a
 * new API route just for this).
 */

import { ArrowLeft, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/firebase/user-profile";
import type { CodingProblemRecord, CodingProblemSourceInput } from "@/lib/coding-catalog/types";
import CodingProblemFieldForm from "../CodingProblemFieldForm";
import {
  buildPayloadFromForm,
  emptyForm,
  fetchAllCodingProblems,
  saveOneCodingProblem,
  sourceToForm,
  type FormState
} from "../shared";

type EditorMode = "form" | "json";

export default function EditCodingProblemPage() {
  const { isAdmin, loading } = useIsAdmin();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const problemId = params.id;

  const [record, setRecord] = useState<CodingProblemRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const [mode, setMode] = useState<EditorMode>("form");
  const [jsonText, setJsonText] = useState("");
  const [form, setForm] = useState<FormState>(() => emptyForm());

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadRecord = useCallback(async () => {
    setLoadingRecord(true);
    setLoadError(null);
    try {
      const all = await fetchAllCodingProblems();
      const found = all.find((p) => p.id === problemId);
      if (!found) {
        setLoadError(`No problem with id "${problemId}" was found.`);
        setRecord(null);
        return;
      }
      setRecord(found);
      setJsonText(found.sourceJson);
      try {
        setForm(sourceToForm(JSON.parse(found.sourceJson) as CodingProblemSourceInput));
      } catch {
        setForm(emptyForm());
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load this problem.");
    } finally {
      setLoadingRecord(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (isAdmin) {
      void loadRecord();
    }
  }, [isAdmin, loadRecord]);

  const handleSave = useCallback(async () => {
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
      const saved = await saveOneCodingProblem(payload);
      setRecord(saved);
      setJsonText(saved.sourceJson);
      setSaveSuccess(`Saved "${saved.title}".`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this problem.");
    } finally {
      setSaving(false);
    }
  }, [mode, jsonText, form]);

  if (loading || loadingRecord) {
    return (
      <div className="page-stack">
        <section className="career-card">
          <div className="empty-drop">
            <Loader2 className="spin" size={16} />
            Loading...
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

  if (loadError || !record) {
    return (
      <div className="page-stack">
        <section className="career-card highlight">
          <div className="card-header">
            <div>
              <p className="eyebrow">Coding Problem</p>
              <h2>Not found</h2>
              <p>{loadError}</p>
            </div>
            <Trash2 size={18} />
          </div>
          <Link className="ghost-button" href="/admin/coding-problems">
            <ArrowLeft size={14} />
            Back to list
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
            <p className="eyebrow">Admin - Editing</p>
            <h2>{record.title}</h2>
            <p>
              {record.id} - {record.difficulty}. Changes save back to this same problem (same id).
            </p>
          </div>
          <Link className="ghost-button" href="/admin/coding-problems">
            <ArrowLeft size={14} />
            Back to list
          </Link>
        </div>
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
        </div>

        {mode === "json" ? (
          <div className="admin-coding-form">
            <div className="admin-coding-field">
              <span className="admin-coding-field-label">Problem JSON</span>
              <textarea
                className="mono admin-coding-json"
                onChange={(event) => setJsonText(event.target.value)}
                rows={30}
                value={jsonText}
              />
            </div>
          </div>
        ) : (
          <CodingProblemFieldForm form={form} onChange={setForm} />
        )}

        <div className="admin-coding-actions" style={{ marginTop: 16 }}>
          <button className="primary-button" disabled={saving} onClick={() => void handleSave()} type="button">
            {saving ? <Loader2 className="spin" size={14} /> : null}
            Save Changes
          </button>
          <button className="ghost-button" onClick={() => router.push("/admin/coding-problems")} type="button">
            Done
          </button>
          {saveError ? <div className="admin-coding-notice error">{saveError}</div> : null}
          {saveSuccess ? <div className="admin-coding-notice success">{saveSuccess}</div> : null}
        </div>
      </section>
    </div>
  );
}
