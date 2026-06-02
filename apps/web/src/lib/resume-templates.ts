import type { ResumeTemplateId, ResumeSection } from "@careeros/shared";

export type ResumeTemplateDefinition = {
  id: ResumeTemplateId;
  name: string;
  tagline: string;
  description: string;
  family: string;
  sampleTargetRoles: string[];
  defaultSections: Array<Pick<ResumeSection, "title" | "contentHtml" | "page">>;
};

export const resumeTemplateCatalog: ResumeTemplateDefinition[] = [
  {
    id: "ats-modern",
    name: "Modern ATS",
    family: "Single column",
    tagline: "ATS-friendly with strong readability",
    description: "Great for most job portals where clean structure and keywords matter.",
    sampleTargetRoles: ["Software Engineer", "Product Engineer", "Frontend Engineer"],
    defaultSections: [
      {
        title: "Professional Summary",
        page: 1,
        contentHtml:
          "<p>Results-driven engineer with experience shipping production products and collaborating across product, design, and data teams.</p>"
      },
      {
        title: "Experience",
        page: 1,
        contentHtml:
          "<ul><li><strong>Senior Product Engineer</strong> at Example Labs (2023 - Present)</li><li>Led user-facing workflow improvements and reduced processing time by 35%.</li><li>Built reusable React and TypeScript components used across 4 product modules.</li></ul>"
      },
      {
        title: "Skills",
        page: 1,
        contentHtml: "<p>React, TypeScript, Next.js, Firebase, Node.js, SQL, Product Thinking</p>"
      }
    ]
  },
  {
    id: "classic-professional",
    name: "Classic Professional",
    family: "Chronological",
    tagline: "Traditional recruiter-friendly format",
    description: "Strong for consulting, operations, and mainstream corporate roles.",
    sampleTargetRoles: ["Business Analyst", "Operations Associate"],
    defaultSections: [
      {
        title: "Profile",
        page: 1,
        contentHtml:
          "<p>Professional with a track record of owning cross-functional projects and driving measurable outcomes.</p>"
      },
      {
        title: "Work History",
        page: 1,
        contentHtml:
          "<ul><li><strong>Company Name</strong> - Role Title (2022 - Present)</li><li>Delivered process optimization projects and improved reporting quality.</li></ul>"
      },
      {
        title: "Education",
        page: 1,
        contentHtml:
          "<p>Bachelor's Degree, University Name (2018 - 2022)<br/>CGPA: 8.6 / 10</p>"
      }
    ]
  },
  {
    id: "executive-impact",
    name: "Executive Impact",
    family: "Achievement-first",
    tagline: "Highlights outcomes before details",
    description: "Designed for senior professionals showcasing leadership and impact.",
    sampleTargetRoles: ["Engineering Manager", "Director of Product"],
    defaultSections: [
      {
        title: "Executive Summary",
        page: 1,
        contentHtml:
          "<p>Leader focused on scaling teams, improving delivery velocity, and building resilient product organizations.</p>"
      },
      {
        title: "Key Achievements",
        page: 1,
        contentHtml:
          "<ul><li>Scaled team productivity by 2.1x through platform and process upgrades.</li><li>Launched strategic initiatives contributing to 7-figure annual revenue impact.</li></ul>"
      },
      {
        title: "Leadership Experience",
        page: 1,
        contentHtml:
          "<p>Include executive roles, reporting lines, and strategic ownership areas here.</p>"
      }
    ]
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    family: "Minimal",
    tagline: "Simple and typography-focused",
    description: "Best for generalist profiles where concise communication matters.",
    sampleTargetRoles: ["Product Analyst", "Program Associate"],
    defaultSections: [
      {
        title: "About",
        page: 1,
        contentHtml:
          "<p>Clear communicator with strong execution and ownership across ambiguous projects.</p>"
      },
      {
        title: "Experience Highlights",
        page: 1,
        contentHtml:
          "<ul><li>Delivered high-impact projects in fast-paced environments.</li><li>Collaborated effectively with diverse stakeholders.</li></ul>"
      },
      {
        title: "Projects",
        page: 1,
        contentHtml: "<p>List your top projects with outcomes, stack, and your contribution.</p>"
      }
    ]
  },
  {
    id: "technical-depth",
    name: "Technical Depth",
    family: "Engineering",
    tagline: "Project-heavy technical resume",
    description: "Optimized for engineering roles where architecture and shipped work matter.",
    sampleTargetRoles: ["Backend Engineer", "Full Stack Engineer", "SDE"],
    defaultSections: [
      {
        title: "Technical Summary",
        page: 1,
        contentHtml:
          "<p>Engineer experienced in distributed systems, APIs, and end-to-end feature delivery.</p>"
      },
      {
        title: "Core Projects",
        page: 1,
        contentHtml:
          "<ul><li><strong>Realtime Dashboard</strong>: Built scalable event pipelines with resilient retries and monitoring.</li><li><strong>Resume Pipeline</strong>: Designed resume-to-job mapping workflow with Firebase persistence.</li></ul>"
      },
      {
        title: "Tech Stack",
        page: 1,
        contentHtml: "<p>TypeScript, Node.js, React, Next.js, PostgreSQL, Firebase, Docker</p>"
      }
    ]
  },
  {
    id: "academic-cv",
    name: "Academic CV",
    family: "Research",
    tagline: "Publications, research, and teaching first",
    description: "Built for academic applications, research roles, and graduate opportunities.",
    sampleTargetRoles: ["Research Assistant", "PhD Applicant"],
    defaultSections: [
      {
        title: "Research Interests",
        page: 1,
        contentHtml:
          "<p>Machine Learning Systems, Human-Centered AI, and Applied NLP for Education.</p>"
      },
      {
        title: "Publications",
        page: 1,
        contentHtml:
          "<ul><li>Author Name, Paper Title, Conference/Journal, Year.</li><li>Author Name, Paper Title, Conference/Journal, Year.</li></ul>"
      },
      {
        title: "Teaching and Service",
        page: 1,
        contentHtml:
          "<p>Teaching Assistant, mentoring programs, clubs, committee responsibilities, and outreach work.</p>"
      }
    ]
  },
  {
    id: "custom-blank",
    name: "Custom Blank Canvas",
    family: "Custom",
    tagline: "Start from a blank A4 canvas",
    description: "Create your own format from scratch with reusable rich sections.",
    sampleTargetRoles: [],
    defaultSections: []
  }
];

export const defaultResumeTemplateId: ResumeTemplateId = "ats-modern";

export function getResumeTemplateById(templateId: string | null | undefined): ResumeTemplateDefinition {
  const found = resumeTemplateCatalog.find((template) => template.id === templateId);
  return found ?? resumeTemplateCatalog[0];
}
