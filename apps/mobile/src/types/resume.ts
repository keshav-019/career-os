// Visual Mode resume data model - mirrors apps/web/src/lib/resume-types.ts's `ResumeData` exactly, since the form
// fields/templates need to match. See src/lib/mobileResumes.ts for why this gets its OWN Firestore collection
// (mobileResumes) instead of reusing the web's `resumes`/ResumeVersion shape.
export type ResumeData = {
  personal: {
    firstName: string;
    lastName: string;
    title?: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
    summary: string;
  };
  education: {
    id: string;
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    gpa: string;
    description: string;
  }[];
  experience: {
    id: string;
    company: string;
    position: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string[];
  }[];
  skills: {
    id: string;
    category: string;
    items: string[];
  }[];
  projects: {
    id: string;
    name: string;
    description: string;
    technologies: string[];
    link: string;
  }[];
  certifications: {
    id: string;
    name: string;
    issuer: string;
    date: string;
  }[];
  /** 1-3 columns for rendering the skills section. A single skill group with an empty `category` renders as a
   *  flat bullet list with no heading ("just a bunch of skills") - multiple groups with categories render each
   *  as its own labeled column/section. Optional and defaults to 2 for resumes saved before this field existed. */
  skillsColumns?: 1 | 2 | 3;
};

export function createEmptyResumeData(): ResumeData {
  return {
    personal: {
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
      summary: ""
    },
    education: [],
    experience: [],
    skills: [],
    projects: [],
    certifications: [],
    skillsColumns: 2
  };
}

export type ResumeTemplateId = "swiss" | "sidebar" | "coral" | "spearmint" | "modern-writer";

export type ResumeTemplateMeta = {
  id: ResumeTemplateId;
  name: string;
  tagline: string;
  bestFor: string;
  accent: string;
};

export const RESUME_VISUAL_TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: "swiss",
    name: "Swiss",
    tagline: "Clean single column",
    bestFor: "Best for most roles, especially when a system reads your resume before a human does.",
    accent: "#c1652f"
  },
  {
    id: "sidebar",
    name: "Sidebar",
    tagline: "Two-column with a contact rail",
    bestFor: "Best when you want skills and credentials to stay visible at a glance.",
    accent: "#2f4d6e"
  },
  {
    id: "coral",
    name: "Coral",
    tagline: "Bold section headers",
    bestFor: "Best for customer-facing, sales, or people-first roles.",
    accent: "#c0392b"
  },
  {
    id: "spearmint",
    name: "Spearmint",
    tagline: "Strong section dividers",
    bestFor: "Best for students and early-career applicants.",
    accent: "#1f9d73"
  },
  {
    id: "modern-writer",
    name: "Modern Writer",
    tagline: "Minimalist & typewriter-style",
    bestFor: "Best for design, writing, and other creative fields.",
    accent: "#1c1c1c"
  }
];

export const DEFAULT_RESUME_TEMPLATE_ID: ResumeTemplateId = "swiss";

/** Firestore document shape for a saved mobile resume (users/{uid}/mobileResumes/{id}). jobId/jobLabel are set
 *  when this resume was produced by "Generate resume" for a specific saved job (see ResumeScreen.tsx) - shown in
 *  the resume list so the user can see which version was tailored for which role, and stay unset for resumes
 *  built from scratch or edited freely afterward. */
export type MobileResumeRecord = {
  id: string;
  label: string;
  templateId: ResumeTemplateId;
  data: ResumeData;
  createdAt: string;
  updatedAt: string;
  jobId?: string;
  jobLabel?: string;
};

// ResumeVersion - the web's Firestore-backed resume shape used by AI Match (apps/web/src/lib/firebase/resumes.ts).
// Kept separate from ResumeData/MobileResumeRecord above since it's a different system (HTML sections, not
// structured fields) - AI Match reads from this collection ("resumes"), Visual Mode saves to "mobileResumes".
export type ResumeSection = {
  id: string;
  title: string;
  contentHtml: string;
  plainText?: string;
  page: number;
  order: number;
};

export type CareerResume = {
  id: string;
  userId: string;
  label: string;
  targetRoles: string[];
  status: "active" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  bulletHighlights: string[];
  keywordCoverage: number;
  templateId?: string;
  editorMode?: "builder" | "latex";
  pageCount?: number;
  sections?: ResumeSection[];
  latexCode?: string;
  lastExportedAt?: string;
};
