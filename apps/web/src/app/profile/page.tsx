"use client";

import {
  Briefcase,
  Building2,
  CheckCircle2,
  CirclePlus,
  FileUp,
  GraduationCap,
  Languages,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import { onAuthStateChanged, updateProfile as updateAuthProfile } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { auth, db } from "@/lib/firebase/client";
import { createUploadedResumeRecord } from "@/lib/firebase/resumes";
import { PROFILE_CHANGE_EVENT, PROFILE_SAVE_REQUEST_EVENT, PROFILE_STORAGE_KEY } from "@/lib/preferences";
import { sanitizeExternalUrl } from "@/lib/url-safety";

type CareerPreference = "job" | "internship" | "both";
type ProjectType = "hobby" | "company";
type GradingType = "GPA" | "CGPA" | "Percentage";

type ProfileFileAttachment = {
  id: string;
  contentType: string;
  kind: string;
  name: string;
  r2Key: string;
  signedUrl?: string;
  size: number;
  uploadedAt: string;
};

type Suggestion = {
  domain?: string;
  id: string;
  label: string;
  logo?: string;
  source: string;
};

type LanguageRecord = {
  id: string;
  language: string;
  canSpeak: boolean;
  canRead: boolean;
  canWrite: boolean;
  fluent: boolean;
};

type EducationRecord = {
  id: string;
  institute: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  isPursuing: boolean;
  gradingType: GradingType;
  score: string;
  summary: string;
  certificates: ProfileFileAttachment[];
};

type ExperienceRecord = {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  skillsGained: string;
  achievements: string[];
  certificates: ProfileFileAttachment[];
};

type ProjectRecord = {
  id: string;
  title: string;
  projectType: ProjectType;
  startDate: string;
  endDate: string;
  description: string;
  techStack: string;
  skillsGained: string;
  media: ProfileFileAttachment[];
};

type CertificationRecord = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  credentialUrl: string;
  fileName: string;
  certificates: ProfileFileAttachment[];
};

type CompetitiveExamRecord = {
  id: string;
  examName: string;
  examYear: string;
  score: string;
  rank: string;
};

type ProfileData = {
  photoURL: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  location: string;
  profileSummary: string;
  careerPreference: CareerPreference;
  availabilityDateTime: string;
  expectedSalary: string;
  preferredLocations: string;
  blockedCompanies: string;
  keySkills: string;
  languages: LanguageRecord[];
  education: EducationRecord[];
  internships: ExperienceRecord[];
  employmentHistory: ExperienceRecord[];
  projects: ProjectRecord[];
  certifications: CertificationRecord[];
  awards: string[];
  clubsAndCommittees: string[];
  competitiveExams: CompetitiveExamRecord[];
  academicAchievements: string[];
  resumeFileName: string;
  updatedAt: string;
};

const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyLanguage(): LanguageRecord {
  return {
    id: createId(),
    language: "",
    canSpeak: false,
    canRead: false,
    canWrite: false,
    fluent: false
  };
}

function createEmptyEducation(): EducationRecord {
  return {
    id: createId(),
    institute: "",
    degree: "",
    fieldOfStudy: "",
    startDate: "",
    endDate: "",
    isPursuing: false,
    gradingType: "CGPA",
    score: "",
    summary: "",
    certificates: []
  };
}

function createEmptyExperience(): ExperienceRecord {
  return {
    id: createId(),
    company: "",
    role: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
    skillsGained: "",
    achievements: [],
    certificates: []
  };
}

function createEmptyProject(): ProjectRecord {
  return {
    id: createId(),
    title: "",
    projectType: "hobby",
    startDate: "",
    endDate: "",
    description: "",
    techStack: "",
    skillsGained: "",
    media: []
  };
}

function createEmptyCertification(): CertificationRecord {
  return {
    id: createId(),
    title: "",
    issuer: "",
    issueDate: "",
    credentialUrl: "",
    fileName: "",
    certificates: []
  };
}

function createEmptyExam(): CompetitiveExamRecord {
  return {
    id: createId(),
    examName: "",
    examYear: "",
    score: "",
    rank: ""
  };
}

function normalizeListText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join(", ");
  }

  return "";
}

function buildDefaultProfile(seed?: { name?: string | null; email?: string | null }): ProfileData {
  return {
    photoURL: "",
    fullName: seed?.name?.trim() ?? "",
    email: seed?.email?.trim() ?? "",
    phone: "",
    birthDate: "",
    gender: "Prefer not to say",
    location: "",
    profileSummary: "",
    careerPreference: "both",
    availabilityDateTime: "",
    expectedSalary: "",
    preferredLocations: "",
    blockedCompanies: "",
    keySkills: "",
    languages: [createEmptyLanguage()],
    education: [],
    internships: [],
    employmentHistory: [],
    projects: [],
    certifications: [],
    awards: [],
    clubsAndCommittees: [],
    competitiveExams: [],
    academicAchievements: [],
    resumeFileName: "",
    updatedAt: ""
  };
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toListText(items: string[]): string {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).join(", ");
}

function asAttachmentArray(value: unknown): ProfileFileAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ProfileFileAttachment | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Partial<ProfileFileAttachment>;
      const id = safeString(record.id) || createId();
      const name = safeString(record.name);
      const r2Key = safeString(record.r2Key);
      if (!name || !r2Key) {
        return null;
      }

      const attachment: ProfileFileAttachment = {
        id,
        contentType: safeString(record.contentType, "application/octet-stream"),
        kind: safeString(record.kind, "document"),
        name,
        r2Key,
        size: typeof record.size === "number" && Number.isFinite(record.size) ? record.size : 0,
        uploadedAt: safeString(record.uploadedAt)
      };

      const signedUrl = safeString(record.signedUrl);
      if (signedUrl) {
        attachment.signedUrl = signedUrl;
      }

      return attachment;
    })
    .filter((item): item is ProfileFileAttachment => Boolean(item));
}

function shortFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hydrateProfile(raw: unknown, seed?: { name?: string | null; email?: string | null }): ProfileData {
  const base = buildDefaultProfile(seed);

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const candidate = raw as Partial<ProfileData>;

  const languages = Array.isArray(candidate.languages)
    ? candidate.languages.map((language) => ({
        ...createEmptyLanguage(),
        ...(typeof language === "object" && language !== null ? language : {})
      }))
    : base.languages;

  const education = Array.isArray(candidate.education)
    ? candidate.education.map((record) => {
        const source = typeof record === "object" && record !== null ? (record as Partial<EducationRecord>) : {};
        return {
          ...createEmptyEducation(),
          ...source,
          certificates: asAttachmentArray(source.certificates),
          summary: safeString(source.summary)
        };
      })
    : base.education;

  const internships = Array.isArray(candidate.internships)
    ? candidate.internships.map((record) => {
        const source = typeof record === "object" && record !== null ? (record as Partial<ExperienceRecord>) : {};
        return {
          ...createEmptyExperience(),
          ...source,
          achievements: safeStringArray(source.achievements),
          certificates: asAttachmentArray(source.certificates)
        };
      })
    : base.internships;

  const employmentHistory = Array.isArray(candidate.employmentHistory)
    ? candidate.employmentHistory.map((record) => {
        const source = typeof record === "object" && record !== null ? (record as Partial<ExperienceRecord>) : {};
        return {
          ...createEmptyExperience(),
          ...source,
          achievements: safeStringArray(source.achievements),
          certificates: asAttachmentArray(source.certificates)
        };
      })
    : base.employmentHistory;

  const projects = Array.isArray(candidate.projects)
    ? candidate.projects.map((record) => {
        const source = typeof record === "object" && record !== null ? (record as Partial<ProjectRecord>) : {};
        return {
          ...createEmptyProject(),
          ...source,
          media: asAttachmentArray(source.media)
        };
      })
    : base.projects;

  const certifications = Array.isArray(candidate.certifications)
    ? candidate.certifications.map((record) => {
        const source = typeof record === "object" && record !== null ? (record as Partial<CertificationRecord>) : {};
        return {
          ...createEmptyCertification(),
          ...source,
          certificates: asAttachmentArray(source.certificates),
          credentialUrl: safeString(source.credentialUrl),
          fileName: safeString(source.fileName)
        };
      })
    : base.certifications;

  const competitiveExams = Array.isArray(candidate.competitiveExams)
    ? candidate.competitiveExams.map((record) => ({
        ...createEmptyExam(),
        ...(typeof record === "object" && record !== null ? record : {})
      }))
    : base.competitiveExams;

  return {
    ...base,
    photoURL: safeString(candidate.photoURL),
    fullName: safeString(candidate.fullName, base.fullName),
    email: safeString(candidate.email, base.email),
    phone: safeString(candidate.phone),
    birthDate: safeString(candidate.birthDate),
    gender: safeString(candidate.gender, base.gender),
    location: safeString(candidate.location),
    profileSummary: safeString(candidate.profileSummary),
    careerPreference:
      candidate.careerPreference === "job" ||
      candidate.careerPreference === "internship" ||
      candidate.careerPreference === "both"
        ? candidate.careerPreference
        : base.careerPreference,
    availabilityDateTime: safeString(candidate.availabilityDateTime),
    expectedSalary: safeString(candidate.expectedSalary),
    preferredLocations: normalizeListText(candidate.preferredLocations),
    blockedCompanies: normalizeListText(candidate.blockedCompanies),
    keySkills: normalizeListText(candidate.keySkills),
    languages: languages.length > 0 ? languages : base.languages,
    education,
    internships,
    employmentHistory,
    projects,
    certifications,
    awards: safeStringArray(candidate.awards),
    clubsAndCommittees: safeStringArray(candidate.clubsAndCommittees),
    competitiveExams,
    academicAchievements: safeStringArray(candidate.academicAchievements),
    resumeFileName: safeString(candidate.resumeFileName),
    updatedAt: safeString(candidate.updatedAt)
  };
}

function formatDateRange(startDate: string, endDate: string, isCurrent: boolean): string {
  if (!startDate && !endDate && !isCurrent) {
    return "Timeline not set";
  }

  const start = startDate || "Start date";
  const end = isCurrent ? "Present" : endDate || "End date";
  return `${start} - ${end}`;
}

