import fs from "node:fs/promises";
import path from "node:path";
import { learningAssetUrl } from "@/lib/learning/asset-url";
import { getR2Json, uploadToR2 } from "@/lib/r2/client";
import osFigureDimensions from "./os-figure-dimensions.json";

export type LearningTrackId = "computer-science" | "ai";

type MaterialReference = {
  bestFor?: string;
  id: string;
  publisher?: string;
  title: string;
  type?: string;
  url: string;
};

type MaterialFigure = {
  caption?: string;
  description?: string;
  height?: number;
  id: string;
  page?: number | string;
  reference?: string;
  src: string;
  width?: number;
};

type MaterialTopic = {
  candidateTraps?: string[];
  coreNotes?: string[];
  difficulty?: string;
  figures?: MaterialFigure[];
  focusKeywords?: string[];
  id?: number;
  learningObjectives?: string[];
  pageEnd?: number | string;
  pageStart?: number | string;
  paragraphPages?: Array<number | string>;
  practiceDrills?: string[];
  readingParagraphs?: string[];
  recommendedStudyOrderWithinSubject?: number;
  referenceIds?: string[];
  rulesAndFormulas?: string[];
  title: string;
  topicId?: string;
  unicodeSketch?: string;
  visualStudyReferenceIds?: string[];
};

type MaterialSubject = {
  capstoneTasks?: string[];
  defaultReferenceIds?: string[];
  order?: number;
  overview?: string;
  selfAssessmentChecklist?: string[];
  subjectId?: string;
  title: string;
  topicCount?: number;
  topics?: MaterialTopic[];
};

type MaterialMetadata = {
  trackId?: string;
  track?: string;
  title?: string;
};

type MaterialFile = {
  globalStudyPlan?: string[];
  metadata?: MaterialMetadata;
  referenceCatalog?: MaterialReference[];
  subjects?: MaterialSubject[];
};

function getPublicImageDimensions(src: string): { height: number; width: number } | null {
  return (osFigureDimensions as Record<string, { height: number; width: number }>)[src] ?? null;
}

type JsonRecord = Record<string, unknown>;

type ReferenceDescriptor = {
  bestFor?: string;
  publisher?: string;
  title?: string;
  type?: string;
  url: string;
};

type ParsedMaterialFile = {
  datasetKey: string;
  fileName: string;
  globalStudyPlan: string[];
  metadataTitle: string;
  referenceCatalog: MaterialReference[];
  subjects: MaterialSubject[];
  trackId: LearningTrackId;
};

type SubjectSummary = {
  capstoneTasks: string[];
  defaultReferenceIds: string[];
  id: string;
  order: number;
  overview: string;
  selfAssessmentChecklist: string[];
  title: string;
  topicCount: number;
  topics: TopicSummary[];
};

type TopicSummary = {
  difficulty: string;
  focusKeywords: string[];
  id: string;
  title: string;
};

type TrackSummary = {
  available: boolean;
  description: string;
  id: LearningTrackId;
  imageAlt: string;
  imageSrc: string;
  subjects: SubjectSummary[];
  subtitle: string;
  title: string;
  topicCount: number;
};

type LibrarySummary = {
  generatedAt: string;
  tracks: TrackSummary[];
};

type TopicReferenceGroup = {
  id: string;
  title: string;
  references: MaterialReference[];
};

type TopicDetail = {
  difficulty: string;
  figures: MaterialFigure[];
  focusKeywords: string[];
  pageEnd?: number;
  pageStart?: number;
  paragraphPages: number[];
  readingParagraphs: string[];
  referenceGroups: TopicReferenceGroup[];
  subjectId: string;
  subjectTitle: string;
  title: string;
  topicId: string;
};

export type LearningTopicFigureEdit = {
  caption?: string;
  dataUrl?: string;
  description?: string;
  height?: number;
  id?: string;
  page?: number | string;
  reference?: string;
  src?: string;
  width?: number;
};

const TRACK_ORDER: LearningTrackId[] = ["computer-science", "ai"];

const TRACK_DEFS: Record<
  LearningTrackId,
  { description: string; imageAlt: string; imageSrc: string; subtitle: string; title: string }
> = {
  "computer-science": {
    title: "Computer Science",
    subtitle: "Fundamentals and interview-ready concepts",
    description:
      "OS, Database Systems, Computer Networks, System Design, algorithms, and practical Python/C/Data Structures foundations.",
    imageSrc: "/war-room/cs-card.svg",
    imageAlt: "Computer science track visual"
  },
  ai: {
    title: "AI",
    subtitle: "ML, GenAI, and model reasoning",
    description: "AI role preparation with ML concepts, evaluation strategy, and model behavior analysis.",
    imageSrc: "/war-room/ai-card.svg",
    imageAlt: "AI track visual"
  }
};

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function dedupeStrings(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(trimmed);
  });

  return result;
}

function labelFromKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toSentenceCase(value: string): string {
  if (!value.trim()) {
    return value;
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toDetailedLines(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return dedupeStrings(value.flatMap((entry) => toDetailedLines(entry)));
  }

  const record = toRecord(value);
  if (!record) {
    return [];
  }

  const lines: string[] = [];
  const heading = toStringValue(record.section) || toStringValue(record.title) || toStringValue(record.name);
  const readingNote = toStringValue(record.reading_note);
  if (readingNote) {
    lines.push(heading ? `${heading}: ${readingNote}` : readingNote);
  }

  if (Array.isArray(record.details)) {
    const details = toDetailedLines(record.details);
    if (heading) {
      details.forEach((detail) => {
        lines.push(`${heading}: ${detail}`);
      });
    } else {
      lines.push(...details);
    }
  }

  const setup = toStringValue(record.setup);
  if (setup) {
    lines.push(`Setup: ${setup}`);
  }

  const deliverable = toStringValue(record.deliverable);
  if (deliverable) {
    lines.push(`Deliverable: ${deliverable}`);
  }

  if (Array.isArray(record.tasks)) {
    lines.push(...toDetailedLines(record.tasks));
  }

  const purpose = toStringValue(record.purpose);
  if (purpose) {
    lines.push(heading ? `${heading} Purpose: ${purpose}` : purpose);
  }

  const prompt = toStringValue(record.candidate_prompt);
  if (prompt) {
    lines.push(`Prompt: ${prompt}`);
  }

  if (Array.isArray(record.must_label)) {
    lines.push(...toDetailedLines(record.must_label).map((label) => `Must label: ${label}`));
  }

  Object.entries(record).forEach(([key, entryValue]) => {
    if (
      [
        "section",
        "title",
        "name",
        "reading_note",
        "details",
        "setup",
        "deliverable",
        "tasks",
        "purpose",
        "candidate_prompt",
        "must_label",
        "reference_links",
        "url"
      ].includes(key)
    ) {
      return;
    }

    const scalar = toStringValue(entryValue);
    if (scalar) {
      lines.push(`${labelFromKey(key)}: ${scalar}`);
    }
  });

  return dedupeStrings(lines);
}

function normalizeDifficulty(value: unknown): string {
  const raw = toStringValue(value);
  if (!raw) {
    return "Medium";
  }

  return toSentenceCase(raw);
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]}]+/gi;

function sanitizeUrl(url: string): string {
  return url.trim().replace(/[),.;]+$/g, "");
}

function normalizeHttpUrl(url: string): string | null {
  const trimmed = sanitizeUrl(url);
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

function collectReferenceDescriptors(value: unknown, fallbackTitle: string): ReferenceDescriptor[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    URL_PATTERN.lastIndex = 0;
    const matches = Array.from(value.matchAll(URL_PATTERN));
    return matches
      .map((match) => normalizeHttpUrl(match[0]))
      .filter((url): url is string => Boolean(url))
      .map((url) => ({
        title: fallbackTitle,
        url
      }));
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectReferenceDescriptors(entry, fallbackTitle));
  }

  const record = toRecord(value);
  if (!record) {
    return [];
  }

  const title = toStringValue(record.title) || toStringValue(record.name) || fallbackTitle;
  const descriptors: ReferenceDescriptor[] = [];
  const directUrl = normalizeHttpUrl(toStringValue(record.url));
  if (directUrl) {
    descriptors.push({
      title,
      url: directUrl,
      bestFor: toStringValue(record.bestFor) || toStringValue(record.purpose) || undefined,
      publisher: toStringValue(record.publisher) || undefined,
      type: toStringValue(record.type) || undefined
    });
  }

  Object.entries(record).forEach(([key, entryValue]) => {
    if (key === "url") {
      return;
    }

    descriptors.push(...collectReferenceDescriptors(entryValue, title || fallbackTitle));
  });

  return descriptors;
}

function fallbackReferenceTitle(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "Reference";
  }
}

function upsertReference(
  descriptor: ReferenceDescriptor,
  datasetKey: string,
  referenceCatalog: MaterialReference[],
  referenceByUrl: Map<string, string>
): string | null {
  const url = normalizeHttpUrl(descriptor.url);
  if (!url) {
    return null;
  }

  const existingId = referenceByUrl.get(url);
  if (existingId) {
    return existingId;
  }

  const id = `${datasetKey}::ref-${referenceCatalog.length + 1}`;
  referenceCatalog.push({
    id,
    title: descriptor.title?.trim() || fallbackReferenceTitle(url),
    url,
    bestFor: descriptor.bestFor,
    publisher: descriptor.publisher,
    type: descriptor.type
  });
  referenceByUrl.set(url, id);

  return id;
}

function collectReferenceIds(
  value: unknown,
  topicTitle: string,
  datasetKey: string,
  referenceCatalog: MaterialReference[],
  referenceByUrl: Map<string, string>
): string[] {
  const descriptors = collectReferenceDescriptors(value, topicTitle);
  const ids = descriptors
    .map((descriptor) => upsertReference(descriptor, datasetKey, referenceCatalog, referenceByUrl))
    .filter((id): id is string => Boolean(id));

  return Array.from(new Set(ids));
}

function toSafeReference(value: unknown): MaterialReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  const url = typeof entry.url === "string" ? entry.url.trim() : "";
  if (!id || !title || !url) {
    return null;
  }

  const normalizedUrl = normalizeHttpUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  return {
    id,
    title,
    url: normalizedUrl,
    type: typeof entry.type === "string" ? entry.type : undefined,
    publisher: typeof entry.publisher === "string" ? entry.publisher : undefined,
    bestFor: typeof entry.bestFor === "string" ? entry.bestFor : undefined
  };
}

