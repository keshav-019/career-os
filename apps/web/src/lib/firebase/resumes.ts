"use client";

import type {
  ResumeEditorMode,
  ResumeSection,
  ResumeTemplateId,
  ResumeVersion,
  ResumeVersionStatus
} from "@careeros/shared";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";
import { defaultResumeTemplateId } from "@/lib/resume-templates";

export type CareerResume = ResumeVersion;

const STATUS_VALUES = new Set<ResumeVersionStatus>(["active", "draft", "archived"]);
const EDITOR_MODE_VALUES = new Set<ResumeEditorMode>(["builder", "latex"]);
const TEMPLATE_VALUES = new Set<ResumeTemplateId>([
  "ats-modern",
  "classic-professional",
  "executive-impact",
  "minimal-clean",
  "technical-depth",
  "academic-cv",
  "custom-blank"
]);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asIsoString(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate() as Date;
      const parsed = date.getTime();
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
    } catch {
      return "";
    }
  }

  return "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .slice(0, 60);
}

function normalizeSection(entry: unknown, index: number): ResumeSection | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const id = asString(record.id) || `section_${index + 1}`;
  const title = asString(record.title) || `Section ${index + 1}`;
  const contentHtml = asString(record.contentHtml) || "<p></p>";
  const plainText = asString(record.plainText) || undefined;

  const pageRaw = Math.round(asNumber(record.page));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const orderRaw = Math.round(asNumber(record.order));
  const order = Number.isFinite(orderRaw) && orderRaw >= 0 ? orderRaw : index;

  return {
    id,
    title,
    contentHtml,
    plainText,
    page,
    order
  };
}

function asSections(value: unknown): ResumeSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => normalizeSection(entry, index))
    .filter((entry): entry is ResumeSection => Boolean(entry))
    .sort((first, second) => first.order - second.order)
    .slice(0, 200);
}

