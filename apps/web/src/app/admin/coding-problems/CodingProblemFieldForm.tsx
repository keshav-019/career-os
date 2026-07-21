"use client";

/**
 * The field-by-field editor for one coding problem - shared by the main admin list page's "New" flow and the
 * dedicated per-problem edit screen ([id]/page.tsx), so this ~350-line form only exists in one place. Owns its
 * own image-upload state internally (Cloudinary insert-into-statement) so callers only need to pass `form`/`onChange`.
 */

import { Loader2, PlusCircle, Trash2, UploadCloud } from "lucide-react";
import { type ChangeEvent, useCallback, useRef, useState } from "react";
import StatementWithImages from "@/components/StatementWithImages";
import { uploadImageToCloudinary } from "@/lib/cloudinary/upload-image";
import { buildStatementImageMarker } from "@/lib/coding-catalog/statement-images";
import type { CodingDifficulty, CodingOutputKind, CodingParamSpecEntry, CodingParamType } from "@/lib/coding-catalog/types";
import { DIFFICULTIES, OUTPUT_KINDS, PARAM_TYPES, type ExampleRow, type FormState } from "./shared";

type Props = {
  form: FormState;
  onChange: (updater: (current: FormState) => FormState) => void;
};

export default function CodingProblemFieldForm({ form, onChange }: Props) {
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lastMarker, setLastMarker] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const statementRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleUploadImage = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setImageUploading(true);
      setImageError(null);
      try {
        const url = await uploadImageToCloudinary(file);
        const marker = buildStatementImageMarker(url);
        setLastMarker(marker);

        const textarea = statementRef.current;
        const currentStatement = form.statement;
        const start = textarea?.selectionStart ?? currentStatement.length;
        const end = textarea?.selectionEnd ?? currentStatement.length;
        const nextStatement = `${currentStatement.slice(0, start)}${marker}${currentStatement.slice(end)}`;
        onChange((current) => ({ ...current, statement: nextStatement }));

        requestAnimationFrame(() => {
          if (!textarea) return;
          textarea.focus();
          const cursor = start + marker.length;
          textarea.setSelectionRange(cursor, cursor);
        });
      } catch (error) {
        setImageError(error instanceof Error ? error.message : "Image upload failed.");
      } finally {
        setImageUploading(false);
      }
    },
    [form.statement, onChange]
  );

  const updateParamSpecRow = (index: number, patch: Partial<CodingParamSpecEntry>) => {
    onChange((current) => ({
      ...current,
      paramSpec: current.paramSpec.map((row, i) => (i === index ? { ...row, ...patch } : row))
    }));
  };

  const updateExampleRow = (index: number, patch: Partial<ExampleRow>) => {
    onChange((current) => ({
      ...current,
      examples: current.examples.map((row, i) => (i === index ? { ...row, ...patch } : row))
    }));
  };

  return (
    <div className="admin-coding-form">
      <input accept="image/*" hidden onChange={(event) => void handleUploadImage(event)} ref={imageInputRef} type="file" />

      <div className="admin-coding-field-grid">
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">ID (lowercase, hyphens)</span>
          <input onChange={(event) => onChange((c) => ({ ...c, id: event.target.value }))} type="text" value={form.id} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Title</span>
          <input onChange={(event) => onChange((c) => ({ ...c, title: event.target.value }))} type="text" value={form.title} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Difficulty</span>
          <select
            onChange={(event) => onChange((c) => ({ ...c, difficulty: event.target.value as CodingDifficulty }))}
            value={form.difficulty}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Output kind</span>
          <select
            onChange={(event) => onChange((c) => ({ ...c, outputKind: event.target.value as CodingOutputKind }))}
            value={form.outputKind}
          >
            {OUTPUT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Companies (comma-separated)</span>
          <input
            onChange={(event) => onChange((c) => ({ ...c, companiesText: event.target.value }))}
            type="text"
            value={form.companiesText}
          />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Tags (comma-separated)</span>
          <input onChange={(event) => onChange((c) => ({ ...c, tagsText: event.target.value }))} type="text" value={form.tagsText} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Time limit per test case (ms)</span>
          <input
            min={500}
            max={30000}
            onChange={(event) => onChange((c) => ({ ...c, timeLimitMsText: event.target.value }))}
            type="number"
            value={form.timeLimitMsText}
          />
        </div>
      </div>

      <div className="admin-coding-statement-row">
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Statement</span>
          <textarea
            onChange={(event) => onChange((c) => ({ ...c, statement: event.target.value }))}
            ref={statementRef}
            rows={12}
            value={form.statement}
          />
          <button className="ghost-button" onClick={() => setShowPreview((v) => !v)} type="button">
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
          {showPreview ? (
            <div className="empty-drop">
              <StatementWithImages statement={form.statement} />
            </div>
          ) : null}
        </div>

        <div className="admin-coding-image-panel">
          <p>Place your cursor in the statement, then insert an image there. It uploads to Cloudinary automatically.</p>
          <button
            className="ghost-button"
            disabled={imageUploading}
            onClick={() => imageInputRef.current?.click()}
            type="button"
          >
            {imageUploading ? <Loader2 className="spin" size={13} /> : <UploadCloud size={13} />}
            Insert Image
          </button>
          {lastMarker ? (
            <div className="admin-coding-notice">
              Last marker: <code>{lastMarker}</code>
            </div>
          ) : null}
          {imageError ? <div className="admin-coding-notice error">{imageError}</div> : null}
        </div>
      </div>

      <div className="admin-coding-field-grid">
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Input format</span>
          <textarea onChange={(event) => onChange((c) => ({ ...c, inputFormat: event.target.value }))} rows={3} value={form.inputFormat} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Output format</span>
          <textarea
            onChange={(event) => onChange((c) => ({ ...c, outputFormat: event.target.value }))}
            rows={3}
            value={form.outputFormat}
          />
        </div>
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Constraints (one per line)</span>
        <textarea
          onChange={(event) => onChange((c) => ({ ...c, constraintsText: event.target.value }))}
          rows={3}
          value={form.constraintsText}
        />
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Param spec - names must match the keys you use in Test Cases below</span>
        <div className="admin-coding-array-list">
          {form.paramSpec.map((row, index) => (
            <div className="admin-coding-array-row" key={index}>
              <div className="admin-coding-field-grid">
                <div className="admin-coding-field">
                  <span className="admin-coding-field-label">Name</span>
                  <input onChange={(event) => updateParamSpecRow(index, { name: event.target.value })} type="text" value={row.name} />
                </div>
                <div className="admin-coding-field">
                  <span className="admin-coding-field-label">Type</span>
                  <select
                    onChange={(event) => updateParamSpecRow(index, { type: event.target.value as CodingParamType })}
                    value={row.type}
                  >
                    {PARAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {form.paramSpec.length > 1 ? (
                <button
                  className="admin-coding-array-remove"
                  onClick={() => onChange((c) => ({ ...c, paramSpec: c.paramSpec.filter((_, i) => i !== index) }))}
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          className="ghost-button"
          onClick={() => onChange((c) => ({ ...c, paramSpec: [...c.paramSpec, { name: "", type: "int" }] }))}
          type="button"
        >
          <PlusCircle size={13} />
          Add param
        </button>
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Worked examples</span>
        <div className="admin-coding-array-list">
          {form.examples.map((row, index) => (
            <div className="admin-coding-array-row" key={index}>
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Input (matches a visible test case's serialized stdin)</span>
                <textarea onChange={(event) => updateExampleRow(index, { input: event.target.value })} rows={2} value={row.input} />
              </div>
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Output</span>
                <textarea onChange={(event) => updateExampleRow(index, { output: event.target.value })} rows={1} value={row.output} />
              </div>
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Explanation (optional)</span>
                <textarea
                  onChange={(event) => updateExampleRow(index, { explanation: event.target.value })}
                  rows={2}
                  value={row.explanation}
                />
              </div>
              {form.examples.length > 1 ? (
                <button
                  className="admin-coding-array-remove"
                  onClick={() => onChange((c) => ({ ...c, examples: c.examples.filter((_, i) => i !== index) }))}
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          className="ghost-button"
          onClick={() => onChange((c) => ({ ...c, examples: [...c.examples, { input: "", output: "", explanation: "" }] }))}
          type="button"
        >
          <PlusCircle size={13} />
          Add example
        </button>
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">
          Reference solution (JS function body, only used once at save time to compute expected output for every test
          case - never stored as &quot;the solution&quot;)
        </span>
        <textarea
          className="mono"
          onChange={(event) => onChange((c) => ({ ...c, referenceBody: event.target.value }))}
          rows={8}
          value={form.referenceBody}
        />
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">
          Test cases (JSON array of {"{ values, visible }"}, values keyed by the param names above - hidden test
          cases are the ones with <code>visible: false</code>)
        </span>
        <textarea
          className="mono admin-coding-json"
          onChange={(event) => onChange((c) => ({ ...c, testCasesJson: event.target.value }))}
          rows={10}
          value={form.testCasesJson}
        />
      </div>
    </div>
  );
}