function detectTrackId(fileName: string, title: string, metadataTrack: string): LearningTrackId {
  const explicit = metadataTrack.trim().toLowerCase();
  if (explicit === "computer-science" || explicit === "computer science" || explicit === "cs") {
    return "computer-science";
  }

  if (explicit === "system-design" || explicit === "system design" || explicit === "design") {
    return "computer-science";
  }

  if (explicit === "ai" || explicit === "artificial intelligence" || explicit === "machine learning") {
    return "ai";
  }

  const source = `${fileName} ${title}`.toLowerCase();

  if (/(system[-\s]?design|hld|lld|distributed)/.test(source)) {
    return "computer-science";
  }

  if (/\bai\b|artificial intelligence|machine learning|genai/.test(source)) {
    return "ai";
  }

  return "computer-science";
}

function removeLegacyComputerScienceSubjects(subjects: MaterialSubject[]): MaterialSubject[] {
  return subjects.filter((subject) => {
    const titleKey = normalizeSlug(typeof subject.title === "string" ? subject.title : "");
    const idKey = normalizeSlug(typeof subject.subjectId === "string" ? subject.subjectId : "");
    const isProgrammingFundamentals = titleKey === "programming-fundamentals" || idKey === "programming-fundamentals";
    const isLegacyCProgramming = titleKey === "c-programming" || idKey === "c-programming";
    const isLegacyDataStructures = titleKey === "data-structures" || idKey === "data-structures";
    const isLegacyAlgorithms = titleKey === "algorithms" || idKey === "algorithms";
    const isLegacyOperatingSystems = titleKey === "operating-systems" || idKey === "operating-systems";
    return (
      !isProgrammingFundamentals &&
      !isLegacyCProgramming &&
      !isLegacyDataStructures &&
      !isLegacyAlgorithms &&
      !isLegacyOperatingSystems
    );
  });
}

function buildReadingParagraphs(topic: MaterialTopic): string[] {
  const curatedParagraphs = toArrayOfStrings(topic.readingParagraphs);
  if (curatedParagraphs.length > 0) {
    return curatedParagraphs;
  }

  const derived = dedupeStrings([
    ...toArrayOfStrings(topic.coreNotes),
    ...toArrayOfStrings(topic.rulesAndFormulas).map((line) => `Formula / rule: ${line}`),
    ...toArrayOfStrings(topic.learningObjectives).map((line) => `Learning checkpoint: ${line}`),
    ...toArrayOfStrings(topic.candidateTraps).map((line) => `Watch-out: ${line}`),
    ...toArrayOfStrings(topic.practiceDrills).map((line) => `Practice prompt: ${line}`),
    typeof topic.unicodeSketch === "string" && topic.unicodeSketch.trim()
      ? `Quick visual sketch:\n${topic.unicodeSketch}`
      : ""
  ]);

  if (derived.length > 0) {
    return derived;
  }

  return ["Detailed reading notes for this topic will be added soon."];
}

function parseClassicMaterialFile(
  entryName: string,
  datasetKey: string,
  rawRecord: JsonRecord
): ParsedMaterialFile | null {
  const raw = rawRecord as MaterialFile;
  const subjects = Array.isArray(raw.subjects) ? raw.subjects : [];
  if (subjects.length === 0) {
    return null;
  }

  const metadata = toRecord(raw.metadata);
  const metadataTitle = toStringValue(metadata?.title) || entryName;
  const metadataTrack = toStringValue(metadata?.trackId) || toStringValue(metadata?.track);

  const referenceCatalog = (Array.isArray(raw.referenceCatalog) ? raw.referenceCatalog : [])
    .map((value) => toSafeReference(value))
    .filter((value): value is MaterialReference => Boolean(value));

  const trackId = detectTrackId(entryName, metadataTitle, metadataTrack);
  const isComputerScienceBaseDataset = entryName === "cse_detailed_reading_material_minified.json";
  const normalizedSubjects =
    trackId === "computer-science" && isComputerScienceBaseDataset
      ? removeLegacyComputerScienceSubjects(subjects)
      : subjects;

  return {
    fileName: entryName,
    datasetKey,
    metadataTitle,
    trackId,
    globalStudyPlan: toArrayOfStrings(raw.globalStudyPlan),
    referenceCatalog,
    subjects: normalizedSubjects
  };
}