function inferBulletHighlights(sections: ResumeSection[]): string[] {
  return sections
    .map((section) => section.plainText || section.contentHtml.replace(/<[^>]+>/g, " "))
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeTemplateId(value: unknown): ResumeTemplateId {
  const candidate = asString(value) as ResumeTemplateId;
  if (TEMPLATE_VALUES.has(candidate)) {
    return candidate;
  }

  return defaultResumeTemplateId;
}

function normalizeEditorMode(value: unknown): ResumeEditorMode {
  const candidate = asString(value) as ResumeEditorMode;
  return EDITOR_MODE_VALUES.has(candidate) ? candidate : "builder";
}

function parseResume(snapshot: QueryDocumentSnapshot<DocumentData>): CareerResume {
  const data = snapshot.data() as Record<string, unknown>;
  const sections = asSections(data.sections);
  const createdAt = asIsoString(data.createdAt) || new Date().toISOString();
  const updatedAt = asIsoString(data.updatedAt) || createdAt;
  const statusCandidate = asString(data.status) as ResumeVersionStatus;
  const keywordCoverage = Math.max(0, Math.min(100, Math.round(asNumber(data.keywordCoverage))));
  const pageCountRaw = Math.round(asNumber(data.pageCount));
  const inferredPageCount = Math.max(
    1,
    sections.reduce((maxPage, section) => Math.max(maxPage, section.page), 1)
  );

  const bulletHighlights = asStringArray(data.bulletHighlights);

  return {
    id: asString(data.id) || snapshot.id,
    userId: asString(data.userId),
    label: asString(data.label) || "Untitled resume",
    targetRoles: asStringArray(data.targetRoles),
    status: STATUS_VALUES.has(statusCandidate) ? statusCandidate : "draft",
    createdAt,
    updatedAt,
    fileUrl: asString(data.fileUrl) || undefined,
    bulletHighlights: bulletHighlights.length > 0 ? bulletHighlights : inferBulletHighlights(sections),
    keywordCoverage,
    templateId: normalizeTemplateId(data.templateId),
    editorMode: normalizeEditorMode(data.editorMode),
    pageCount: Number.isFinite(pageCountRaw) && pageCountRaw > 0 ? Math.min(pageCountRaw, 12) : inferredPageCount,
    sections,
    latexCode: asString(data.latexCode) || undefined,
    lastExportedAt: asIsoString(data.lastExportedAt) || undefined
  };
}

function sortResumesByUpdatedAtDescending(resumes: CareerResume[]): CareerResume[] {
  return [...resumes].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
}

export function useUserResumes() {
  const hasAuth = Boolean(auth);
  const hasDb = Boolean(db);
  const [resumes, setResumes] = useState<CareerResume[]>([]);
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [loading, setLoading] = useState(hasAuth && hasDb);
  const [error, setError] = useState<string | null>(
    !hasAuth ? "Firebase authentication is not configured." : !hasDb ? "Firestore is not configured." : null
  );

  useEffect(() => {
    const firebaseAuth = auth;
    const firestore = db;

    if (!firebaseAuth || !firestore) {
      return;
    }

    let unsubscribeResumes: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (authUser) => {
      if (unsubscribeResumes) {
        unsubscribeResumes();
        unsubscribeResumes = null;
      }

      setUser(authUser);

      if (!authUser) {
        setResumes([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      unsubscribeResumes = onSnapshot(
        collection(firestore, "users", authUser.uid, "resumes"),
        (snapshot) => {
          const parsedResumes = snapshot.docs.map((docSnapshot) => parseResume(docSnapshot));
          setResumes(sortResumesByUpdatedAtDescending(parsedResumes));
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          setResumes([]);
          setLoading(false);
          setError(snapshotError.message || "Failed to load resumes.");
        }
      );
    });

    return () => {
      if (unsubscribeResumes) {
        unsubscribeResumes();
      }

      unsubscribeAuth();
    };
  }, []);

  return {
    error,
    loading,
    resumes,
    user
  };
}

export type ResumeCreatePayload = {
  bulletHighlights: string[];
  editorMode: ResumeEditorMode;
  keywordCoverage: number;
  label: string;
  latexCode: string;
  pageCount: number;
  sections: ResumeSection[];
  status?: ResumeVersionStatus;
  targetRoles: string[];
  templateId: ResumeTemplateId;
};

function normalizeSectionsForWrite(sections: ResumeSection[]): ResumeSection[] {
  return sections
    .map((section, index) => {
      const page = Number.isFinite(section.page) && section.page > 0 ? Math.round(section.page) : 1;
      const order = Number.isFinite(section.order) ? Math.round(section.order) : index;

      return {
        id: asString(section.id) || `section_${index + 1}`,
        title: asString(section.title) || `Section ${index + 1}`,
        contentHtml: asString(section.contentHtml) || "<p></p>",
        plainText: asString(section.plainText) || undefined,
        page,
        order
      };
    })
    .sort((first, second) => first.order - second.order)
    .slice(0, 200);
}

function normalizeCreatePayload(payload: ResumeCreatePayload) {
  const sections = normalizeSectionsForWrite(payload.sections);
  const nowIso = new Date().toISOString();

  return {
    bulletHighlights: payload.bulletHighlights.map((value) => asString(value)).filter(Boolean).slice(0, 10),
    createdAt: nowIso,
    editorMode: normalizeEditorMode(payload.editorMode),
    keywordCoverage: Math.max(0, Math.min(100, Math.round(payload.keywordCoverage))),
    label: asString(payload.label) || "Untitled resume",
    latexCode: asString(payload.latexCode),
    pageCount: Math.max(
      1,
      Math.min(
        12,
        Math.round(payload.pageCount || sections.reduce((maxPage, section) => Math.max(maxPage, section.page), 1))
      )
    ),
    sections,
    status: STATUS_VALUES.has(payload.status ?? "draft") ? (payload.status ?? "draft") : "draft",
    targetRoles: payload.targetRoles.map((value) => asString(value)).filter(Boolean).slice(0, 20),
    templateId: normalizeTemplateId(payload.templateId),
    updatedAt: nowIso
  };
}

export async function createResumeRecord(userId: string, payload: ResumeCreatePayload): Promise<string> {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  const normalized = normalizeCreatePayload(payload);

  const resumeRef = await addDoc(collection(db, "users", userId, "resumes"), {
    ...normalized,
    userId
  });

  await updateDoc(resumeRef, { id: resumeRef.id });

  return resumeRef.id;
}

export type ResumeUpdatePayload = Partial<ResumeCreatePayload>;

export async function updateResumeRecord(userId: string, resumeId: string, payload: ResumeUpdatePayload) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString()
  };

  if (typeof payload.label === "string") {
    updates.label = asString(payload.label) || "Untitled resume";
  }

  if (Array.isArray(payload.targetRoles)) {
    updates.targetRoles = payload.targetRoles.map((value) => asString(value)).filter(Boolean).slice(0, 20);
  }

  if (typeof payload.status === "string" && STATUS_VALUES.has(payload.status)) {
    updates.status = payload.status;
  }

  if (typeof payload.keywordCoverage === "number" || typeof payload.keywordCoverage === "string") {
    updates.keywordCoverage = Math.max(0, Math.min(100, Math.round(asNumber(payload.keywordCoverage))));
  }

  if (Array.isArray(payload.bulletHighlights)) {
    updates.bulletHighlights = payload.bulletHighlights
      .map((value) => asString(value))
      .filter(Boolean)
      .slice(0, 10);
  }

  if (typeof payload.templateId === "string") {
    updates.templateId = normalizeTemplateId(payload.templateId);
  }

  if (typeof payload.editorMode === "string") {
    updates.editorMode = normalizeEditorMode(payload.editorMode);
  }

  if (Array.isArray(payload.sections)) {
    const sections = normalizeSectionsForWrite(payload.sections);
    updates.sections = sections;

    const inferredPageCount = sections.reduce((maxPage, section) => Math.max(maxPage, section.page), 1);
    updates.pageCount = Math.max(1, inferredPageCount);

    if (!Array.isArray(payload.bulletHighlights)) {
      updates.bulletHighlights = inferBulletHighlights(sections);
    }
  }

  if (typeof payload.pageCount === "number") {
    updates.pageCount = Math.max(1, Math.min(12, Math.round(payload.pageCount)));
  }

  if (typeof payload.latexCode === "string") {
    updates.latexCode = asString(payload.latexCode);
  }

  await updateDoc(doc(db, "users", userId, "resumes", resumeId), updates);
}

export async function removeResumeRecord(userId: string, resumeId: string) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }

  await deleteDoc(doc(db, "users", userId, "resumes", resumeId));
}
