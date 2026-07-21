"use client";

import type { CodingProblemSummary } from "./coding-arena-client";

export const CODING_PAPER_DURATION_MINUTES = 90;

export type CodingPaperProblem = Pick<CodingProblemSummary, "id" | "title" | "difficulty" | "tags" | "companies">;

export type CodingPaper = {
  id: string;
  title: string;
  durationMinutes: number;
  focus: string;
  problems: CodingPaperProblem[];
};

function hasDifficulty(problem: CodingProblemSummary, tokens: string[]): boolean {
  const difficulty = problem.difficulty.toLowerCase();
  return tokens.some((token) => difficulty.includes(token));
}

function pickWrapped<T>(items: T[], index: number): T | null {
  if (items.length === 0) return null;
  return items[index % items.length];
}

function addUniqueProblem(target: CodingPaperProblem[], candidate: CodingProblemSummary | null, fallback: CodingProblemSummary[]): void {
  if (candidate && !target.some((problem) => problem.id === candidate.id)) {
    target.push(candidate);
    return;
  }

  const replacement = fallback.find((problem) => !target.some((selected) => selected.id === problem.id));
  if (replacement) target.push(replacement);
}

function summarizeFocus(problems: CodingPaperProblem[]): string {
  const tagCounts = new Map<string, number>();
  const companyCounts = new Map<string, number>();

  for (const problem of problems) {
    for (const tag of problem.tags.slice(0, 3)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    for (const company of problem.companies.slice(0, 2)) companyCounts.set(company, (companyCounts.get(company) ?? 0) + 1);
  }

  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([tag]) => tag);
  const companies = [...companyCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([company]) => company);

  return [...companies, ...tags].slice(0, 4).join(" / ") || "Mixed interview patterns";
}

export function buildCodingPapers(problems: CodingProblemSummary[]): CodingPaper[] {
  if (problems.length === 0) return [];

  const ordered = [...problems].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const easyMedium = ordered.filter((problem) => hasDifficulty(problem, ["easy", "medium"]));
  const hardMedium = ordered.filter((problem) => hasDifficulty(problem, ["medium", "hard"]));
  const hard = ordered.filter((problem) => hasDifficulty(problem, ["hard"]));
  const paperCount = Math.max(1, Math.min(12, Math.ceil(ordered.length / 3)));

  return Array.from({ length: paperCount }, (_, index) => {
    const selected: CodingPaperProblem[] = [];
    addUniqueProblem(selected, pickWrapped(easyMedium, index), ordered);
    addUniqueProblem(selected, pickWrapped(hardMedium, index + 3), ordered);
    addUniqueProblem(selected, pickWrapped(hard, index + 7), ordered);

    return {
      id: `career-os-paper-${index + 1}`,
      title: `CareerOS Paper ${index + 1}`,
      durationMinutes: CODING_PAPER_DURATION_MINUTES,
      focus: summarizeFocus(selected),
      problems: selected
    };
  });
}