function parseAiRoleMaterialFile(
  entryName: string,
  datasetKey: string,
  rawRecord: JsonRecord
): ParsedMaterialFile | null {
  const roles = Array.isArray(rawRecord.roles)
    ? rawRecord.roles.map((entry) => toRecord(entry)).filter((entry): entry is JsonRecord => Boolean(entry))
    : [];
  if (roles.length === 0) {
    return null;
  }

  const phaseLabel = toStringValue(rawRecord.phase_label);
  const phaseNumberRaw = rawRecord.phase;
  const phaseNumber =
    typeof phaseNumberRaw === "number" && Number.isFinite(phaseNumberRaw) ? phaseNumberRaw : null;
  const metadataTitle = phaseLabel || entryName;
  const referenceCatalog: MaterialReference[] = [];
  const referenceByUrl = new Map<string, string>();

  const subjects: MaterialSubject[] = roles.map((role, roleIndex) => {
    const roleName = toStringValue(role.role) || `AI Role ${roleIndex + 1}`;
    const topicsRaw = Array.isArray(role.topics)
      ? role.topics.map((entry) => toRecord(entry)).filter((entry): entry is JsonRecord => Boolean(entry))
      : [];

    const topics: MaterialTopic[] = topicsRaw.map((topic, topicIndex) => {
      const topicTitle = toStringValue(topic.topic) || `Topic ${topicIndex + 1}`;
      const topicId = toStringValue(topic.topic_id) || `topic-${topicIndex + 1}`;
      const topicReferences = collectReferenceIds(
        topic,
        `${roleName} - ${topicTitle}`,
        datasetKey,
        referenceCatalog,
        referenceByUrl
      );

      return {
        topicId,
        title: topicTitle,
        difficulty: normalizeDifficulty(topic.difficulty_scope),
        focusKeywords: dedupeStrings([
          ...toDetailedLines(topic.related_terms),
          toStringValue(topic.category)
        ]).slice(0, 8),
        learningObjectives: dedupeStrings([toStringValue(topic.learning_objective)]),
        coreNotes: dedupeStrings([
          toStringValue(topic.overview),
          toStringValue(topic.role_application),
          ...toDetailedLines(topic.reading_sections),
          ...toDetailedLines(topic.concepts_to_master)
        ]),
        rulesAndFormulas: dedupeStrings([...toDetailedLines(topic.reading_path)]),
        candidateTraps: dedupeStrings([...toDetailedLines(topic.common_pitfalls)]),
        practiceDrills: dedupeStrings([
          ...toDetailedLines(topic.practice_drills),
          ...toDetailedLines(topic.mastery_check),
          ...toDetailedLines(topic.assessment_prompts),
          ...toDetailedLines(topic.suggested_output_artifacts),
          ...toDetailedLines(topic.practice_lab)
        ]),
        referenceIds: topicReferences
      };
    });

    const orderBase = phaseNumber ? phaseNumber * 100 : 0;
    return {
      subjectId: `${normalizeSlug(roleName)}${phaseNumber ? `-phase-${phaseNumber}` : ""}`,
      order: orderBase + roleIndex + 1,
      title: roleName,
      overview: dedupeStrings([
        toStringValue(role.role_mission),
        toStringValue(role.quality_bar)
      ]).join(" "),
      topicCount: topics.length,
      topics,
      capstoneTasks: dedupeStrings([...toDetailedLines(role.expected_artifacts)]),
      selfAssessmentChecklist: dedupeStrings([...toDetailedLines(role.reading_strategy)]),
      defaultReferenceIds: []
    };
  });

  return {
    fileName: entryName,
    datasetKey,
    metadataTitle,
    trackId: "ai",
    globalStudyPlan: dedupeStrings([
      toStringValue(rawRecord.intended_use),
      ...toDetailedLines(rawRecord.roles_in_phase)
    ]),
    referenceCatalog,
    subjects
  };
}

function parseSystemDesignMaterialFile(
  entryName: string,
  datasetKey: string,
  rawRecord: JsonRecord
): ParsedMaterialFile | null {
  const modules = Array.isArray(rawRecord.modules)
    ? rawRecord.modules.map((entry) => toRecord(entry)).filter((entry): entry is JsonRecord => Boolean(entry))
    : [];
  if (modules.length === 0) {
    return null;
  }

  const metadata = toRecord(rawRecord.metadata);
  const metadataTitle = toStringValue(metadata?.title) || entryName;
  const referenceCatalog: MaterialReference[] = [];
  const referenceByUrl = new Map<string, string>();
  const areaMap = new Map<string, JsonRecord[]>();

  modules.forEach((module) => {
    const area = toStringValue(module.area) || "General System Design";
    const current = areaMap.get(area) ?? [];
    current.push(module);
    areaMap.set(area, current);
  });

  const areas = Array.from(areaMap.entries());
  const subjects: MaterialSubject[] = areas.map(([area, areaModules], areaIndex) => {
    const sortedModules = areaModules.sort((first, second) =>
      toStringValue(first.id).localeCompare(toStringValue(second.id), undefined, { numeric: true })
    );

    const topics: MaterialTopic[] = sortedModules.map((module, topicIndex) => {
      const topicTitle = toStringValue(module.topic) || `Topic ${topicIndex + 1}`;
      const topicId = toStringValue(module.id) || `module-${topicIndex + 1}`;

      const topicReferences = collectReferenceIds(
        module,
        `${area} - ${topicTitle}`,
        datasetKey,
        referenceCatalog,
        referenceByUrl
      );
      const visualReferences = collectReferenceIds(
        module.diagrams_to_draw,
        `${topicTitle} Diagrams`,
        datasetKey,
        referenceCatalog,
        referenceByUrl
      );

      const deepDive = toRecord(module.topic_specific_deep_dive);
      return {
        topicId,
        title: topicTitle,
        difficulty: normalizeDifficulty(module.difficulty_scope),
        focusKeywords: dedupeStrings([
          ...toDetailedLines(module.concepts_to_master),
          toStringValue(module.interview_frequency)
        ]).slice(0, 8),
        learningObjectives: dedupeStrings([toStringValue(module.learning_objective)]),
        coreNotes: dedupeStrings([
          toStringValue(module.overview),
          toStringValue(module.role_application),
          ...toDetailedLines(module.reading_sections),
          ...toDetailedLines(deepDive?.study_notes)
        ]),
        rulesAndFormulas: dedupeStrings([
          ...toDetailedLines(module.reading_path),
          ...toDetailedLines(module.tradeoffs_to_be_able_to_explain),
          ...toDetailedLines(deepDive?.questions_to_answer_before_interview)
        ]),
        candidateTraps: dedupeStrings([...toDetailedLines(module.common_failure_modes)]),
        practiceDrills: dedupeStrings([
          ...toDetailedLines(module.practice_drills),
          ...toDetailedLines(module.mastery_check),
          ...toDetailedLines(module.assessment_prompts),
          ...toDetailedLines(module.hands_on_labs),
          ...toDetailedLines(module.suggested_output_artifacts),
          ...toDetailedLines(deepDive?.advanced_variations_to_practice),
          ...toDetailedLines(deepDive?.senior_level_signals)
        ]),
        referenceIds: topicReferences,
        visualStudyReferenceIds: visualReferences
      };
    });

    return {
      subjectId: normalizeSlug(area),
      order: areaIndex + 1,
      title: area,
      overview: `${topics.length} curated system design modules with interview-grade drill-downs.`,
      topicCount: topics.length,
      topics,
      capstoneTasks: [],
      selfAssessmentChecklist: [],
      defaultReferenceIds: []
    };
  });

  return {
    fileName: entryName,
    datasetKey,
    metadataTitle,
    trackId: "computer-science",
    globalStudyPlan: dedupeStrings([
      ...toDetailedLines(rawRecord.global_study_sequence),
      ...toDetailedLines(rawRecord.interview_answer_template)
    ]),
    referenceCatalog,
    subjects
  };
}

