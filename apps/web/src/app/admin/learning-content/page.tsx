"use client";

/**
 * Admin-only tool for authoring Learning Center categories - each one becomes a track alongside the two built-in
 * ones (Computer Science, AI) once active (see lib/learning/admin-content.ts and api/learning/library/route.ts).
 * Structure mirrors what already exists: Category -> Subtopics -> Topics, each with its own active/inactive
 * toggle so content can be drafted and hidden from the public before it's ready, or pulled back later without
 * deleting it. Only requires the Firebase Admin SSDK-gated /api/admin/learning-content routes - no direct
 * Firestore access from the browser, same pattern as every other admin tool.
 */

import { Loader2, PenSquare, PlusCircle, ShieldAlert, Trash2, UploadCloud, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsAdmin } from "@/lib/firebase/user-profile";
import type { AdminLearningCategory } from "@/lib/learning/admin-content";
import {
  buildPayloadFromForm,
  categoryToForm,
  emptyCategoryForm,
  emptySubtopic,
  emptyTopic,
  fetchAllCategories,
  saveCategory,
  uploadFigureImage,
  type CategoryForm,
  type SubtopicForm,
  type TopicForm
} from "./shared";

export default function AdminLearningContentPage() {
  const { isAdmin, loading } = useIsAdmin();

  const [categories, setCategories] = useState<AdminLearningCategory[] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [form, setForm] = useState<CategoryForm>(() => emptyCategoryForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setCategories(await fetchAllCategories());
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load categories.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void fetchCategories();
    }
  }, [isAdmin, fetchCategories]);

  const handleSubmit = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(null);
    let payload: ReturnType<typeof buildPayloadFromForm>;
    try {
      payload = buildPayloadFromForm(form);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Invalid input.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveCategory(payload);
      setSaveSuccess(`Saved "${result.title}" (${result.active ? "visible to everyone" : "hidden - inactive"}).`);
      void fetchCategories();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this category.");
    } finally {
      setSaving(false);
    }
  }, [form, fetchCategories]);

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
                This tool is only available to accounts with <code>admin: true</code> (or the local <code>non_admin: true</code>{" "}
                development escape hatch) set on their CareerOS user document.
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
            <h2>Add Learning Content</h2>
            <p>
              Build a new category (Computer Science / AI are already built in - this is for anything else). Each level -
              category, subtopic, topic - has its own active toggle: switch it off to keep drafting without showing it to
              anyone but admins. Saved categories show up in the Learning Center for every signed-in user immediately once
              active, on both web and the phone app - no redeploy needed.
            </p>
          </div>
          <Wrench size={18} />
        </div>
      </section>

      <div className="admin-coding-shell">
        <section className="career-card admin-coding-list">
          <div className="card-header">
            <div>
              <p className="eyebrow">Categories</p>
              <h2>{categories?.length ?? 0} total</h2>
            </div>
            <button className="ghost-button" onClick={() => setForm(emptyCategoryForm())} type="button">
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
          ) : !categories || categories.length === 0 ? (
            <div className="empty-drop">No admin-added categories yet.</div>
          ) : (
            categories.map((category) => (
              <button
                className="admin-coding-list-item"
                key={category.id}
                onClick={() => {
                  setForm(categoryToForm(category));
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
                style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer" }}
                type="button"
              >
                <strong>
                  {category.title} <PenSquare size={12} />
                  {!category.active ? " (inactive)" : ""}
                </strong>
                <span>
                  {category.id} - {category.subtopics.length} subtopics -{" "}
                  {category.subtopics.reduce((sum, s) => sum + s.topics.length, 0)} topics
                </span>
              </button>
            ))
          )}
        </section>

        <section className="career-card">
          <CategoryFieldForm form={form} onChange={setForm} />

          <div className="admin-coding-actions" style={{ marginTop: 16 }}>
            <button className="primary-button" disabled={saving} onClick={() => void handleSubmit()} type="button">
              {saving ? <Loader2 className="spin" size={14} /> : null}
              Save Category
            </button>
            {saveError ? <div className="admin-coding-notice error">{saveError}</div> : null}
            {saveSuccess ? <div className="admin-coding-notice success">{saveSuccess}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function CategoryFieldForm({ form, onChange }: { form: CategoryForm; onChange: (updater: (current: CategoryForm) => CategoryForm) => void }) {
  return (
    <div className="admin-coding-form">
      <div className="admin-coding-field-grid">
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Id (optional, auto-generated from title)</span>
          <input onChange={(e) => onChange((c) => ({ ...c, id: e.target.value }))} type="text" value={form.id} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Title</span>
          <input onChange={(e) => onChange((c) => ({ ...c, title: e.target.value }))} type="text" value={form.title} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Subtitle</span>
          <input onChange={(e) => onChange((c) => ({ ...c, subtitle: e.target.value }))} type="text" value={form.subtitle} />
        </div>
        <div className="admin-coding-field">
          <label className="admin-coding-field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input checked={form.active} onChange={(e) => onChange((c) => ({ ...c, active: e.target.checked }))} type="checkbox" />
            Active (visible to everyone - uncheck to hide from the public)
          </label>
        </div>
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Description</span>
        <textarea onChange={(e) => onChange((c) => ({ ...c, description: e.target.value }))} rows={2} value={form.description} />
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Subtopics</span>
        <div className="admin-coding-array-list">
          {form.subtopics.map((subtopic, subtopicIndex) => (
            <SubtopicFieldForm
              key={subtopicIndex}
              categoryId={form.id || form.title}
              subtopic={subtopic}
              onChange={(updater) =>
                onChange((c) => ({ ...c, subtopics: c.subtopics.map((s, i) => (i === subtopicIndex ? updater(s) : s)) }))
              }
              onRemove={form.subtopics.length > 1 ? () => onChange((c) => ({ ...c, subtopics: c.subtopics.filter((_, i) => i !== subtopicIndex) })) : undefined}
            />
          ))}
        </div>
        <button className="ghost-button" onClick={() => onChange((c) => ({ ...c, subtopics: [...c.subtopics, emptySubtopic()] }))} type="button">
          <PlusCircle size={13} />
          Add subtopic
        </button>
      </div>
    </div>
  );
}

function SubtopicFieldForm({
  categoryId,
  subtopic,
  onChange,
  onRemove
}: {
  categoryId: string;
  subtopic: SubtopicForm;
  onChange: (updater: (current: SubtopicForm) => SubtopicForm) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="admin-coding-array-row">
      <div className="admin-coding-field-grid">
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Subtopic title</span>
          <input onChange={(e) => onChange((s) => ({ ...s, title: e.target.value }))} type="text" value={subtopic.title} />
        </div>
        <div className="admin-coding-field">
          <label className="admin-coding-field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input checked={subtopic.active} onChange={(e) => onChange((s) => ({ ...s, active: e.target.checked }))} type="checkbox" />
            Active
          </label>
        </div>
      </div>
      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Overview</span>
        <textarea onChange={(e) => onChange((s) => ({ ...s, overview: e.target.value }))} rows={2} value={subtopic.overview} />
      </div>
      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Capstone tasks (one per line, optional)</span>
        <textarea onChange={(e) => onChange((s) => ({ ...s, capstoneTasksText: e.target.value }))} rows={2} value={subtopic.capstoneTasksText} />
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Topics</span>
        <div className="admin-coding-array-list">
          {subtopic.topics.map((topic, topicIndex) => (
            <TopicFieldForm
              key={topicIndex}
              categoryId={categoryId}
              topic={topic}
              onChange={(updater) => onChange((s) => ({ ...s, topics: s.topics.map((t, i) => (i === topicIndex ? updater(t) : t)) }))}
              onRemove={subtopic.topics.length > 1 ? () => onChange((s) => ({ ...s, topics: s.topics.filter((_, i) => i !== topicIndex) })) : undefined}
            />
          ))}
        </div>
        <button className="ghost-button" onClick={() => onChange((s) => ({ ...s, topics: [...s.topics, emptyTopic()] }))} type="button">
          <PlusCircle size={13} />
          Add topic
        </button>
      </div>

      {onRemove ? (
        <button className="admin-coding-array-remove" onClick={onRemove} type="button">
          <Trash2 size={12} />
        </button>
      ) : null}
    </div>
  );
}

function TopicFieldForm({
  categoryId,
  topic,
  onChange,
  onRemove
}: {
  categoryId: string;
  topic: TopicForm;
  onChange: (updater: (current: TopicForm) => TopicForm) => void;
  onRemove?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { key, previewUrl } = await uploadFigureImage(categoryId || "uncategorized", file);
      onChange((t) => ({ ...t, figures: [...t.figures, { id: "", r2Key: key, previewUrl, caption: "", description: "" }] }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-coding-array-row">
      <input accept="image/*" hidden onChange={(e) => void handleUpload(e)} ref={fileInputRef} type="file" />
      <div className="admin-coding-field-grid">
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Topic title</span>
          <input onChange={(e) => onChange((t) => ({ ...t, title: e.target.value }))} type="text" value={topic.title} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Difficulty</span>
          <select onChange={(e) => onChange((t) => ({ ...t, difficulty: e.target.value }))} value={topic.difficulty}>
            {["beginner", "intermediate", "advanced"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-coding-field">
          <label className="admin-coding-field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input checked={topic.active} onChange={(e) => onChange((t) => ({ ...t, active: e.target.checked }))} type="checkbox" />
            Active
          </label>
        </div>
      </div>
      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Focus keywords (comma-separated)</span>
        <input onChange={(e) => onChange((t) => ({ ...t, focusKeywordsText: e.target.value }))} type="text" value={topic.focusKeywordsText} />
      </div>
      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Reading paragraphs / descriptions (blank line between paragraphs)</span>
        <textarea
          className="mono"
          onChange={(e) => onChange((t) => ({ ...t, readingParagraphsText: e.target.value }))}
          rows={6}
          value={topic.readingParagraphsText}
        />
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Figures</span>
        {topic.figures.map((figure, figureIndex) => (
          <div className="admin-coding-array-row" key={figureIndex}>
            {figure.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={figure.caption || "preview"} src={figure.previewUrl} style={{ maxWidth: 160, borderRadius: 6 }} />
            ) : (
              <span className="admin-coding-notice">{figure.r2Key}</span>
            )}
            <input
              onChange={(e) =>
                onChange((t) => ({ ...t, figures: t.figures.map((f, i) => (i === figureIndex ? { ...f, caption: e.target.value } : f)) }))
              }
              placeholder="Caption"
              type="text"
              value={figure.caption}
            />
            <button
              className="admin-coding-array-remove"
              onClick={() => onChange((t) => ({ ...t, figures: t.figures.filter((_, i) => i !== figureIndex) }))}
              type="button"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button className="ghost-button" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
          {uploading ? <Loader2 className="spin" size={13} /> : <UploadCloud size={13} />}
          Upload image
        </button>
        {uploadError ? <div className="admin-coding-notice error">{uploadError}</div> : null}
      </div>

      {onRemove ? (
        <button className="admin-coding-array-remove" onClick={onRemove} type="button">
          <Trash2 size={12} />
        </button>
      ) : null}
    </div>
  );
}
