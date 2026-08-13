import type { JobSkillCategory } from "@careeros/shared";
import { requireAuthAndRateLimit } from "@/lib/server/require-auth-rate-limit";

export const runtime = "nodejs";

type SkillBucket = {
  category: string;
  terms: string[];
};

const SKILL_BUCKETS: SkillBucket[] = [
  {
    category: "Languages",
    terms: ["TypeScript", "JavaScript", "Python", "Java", "C++", "C#", "Go", "Rust", "SQL", "Kotlin", "Swift"]
  },
  {
    category: "Frontend",
    terms: ["React", "Next.js", "Angular", "Vue", "HTML", "CSS", "Tailwind", "Redux", "Accessibility", "Design Systems"]
  },
  {
    category: "Backend",
    terms: ["Node.js", "Express", "Spring Boot", "Django", "FastAPI", "GraphQL", "REST", "Microservices", "PostgreSQL", "MongoDB"]
  },
  {
    category: "Cloud & DevOps",
    terms: ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD", "Linux", "GitHub Actions", "Firebase"]
  },
  {
    category: "Data & AI",
    terms: ["Machine Learning", "Deep Learning", "LLM", "NLP", "TensorFlow", "PyTorch", "Pandas", "Spark", "Data Pipeline"]
  },
  {
    category: "Quality",
    terms: ["Testing", "Jest", "Playwright", "Cypress", "Unit Tests", "Integration Tests", "Performance", "Security"]
  },
  {
    category: "Product",
    terms: ["Analytics", "Experimentation", "A/B Testing", "Roadmap", "Stakeholders", "User Research", "Agile", "Scrum"]
  }
];

function normalizeText(value: string): string {
  return value
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function includesTerm(haystack: string, term: string): boolean {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9+#.])${escapedTerm}([^a-z0-9+#.]|$)`, "i");
  return pattern.test(haystack);
}

function extractResponsibilities(text: string): string[] {
  const candidates = [
    ["Own features", /\b(own|lead|drive)\b[^.]{0,70}\b(features?|projects?|initiatives?|roadmap)\b/i],
    ["Cross-functional collaboration", /\b(cross-functional|stakeholders?|product managers?|designers?)\b/i],
    ["System design", /\b(system design|architecture|scalable|distributed systems?)\b/i],
    ["Production operations", /\b(observability|monitoring|incident|on-call|production)\b/i],
    ["API integration", /\b(api integration|third-party|integrations?)\b/i],
    ["Data-driven delivery", /\b(metrics?|analytics|experiments?|data-driven)\b/i]
  ] as const;

  return candidates.filter(([, pattern]) => pattern.test(text)).map(([label]) => label).slice(0, 8);
}

function extractSkillCategories(jdText: string): JobSkillCategory[] {
  const text = normalizeText(jdText);
  const categories = SKILL_BUCKETS.map((bucket) => ({
    category: bucket.category,
    items: bucket.terms.filter((term) => includesTerm(text, term)).slice(0, 8)
  })).filter((bucket) => bucket.items.length > 0);

  const responsibilities = extractResponsibilities(text);
  if (responsibilities.length > 0) {
    categories.push({
      category: "Role Signals",
      items: responsibilities
    });
  }

  return categories.slice(0, 8);
}

export async function POST(request: Request) {
  const gate = await requireAuthAndRateLimit(request, "ai-job-skills");
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as { jdText?: string };

    if (!body.jdText || !body.jdText.trim()) {
      return Response.json({ error: "A job description is required." }, { status: 400 });
    }

    return Response.json({
      ok: true,
      skillCategories: extractSkillCategories(body.jdText)
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to extract skills from this job description."
      },
      { status: 500 }
    );
  }
}