function getProfileInitials(name: string, email: string): string {
  const source = (name || email || "CareerOS User").trim();
  const pieces = source.split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 2);
  return pieces.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CO";
}

function readCloudinaryErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Failed to upload profile picture.";
  }

  const errorRecord = (payload as { error?: unknown }).error;
  if (errorRecord && typeof errorRecord === "object") {
    const message = (errorRecord as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return "Failed to upload profile picture.";
}

function RichTextEditor({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const applyCommand = (command: "bold" | "insertOrderedList" | "insertUnorderedList" | "italic") => {
    editorRef.current?.focus();
    document.execCommand(command);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  return (
    <div className="profile-field span-2">
      <span>{label}</span>
      <div className="profile-rich-editor-toolbar" aria-label={`${label} formatting`}>
        <button onClick={() => applyCommand("bold")} type="button">
          B
        </button>
        <button onClick={() => applyCommand("italic")} type="button">
          I
        </button>
        <button onClick={() => applyCommand("insertUnorderedList")} type="button">
          Bullets
        </button>
        <button onClick={() => applyCommand("insertOrderedList")} type="button">
          Numbers
        </button>
      </div>
      <div
        className="profile-rich-editor"
        contentEditable
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

function AttachmentList({
  attachments,
  emptyLabel,
  onRemove
}: {
  attachments: ProfileFileAttachment[];
  emptyLabel?: string;
  onRemove: (attachmentId: string) => void;
}) {
  if (attachments.length === 0) {
    return emptyLabel ? <p className="muted span-2">{emptyLabel}</p> : null;
  }

  return (
    <div className="profile-attachment-list span-2">
      {attachments.map((attachment) => (
        <div className="profile-attachment-chip" key={attachment.id}>
          <Paperclip size={13} />
          {attachment.signedUrl ? (
            <a href={attachment.signedUrl} rel="noreferrer" target="_blank">
              {attachment.name}
            </a>
          ) : (
            <span>{attachment.name}</span>
          )}
          {attachment.size ? <small>{shortFileSize(attachment.size)}</small> : null}
          <button aria-label={`Remove ${attachment.name}`} onClick={() => onRemove(attachment.id)} type="button">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SuggestionBox({
  emptyText,
  icon,
  onAdd,
  suggestions
}: {
  emptyText: string;
  icon: ReactNode;
  onAdd: (label: string) => void;
  suggestions: Suggestion[];
}) {
  if (suggestions.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="profile-suggestion-list">
      {suggestions.map((suggestion) => (
        <button key={`${suggestion.source}-${suggestion.id}`} onClick={() => onAdd(suggestion.label.replace(/^Other:\s*/i, ""))} type="button">
          {icon}
          <span>{suggestion.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(() => buildDefaultProfile());
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [educationDraft, setEducationDraft] = useState<EducationRecord>(createEmptyEducation());
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
  const [experienceModalType, setExperienceModalType] = useState<"internship" | "employment">("internship");
  const [experienceDraft, setExperienceDraft] = useState<ExperienceRecord>(createEmptyExperience());
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectRecord>(createEmptyProject());
  const [certificationModalOpen, setCertificationModalOpen] = useState(false);
  const [certificationDraft, setCertificationDraft] = useState<CertificationRecord>(createEmptyCertification());
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examDraft, setExamDraft] = useState<CompetitiveExamRecord>(createEmptyExam());
  const [awardDraft, setAwardDraft] = useState("");
  const [clubDraft, setClubDraft] = useState("");
  const [achievementDraft, setAchievementDraft] = useState("");
  const [experienceAchievementDrafts, setExperienceAchievementDrafts] = useState<Record<string, string>>({});
  const [activeUserId, setActiveUserId] = useState<string | null>(auth?.currentUser?.uid ?? null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveNotice, setProfileSaveNotice] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingFileKey, setUploadingFileKey] = useState<string | null>(null);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
  const [profilePhotoNotice, setProfilePhotoNotice] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<Suggestion[]>([]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [companySuggestions, setCompanySuggestions] = useState<Suggestion[]>([]);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const preferredLocationList = useMemo(() => toList(profile.preferredLocations), [profile.preferredLocations]);
  const blockedCompanyList = useMemo(() => toList(profile.blockedCompanies), [profile.blockedCompanies]);
  const lastSavedAt = useMemo(
    () => (profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : ""),
    [profile.updatedAt]
  );
  const safeProfilePhotoUrl = useMemo(() => sanitizeExternalUrl(profile.photoURL), [profile.photoURL]);
  const profileInitials = useMemo(
    () => getProfileInitials(profile.fullName, profile.email),
    [profile.fullName, profile.email]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;

    const storedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!storedProfile) {
      return () => {
        cancelled = true;
      };
    }

    try {
      const hydratedProfile = hydrateProfile(JSON.parse(storedProfile));
      animationFrameId = window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        setProfile((current) => ({
          ...hydratedProfile,
          fullName: hydratedProfile.fullName || current.fullName,
          email: hydratedProfile.email || current.email
        }));
      });
    } catch {
      // Ignore corrupted profile snapshots and keep defaults.
    }

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useEffect(() => {
    if (!auth) {
      return;
    }

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setActiveUserId(user?.uid ?? null);

      setProfile((current) => {
        const fullName = current.fullName || user?.displayName || "";
        const email = current.email || user?.email || "";
        const photoURL = current.photoURL || sanitizeExternalUrl(user?.photoURL) || "";

        if (fullName === current.fullName && email === current.email && photoURL === current.photoURL) {
          return current;
        }

        return {
          ...current,
          fullName,
          email,
          photoURL
        };
      });

      if (!user || !db) {
        return;
      }

      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.data() as { profile?: unknown } | undefined;
          if (!data?.profile) {
            return;
          }

          const hydratedProfile = hydrateProfile(data.profile, {
            email: user.email,
            name: user.displayName
          });
          setProfile(hydratedProfile);

          if (typeof window !== "undefined") {
            window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(hydratedProfile));
            window.dispatchEvent(new Event(PROFILE_CHANGE_EVENT));
          }
        },
        (error) => {
          setProfileSaveError(error.message || "Unable to load saved profile from Firebase.");
        }
      );
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
          const response = await fetch(`/api/profile/locations?q=${encodeURIComponent(query)}`, {
            headers: idToken ? { authorization: `Bearer ${idToken}` } : undefined
          });
          const payload = (await response.json()) as { results?: Suggestion[] };
          setLocationSuggestions(Array.isArray(payload.results) ? payload.results : []);
        } catch {
          setLocationSuggestions([]);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [locationQuery]);

  useEffect(() => {
    const query = companyQuery.trim();
    if (query.length < 2) {
      setCompanySuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
          const response = await fetch(`/api/profile/companies?q=${encodeURIComponent(query)}`, {
            headers: idToken ? { authorization: `Bearer ${idToken}` } : undefined
          });
          const payload = (await response.json()) as { results?: Suggestion[] };
          setCompanySuggestions(Array.isArray(payload.results) ? payload.results : []);
        } catch {
          setCompanySuggestions([]);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [companyQuery]);

  const handleOpenProfilePhotoPicker = () => {
    if (isUploadingPhoto) {
      return;
    }

    profilePhotoInputRef.current?.click();
  };

  const handleRemoveProfilePhoto = () => {
    if (isUploadingPhoto) {
      return;
    }

    updateProfileField("photoURL", "");
    setProfilePhotoError(null);
    setProfilePhotoNotice("Profile photo removed. Click Update Profile to save changes.");
  };

  const handleProfilePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setProfilePhotoError("Please select a valid image file.");
      setProfilePhotoNotice(null);
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      setProfilePhotoError("Profile picture must be 5 MB or smaller.");
      setProfilePhotoNotice(null);
      return;
    }

    const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
    const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
    if (!cloudName || !uploadPreset) {
      setProfilePhotoError(
        "Missing Cloudinary configuration. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
      );
      setProfilePhotoNotice(null);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    setIsUploadingPhoto(true);
    setProfilePhotoError(null);
    setProfilePhotoNotice("Uploading profile picture...");

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as { secure_url?: unknown } | null;

      if (!response.ok || !payload) {
        throw new Error(readCloudinaryErrorMessage(payload));
      }

      const secureUrl = sanitizeExternalUrl(payload.secure_url);
      if (!secureUrl) {
        throw new Error("Cloudinary did not return a valid secure image URL.");
      }

      updateProfileField("photoURL", secureUrl);
      setProfilePhotoNotice("Profile picture uploaded. Click Update Profile to save changes.");
      setProfilePhotoError(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message ? error.message : "Failed to upload profile picture.";
      setProfilePhotoError(message);
      setProfilePhotoNotice(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = useCallback(async () => {
    if (isSavingProfile) {
      return;
    }

    const normalizedFullName = profile.fullName.trim();
    const normalizedEmail = profile.email.trim();
    const normalizedPhotoURL = sanitizeExternalUrl(profile.photoURL) ?? "";
    const nextProfile: ProfileData = {
      ...profile,
      photoURL: normalizedPhotoURL,
      fullName: normalizedFullName,
      email: normalizedEmail,
      updatedAt: new Date().toISOString()
    };

    setIsSavingProfile(true);
    setProfileSaveNotice(null);
    setProfileSaveError(null);

    try {
      setProfile(nextProfile);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
        window.dispatchEvent(new Event(PROFILE_CHANGE_EVENT));
      }

      const activeAuth = auth;
      if (!activeAuth?.currentUser || !db) {
        throw new Error("Sign in with Firebase before saving your profile.");
      }

      const nextAuthProfile: { displayName?: string | null; photoURL?: string | null } = {};
      const currentDisplayName = activeAuth.currentUser.displayName?.trim() ?? "";
      const currentPhotoURL = sanitizeExternalUrl(activeAuth.currentUser.photoURL) ?? "";

      if (normalizedFullName && currentDisplayName !== normalizedFullName) {
        nextAuthProfile.displayName = normalizedFullName;
      }

      if (currentPhotoURL !== normalizedPhotoURL) {
        nextAuthProfile.photoURL = normalizedPhotoURL || null;
      }

      if (Object.keys(nextAuthProfile).length > 0) {
        await updateAuthProfile(activeAuth.currentUser, nextAuthProfile);
      }

      await setDoc(
        doc(db, "users", activeAuth.currentUser.uid),
        {
          displayName: normalizedFullName,
          email: normalizedEmail,
          photoURL: normalizedPhotoURL,
          profile: nextProfile,
          profileUpdatedAt: nextProfile.updatedAt,
          updatedAt: nextProfile.updatedAt
        },
        { merge: true }
      );
      setProfileSaveNotice("Profile updated successfully.");
    } catch (error) {
      console.error("Failed to save profile:", error);
      setProfileSaveError(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }, [isSavingProfile, profile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onSaveRequested = () => {
      void handleSaveProfile();
    };

    window.addEventListener(PROFILE_SAVE_REQUEST_EVENT, onSaveRequested);
    return () => window.removeEventListener(PROFILE_SAVE_REQUEST_EVENT, onSaveRequested);
  }, [handleSaveProfile]);

  const updateProfileField = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    setProfile((current) => ({
      ...current,
      [key]: value
    }));
  };

  const addPreferredLocation = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) {
      return;
    }

    updateProfileField("preferredLocations", toListText([...preferredLocationList, trimmed]));
    setLocationQuery("");
    setLocationSuggestions([]);
  };

  const removePreferredLocation = (label: string) => {
    updateProfileField(
      "preferredLocations",
      toListText(preferredLocationList.filter((item) => item !== label))
    );
  };

  const addBlockedCompany = (label: string) => {
    const trimmed = label.trim().replace(/^Other:\s*/i, "");
    if (!trimmed) {
      return;
    }

    updateProfileField("blockedCompanies", toListText([...blockedCompanyList, trimmed]));
    setCompanyQuery("");
    setCompanySuggestions([]);
  };

  const removeBlockedCompany = (label: string) => {
    updateProfileField(
      "blockedCompanies",
      toListText(blockedCompanyList.filter((item) => item !== label))
    );
  };

  const uploadProfileFile = async (file: File, kind: string): Promise<ProfileFileAttachment> => {
    const activeAuth = auth;
    const currentUser = activeAuth?.currentUser;
    if (!currentUser) {
      throw new Error("Sign in before uploading profile documents.");
    }

    const idToken = await currentUser.getIdToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const response = await fetch("/api/profile/files", {
      body: formData,
      headers: { authorization: `Bearer ${idToken}` },
      method: "POST"
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      file?: ProfileFileAttachment;
    };

    if (!response.ok || !payload.file) {
      throw new Error(payload.error || "Unable to upload file.");
    }

    return payload.file;
  };

  const handleProfileDocumentUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    options: {
      kind: string;
      onUploaded: (attachment: ProfileFileAttachment) => void;
      uploadingKey: string;
    }
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadingFileKey(options.uploadingKey);
    setProfileSaveError(null);
    setProfileSaveNotice(null);

    try {
      const attachment = await uploadProfileFile(file, options.kind);
      options.onUploaded(attachment);
      setProfileSaveNotice(`${attachment.name} uploaded. Click Update Profile to save the attachment metadata.`);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : "File upload failed.");
    } finally {
      setUploadingFileKey(null);
    }
  };

  const openAddEducationModal = () => {
    setEditingEducationId(null);
    setEducationDraft(createEmptyEducation());
    setEducationModalOpen(true);
  };

  const openEditEducationModal = (record: EducationRecord) => {
    setEditingEducationId(record.id);
    setEducationDraft(record);
    setEducationModalOpen(true);
  };

  const saveEducationRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!educationDraft.institute.trim() || !educationDraft.degree.trim()) {
      return;
    }

    setProfile((current) => {
      if (editingEducationId) {
        return {
          ...current,
          education: current.education.map((record) =>
            record.id === editingEducationId ? { ...educationDraft, id: editingEducationId } : record
          )
        };
      }

      return {
        ...current,
        education: [...current.education, { ...educationDraft, id: createId() }]
      };
    });

    setEducationModalOpen(false);
    setEditingEducationId(null);
    setEducationDraft(createEmptyEducation());
  };

  const handleResumeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadingFileKey("resume-upload");
    setProfileSaveError(null);
    setProfileSaveNotice(null);

    try {
      const attachment = await uploadProfileFile(file, "resume");
      updateProfileField("resumeFileName", attachment.name);

      const userId = activeUserId ?? auth?.currentUser?.uid;
      if (userId) {
        await createUploadedResumeRecord(userId, {
          contentType: attachment.contentType,
          fileName: attachment.name,
          fileR2Key: attachment.r2Key,
          fileSize: attachment.size,
          fileUrl: attachment.signedUrl,
          label: attachment.name.replace(/\.[^.]+$/, "")
        });
      }

      setProfileSaveNotice(`${attachment.name} uploaded and added to Resume Gallery. Click Update Profile to save the profile link.`);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : "Resume upload failed.");
    } finally {
      setUploadingFileKey(null);
    }
  };

  const addLanguage = () => {
    updateProfileField("languages", [...profile.languages, createEmptyLanguage()]);
  };

  const openExperienceModal = (type: "internship" | "employment") => {
    setExperienceModalType(type);
    setExperienceDraft(createEmptyExperience());
    setExperienceModalOpen(true);
  };

  const saveExperienceRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!experienceDraft.company.trim() || !experienceDraft.role.trim()) {
      return;
    }

    if (experienceModalType === "internship") {
      updateProfileField("internships", [...profile.internships, { ...experienceDraft, id: createId() }]);
    } else {
      updateProfileField("employmentHistory", [
        ...profile.employmentHistory,
        { ...experienceDraft, id: createId() }
      ]);
    }

    setExperienceModalOpen(false);
    setExperienceDraft(createEmptyExperience());
  };

  const openProjectModal = () => {
    setProjectDraft(createEmptyProject());
    setProjectModalOpen(true);
  };

  const saveProjectRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectDraft.title.trim()) {
      return;
    }

    updateProfileField("projects", [...profile.projects, { ...projectDraft, id: createId() }]);
    setProjectModalOpen(false);
    setProjectDraft(createEmptyProject());
  };

  const openCertificationModal = () => {
    setCertificationDraft(createEmptyCertification());
    setCertificationModalOpen(true);
  };

  const saveCertificationRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!certificationDraft.title.trim()) {
      return;
    }

    updateProfileField("certifications", [...profile.certifications, { ...certificationDraft, id: createId() }]);
    setCertificationModalOpen(false);
    setCertificationDraft(createEmptyCertification());
  };

  const openExamModal = () => {
    setExamDraft(createEmptyExam());
    setExamModalOpen(true);
  };

  const saveExamRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!examDraft.examName.trim()) {
      return;
    }

    updateProfileField("competitiveExams", [...profile.competitiveExams, { ...examDraft, id: createId() }]);
    setExamModalOpen(false);
    setExamDraft(createEmptyExam());
  };

  const addQuickListItem = (
    key: "awards" | "clubsAndCommittees" | "academicAchievements",
    value: string,
    clear: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    updateProfileField(key, [...profile[key], trimmed]);
    clear();
  };

  const addExperienceAchievement = (key: "internships" | "employmentHistory", recordId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    updateProfileField(
      key,
      profile[key].map((item) =>
        item.id === recordId ? { ...item, achievements: [...item.achievements, trimmed] } : item
      )
    );
    setExperienceAchievementDrafts((current) => ({ ...current, [recordId]: "" }));
  };

  const removeExperienceAchievement = (
    key: "internships" | "employmentHistory",
    recordId: string,
    achievement: string
  ) => {
    updateProfileField(
      key,
      profile[key].map((item) =>
        item.id === recordId
          ? { ...item, achievements: item.achievements.filter((entry) => entry !== achievement) }
          : item
      )
    );
  };

  const removeEducationAttachment = (recordId: string, attachmentId: string) => {
    updateProfileField(
      "education",
      profile.education.map((item) =>
        item.id === recordId
          ? { ...item, certificates: item.certificates.filter((attachment) => attachment.id !== attachmentId) }
          : item
      )
    );
  };

  const removeExperienceAttachment = (
    key: "internships" | "employmentHistory",
    recordId: string,
    attachmentId: string
  ) => {
    updateProfileField(
      key,
      profile[key].map((item) =>
        item.id === recordId
          ? { ...item, certificates: item.certificates.filter((attachment) => attachment.id !== attachmentId) }
          : item
      )
    );
  };

  const removeProjectMedia = (recordId: string, attachmentId: string) => {
    updateProfileField(
      "projects",
      profile.projects.map((item) =>
        item.id === recordId ? { ...item, media: item.media.filter((attachment) => attachment.id !== attachmentId) } : item
      )
    );
  };

  const removeCertificationAttachment = (recordId: string, attachmentId: string) => {
    updateProfileField(
      "certifications",
      profile.certifications.map((item) =>
        item.id === recordId
          ? { ...item, certificates: item.certificates.filter((attachment) => attachment.id !== attachmentId) }
          : item
      )
    );
  };

  return (
    <div className="page-stack profile-page-stack">
      <section className="career-card profile-hero-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Profile</p>
            <h2>Career identity and preferences</h2>
            <p>Keep this updated so your dashboard, suggestions, and opportunities stay personalized.</p>
          </div>
          <div className="profile-status-badges">
            <span className="pill brand">Manual save</span>
            <span className={isSavingProfile ? "pill brand" : "pill"}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="spin" size={12} /> Saving profile...
                </>
              ) : (
                "Click Update Profile to save"
              )}
            </span>
            <span className="pill">{lastSavedAt ? `Last saved ${lastSavedAt}` : "Not saved yet"}</span>
            <button className="primary-button" disabled={isSavingProfile} onClick={() => void handleSaveProfile()} type="button">
              {isSavingProfile ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
              Update Profile
            </button>
          </div>
        </div>
        {profileSaveNotice ? (
          <div className="settings-feedback success profile-save-banner">
            <CheckCircle2 size={14} />
            {profileSaveNotice}
          </div>
        ) : null}
        {profileSaveError ? (
          <div className="settings-feedback error profile-save-banner">
            <ShieldCheck size={14} />
            {profileSaveError}
          </div>
        ) : null}
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Profile Photo</p>
            <h2>Avatar</h2>
            <p>Upload your profile picture to personalize CareerOS.</p>
          </div>
          <UserRound size={18} />
        </div>

        <div className="profile-photo-shell">
          <div className="profile-photo-preview" aria-hidden>
            {safeProfilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Profile preview" className="profile-photo-image" src={safeProfilePhotoUrl} />
            ) : (
              <span>{profileInitials}</span>
            )}
          </div>

          <div className="profile-photo-actions">
            <div className="profile-photo-button-row">
              <button
                className="ghost-button"
                disabled={isUploadingPhoto}
                onClick={handleOpenProfilePhotoPicker}
                type="button"
              >
                {isUploadingPhoto ? "Uploading..." : "Change avatar"}
              </button>
              <button
                className="ghost-button"
                disabled={isUploadingPhoto || !safeProfilePhotoUrl}
                onClick={handleRemoveProfilePhoto}
                type="button"
              >
                Remove
              </button>
            </div>
            {profilePhotoNotice ? <p className="settings-feedback success">{profilePhotoNotice}</p> : null}
            {profilePhotoError ? <p className="settings-feedback error">{profilePhotoError}</p> : null}
          </div>
        </div>

        <input
          accept="image/*"
          className="profile-photo-input"
          onChange={(event) => {
            void handleProfilePhotoUpload(event);
          }}
          ref={profilePhotoInputRef}
          type="file"
        />
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Personal</p>
            <h2>Basic information</h2>
          </div>
          <UserRound size={18} />
        </div>

        <div className="profile-form-grid">
          <label className="profile-field">
            Full name
            <input
              onChange={(event) => updateProfileField("fullName", event.target.value)}
              placeholder="Your full name"
              type="text"
              value={profile.fullName}
            />
          </label>

          <label className="profile-field">
            Email
            <input
              onChange={(event) => updateProfileField("email", event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={profile.email}
            />
          </label>

          <label className="profile-field">
            Phone number
            <input
              onChange={(event) => updateProfileField("phone", event.target.value)}
              placeholder="+91 98xxxxxx"
              type="tel"
              value={profile.phone}
            />
          </label>

          <label className="profile-field">
            Gender
            <select onChange={(event) => updateProfileField("gender", event.target.value)} value={profile.gender}>
              <option value="Prefer not to say">Prefer not to say</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="profile-field">
            Birth date
            <input
              onChange={(event) => updateProfileField("birthDate", event.target.value)}
              type="date"
              value={profile.birthDate}
            />
          </label>

          <label className="profile-field">
            Current location
            <input
              onChange={(event) => updateProfileField("location", event.target.value)}
              placeholder="City, State, Country"
              type="text"
              value={profile.location}
            />
          </label>

          <label className="profile-field span-2">
            Profile summary
            <textarea
              onChange={(event) => updateProfileField("profileSummary", event.target.value)}
              placeholder="Write a short summary about your background, strengths, and goals."
              rows={4}
              value={profile.profileSummary}
            />
          </label>
        </div>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Career</p>
            <h2>Career preferences</h2>
          </div>
          <Briefcase size={18} />
        </div>

        <div className="profile-form-grid">
          <label className="profile-field">
            Looking for
            <select
              onChange={(event) => updateProfileField("careerPreference", event.target.value as CareerPreference)}
              value={profile.careerPreference}
            >
              <option value="job">Job</option>
              <option value="internship">Internship</option>
              <option value="both">Both</option>
            </select>
          </label>

          <label className="profile-field">
            Available to work from
            <input
              onChange={(event) => updateProfileField("availabilityDateTime", event.target.value)}
              type="datetime-local"
              value={profile.availabilityDateTime}
            />
          </label>

          <label className="profile-field">
            Expected salary / stipend
            <input
              onChange={(event) => updateProfileField("expectedSalary", event.target.value)}
              placeholder="For example: 12 LPA or 30k/month"
              type="text"
              value={profile.expectedSalary}
            />
          </label>

          <div className="profile-field">
            <span>Preferred locations</span>
            <div className="profile-suggest-field">
              <input
                onChange={(event) => setLocationQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPreferredLocation(locationQuery);
                  }
                }}
                placeholder="Search Indian city or add Remote"
                type="text"
                value={locationQuery}
              />
              <button className="ghost-button" onClick={() => addPreferredLocation(locationQuery)} type="button">
                Add
              </button>
            </div>
            <SuggestionBox
              emptyText="Type at least two characters to search Indian locations."
              icon={<MapPin size={13} />}
              onAdd={addPreferredLocation}
              suggestions={locationSuggestions}
            />
            <div className="tag-cloud profile-tag-list">
              {preferredLocationList.map((location) => (
                <button className="profile-tag-chip" key={location} onClick={() => removePreferredLocation(location)} type="button">
                  {location} <Trash2 size={12} />
                </button>
              ))}
            </div>
          </div>

          <label className="profile-field">
            Key skills
            <textarea
              onChange={(event) => updateProfileField("keySkills", event.target.value)}
              placeholder="React, TypeScript, System Design"
              rows={2}
              value={profile.keySkills}
            />
          </label>

          <div className="profile-field">
            <span>Blocked companies</span>
            <div className="profile-suggest-field">
              <input
                onChange={(event) => setCompanyQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addBlockedCompany(companyQuery);
                  }
                }}
                placeholder="Search company or type a custom name"
                type="text"
                value={companyQuery}
              />
              <button className="ghost-button" onClick={() => addBlockedCompany(companyQuery)} type="button">
                Add
              </button>
            </div>
            <SuggestionBox
              emptyText="Type at least two characters to search companies."
              icon={<Building2 size={13} />}
              onAdd={addBlockedCompany}
              suggestions={companySuggestions}
            />
            <div className="tag-cloud profile-tag-list">
              {blockedCompanyList.map((company) => (
                <button className="profile-tag-chip" key={company} onClick={() => removeBlockedCompany(company)} type="button">
                  {company} <Trash2 size={12} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Education</p>
            <h2>Academic history</h2>
            <p>Add institutes, GPA/CGPA/marks, and pursuing timelines.</p>
          </div>
          <button className="ghost-button" onClick={openAddEducationModal} type="button">
            <CirclePlus size={14} /> Add education
          </button>
        </div>

        {profile.education.length === 0 ? (
          <div className="empty-drop">No education entries yet</div>
        ) : (
          <div className="profile-entry-list">
            {profile.education.map((record) => (
              <article className="profile-entry-card" key={record.id}>
                <div className="profile-entry-head">
                  <div>
                    <h3>{record.degree || "Degree"}</h3>
                    <p>{record.institute || "Institute"}</p>
                  </div>
                  <div className="profile-inline-actions">
                    <button
                      aria-label="Edit education"
                      className="icon-button"
                      onClick={() => openEditEducationModal(record)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label="Remove education"
                      className="icon-button"
                      onClick={() =>
                        updateProfileField(
                          "education",
                          profile.education.filter((item) => item.id !== record.id)
                        )
                      }
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p>{record.fieldOfStudy || "Field not specified"}</p>
                <div className="tag-cloud">
                  <span>{formatDateRange(record.startDate, record.endDate, record.isPursuing)}</span>
                  <span>
                    {record.gradingType}: {record.score || "Not added"}
                  </span>
                </div>
                {record.summary ? <p>{record.summary}</p> : null}
                <AttachmentList
                  attachments={record.certificates}
                  onRemove={(attachmentId) => removeEducationAttachment(record.id, attachmentId)}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Skills</p>
            <h2>Languages and communication</h2>
          </div>
          <Languages size={18} />
        </div>

        <div className="profile-entry-list">
          {profile.languages.map((language) => (
            <article className="profile-entry-card" key={language.id}>
              <div className="profile-form-grid language-grid">
                <label className="profile-field">
                  Language
                  <input
                    onChange={(event) =>
                      updateProfileField(
                        "languages",
                        profile.languages.map((item) =>
                          item.id === language.id ? { ...item, language: event.target.value } : item
                        )
                      )
                    }
                    placeholder="English"
                    type="text"
                    value={language.language}
                  />
                </label>

                <label className="profile-toggle">
                  <input
                    checked={language.canSpeak}
                    onChange={(event) =>
                      updateProfileField(
                        "languages",
                        profile.languages.map((item) =>
                          item.id === language.id ? { ...item, canSpeak: event.target.checked } : item
                        )
                      )
                    }
                    type="checkbox"
                  />
                  <span>Speak</span>
                </label>

                <label className="profile-toggle">
                  <input
                    checked={language.canRead}
                    onChange={(event) =>
                      updateProfileField(
                        "languages",
                        profile.languages.map((item) =>
                          item.id === language.id ? { ...item, canRead: event.target.checked } : item
                        )
                      )
                    }
                    type="checkbox"
                  />
                  <span>Read</span>
                </label>

                <label className="profile-toggle">
                  <input
                    checked={language.canWrite}
                    onChange={(event) =>
                      updateProfileField(
                        "languages",
                        profile.languages.map((item) =>
                          item.id === language.id ? { ...item, canWrite: event.target.checked } : item
                        )
                      )
                    }
                    type="checkbox"
                  />
                  <span>Write</span>
                </label>

                <label className="profile-toggle">
                  <input
                    checked={language.fluent}
                    onChange={(event) =>
                      updateProfileField(
                        "languages",
                        profile.languages.map((item) =>
                          item.id === language.id ? { ...item, fluent: event.target.checked } : item
                        )
                      )
                    }
                    type="checkbox"
                  />
                  <span>Fluent</span>
                </label>

                <button
                  className="ghost-button profile-remove"
                  onClick={() =>
                    updateProfileField(
                      "languages",
                      profile.languages.length === 1
                        ? profile.languages
                        : profile.languages.filter((item) => item.id !== language.id)
                    )
                  }
                  type="button"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>

        <button className="ghost-button" onClick={addLanguage} style={{ marginTop: 12 }} type="button">
          <CirclePlus size={14} /> Add language
        </button>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Experience</p>
            <h2>Internships and employment history</h2>
          </div>
        </div>

        <div className="profile-dual-grid">
          <div>
            <div className="section-heading" style={{ marginBottom: 10 }}>
              <div>
                <p className="eyebrow">Internships</p>
                <h2>Past internships</h2>
              </div>
              <button className="ghost-button" onClick={() => openExperienceModal("internship")} type="button">
                <CirclePlus size={14} /> Add
              </button>
            </div>

            <div className="profile-entry-list">
              {profile.internships.length === 0 ? (
                <div className="empty-drop">No internships added</div>
              ) : (
                profile.internships.map((record) => (
                  <article className="profile-entry-card" key={record.id}>
                    <div className="profile-form-grid">
                      <label className="profile-field">
                        Company
                        <input
                          onChange={(event) =>
                            updateProfileField(
                              "internships",
                              profile.internships.map((item) =>
                                item.id === record.id ? { ...item, company: event.target.value } : item
                              )
                            )
                          }
                          type="text"
                          value={record.company}
                        />
                      </label>

                      <label className="profile-field">
                        Role
                        <input
                          onChange={(event) =>
                            updateProfileField(
                              "internships",
                              profile.internships.map((item) =>
                                item.id === record.id ? { ...item, role: event.target.value } : item
                              )
                            )
                          }
                          type="text"
                          value={record.role}
                        />
                      </label>

                      <label className="profile-field">
                        Start date
                        <input
                          onChange={(event) =>
                            updateProfileField(
                              "internships",
                              profile.internships.map((item) =>
                                item.id === record.id ? { ...item, startDate: event.target.value } : item
                              )
                            )
                          }
                          type="date"
                          value={record.startDate}
                        />
                      </label>

                      <label className="profile-field">
                        End date
                        <input
                          disabled={record.isCurrent}
                          onChange={(event) =>
                            updateProfileField(
                              "internships",
                              profile.internships.map((item) =>
                                item.id === record.id ? { ...item, endDate: event.target.value } : item
                              )
                            )
                          }
                          type="date"
                          value={record.endDate}
                        />
                      </label>

                      <label className="profile-toggle">
                        <input
                          checked={record.isCurrent}
                          onChange={(event) =>
                            updateProfileField(
                              "internships",
                              profile.internships.map((item) =>
                                item.id === record.id
                                  ? {
                                      ...item,
                                      isCurrent: event.target.checked,
                                      endDate: event.target.checked ? "" : item.endDate
                                    }
                                  : item
                              )
                            )
                          }
                          type="checkbox"
                        />
                        <span>Currently active</span>
                      </label>

                      <RichTextEditor
                        label="Summary"
                        onChange={(value) =>
                          updateProfileField(
                            "internships",
                            profile.internships.map((item) =>
                              item.id === record.id ? { ...item, description: value } : item
                            )
                          )
                        }
                        placeholder="Add bullet points for responsibilities, impact, and outcomes."
                        value={record.description}
                      />

                      <label className="profile-field span-2">
                        Skills gained
                        <textarea
                          onChange={(event) =>
                            updateProfileField(
                              "internships",
                              profile.internships.map((item) =>
                                item.id === record.id ? { ...item, skillsGained: event.target.value } : item
                              )
                            )
                          }
                          placeholder="What skills did you actually build or sharpen here? e.g. REST API design, SQL query optimization, team code reviews"
                          rows={2}
                          value={record.skillsGained}
                        />
                      </label>

                      <div className="profile-field span-2">
                        <span>Achievements</span>
                        <div className="profile-quick-add-row">
                          <input
                            onChange={(event) =>
                              setExperienceAchievementDrafts((current) => ({
                                ...current,
                                [record.id]: event.target.value
                              }))
                            }
                            placeholder="Add an achievement from this internship"
                            type="text"
                            value={experienceAchievementDrafts[record.id] ?? ""}
                          />
                          <button
                            className="ghost-button"
                            onClick={() =>
                              addExperienceAchievement("internships", record.id, experienceAchievementDrafts[record.id] ?? "")
                            }
                            type="button"
                          >
                            Add
                          </button>
                        </div>
                        <div className="tag-cloud profile-tag-list">
                          {record.achievements.map((achievement) => (
                            <button
                              className="profile-tag-chip"
                              key={achievement}
                              onClick={() => removeExperienceAchievement("internships", record.id, achievement)}
                              type="button"
                            >
                              {achievement} <Trash2 size={12} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="profile-field span-2">
                        Certificates
                        <input
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                          disabled={uploadingFileKey === `internship-${record.id}`}
                          onChange={(event) =>
                            void handleProfileDocumentUpload(event, {
                              kind: "internship-certificate",
                              onUploaded: (attachment) =>
                                updateProfileField(
                                  "internships",
                                  profile.internships.map((item) =>
                                    item.id === record.id
                                      ? { ...item, certificates: [...item.certificates, attachment] }
                                      : item
                                  )
                                ),
                              uploadingKey: `internship-${record.id}`
                            })
                          }
                          type="file"
                        />
                      </label>
                      {uploadingFileKey === `internship-${record.id}` ? (
                        <p className="muted span-2">
                          <Loader2 className="spin" size={13} /> Uploading certificate...
                        </p>
                      ) : null}
                      <AttachmentList
                        attachments={record.certificates}
                        emptyLabel="No internship certificates attached yet."
                        onRemove={(attachmentId) => removeExperienceAttachment("internships", record.id, attachmentId)}
                      />

                      <button
                        className="ghost-button profile-remove"
                        onClick={() =>
                          updateProfileField(
                            "internships",
                            profile.internships.filter((item) => item.id !== record.id)
                          )
                        }
                        type="button"
                      >
                        <Trash2 size={14} /> Remove internship
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="section-heading" style={{ marginBottom: 10 }}>
              <div>
                <p className="eyebrow">Employment</p>
                <h2>Work history</h2>
              </div>
              <button className="ghost-button" onClick={() => openExperienceModal("employment")} type="button">
                <CirclePlus size={14} /> Add
              </button>
            </div>

            <div className="profile-entry-list">
              {profile.employmentHistory.length === 0 ? (
                <div className="empty-drop">No employment entries added</div>
              ) : (
                profile.employmentHistory.map((record) => (
                  <article className="profile-entry-card" key={record.id}>
                    <div className="profile-form-grid">
                      <label className="profile-field">
                        Company
                        <input
                          onChange={(event) =>
                            updateProfileField(
                              "employmentHistory",
                              profile.employmentHistory.map((item) =>
                                item.id === record.id ? { ...item, company: event.target.value } : item
                              )
                            )
                          }
                          type="text"
                          value={record.company}
                        />
                      </label>

                      <label className="profile-field">
                        Role
                        <input
                          onChange={(event) =>
                            updateProfileField(
                              "employmentHistory",
                              profile.employmentHistory.map((item) =>
                                item.id === record.id ? { ...item, role: event.target.value } : item
                              )
                            )
                          }
                          type="text"
                          value={record.role}
                        />
                      </label>

                      <label className="profile-field">
                        Start date
                        <input
                          onChange={(event) =>
                            updateProfileField(
                              "employmentHistory",
                              profile.employmentHistory.map((item) =>
                                item.id === record.id ? { ...item, startDate: event.target.value } : item
                              )
                            )
                          }
                          type="date"
                          value={record.startDate}
                        />
                      </label>

                      <label className="profile-field">
                        End date
                        <input
                          disabled={record.isCurrent}
                          onChange={(event) =>
                            updateProfileField(
                              "employmentHistory",
                              profile.employmentHistory.map((item) =>
                                item.id === record.id ? { ...item, endDate: event.target.value } : item
                              )
                            )
                          }
                          type="date"
                          value={record.endDate}
                        />
                      </label>

                      <label className="profile-toggle">
                        <input
                          checked={record.isCurrent}
                          onChange={(event) =>
                            updateProfileField(
                              "employmentHistory",
                              profile.employmentHistory.map((item) =>
                                item.id === record.id
                                  ? {
                                      ...item,
                                      isCurrent: event.target.checked,
                                      endDate: event.target.checked ? "" : item.endDate
                                    }
                                  : item
                              )
                            )
                          }
                          type="checkbox"
                        />
                        <span>Current company</span>
                      </label>

                      <RichTextEditor
                        label="Summary"
                        onChange={(value) =>
                          updateProfileField(
                            "employmentHistory",
                            profile.employmentHistory.map((item) =>
                              item.id === record.id ? { ...item, description: value } : item
                            )
                          )
                        }
                        placeholder="Add bullet points for responsibilities, impact, and outcomes."
                        value={record.description}
                      />

                      <label className="profile-field span-2">
                        Skills gained
                        <textarea
                          onChange={(event) =>
                            updateProfileField(
                              "employmentHistory",
                              profile.employmentHistory.map((item) =>
                                item.id === record.id ? { ...item, skillsGained: event.target.value } : item
                              )
                            )
                          }
                          placeholder="What skills did you actually build or sharpen here? e.g. REST API design, SQL query optimization, team code reviews"
                          rows={2}
                          value={record.skillsGained}
                        />
                      </label>

                      <div className="profile-field span-2">
                        <span>Achievements</span>
                        <div className="profile-quick-add-row">
                          <input
                            onChange={(event) =>
                              setExperienceAchievementDrafts((current) => ({
                                ...current,
                                [record.id]: event.target.value
                              }))
                            }
                            placeholder="Add an achievement from this role"
                            type="text"
                            value={experienceAchievementDrafts[record.id] ?? ""}
                          />
                          <button
                            className="ghost-button"
                            onClick={() =>
                              addExperienceAchievement(
                                "employmentHistory",
                                record.id,
                                experienceAchievementDrafts[record.id] ?? ""
                              )
                            }
                            type="button"
                          >
                            Add
                          </button>
                        </div>
                        <div className="tag-cloud profile-tag-list">
                          {record.achievements.map((achievement) => (
                            <button
                              className="profile-tag-chip"
                              key={achievement}
                              onClick={() => removeExperienceAchievement("employmentHistory", record.id, achievement)}
                              type="button"
                            >
                              {achievement} <Trash2 size={12} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="profile-field span-2">
                        Certificates
                        <input
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                          disabled={uploadingFileKey === `employment-${record.id}`}
                          onChange={(event) =>
                            void handleProfileDocumentUpload(event, {
                              kind: "employment-certificate",
                              onUploaded: (attachment) =>
                                updateProfileField(
                                  "employmentHistory",
                                  profile.employmentHistory.map((item) =>
                                    item.id === record.id
                                      ? { ...item, certificates: [...item.certificates, attachment] }
                                      : item
                                  )
                                ),
                              uploadingKey: `employment-${record.id}`
                            })
                          }
                          type="file"
                        />
                      </label>
                      {uploadingFileKey === `employment-${record.id}` ? (
                        <p className="muted span-2">
                          <Loader2 className="spin" size={13} /> Uploading certificate...
                        </p>
                      ) : null}
                      <AttachmentList
                        attachments={record.certificates}
                        emptyLabel="No employment certificates attached yet."
                        onRemove={(attachmentId) =>
                          removeExperienceAttachment("employmentHistory", record.id, attachmentId)
                        }
                      />

                      <button
                        className="ghost-button profile-remove"
                        onClick={() =>
                          updateProfileField(
                            "employmentHistory",
                            profile.employmentHistory.filter((item) => item.id !== record.id)
                          )
                        }
                        type="button"
                      >
                        <Trash2 size={14} /> Remove employment
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Projects</p>
            <h2>Project portfolio</h2>
          </div>
          <button className="ghost-button" onClick={openProjectModal} type="button">
            <CirclePlus size={14} /> Add project
          </button>
        </div>

        <div className="profile-entry-list">
          {profile.projects.length === 0 ? (
            <div className="empty-drop">No projects added yet</div>
          ) : (
            profile.projects.map((project) => (
              <article className="profile-entry-card" key={project.id}>
                <div className="profile-form-grid">
                  <label className="profile-field">
                    Project title
                    <input
                      onChange={(event) =>
                        updateProfileField(
                          "projects",
                          profile.projects.map((item) =>
                            item.id === project.id ? { ...item, title: event.target.value } : item
                          )
                        )
                      }
                      type="text"
                      value={project.title}
                    />
                  </label>

                  <label className="profile-field">
                    Type
                    <select
                      onChange={(event) =>
                        updateProfileField(
                          "projects",
                          profile.projects.map((item) =>
                            item.id === project.id
                              ? { ...item, projectType: event.target.value as ProjectType }
                              : item
                          )
                        )
                      }
                      value={project.projectType}
                    >
                      <option value="hobby">Hobby project</option>
                      <option value="company">Company project</option>
                    </select>
                  </label>

                  <label className="profile-field">
                    Start date
                    <input
                      onChange={(event) =>
                        updateProfileField(
                          "projects",
                          profile.projects.map((item) =>
                            item.id === project.id ? { ...item, startDate: event.target.value } : item
                          )
                        )
                      }
                      type="date"
                      value={project.startDate}
                    />
                  </label>

                  <label className="profile-field">
                    End date
                    <input
                      onChange={(event) =>
                        updateProfileField(
                          "projects",
                          profile.projects.map((item) =>
                            item.id === project.id ? { ...item, endDate: event.target.value } : item
                          )
                        )
                      }
                      type="date"
                      value={project.endDate}
                    />
                  </label>

                  <label className="profile-field span-2">
                    Tech stack
                    <input
                      onChange={(event) =>
                        updateProfileField(
                          "projects",
                          profile.projects.map((item) =>
                            item.id === project.id ? { ...item, techStack: event.target.value } : item
                          )
                        )
                      }
                      placeholder="React, Firebase, Tailwind"
                      type="text"
                      value={project.techStack}
                    />
                  </label>

                  <label className="profile-field span-2">
                    Description
                    <textarea
                      onChange={(event) =>
                        updateProfileField(
                          "projects",
                          profile.projects.map((item) =>
                            item.id === project.id ? { ...item, description: event.target.value } : item
                          )
                        )
                      }
                      rows={3}
                      value={project.description}
                    />
                  </label>

                  <label className="profile-field span-2">
                    Skills gained
                    <textarea
                      onChange={(event) =>
                        updateProfileField(
                          "projects",
                          profile.projects.map((item) =>
                            item.id === project.id ? { ...item, skillsGained: event.target.value } : item
                          )
                        )
                      }
                      placeholder="What skills did you actually build or sharpen here? e.g. state management, API integration, performance profiling"
                      rows={2}
                      value={project.skillsGained}
                    />
                  </label>

                  <label className="profile-field span-2">
                    Project media
                    <input
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      disabled={uploadingFileKey === `project-${project.id}`}
                      onChange={(event) =>
                        void handleProfileDocumentUpload(event, {
                          kind: "project-media",
                          onUploaded: (attachment) =>
                            updateProfileField(
                              "projects",
                              profile.projects.map((item) =>
                                item.id === project.id ? { ...item, media: [...item.media, attachment] } : item
                              )
                            ),
                          uploadingKey: `project-${project.id}`
                        })
                      }
                      type="file"
                    />
                  </label>
                  {uploadingFileKey === `project-${project.id}` ? (
                    <p className="muted span-2">
                      <Loader2 className="spin" size={13} /> Uploading project media...
                    </p>
                  ) : null}
                  <AttachmentList
                    attachments={project.media}
                    emptyLabel="No project media attached yet."
                    onRemove={(attachmentId) => removeProjectMedia(project.id, attachmentId)}
                  />

                  <button
                    className="ghost-button profile-remove"
                    onClick={() =>
                      updateProfileField(
                        "projects",
                        profile.projects.filter((item) => item.id !== project.id)
                      )
                    }
                    type="button"
                  >
                    <Trash2 size={14} /> Remove project
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Accomplishments</p>
            <h2>Certifications, exams, clubs, and achievements</h2>
          </div>
          <ShieldCheck size={18} />
        </div>

        <div className="profile-entry-list">
          <article className="profile-entry-card">
            <div className="section-heading" style={{ marginBottom: 10 }}>
              <div>
                <p className="eyebrow">Certifications</p>
                <h2>Upload and track credentials</h2>
              </div>
              <button className="ghost-button" onClick={openCertificationModal} type="button">
                <CirclePlus size={14} /> Add certification
              </button>
            </div>

            <div className="profile-entry-list">
              {profile.certifications.length === 0 ? (
                <div className="empty-drop">No certifications added</div>
              ) : (
                profile.certifications.map((certification) => (
                  <div className="profile-form-grid" key={certification.id}>
                    <label className="profile-field">
                      Certification name
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "certifications",
                            profile.certifications.map((item) =>
                              item.id === certification.id ? { ...item, title: event.target.value } : item
                            )
                          )
                        }
                        type="text"
                        value={certification.title}
                      />
                    </label>

                    <label className="profile-field">
                      Issuer
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "certifications",
                            profile.certifications.map((item) =>
                              item.id === certification.id ? { ...item, issuer: event.target.value } : item
                            )
                          )
                        }
                        type="text"
                        value={certification.issuer}
                      />
                    </label>

                    <label className="profile-field">
                      Issue date
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "certifications",
                            profile.certifications.map((item) =>
                              item.id === certification.id ? { ...item, issueDate: event.target.value } : item
                            )
                          )
                        }
                        type="date"
                        value={certification.issueDate}
                      />
                    </label>

                    <label className="profile-field">
                      Certificate link
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "certifications",
                            profile.certifications.map((item) =>
                              item.id === certification.id ? { ...item, credentialUrl: event.target.value } : item
                            )
                          )
                        }
                        placeholder="https://..."
                        type="url"
                        value={certification.credentialUrl}
                      />
                    </label>

                    <label className="profile-field span-2">
                      Certificate file
                      <input
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                        disabled={uploadingFileKey === `certification-${certification.id}`}
                        onChange={(event) =>
                          void handleProfileDocumentUpload(event, {
                            kind: "certification-certificate",
                            onUploaded: (attachment) =>
                              updateProfileField(
                                "certifications",
                                profile.certifications.map((item) =>
                                  item.id === certification.id
                                    ? {
                                        ...item,
                                        certificates: [...item.certificates, attachment],
                                        fileName: attachment.name
                                      }
                                    : item
                                )
                              ),
                            uploadingKey: `certification-${certification.id}`
                          })
                        }
                        type="file"
                      />
                    </label>

                    {uploadingFileKey === `certification-${certification.id}` ? (
                      <p className="muted span-2">
                        <Loader2 className="spin" size={13} /> Uploading certificate...
                      </p>
                    ) : null}
                    <AttachmentList
                      attachments={certification.certificates}
                      emptyLabel={
                        certification.credentialUrl
                          ? `Certificate link saved: ${certification.credentialUrl}`
                          : "No certificate file or link attached yet."
                      }
                      onRemove={(attachmentId) => removeCertificationAttachment(certification.id, attachmentId)}
                    />

                    <button
                      className="ghost-button profile-remove"
                      onClick={() =>
                        updateProfileField(
                          "certifications",
                          profile.certifications.filter((item) => item.id !== certification.id)
                        )
                      }
                      type="button"
                    >
                      <Trash2 size={14} /> Remove certification
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="profile-entry-card">
            <div className="section-heading" style={{ marginBottom: 10 }}>
              <div>
                <p className="eyebrow">Competitive Exams</p>
                <h2>Exam scores and ranks</h2>
              </div>
              <button className="ghost-button" onClick={openExamModal} type="button">
                <CirclePlus size={14} /> Add exam
              </button>
            </div>

            <div className="profile-entry-list">
              {profile.competitiveExams.length === 0 ? (
                <div className="empty-drop">No exam entries added</div>
              ) : (
                profile.competitiveExams.map((exam) => (
                  <div className="profile-form-grid" key={exam.id}>
                    <label className="profile-field">
                      Exam name
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "competitiveExams",
                            profile.competitiveExams.map((item) =>
                              item.id === exam.id ? { ...item, examName: event.target.value } : item
                            )
                          )
                        }
                        type="text"
                        value={exam.examName}
                      />
                    </label>

                    <label className="profile-field">
                      Year
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "competitiveExams",
                            profile.competitiveExams.map((item) =>
                              item.id === exam.id ? { ...item, examYear: event.target.value } : item
                            )
                          )
                        }
                        placeholder="2026"
                        type="text"
                        value={exam.examYear}
                      />
                    </label>

                    <label className="profile-field">
                      Score
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "competitiveExams",
                            profile.competitiveExams.map((item) =>
                              item.id === exam.id ? { ...item, score: event.target.value } : item
                            )
                          )
                        }
                        type="text"
                        value={exam.score}
                      />
                    </label>

                    <label className="profile-field">
                      Rank
                      <input
                        onChange={(event) =>
                          updateProfileField(
                            "competitiveExams",
                            profile.competitiveExams.map((item) =>
                              item.id === exam.id ? { ...item, rank: event.target.value } : item
                            )
                          )
                        }
                        type="text"
                        value={exam.rank}
                      />
                    </label>

                    <button
                      className="ghost-button profile-remove"
                      onClick={() =>
                        updateProfileField(
                          "competitiveExams",
                          profile.competitiveExams.filter((item) => item.id !== exam.id)
                        )
                      }
                      type="button"
                    >
                      <Trash2 size={14} /> Remove exam
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="profile-entry-card">
            <div className="profile-quick-add-grid">
              <div className="profile-quick-add-block">
                <h3>Awards</h3>
                <div className="profile-quick-add-row">
                  <input
                    onChange={(event) => setAwardDraft(event.target.value)}
                    placeholder="Add an award"
                    type="text"
                    value={awardDraft}
                  />
                  <button
                    className="ghost-button"
                    onClick={() => addQuickListItem("awards", awardDraft, () => setAwardDraft(""))}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {profile.awards.length === 0 ? (
                  <p className="muted">No awards added yet.</p>
                ) : (
                  <div className="tag-cloud profile-tag-list">
                    {profile.awards.map((item, index) => (
                      <button
                        className="profile-tag-chip"
                        key={`${item}-${index}`}
                        onClick={() =>
                          updateProfileField(
                            "awards",
                            profile.awards.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        type="button"
                      >
                        {item} <Trash2 size={12} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="profile-quick-add-block">
                <h3>Clubs and committees</h3>
                <div className="profile-quick-add-row">
                  <input
                    onChange={(event) => setClubDraft(event.target.value)}
                    placeholder="Add club or committee"
                    type="text"
                    value={clubDraft}
                  />
                  <button
                    className="ghost-button"
                    onClick={() =>
                      addQuickListItem("clubsAndCommittees", clubDraft, () => setClubDraft(""))
                    }
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {profile.clubsAndCommittees.length === 0 ? (
                  <p className="muted">No clubs or committees added yet.</p>
                ) : (
                  <div className="tag-cloud profile-tag-list">
                    {profile.clubsAndCommittees.map((item, index) => (
                      <button
                        className="profile-tag-chip"
                        key={`${item}-${index}`}
                        onClick={() =>
                          updateProfileField(
                            "clubsAndCommittees",
                            profile.clubsAndCommittees.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        type="button"
                      >
                        {item} <Trash2 size={12} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="profile-quick-add-block">
                <h3>Academic achievements</h3>
                <div className="profile-quick-add-row">
                  <input
                    onChange={(event) => setAchievementDraft(event.target.value)}
                    placeholder="Add academic achievement"
                    type="text"
                    value={achievementDraft}
                  />
                  <button
                    className="ghost-button"
                    onClick={() =>
                      addQuickListItem(
                        "academicAchievements",
                        achievementDraft,
                        () => setAchievementDraft("")
                      )
                    }
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {profile.academicAchievements.length === 0 ? (
                  <p className="muted">No academic achievements added yet.</p>
                ) : (
                  <div className="tag-cloud profile-tag-list">
                    {profile.academicAchievements.map((item, index) => (
                      <button
                        className="profile-tag-chip"
                        key={`${item}-${index}`}
                        onClick={() =>
                          updateProfileField(
                            "academicAchievements",
                            profile.academicAchievements.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        type="button"
                      >
                        {item} <Trash2 size={12} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="career-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Resume</p>
            <h2>Resume upload</h2>
          </div>
          <GraduationCap size={18} />
        </div>

        <div className="profile-form-grid">
          <label className="profile-field span-2">
            Upload latest resume
            <input
              accept=".pdf,.doc,.docx,.txt,.md,.markdown"
              disabled={uploadingFileKey === "resume-upload"}
              onChange={(event) => void handleResumeFile(event)}
              type="file"
            />
          </label>

          <div className="upload-note span-2">
            {uploadingFileKey === "resume-upload" ? <Loader2 className="spin" size={16} /> : <FileUp size={16} />}
            <p>
              {uploadingFileKey === "resume-upload"
                ? "Uploading resume to protected storage..."
                : profile.resumeFileName
                  ? `Current resume: ${profile.resumeFileName}. It also appears in Resume Gallery.`
                  : "No resume uploaded yet."}
            </p>
          </div>
        </div>
      </section>

      {educationModalOpen ? (
        <div className="profile-modal-overlay" role="presentation">
          <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Education form">
            <div className="card-header">
              <div>
                <p className="eyebrow">Education</p>
                <h2>{editingEducationId ? "Edit education" : "Add education"}</h2>
              </div>
            </div>

            <form className="profile-form-grid" onSubmit={saveEducationRecord}>
              <label className="profile-field">
                Institute
                <input
                  onChange={(event) => setEducationDraft((current) => ({ ...current, institute: event.target.value }))}
                  required
                  type="text"
                  value={educationDraft.institute}
                />
              </label>

              <label className="profile-field">
                Degree
                <input
                  onChange={(event) => setEducationDraft((current) => ({ ...current, degree: event.target.value }))}
                  required
                  type="text"
                  value={educationDraft.degree}
                />
              </label>

              <label className="profile-field span-2">
                Field of study
                <input
                  onChange={(event) => setEducationDraft((current) => ({ ...current, fieldOfStudy: event.target.value }))}
                  type="text"
                  value={educationDraft.fieldOfStudy}
                />
              </label>

              <label className="profile-field">
                Start date
                <input
                  onChange={(event) => setEducationDraft((current) => ({ ...current, startDate: event.target.value }))}
                  type="date"
                  value={educationDraft.startDate}
                />
              </label>

              <label className="profile-field">
                End date
                <input
                  disabled={educationDraft.isPursuing}
                  onChange={(event) => setEducationDraft((current) => ({ ...current, endDate: event.target.value }))}
                  type="date"
                  value={educationDraft.endDate}
                />
              </label>

              <label className="profile-toggle span-2">
                <input
                  checked={educationDraft.isPursuing}
                  onChange={(event) =>
                    setEducationDraft((current) => ({
                      ...current,
                      isPursuing: event.target.checked,
                      endDate: event.target.checked ? "" : current.endDate
                    }))
                  }
                  type="checkbox"
                />
                <span>I am currently pursuing this education</span>
              </label>

              <label className="profile-field">
                Grading type
                <select
                  onChange={(event) =>
                    setEducationDraft((current) => ({ ...current, gradingType: event.target.value as GradingType }))
                  }
                  value={educationDraft.gradingType}
                >
                  <option value="CGPA">CGPA</option>
                  <option value="GPA">GPA</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </label>

              <label className="profile-field">
                Marks / score
                <input
                  onChange={(event) => setEducationDraft((current) => ({ ...current, score: event.target.value }))}
                  placeholder="9.2"
                  type="text"
                  value={educationDraft.score}
                />
              </label>

              <label className="profile-field span-2">
                Education summary
                <textarea
                  onChange={(event) => setEducationDraft((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="Summarize what you studied, major academic work, thesis, specialization, or relevant coursework."
                  rows={6}
                  value={educationDraft.summary}
                />
              </label>

              <label className="profile-field span-2">
                Certificates or transcripts
                <input
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  disabled={uploadingFileKey === `education-draft-${educationDraft.id}`}
                  onChange={(event) =>
                    void handleProfileDocumentUpload(event, {
                      kind: "education-certificate",
                      onUploaded: (attachment) =>
                        setEducationDraft((current) => ({
                          ...current,
                          certificates: [...current.certificates, attachment]
                        })),
                      uploadingKey: `education-draft-${educationDraft.id}`
                    })
                  }
                  type="file"
                />
              </label>
              {uploadingFileKey === `education-draft-${educationDraft.id}` ? (
                <p className="muted span-2">
                  <Loader2 className="spin" size={13} /> Uploading education document...
                </p>
              ) : null}
              <AttachmentList
                attachments={educationDraft.certificates}
                emptyLabel="No education certificates attached yet."
                onRemove={(attachmentId) =>
                  setEducationDraft((current) => ({
                    ...current,
                    certificates: current.certificates.filter((attachment) => attachment.id !== attachmentId)
                  }))
                }
              />

              <div className="modal-actions span-2">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setEducationModalOpen(false);
                    setEditingEducationId(null);
                    setEducationDraft(createEmptyEducation());
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  {editingEducationId ? "Update" : "Add"} education
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {experienceModalOpen ? (
        <div className="profile-modal-overlay" role="presentation">
          <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Experience form">
            <div className="card-header">
              <div>
                <p className="eyebrow">{experienceModalType === "internship" ? "Internship" : "Employment"}</p>
                <h2>
                  Add {experienceModalType === "internship" ? "internship" : "employment"} experience
                </h2>
              </div>
            </div>

            <form className="profile-form-grid" onSubmit={saveExperienceRecord}>
              <label className="profile-field">
                Company
                <input
                  onChange={(event) => setExperienceDraft((current) => ({ ...current, company: event.target.value }))}
                  required
                  type="text"
                  value={experienceDraft.company}
                />
              </label>

              <label className="profile-field">
                Role
                <input
                  onChange={(event) => setExperienceDraft((current) => ({ ...current, role: event.target.value }))}
                  required
                  type="text"
                  value={experienceDraft.role}
                />
              </label>

              <label className="profile-field">
                Start date
                <input
                  onChange={(event) => setExperienceDraft((current) => ({ ...current, startDate: event.target.value }))}
                  type="date"
                  value={experienceDraft.startDate}
                />
              </label>

              <label className="profile-field">
                End date
                <input
                  disabled={experienceDraft.isCurrent}
                  onChange={(event) => setExperienceDraft((current) => ({ ...current, endDate: event.target.value }))}
                  type="date"
                  value={experienceDraft.endDate}
                />
              </label>

              <label className="profile-toggle span-2">
                <input
                  checked={experienceDraft.isCurrent}
                  onChange={(event) =>
                    setExperienceDraft((current) => ({
                      ...current,
                      isCurrent: event.target.checked,
                      endDate: event.target.checked ? "" : current.endDate
                    }))
                  }
                  type="checkbox"
                />
                <span>Currently active</span>
              </label>

              <RichTextEditor
                label="Summary"
                onChange={(value) => setExperienceDraft((current) => ({ ...current, description: value }))}
                placeholder="Add bullet points for responsibilities, impact, and outcomes."
                value={experienceDraft.description}
              />

              <label className="profile-field span-2">
                Skills gained
                <textarea
                  onChange={(event) =>
                    setExperienceDraft((current) => ({ ...current, skillsGained: event.target.value }))
                  }
                  placeholder="What skills did you actually build or sharpen here? e.g. REST API design, SQL query optimization, team code reviews"
                  rows={2}
                  value={experienceDraft.skillsGained}
                />
              </label>

              <label className="profile-field span-2">
                Certificates
                <input
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  disabled={uploadingFileKey === `experience-draft-${experienceDraft.id}`}
                  onChange={(event) =>
                    void handleProfileDocumentUpload(event, {
                      kind: `${experienceModalType}-certificate`,
                      onUploaded: (attachment) =>
                        setExperienceDraft((current) => ({
                          ...current,
                          certificates: [...current.certificates, attachment]
                        })),
                      uploadingKey: `experience-draft-${experienceDraft.id}`
                    })
                  }
                  type="file"
                />
              </label>
              {uploadingFileKey === `experience-draft-${experienceDraft.id}` ? (
                <p className="muted span-2">
                  <Loader2 className="spin" size={13} /> Uploading certificate...
                </p>
              ) : null}
              <AttachmentList
                attachments={experienceDraft.certificates}
                emptyLabel="No certificates attached yet."
                onRemove={(attachmentId) =>
                  setExperienceDraft((current) => ({
                    ...current,
                    certificates: current.certificates.filter((attachment) => attachment.id !== attachmentId)
                  }))
                }
              />

              <div className="modal-actions span-2">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setExperienceModalOpen(false);
                    setExperienceDraft(createEmptyExperience());
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Add {experienceModalType}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {projectModalOpen ? (
        <div className="profile-modal-overlay" role="presentation">
          <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Project form">
            <div className="card-header">
              <div>
                <p className="eyebrow">Project</p>
                <h2>Add project</h2>
              </div>
            </div>

            <form className="profile-form-grid" onSubmit={saveProjectRecord}>
              <label className="profile-field">
                Project title
                <input
                  onChange={(event) => setProjectDraft((current) => ({ ...current, title: event.target.value }))}
                  required
                  type="text"
                  value={projectDraft.title}
                />
              </label>

              <label className="profile-field">
                Type
                <select
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, projectType: event.target.value as ProjectType }))
                  }
                  value={projectDraft.projectType}
                >
                  <option value="hobby">Hobby project</option>
                  <option value="company">Company project</option>
                </select>
              </label>

              <label className="profile-field">
                Start date
                <input
                  onChange={(event) => setProjectDraft((current) => ({ ...current, startDate: event.target.value }))}
                  type="date"
                  value={projectDraft.startDate}
                />
              </label>

              <label className="profile-field">
                End date
                <input
                  onChange={(event) => setProjectDraft((current) => ({ ...current, endDate: event.target.value }))}
                  type="date"
                  value={projectDraft.endDate}
                />
              </label>

              <label className="profile-field span-2">
                Tech stack
                <input
                  onChange={(event) => setProjectDraft((current) => ({ ...current, techStack: event.target.value }))}
                  placeholder="React, Firebase, Tailwind"
                  type="text"
                  value={projectDraft.techStack}
                />
              </label>

              <label className="profile-field span-2">
                Description
                <textarea
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={4}
                  value={projectDraft.description}
                />
              </label>

              <label className="profile-field span-2">
                Skills gained
                <textarea
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, skillsGained: event.target.value }))
                  }
                  placeholder="What skills did you actually build or sharpen here? e.g. state management, API integration, performance profiling"
                  rows={2}
                  value={projectDraft.skillsGained}
                />
              </label>

              <label className="profile-field span-2">
                Project media
                <input
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  disabled={uploadingFileKey === `project-draft-${projectDraft.id}`}
                  onChange={(event) =>
                    void handleProfileDocumentUpload(event, {
                      kind: "project-media",
                      onUploaded: (attachment) =>
                        setProjectDraft((current) => ({ ...current, media: [...current.media, attachment] })),
                      uploadingKey: `project-draft-${projectDraft.id}`
                    })
                  }
                  type="file"
                />
              </label>
              {uploadingFileKey === `project-draft-${projectDraft.id}` ? (
                <p className="muted span-2">
                  <Loader2 className="spin" size={13} /> Uploading project media...
                </p>
              ) : null}
              <AttachmentList
                attachments={projectDraft.media}
                emptyLabel="No project media attached yet."
                onRemove={(attachmentId) =>
                  setProjectDraft((current) => ({
                    ...current,
                    media: current.media.filter((attachment) => attachment.id !== attachmentId)
                  }))
                }
              />

              <div className="modal-actions span-2">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setProjectModalOpen(false);
                    setProjectDraft(createEmptyProject());
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Add project
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {certificationModalOpen ? (
        <div className="profile-modal-overlay" role="presentation">
          <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Certification form">
            <div className="card-header">
              <div>
                <p className="eyebrow">Certification</p>
                <h2>Add certification</h2>
              </div>
            </div>

            <form className="profile-form-grid" onSubmit={saveCertificationRecord}>
              <label className="profile-field">
                Certification name
                <input
                  onChange={(event) => setCertificationDraft((current) => ({ ...current, title: event.target.value }))}
                  required
                  type="text"
                  value={certificationDraft.title}
                />
              </label>

              <label className="profile-field">
                Issuer
                <input
                  onChange={(event) => setCertificationDraft((current) => ({ ...current, issuer: event.target.value }))}
                  type="text"
                  value={certificationDraft.issuer}
                />
              </label>

              <label className="profile-field">
                Issue date
                <input
                  onChange={(event) =>
                    setCertificationDraft((current) => ({ ...current, issueDate: event.target.value }))
                  }
                  type="date"
                  value={certificationDraft.issueDate}
                />
              </label>

              <label className="profile-field">
                Certificate link
                <input
                  onChange={(event) =>
                    setCertificationDraft((current) => ({ ...current, credentialUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  type="url"
                  value={certificationDraft.credentialUrl}
                />
              </label>

              <label className="profile-field span-2">
                Certificate file
                <input
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  disabled={uploadingFileKey === `certification-draft-${certificationDraft.id}`}
                  onChange={(event) =>
                    void handleProfileDocumentUpload(event, {
                      kind: "certification-certificate",
                      onUploaded: (attachment) =>
                        setCertificationDraft((current) => ({
                          ...current,
                          certificates: [...current.certificates, attachment],
                          fileName: attachment.name
                        })),
                      uploadingKey: `certification-draft-${certificationDraft.id}`
                    })
                  }
                  type="file"
                />
              </label>

              {uploadingFileKey === `certification-draft-${certificationDraft.id}` ? (
                <p className="muted span-2">
                  <Loader2 className="spin" size={13} /> Uploading certificate...
                </p>
              ) : null}
              <AttachmentList
                attachments={certificationDraft.certificates}
                emptyLabel="No certificate file attached yet."
                onRemove={(attachmentId) =>
                  setCertificationDraft((current) => ({
                    ...current,
                    certificates: current.certificates.filter((attachment) => attachment.id !== attachmentId),
                    fileName:
                      current.certificates.filter((attachment) => attachment.id !== attachmentId).at(-1)?.name ?? ""
                  }))
                }
              />

              <div className="modal-actions span-2">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setCertificationModalOpen(false);
                    setCertificationDraft(createEmptyCertification());
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Add certification
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {examModalOpen ? (
        <div className="profile-modal-overlay" role="presentation">
          <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Competitive exam form">
            <div className="card-header">
              <div>
                <p className="eyebrow">Competitive Exam</p>
                <h2>Add exam entry</h2>
              </div>
            </div>

            <form className="profile-form-grid" onSubmit={saveExamRecord}>
              <label className="profile-field">
                Exam name
                <input
                  onChange={(event) => setExamDraft((current) => ({ ...current, examName: event.target.value }))}
                  required
                  type="text"
                  value={examDraft.examName}
                />
              </label>

              <label className="profile-field">
                Year
                <input
                  onChange={(event) => setExamDraft((current) => ({ ...current, examYear: event.target.value }))}
                  placeholder="2026"
                  type="text"
                  value={examDraft.examYear}
                />
              </label>

              <label className="profile-field">
                Score
                <input
                  onChange={(event) => setExamDraft((current) => ({ ...current, score: event.target.value }))}
                  type="text"
                  value={examDraft.score}
                />
              </label>

              <label className="profile-field">
                Rank
                <input
                  onChange={(event) => setExamDraft((current) => ({ ...current, rank: event.target.value }))}
                  type="text"
                  value={examDraft.rank}
                />
              </label>

              <div className="modal-actions span-2">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setExamModalOpen(false);
                    setExamDraft(createEmptyExam());
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Add exam
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