function parseMaterialFile(entryName: string, rawRecord: JsonRecord): ParsedMaterialFile | null {
  const datasetKey = normalizeSlug(entryName.replace(/\.json$/i, ""));
  return (
    parseClassicMaterialFile(entryName, datasetKey, rawRecord) ??
    parseSystemDesignMaterialFile(entryName, datasetKey, rawRecord) ??
    parseAiRoleMaterialFile(entryName, datasetKey, rawRecord)
  );
}

// These 10 files used to be statically `import`ed straight from the repo-root learning-material/ directory
// (~14MB total) - that bloated both the git repo and this module's parsed size at build/import time even though
// it's server-only code. They're now uploaded as-is to R2 under learning-material/<filename> and fetched lazily,
// once per server process, the same pattern as lib/interview/{ai-role-bank,computer-science-bank}.ts.
const MATERIAL_DATASET_ENTRY_NAMES = [
  "algorithms_textbook_clean.min.json",
  "operating_systems_textbook_clean.min.json",
  "database_systems_textbook_clean.min.json",
  "computer_networks_textbook_clean.min.json",
  "system_design_interview_textbook_clean.min.json",
  "python_programming_textbook_clean.min.json",
  "c_programming_textbook_clean.min.json",
  "data_structures_textbook_clean.min.json",
  "cse_detailed_reading_material_minified.json",
  "ai_textbook_curriculum_clean.min.json"
] as const;

let parsedMaterialCache: ParsedMaterialFile[] | null = null;
let parsedMaterialLoadPromise: Promise<ParsedMaterialFile[]> | null = null;

async function fetchRawMaterialDatasets(): Promise<Array<{ entryName: string; raw: unknown }>> {
  return Promise.all(
    MATERIAL_DATASET_ENTRY_NAMES.map(async (entryName) => ({
      entryName,
      raw: await getR2Json<unknown>(`learning-material/${entryName}`)
    }))
  );
}

async function loadMaterialFiles(): Promise<ParsedMaterialFile[]> {
  if (parsedMaterialCache) {
    return parsedMaterialCache;
  }

  if (!parsedMaterialLoadPromise) {
    parsedMaterialLoadPromise = fetchRawMaterialDatasets().then((rawDatasets) => {
      const files: ParsedMaterialFile[] = [];

      rawDatasets.forEach((dataset) => {
        const rawRecord = toRecord(dataset.raw);
        if (!rawRecord) {
          return;
        }

        const parsed = parseMaterialFile(dataset.entryName, rawRecord);
        if (!parsed) {
          return;
        }

        files.push(parsed);
      });

      return files;
    });
  }

  parsedMaterialCache = await parsedMaterialLoadPromise;
  return parsedMaterialCache;
}

function resolveTopicId(subjectId: string, topic: MaterialTopic, index: number): string {
  const rawId =
    typeof topic.topicId === "string" && topic.topicId.trim().length > 0
      ? topic.topicId
      : typeof topic.id === "number"
        ? String(topic.id)
        : `topic-${index + 1}`;

  return `${subjectId}::${normalizeSlug(rawId)}`;
}

function resolveSubjectId(datasetKey: string, subject: MaterialSubject, index: number): string {
  const rawId =
    typeof subject.subjectId === "string" && subject.subjectId.trim().length > 0
      ? subject.subjectId
      : `subject-${index + 1}`;

  return `${datasetKey}::${normalizeSlug(rawId)}`;
}

