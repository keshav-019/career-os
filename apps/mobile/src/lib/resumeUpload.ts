import * as DocumentPicker from "expo-document-picker";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { firestoreCollections } from "./collections";
import { apiPost } from "./apiClient";
import { LEGACY_WEB_BASE_URL } from "../config/env";
import type { CareerResume } from "../types/resume";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
];

export class ResumeUploadCancelledError extends Error {}

/** Extracts plain text from an uploaded resume file by reusing the web app's existing /api/resume/extract route
 *  (apps/web/src/app/api/resume/extract/route.ts) - it already handles PDF (pdfjs-dist), DOCX (mammoth), and
 *  plain text, and isn't affected by the Firebase Admin issue that moved everything else to apps/mobile-backend,
 *  so there's no need to port it. Note this route only returns extracted text - it never stores the file itself,
 *  which is why the raw bytes are uploaded to Firebase Storage separately below. */
async function extractResumeText(uri: string, name: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", { uri, name, type: mimeType } as unknown as Blob);

  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  const response = await fetch(`${LEGACY_WEB_BASE_URL}/api/resume/extract`, {
    method: "POST",
    body: formData,
    headers: idToken ? { authorization: `Bearer ${idToken}` } : undefined
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; text?: string; error?: string };
  if (!response.ok || !payload.ok || typeof payload.text !== "string") {
    throw new Error(payload.error || "Could not read this resume file.");
  }
  return payload.text;
}

/**
 * Lets the user pick a PDF/DOCX/TXT resume from their device, uploads the raw file to Firebase Storage (this
 * project's Storage bucket was already provisioned, just unused before - see lib/firebase.ts), extracts its text
 * via the web app's existing extract route, and writes a resume record into the SAME `users/{uid}/resumes`
 * Firestore collection AI Match and lib/resumes.ts already read - so an uploaded resume becomes selectable there
 * immediately, no separate plumbing needed. The extracted text goes into a single ResumeSection's `plainText`,
 * which is exactly the field apps/web/src/lib/ai/career-ai.ts's resumeToAiText/resumeToJobMatchText already read.
 */
export async function pickAndUploadResume(userId: string): Promise<CareerResume> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_MIME_TYPES,
    copyToCacheDirectory: true,
    multiple: false
  });
  if (picked.canceled || picked.assets.length === 0) {
    throw new ResumeUploadCancelledError("No file selected.");
  }

  const asset = picked.assets[0];
  const mimeType = asset.mimeType || "application/octet-stream";
  const fileName = asset.name || "resume";

  const fileResponse = await fetch(asset.uri);
  const fileBlob = await fileResponse.blob();

  const storagePath = `users/${userId}/resumes/${Date.now()}-${fileName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, fileBlob, { contentType: mimeType });
  const fileUrl = await getDownloadURL(storageRef);

  const extractedText = await extractResumeText(asset.uri, fileName, mimeType);

  const now = new Date().toISOString();
  const record: Omit<CareerResume, "id"> = {
    userId,
    label: fileName.replace(/\.[^/.]+$/, ""),
    targetRoles: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
    fileUrl,
    bulletHighlights: [],
    keywordCoverage: 0,
    editorMode: "builder",
    sections: [{ id: "uploaded-content", title: "Uploaded resume content", contentHtml: "", plainText: extractedText, page: 1, order: 1 }]
  };

  const docRef = await addDoc(collection(db, "users", userId, firestoreCollections.resumes), record);
  return { id: docRef.id, ...record };
}

export async function deleteUploadedResume(userId: string, resumeId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId, firestoreCollections.resumes, resumeId));
}
