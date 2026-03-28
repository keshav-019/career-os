// Mirrors ProfileData and friends from apps/web/src/app/profile/page.tsx exactly, since this app persists to the
// device (AsyncStorage) the same way the web app persists to localStorage - see src/lib/profile.ts.
export type CareerPreference = "job" | "internship" | "both";
export type ProjectType = "hobby" | "company";
export type GradingType = "GPA" | "CGPA" | "Percentage";

export type LanguageRecord = {
  id: string;
  language: string;
  canSpeak: boolean;
  canRead: boolean;
  canWrite: boolean;
  fluent: boolean;
};

export type EducationRecord = {
  id: string;
  institute: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  isPursuing: boolean;
  gradingType: GradingType;
  score: string;
};

export type ExperienceRecord = {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  skillsGained: string;
};

export type ProjectRecord = {
  id: string;
  title: string;
  projectType: ProjectType;
  startDate: string;
  endDate: string;
  description: string;
  techStack: string;
  skillsGained: string;
};

export type CertificationRecord = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  fileName: string;
};

export type CompetitiveExamRecord = {
  id: string;
  examName: string;
  examYear: string;
  score: string;
  rank: string;
};

export type ProfileData = {
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

let idCounter = 0;
export function makeLocalId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function buildDefaultProfile(): ProfileData {
  return {
    photoURL: "",
    fullName: "",
    email: "",
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
    languages: [{ id: makeLocalId("lang"), language: "", canSpeak: false, canRead: false, canWrite: false, fluent: false }],
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
