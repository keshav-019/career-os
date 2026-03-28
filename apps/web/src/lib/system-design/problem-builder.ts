import type { SystemDesignProblemRecord, SystemDesignProblemSourceInput } from "./catalog.server";
import { COMPONENT_LIBRARY } from "./component-library";

const ALLOWED_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const KNOWN_COMPONENT_IDS = new Set(COMPONENT_LIBRARY.map((component) => component.id));

export type BuildProblemContext = {
  createdBy: string;
  existingCreatedAt?: string;
  order: number;
};

function fail(message: string): never {
  throw new Error(message);
}

/**
 * Validates an admin-submitted system-design problem. Much lighter than
 * lib/coding-catalog/problem-builder.ts's `buildCodingProblemRecord` - there's no starter code or
 * hidden-test harness to generate here, and no reference solution to execute. This mostly checks
 * structural integrity of the tree (every node's parentId points somewhere real, no duplicate
 * component ids, the tradeoff's nodeId actually exists in the tree) since a typo here would only
 * surface as a silently-ungradable puzzle at play time otherwise.
 */
export function buildSystemDesignProblemRecord(
  input: SystemDesignProblemSourceInput,
  context: BuildProblemContext
): SystemDesignProblemRecord {
  if (!input.id || !ALLOWED_ID_PATTERN.test(input.id)) {
    fail("id must be lowercase letters, numbers, and hyphens only (2-64 characters).");
  }
  if (!input.title?.trim()) {
    fail("title is required.");
  }
  if (!input.summary?.trim()) {
    fail("summary is required.");
  }
  if (!input.statement?.trim()) {
    fail("statement is required.");
  }
  if (input.rootComponentId !== "client") {
    fail('rootComponentId must be exactly "client".');
  }
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    fail("nodes must have at least one entry.");
  }
  if (!Array.isArray(input.functionalRequirements) || input.functionalRequirements.length === 0) {
    fail("At least one functional requirement is required.");
  }
  if (!Array.isArray(input.nonFunctionalRequirements) || input.nonFunctionalRequirements.length === 0) {
    fail("At least one non-functional requirement is required.");
  }
  if (!Array.isArray(input.keyTakeaways) || input.keyTakeaways.length === 0) {
    fail("At least one key takeaway is required.");
  }

  const errors: string[] = [];
  const nodeIds = new Set<string>();

  input.nodes.forEach((node, index) => {
    if (!node.id?.trim()) {
      errors.push(`Node #${index + 1}: id is required.`);
      return;
    }
    if (nodeIds.has(node.id)) {
      errors.push(`Node #${index + 1}: duplicate component id "${node.id}" - each component id must be unique within a problem.`);
    }
    nodeIds.add(node.id);
    if (!KNOWN_COMPONENT_IDS.has(node.id)) {
      errors.push(`Node #${index + 1}: "${node.id}" isn't a known component id - add it to component-library.ts first, or fix the typo.`);
    }
    if (!node.whyItFits?.trim()) {
      errors.push(`Node #${index + 1} (${node.id}): whyItFits is required.`);
    }
    if (!node.misplacedHint?.trim()) {
      errors.push(`Node #${index + 1} (${node.id}): misplacedHint is required.`);
    }
  });

  input.nodes.forEach((node, index) => {
    if (node.parentId !== null && node.parentId !== undefined && node.parentId !== "client" && !nodeIds.has(node.parentId)) {
      errors.push(`Node #${index + 1} (${node.id}): parentId "${node.parentId}" doesn't match any node id in this problem (or null/"client" for the root).`);
    }
  });

  (input.distractorIds ?? []).forEach((distractorId, index) => {
    if (!KNOWN_COMPONENT_IDS.has(distractorId)) {
      errors.push(`Distractor #${index + 1}: "${distractorId}" isn't a known component id.`);
    }
    if (nodeIds.has(distractorId)) {
      errors.push(`Distractor #${index + 1}: "${distractorId}" is already a real node in this problem's tree - distractors must not belong.`);
    }
  });

  if (input.tradeoff) {
    if (!nodeIds.has(input.tradeoff.nodeId)) {
      errors.push(`tradeoff.nodeId "${input.tradeoff.nodeId}" doesn't match any node id in this problem.`);
    }
    if (!Array.isArray(input.tradeoff.options) || input.tradeoff.options.length === 0) {
      errors.push("tradeoff.options must have at least one entry.");
    } else {
      const correctCount = input.tradeoff.options.filter((option) => option.correct).length;
      if (correctCount !== 1) {
        errors.push(`tradeoff.options must have exactly one option with correct: true (found ${correctCount}).`);
      }
    }
  }

  (input.failureQuestions ?? []).forEach((question, index) => {
    const optionIds = new Set(question.options.map((option) => option.id));
    if (!optionIds.has(question.correctOptionId)) {
      errors.push(`failureQuestions #${index + 1} (${question.id}): correctOptionId "${question.correctOptionId}" doesn't match any of its own options.`);
    }
  });

  (input.estimationQuestions ?? []).forEach((question, index) => {
    if (!Number.isFinite(question.expectedValue)) {
      errors.push(`estimationQuestions #${index + 1} (${question.id}): expectedValue must be a finite number.`);
    }
    if (!Number.isFinite(question.tolerancePercent) || question.tolerancePercent <= 0) {
      errors.push(`estimationQuestions #${index + 1} (${question.id}): tolerancePercent must be a positive number.`);
    }
  });

  if (errors.length > 0) {
    fail(errors.join("\n"));
  }

  const now = new Date().toISOString();

  return {
    ...input,
    companies: input.companies ?? [],
    createdAt: context.existingCreatedAt ?? now,
    createdBy: context.createdBy,
    distractorIds: input.distractorIds ?? [],
    id: input.id,
    order: context.order,
    sourceJson: JSON.stringify(input, null, 2),
    tags: input.tags ?? [],
    title: input.title.trim(),
    updatedAt: now
  };
}