export async function getLearningLibrarySummary(): Promise<LibrarySummary> {
  const files = await loadMaterialFiles();
  const tracks: TrackSummary[] = TRACK_ORDER.map((trackId) => {
    const datasets = files.filter((file) => file.trackId === trackId);
    const subjects: SubjectSummary[] = [];
    let topicCount = 0;

    datasets.forEach((dataset) => {
      dataset.subjects.forEach((subject, subjectIndex) => {
        const subjectId = resolveSubjectId(dataset.datasetKey, subject, subjectIndex);
        const topicList = Array.isArray(subject.topics) ? subject.topics : [];
        const topics = topicList.map((topic, topicIndex) => {
          const topicId = resolveTopicId(subjectId, topic, topicIndex);
          return {
            id: topicId,
            title:
              typeof topic.title === "string" && topic.title.trim().length > 0
                ? topic.title
                : `Topic ${topicIndex + 1}`,
            difficulty: typeof topic.difficulty === "string" ? topic.difficulty : "Medium",
            focusKeywords: toArrayOfStrings(topic.focusKeywords).slice(0, 8)
          };
        });

        topicCount += topics.length;
        subjects.push({
          id: subjectId,
          title:
            typeof subject.title === "string" && subject.title.trim().length > 0
              ? subject.title
              : `Subject ${subjectIndex + 1}`,
          overview: typeof subject.overview === "string" ? subject.overview : "",
          order:
            typeof subject.order === "number" && Number.isFinite(subject.order)
              ? subject.order
              : subjects.length + 1,
          topicCount:
            typeof subject.topicCount === "number" && Number.isFinite(subject.topicCount)
              ? subject.topicCount
              : topics.length,
          topics,
          capstoneTasks: toArrayOfStrings(subject.capstoneTasks),
          selfAssessmentChecklist: toArrayOfStrings(subject.selfAssessmentChecklist),
          defaultReferenceIds: toArrayOfStrings(subject.defaultReferenceIds)
        });
      });
    });

    subjects.sort((first, second) => {
      if (first.order !== second.order) {
        return first.order - second.order;
      }

      return first.title.localeCompare(second.title);
    });

    return {
      id: trackId,
      title: TRACK_DEFS[trackId].title,
      subtitle: TRACK_DEFS[trackId].subtitle,
      description: TRACK_DEFS[trackId].description,
      imageSrc: learningAssetUrl(TRACK_DEFS[trackId].imageSrc),
      imageAlt: TRACK_DEFS[trackId].imageAlt,
      available: subjects.length > 0,
      subjects,
      topicCount
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    tracks
  };
}

function buildReferenceGroups(
  topic: MaterialTopic,
  subject: MaterialSubject,
  referencesById: Map<string, MaterialReference>
): TopicReferenceGroup[] {
  const topicRefs = toArrayOfStrings(topic.referenceIds)
    .map((id) => referencesById.get(id))
    .filter((entry): entry is MaterialReference => Boolean(entry));

  const visualRefs = toArrayOfStrings(topic.visualStudyReferenceIds)
    .map((id) => referencesById.get(id))
    .filter((entry): entry is MaterialReference => Boolean(entry));

  const defaultRefs = toArrayOfStrings(subject.defaultReferenceIds)
    .map((id) => referencesById.get(id))
    .filter((entry): entry is MaterialReference => Boolean(entry));

  const merged = [...visualRefs, ...topicRefs, ...defaultRefs].reduce<MaterialReference[]>(
    (result, reference) => {
      if (!result.some((entry) => entry.id === reference.id)) {
        result.push(reference);
      }

      return result;
    },
    []
  );

  if (merged.length === 0) {
    return [];
  }

  return [
    {
      id: "visual-references",
      title: "Visual Study References",
      references: merged
    }
  ];
}

function buildTopicFigures(topic: MaterialTopic): MaterialFigure[] {
  if (!Array.isArray(topic.figures)) {
    return [];
  }

  const seen = new Set<string>();
  const figures: MaterialFigure[] = [];

  topic.figures.forEach((figure, index) => {
    const srcRaw = toStringValue(figure?.src);
    if (!srcRaw) {
      return;
    }

    const src = srcRaw.startsWith("/") ? srcRaw : normalizeHttpUrl(srcRaw);
    if (!src || seen.has(src)) {
      return;
    }
    seen.add(src);

    const id = toStringValue(figure?.id) || `${normalizeSlug(topic.title || "topic")}-figure-${index + 1}`;
    const caption = toStringValue(figure?.caption) || undefined;
    const description = toStringValue(figure?.description) || undefined;
    const reference = toStringValue(figure?.reference) || undefined;

    const pageRaw = figure?.page;
    const page =
      typeof pageRaw === "number" && Number.isFinite(pageRaw)
        ? pageRaw
        : typeof pageRaw === "string" && /^\d+$/.test(pageRaw.trim())
          ? Number(pageRaw)
          : undefined;
    const inlineWidth = typeof figure?.width === "number" && Number.isFinite(figure.width) ? figure.width : undefined;
    const inlineHeight = typeof figure?.height === "number" && Number.isFinite(figure.height) ? figure.height : undefined;
    const inlineDimensions =
      inlineWidth && inlineHeight
        ? {
            width: inlineWidth,
            height: inlineHeight
          }
        : null;
    const dimensions = getPublicImageDimensions(src) ?? inlineDimensions;

    figures.push({
      id,
      src,
      caption,
      description,
      page,
      reference,
      ...(dimensions ?? {})
    });
  });

  return figures;
}

function buildParagraphPages(topic: MaterialTopic): number[] {
  if (!Array.isArray(topic.paragraphPages)) {
    return [];
  }

  return topic.paragraphPages
    .map((value) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.floor(value)
        : typeof value === "string" && /^\d+$/.test(value.trim())
          ? Number(value)
          : NaN
    )
    .filter((value) => Number.isFinite(value) && value > 0);
}

export async function getLearningTopicDetail(
  trackId: LearningTrackId,
  subjectId: string,
  topicId: string
): Promise<TopicDetail | null> {
  const files = await loadMaterialFiles();
  const datasets = files.filter((file) => file.trackId === trackId);

  for (const dataset of datasets) {
    const referencesById = new Map(dataset.referenceCatalog.map((reference) => [reference.id, reference]));

    for (let subjectIndex = 0; subjectIndex < dataset.subjects.length; subjectIndex += 1) {
      const subject = dataset.subjects[subjectIndex];
      const resolvedSubjectId = resolveSubjectId(dataset.datasetKey, subject, subjectIndex);
      if (resolvedSubjectId !== subjectId) {
        continue;
      }

      const topics = Array.isArray(subject.topics) ? subject.topics : [];
      for (let topicIndex = 0; topicIndex < topics.length; topicIndex += 1) {
        const topic = topics[topicIndex];
        const resolvedTopicId = resolveTopicId(resolvedSubjectId, topic, topicIndex);
        if (resolvedTopicId !== topicId) {
          continue;
        }

        return {
          topicId: resolvedTopicId,
          title:
            typeof topic.title === "string" && topic.title.trim().length > 0
              ? topic.title
              : `Topic ${topicIndex + 1}`,
          difficulty: typeof topic.difficulty === "string" ? topic.difficulty : "Medium",
          subjectId: resolvedSubjectId,
          subjectTitle:
            typeof subject.title === "string" && subject.title.trim().length > 0
              ? subject.title
              : `Subject ${subjectIndex + 1}`,
          figures: buildTopicFigures(topic),
          focusKeywords: toArrayOfStrings(topic.focusKeywords),
          pageStart:
            typeof topic.pageStart === "number" && Number.isFinite(topic.pageStart)
              ? Math.floor(topic.pageStart)
              : typeof topic.pageStart === "string" && /^\d+$/.test(topic.pageStart.trim())
                ? Number(topic.pageStart)
                : undefined,
          pageEnd:
            typeof topic.pageEnd === "number" && Number.isFinite(topic.pageEnd)
              ? Math.floor(topic.pageEnd)
              : typeof topic.pageEnd === "string" && /^\d+$/.test(topic.pageEnd.trim())
                ? Number(topic.pageEnd)
                : undefined,
          paragraphPages: buildParagraphPages(topic),
          readingParagraphs: buildReadingParagraphs(topic),
          referenceGroups: buildReferenceGroups(topic, subject, referencesById)
        };
      }
    }
  }

  return null;
}

function normalizeEditedParagraphs(readingParagraphs: string[]): string[] {
  return readingParagraphs
    .map((paragraph) => paragraph.replace(/\r/g, "").trim())
    .filter((paragraph) => paragraph.length > 0);
}

function toPageNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value);
  }

  return null;
}

