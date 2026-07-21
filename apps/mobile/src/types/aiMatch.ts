// Mirrors apps/web/src/app/api/ai/job-match and /api/ai/resume-review response shapes.
export type ResumeReview = {
  atsKeywords: string[];
  gaps: string[];
  latexOrVisualNotes: string[];
  marketPosition: string;
  overallScore: number;
  recruiterSummary: string;
  strengths: string[];
  targetRoles: string[];
};

export type JobMatch = {
  applicationStrategy: string[];
  bestResumeId: string;
  bestResumeLabel: string;
  coverLetter: string;
  gaps: string[];
  matchedEvidence: string[];
  outreachMessage: string;
  recommendedJobTargets: string[];
  resumeTweaks: string[];
  scoreOutOf10: number;
  verdict: string;
};
