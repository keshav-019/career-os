import type {
  CodingProblemJudgeData,
  CodingProblemPublicDetail,
  CodingProblemPublicSummary,
  CodingProblemRecord
} from "./types";

export function toPublicSummary(record: CodingProblemRecord): CodingProblemPublicSummary {
  return {
    companies: record.companies,
    difficulty: record.difficulty,
    id: record.id,
    order: record.order,
    tags: record.tags,
    title: record.title
  };
}

export function toPublicDetail(record: CodingProblemRecord): CodingProblemPublicDetail {
  return {
    ...toPublicSummary(record),
    constraints: record.constraints,
    examples: record.examples,
    hiddenTestCount: record.hiddenTests.length,
    inputFormat: record.inputFormat,
    outputFormat: record.outputFormat,
    starterCode: record.starterCode,
    statement: record.statement,
    visibleTests: record.visibleTests
  };
}

/**
 * Everything the local judge needs. Only ever return this to the desktop helper server's own fetch (a separate OS
 * process, authenticated with the signed-in user's id token) - never to a browser/renderer request directly.
 */
export function toJudgeData(record: CodingProblemRecord): CodingProblemJudgeData {
  return {
    harness: record.harness,
    hiddenTests: record.hiddenTests,
    starterCode: record.starterCode,
    timeLimitMs: record.timeLimitMs,
    visibleTests: record.visibleTests
  };
}