function toPositiveDimension(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}

function sanitizeFigureId(value: string, fallback: string): string {
  const normalized = normalizeSlug(value).slice(0, 80);
  return normalized || fallback;
}

function resolvePublicDirectoryPath(): string {
  const configuredDirectory = (process.env.LEARNING_PUBLIC_DIR ?? "").trim();
  return configuredDirectory || path.join(/* turbopackIgnore: true */ process.cwd(), "public");
}

function parseImageDataUrl(dataUrl: string): { buffer: Buffer; extension: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : "jpg";
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
    return null;
  }

  return {
    buffer,
    extension,
    mimeType
  };
}

async function saveEditedFigureImage(
  datasetKey: string,
  topicId: string,
  figureId: string,
  dataUrl: string
): Promise<string> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Pasted image must be a PNG, JPG, WebP, or GIF data URL under 8 MB.");
  }

  const publicDirectory = resolvePublicDirectoryPath();
  const safeDataset = sanitizeFigureId(datasetKey, "learning");
  const safeTopic = sanitizeFigureId(topicId, "topic");
  const safeFigure = sanitizeFigureId(figureId, "figure");
  const uploadDirectory = path.join(
    /* turbopackIgnore: true */ publicDirectory,
    "learning",
    "admin-uploads",
    safeDataset,
    safeTopic
  );
  await fs.mkdir(uploadDirectory, { recursive: true });

  const fileName = `${safeFigure}.${parsed.extension}`;
  const filePath = path.join(/* turbopackIgnore: true */ uploadDirectory, fileName);
  await fs.writeFile(filePath, parsed.buffer);

  return `/learning/admin-uploads/${safeDataset}/${safeTopic}/${fileName}`;
}

function normalizeEditedFigureSrc(value: unknown): string | null {
  const srcRaw = toStringValue(value);
  if (!srcRaw) {
    return null;
  }

  if (srcRaw.startsWith("/learning/")) {
    return srcRaw.slice(0, 1024);
  }

  return normalizeHttpUrl(srcRaw);
}

async function normalizeEditedFigure(
  figure: LearningTopicFigureEdit,
  datasetKey: string,
  topicId: string,
  fallbackIndex: number
): Promise<MaterialFigure | null> {
  const id = sanitizeFigureId(toStringValue(figure.id), `edited-figure-${fallbackIndex + 1}`);
  const dataUrl = toStringValue(figure.dataUrl);
  const src = dataUrl
    ? await saveEditedFigureImage(datasetKey, topicId, id, dataUrl)
    : normalizeEditedFigureSrc(figure.src);

  if (!src) {
    return null;
  }

  const page = toPageNumber(figure.page) ?? undefined;
  const width = toPositiveDimension(figure.width);
  const height = toPositiveDimension(figure.height);

  return {
    id,
    src,
    caption: toStringValue(figure.caption) || undefined,
    description: toStringValue(figure.description) || undefined,
    page,
    reference: toStringValue(figure.reference) || undefined,
    ...(width ? { width } : {}),
    ...(height ? { height } : {})
  };
}

