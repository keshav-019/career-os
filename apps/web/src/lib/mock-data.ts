import type {
  AnalyticsSnapshot,
  InterviewRound,
  JobRecord,
  ParsedEmail,
  ResumeVersion
} from "@careeros/shared";

export const mockJobs: JobRecord[] = [
  {
    id: "job_orbitworks_spe",
    userId: "demo-user",
    company: "OrbitWorks",
    role: "Senior Product Engineer",
    location: "Remote, US",
    remotePolicy: "remote",
    source: "chrome-extension",
    sourceUrl: "https://example.com/orbitworks-senior-product-engineer",
    status: "interviewing",
    priority: "high",
    fitScore: 88,
    savedAt: "2026-05-24T11:00:00.000Z",
    appliedAt: "2026-05-25T16:30:00.000Z",
    nextActionAt: "2026-06-03T19:30:00.000Z",
    salaryRange: {
      min: 165000,
      max: 205000,
      currency: "USD"
    },
    resumeVersionId: "resume_product_ai",
    tags: ["ai", "product", "frontend"],
    jdText:
      "Build AI-assisted product workflows with React, TypeScript, event-driven services, and experimentation."
  },
  {
    id: "job_novabank_fe",
    userId: "demo-user",
    company: "NovaBank",
    role: "Frontend Platform Engineer",
    location: "New York, NY",
    remotePolicy: "hybrid",
    source: "gmail",
    status: "applied",
    priority: "medium",
    fitScore: 73,
    savedAt: "2026-05-21T09:10:00.000Z",
    appliedAt: "2026-05-22T12:20:00.000Z",
    nextActionAt: "2026-06-01T14:00:00.000Z",
    resumeVersionId: "resume_frontend_platform",
    tags: ["platform", "design-systems"],
    jdText:
      "Own component infrastructure, accessibility, performance, and developer experience for product teams."
  },
  {
    id: "job_latticeops_fullstack",
    userId: "demo-user",
    company: "LatticeOps",
    role: "Full-Stack AI Tools Engineer",
    location: "Austin, TX",
    remotePolicy: "hybrid",
    source: "linkedin",
    status: "saved",
    priority: "high",
    fitScore: 81,
    savedAt: "2026-05-29T20:15:00.000Z",
    nextActionAt: "2026-06-02T18:00:00.000Z",
    tags: ["ai-tools", "node", "firebase"],
    jdText:
      "Prototype internal AI tools, connect APIs, ship dashboards, and automate data-heavy support workflows."
  },
  {
    id: "job_heliohealth",
    userId: "demo-user",
    company: "HelioHealth",
    role: "Software Engineer, Growth",
    location: "San Francisco, CA",
    remotePolicy: "onsite",
    source: "greenhouse",
    status: "rejected",
    priority: "low",
    fitScore: 62,
    savedAt: "2026-05-12T18:00:00.000Z",
    appliedAt: "2026-05-13T18:00:00.000Z",
    tags: ["growth", "analytics"],
    jdText:
      "Run growth experiments, own onboarding funnels, and collaborate with data science."
  }
];

export const mockResumeVersions: ResumeVersion[] = [
  {
    id: "resume_product_ai",
    userId: "demo-user",
    label: "AI Product Engineer v3",
    targetRoles: ["Product Engineer", "AI Tools Engineer", "Full-Stack Engineer"],
    status: "active",
    createdAt: "2026-05-10T10:00:00.000Z",
    updatedAt: "2026-05-27T10:00:00.000Z",
    keywordCoverage: 86,
    bulletHighlights: [
      "Built production React and TypeScript workflows for data-heavy operators.",
      "Integrated LLM features into internal tooling with measurable time savings.",
      "Owned Firebase-backed dashboards from schema design to launch."
    ]
  },
  {
    id: "resume_frontend_platform",
    userId: "demo-user",
    label: "Frontend Platform v2",
    targetRoles: ["Frontend Platform Engineer", "Design Systems Engineer"],
    status: "draft",
    createdAt: "2026-05-08T10:00:00.000Z",
    updatedAt: "2026-05-26T10:00:00.000Z",
    keywordCoverage: 74,
    bulletHighlights: [
      "Improved component delivery speed with typed UI primitives.",
      "Reduced interaction defects by tightening accessibility checks.",
      "Documented patterns used across multiple product surfaces."
    ]
  }
];

export const mockInterviewRounds: InterviewRound[] = [
  {
    id: "round_orbitworks_hm",
    jobId: "job_orbitworks_spe",
    stage: "hiring-manager",
    scheduledAt: "2026-06-03T19:30:00.000Z",
    interviewer: "Maya Chen",
    prepQuestions: [
      "Tell me about a product decision where you changed direction after user evidence.",
      "How would you evaluate an AI workflow before shipping it broadly?",
      "Describe a time you had to simplify a complex technical system for nontechnical users."
    ],
    weakTopics: ["Experiment design", "Model evaluation vocabulary"],
    memory: [
      "Recruiter emphasized speed, product taste, and comfort with ambiguous workflows.",
      "Company is expanding from workflow automation into AI-guided operations."
    ],
    followUpDraft:
      "Thanks for the conversation today. I enjoyed learning more about the AI workflow roadmap and the way the team balances fast prototypes with careful product judgment."
  }
];

export const mockEmails: ParsedEmail[] = [
  {
    id: "email_recruiter_orbit",
    jobId: "job_orbitworks_spe",
    sender: "recruiting@orbitworks.example",
    subject: "Next step with OrbitWorks",
    receivedAt: "2026-05-30T17:10:00.000Z",
    signal: "interview",
    confidence: 0.94,
    nextActionAt: "2026-06-03T19:30:00.000Z"
  },
  {
    id: "email_novabank_followup",
    jobId: "job_novabank_fe",
    sender: "talent@novabank.example",
    subject: "Application received",
    receivedAt: "2026-05-22T12:25:00.000Z",
    signal: "follow-up",
    confidence: 0.82,
    nextActionAt: "2026-06-01T14:00:00.000Z"
  }
];

export const mockAnalytics: AnalyticsSnapshot = {
  applications: 24,
  interviews: 7,
  offers: 1,
  rejections: 9,
  recruiterReplies: 11,
  responseRate: 46,
  interviewRate: 29
};
