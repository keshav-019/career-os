import type { JobFitInput, JobFitScore } from "./types";

const tokenize = (value: string) =>
  new Set(value.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []);

const includesKeyword = (tokens: Set<string>, keyword: string) => {
  const parts = keyword.toLowerCase().match(/[a-z0-9+#.]+/g) ?? [];
  return parts.every((part) => tokens.has(part));
};

export function calculateJobFit(input: JobFitInput): JobFitScore {
  const resumeText = input.resumeHighlights.join(" ");
  const jobTokens = tokenize(input.jobDescription);
  const resumeTokens = tokenize(resumeText);
  const niceToHaveKeywords = input.niceToHaveKeywords ?? [];

  const matchedMustHaves = input.mustHaveKeywords.filter(
    (keyword) => includesKeyword(jobTokens, keyword) && includesKeyword(resumeTokens, keyword)
  );
  const matchedNiceToHaves = niceToHaveKeywords.filter(
    (keyword) => includesKeyword(jobTokens, keyword) && includesKeyword(resumeTokens, keyword)
  );

  const missingKeywords = [...input.mustHaveKeywords, ...niceToHaveKeywords].filter(
    (keyword) => includesKeyword(jobTokens, keyword) && !includesKeyword(resumeTokens, keyword)
  );

  const mustHaveScore =
    input.mustHaveKeywords.length === 0
      ? 60
      : (matchedMustHaves.length / input.mustHaveKeywords.length) * 60;
  const niceToHaveScore =
    niceToHaveKeywords.length === 0
      ? 25
      : (matchedNiceToHaves.length / niceToHaveKeywords.length) * 25;
  const coverageBonus = Math.min(15, Math.max(0, resumeTokens.size / 10));
  const score = Math.round(Math.min(100, mustHaveScore + niceToHaveScore + coverageBonus));

  return {
    score,
    matchedKeywords: [...matchedMustHaves, ...matchedNiceToHaves],
    missingKeywords,
    rationale:
      score >= 80
        ? "Strong role alignment with only small keyword gaps."
        : score >= 60
          ? "Promising role fit with a few resume targeting opportunities."
          : "Needs stronger resume alignment before applying."
  };
}