function upsertEditedFigures(existingFigures: unknown, editedFigures: MaterialFigure[]): MaterialFigure[] {
  const figures = Array.isArray(existingFigures)
    ? existingFigures.map((figure) => toRecord(figure)).filter((figure): figure is JsonRecord => Boolean(figure))
    : [];

  const merged = figures.map((figure) => ({
    ...figure
  })) as MaterialFigure[];

  editedFigures.forEach((figure) => {
    const existingIndex = merged.findIndex((entry) => toStringValue(entry.id) === figure.id);
    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...figure
      };
      return;
    }

    merged.push(figure);
  });

  return merged;
}

export async function updateLearningTopicReadingContent(
  trackId: LearningTrackId,
  subjectId: string,
  topicId: string,
  readingParagraphs: string[],
  editedFigures: LearningTopicFigureEdit[] = []
): Promise<TopicDetail | null> {
  const editingEnabled = process.env.NODE_ENV !== "production" || process.env.ALLOW_LEARNING_CONTENT_EDIT === "1";
  if (!editingEnabled) {
    throw new Error("Learning content editing is disabled in this environment.");
  }

  const normalizedParagraphs = normalizeEditedParagraphs(readingParagraphs);
  if (normalizedParagraphs.length === 0) {
    throw new Error("Edited content cannot be empty.");
  }

  const files = await loadMaterialFiles();
  let targetFile: ParsedMaterialFile | null = null;
  let targetSubjectIndex = -1;
  let targetTopicIndex = -1;

  for (const file of files) {
    if (file.trackId !== trackId) {
      continue;
    }

    for (let subjectIndex = 0; subjectIndex < file.subjects.length; subjectIndex += 1) {
      const subject = file.subjects[subjectIndex];
      const resolvedSubjectId = resolveSubjectId(file.datasetKey, subject, subjectIndex);
      if (resolvedSubjectId !== subjectId) {
        continue;
      }

      const topics = Array.isArray(subject.topics) ? subject.topics : [];
      for (let topicIndex = 0; topicIndex < topics.length; topicIndex += 1) {
        const topic = topics[topicIndex];
        const resolvedTopicId = resolveTopicId(resolvedSubjectId, topic, topicIndex);
        if (resolvedTopicId !== topicId) {
          continue;
        }

        targetFile = file;
        targetSubjectIndex = subjectIndex;
        targetTopicIndex = topicIndex;
        break;
      }

      if (targetFile) {
        break;
      }
    }

    if (targetFile) {
      break;
    }
  }

  if (!targetFile || targetSubjectIndex < 0 || targetTopicIndex < 0) {
    return null;
  }

  // This used to read the source file straight off local disk (fs.readFile) and write the edit back the same way
  // - now that learning-material/*.json lives in R2 (not the git repo), both the read and the write below go
  // through R2 instead. Still gated by the editingEnabled check above (dev-only unless ALLOW_LEARNING_CONTENT_EDIT
  // is set), so this stays a low-traffic admin path.
  const rawRecord = await getR2Json<MaterialFile>(`learning-material/${targetFile.fileName}`);
  const rawSubjects = Array.isArray(rawRecord.subjects) ? rawRecord.subjects : [];
  const rawSubject =
    rawSubjects.find((subject, index) => resolveSubjectId(targetFile.datasetKey, subject, index) === subjectId)
    ?? rawSubjects[targetSubjectIndex];
  if (!rawSubject || !Array.isArray(rawSubject.topics)) {
    throw new Error("Unable to locate target subject in learning material file.");
  }

  const rawTopic =
    rawSubject.topics.find((topic, index) => resolveTopicId(subjectId, topic, index) === topicId)
    ?? (rawSubject.topics[targetTopicIndex] as (MaterialTopic & { paragraphPages?: unknown }) | undefined);
  if (!rawTopic) {
    throw new Error("Unable to locate target topic in learning material file.");
  }

  const existingParagraphPages = Array.isArray(rawTopic.paragraphPages)
    ? rawTopic.paragraphPages.map((value) => toPageNumber(value)).filter((value): value is number => value !== null)
    : [];
  const fallbackPage = toPageNumber((rawTopic as { pageStart?: unknown }).pageStart) ?? 1;
  const lastKnownPage =
    existingParagraphPages.length > 0 ? existingParagraphPages[existingParagraphPages.length - 1] : fallbackPage;
  const nextParagraphPages = normalizedParagraphs.map(
    (_, index) => existingParagraphPages[index] ?? lastKnownPage ?? fallbackPage
  );

  rawTopic.readingParagraphs = normalizedParagraphs;
  rawTopic.paragraphPages = nextParagraphPages;

  const normalizedFigures = (
    await Promise.all(
      editedFigures
        .filter((figure) => figure && typeof figure === "object")
        .map((figure, index) => normalizeEditedFigure(figure, targetFile.datasetKey, topicId, index))
    )
  ).filter((figure): figure is MaterialFigure => Boolean(figure));

  if (normalizedFigures.length > 0) {
    rawTopic.figures = upsertEditedFigures(rawTopic.figures, normalizedFigures);
  }

  await uploadToR2(
    `learning-material/${targetFile.fileName}`,
    Buffer.from(JSON.stringify(rawRecord), "utf-8"),
    "application/json"
  );

  parsedMaterialCache = null;
  parsedMaterialLoadPromise = null;

  return getLearningTopicDetail(trackId, subjectId, topicId);
}
