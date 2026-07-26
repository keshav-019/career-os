"use client";

/**
 * The field-by-field editor for one test paper (aptitude / computer-science / AI technical) - mirrors
 * apps/web/src/app/admin/coding-problems/CodingProblemFieldForm.tsx's structure, adapted for a paper made of many
 * MCQ questions instead of a single coding problem.
 */

import { PlusCircle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAiInterviewRoles } from "@/lib/interview/client";
import type { AiInterviewRole } from "@/lib/interview/question-bank";
import { DIFFICULTIES, TRACK_LABELS, emptyQuestionRow, type FormState, type QuestionRow, type TestPaperTrack } from "./shared";

type Props = {
  form: FormState;
  onChange: (updater: (current: FormState) => FormState) => void;
};

export default function TestPaperFieldForm({ form, onChange }: Props) {
  // AI role list used to come from a synchronous listAiInterviewRoles() call - that function now lazily loads its
  // data from R2 with real bucket credentials, server-side only, so it's fetched via /api/interview/ai-roles
  // instead (see lib/interview/client.ts's fetchAiInterviewRoles()).
  const [aiRoles, setAiRoles] = useState<AiInterviewRole[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAiInterviewRoles()
      .then((roles) => {
        if (!cancelled) setAiRoles(roles);
      })
      .catch(() => {
        if (!cancelled) setAiRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateQuestionRow = (index: number, patch: Partial<QuestionRow>) => {
    onChange((current) => ({
      ...current,
      questions: current.questions.map((row, i) => (i === index ? { ...row, ...patch } : row))
    }));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    onChange((current) => ({
      ...current,
      questions: current.questions.map((row, i) => {
        if (i !== questionIndex) return row;
        const options = [...row.options] as QuestionRow["options"];
        options[optionIndex] = value;
        return { ...row, options };
      })
    }));
  };

  return (
    <div className="admin-coding-form">
      <div className="admin-coding-field-grid">
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Track</span>
          <select
            onChange={(event) => onChange((c) => ({ ...c, testType: event.target.value as TestPaperTrack }))}
            value={form.testType}
          >
            {(Object.keys(TRACK_LABELS) as TestPaperTrack[]).map((track) => (
              <option key={track} value={track}>
                {TRACK_LABELS[track]}
              </option>
            ))}
          </select>
        </div>
        {form.testType === "ai" ? (
          <div className="admin-coding-field">
            <span className="admin-coding-field-label">AI role</span>
            <select onChange={(event) => onChange((c) => ({ ...c, roleId: event.target.value }))} value={form.roleId}>
              <option value="">Select a role...</option>
              {aiRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Id (optional, auto-generated from title)</span>
          <input onChange={(event) => onChange((c) => ({ ...c, id: event.target.value }))} type="text" value={form.id} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Title</span>
          <input onChange={(event) => onChange((c) => ({ ...c, title: event.target.value }))} type="text" value={form.title} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Subtitle (optional)</span>
          <input onChange={(event) => onChange((c) => ({ ...c, subtitle: event.target.value }))} type="text" value={form.subtitle} />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Duration (minutes, optional)</span>
          <input
            min={5}
            onChange={(event) => onChange((c) => ({ ...c, durationMinutesText: event.target.value }))}
            type="number"
            value={form.durationMinutesText}
          />
        </div>
        <div className="admin-coding-field">
          <span className="admin-coding-field-label">Category focus (comma-separated, optional)</span>
          <input
            onChange={(event) => onChange((c) => ({ ...c, categoryFocusText: event.target.value }))}
            type="text"
            value={form.categoryFocusText}
          />
        </div>
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Summary (optional)</span>
        <textarea onChange={(event) => onChange((c) => ({ ...c, summary: event.target.value }))} rows={2} value={form.summary} />
      </div>

      <div className="admin-coding-field">
        <span className="admin-coding-field-label">Questions</span>
        <div className="admin-coding-array-list">
          {form.questions.map((row, index) => (
            <div className="admin-coding-array-row" key={index}>
              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Question {index + 1} prompt</span>
                <textarea onChange={(event) => updateQuestionRow(index, { prompt: event.target.value })} rows={2} value={row.prompt} />
              </div>

              <div className="admin-coding-field-grid">
                {row.options.map((optionText, optionIndex) => (
                  <div className="admin-coding-field" key={optionIndex}>
                    <span className="admin-coding-field-label">
                      Option {String.fromCharCode(97 + optionIndex).toUpperCase()}
                      {row.correctOptionIndex === optionIndex ? " (correct)" : ""}
                    </span>
                    <input
                      onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                      type="text"
                      value={optionText}
                    />
                  </div>
                ))}
              </div>

              <div className="admin-coding-field-grid">
                <div className="admin-coding-field">
                  <span className="admin-coding-field-label">Correct option</span>
                  <select
                    onChange={(event) => updateQuestionRow(index, { correctOptionIndex: Number(event.target.value) })}
                    value={row.correctOptionIndex}
                  >
                    {row.options.map((_, optionIndex) => (
                      <option key={optionIndex} value={optionIndex}>
                        {String.fromCharCode(97 + optionIndex).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-coding-field">
                  <span className="admin-coding-field-label">Category (optional, defaults to title)</span>
                  <input
                    onChange={(event) => updateQuestionRow(index, { category: event.target.value })}
                    type="text"
                    value={row.category}
                  />
                </div>
                <div className="admin-coding-field">
                  <span className="admin-coding-field-label">Difficulty (optional)</span>
                  <select
                    onChange={(event) => updateQuestionRow(index, { difficulty: event.target.value as QuestionRow["difficulty"] })}
                    value={row.difficulty}
                  >
                    {DIFFICULTIES.map((difficulty) => (
                      <option key={difficulty || "none"} value={difficulty}>
                        {difficulty || "(none)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-coding-field">
                <span className="admin-coding-field-label">Explanation (optional)</span>
                <textarea
                  onChange={(event) => updateQuestionRow(index, { explanation: event.target.value })}
                  rows={2}
                  value={row.explanation}
                />
              </div>

              {form.questions.length > 1 ? (
                <button
                  className="admin-coding-array-remove"
                  onClick={() => onChange((c) => ({ ...c, questions: c.questions.filter((_, i) => i !== index) }))}
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
          onClick={() => onChange((c) => ({ ...c, questions: [...c.questions, emptyQuestionRow()] }))}
          type="button"
        >
          <PlusCircle size={13} />
          Add question
        </button>
      </div>
    </div>
  );
}
