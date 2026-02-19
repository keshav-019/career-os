import { promises as fs } from "node:fs";
import path from "node:path";

export type LearningTrackId = "computer-science" | "system-design" | "aptitude" | "ai";

type MaterialReference = {
  bestFor?: string;
  id: string;
  publisher?: string;
  title: string;
  type?: string;
  url: string;
};

type MaterialTopic = {
  candidateTraps?: string[];
  coreNotes?: string[];
  difficulty?: string;
  focusKeywords?: string[];
  id?: number;
  learningObjectives?: string[];
  practiceDrills?: string[];
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
  candidateTraps: string[];
  coreNotes: string[];
  difficulty: string;
  focusKeywords: string[];
  learningObjectives: string[];
  practiceDrills: string[];
  referenceGroups: TopicReferenceGroup[];
  rulesAndFormulas: string[];
  studyPlan: string[];
  subjectId: string;
  subjectTitle: string;
  title: string;
  topicId: string;
  unicodeSketch: string;
};

const TRACK_ORDER: LearningTrackId[] = ["computer-science", "system-design", "aptitude", "ai"];

const TRACK_DEFS: Record<
  LearningTrackId,
  { description: string; imageAlt: string; imageSrc: string; subtitle: string; title: string }
> = {
  "computer-science": {
    title: "Computer Science",
    subtitle: "Fundamentals and interview-ready concepts",
    description: "OS, DBMS, networks, algorithms, architecture, and core programming fundamentals.",
    imageSrc: "/war-room/cs-card.svg",
    imageAlt: "Computer science track visual"
  },
  "system-design": {
    title: "System Design",
    subtitle: "Scalable architecture and tradeoffs",
    description: "Distributed systems, reliability, data modeling, and production architecture decisions.",
    imageSrc: "/war-room/coding-card.svg",
    imageAlt: "System design track visual"
  },
  aptitude: {
    title: "Aptitude",
    subtitle: "Speed, logic, and quantitative reasoning",
    description: "Arithmetic, logical reasoning, and exam-oriented timed problem-solving patterns.",
    imageSrc: "/war-room/aptitude-card.svg",
    imageAlt: "Aptitude track visual"
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
    return "system-design";
  }

  if (explicit === "aptitude") {
    return "aptitude";
  }

  if (explicit === "ai" || explicit === "artificial intelligence" || explicit === "machine learning") {
    return "ai";
  }

  const source = `${fileName} ${title}`.toLowerCase();

  if (/(system[-\s]?design|hld|lld|distributed)/.test(source)) {
    return "system-design";
  }

  if (/\baptitude\b/.test(source)) {
    return "aptitude";
  }

  if (/\bai\b|artificial intelligence|machine learning|genai/.test(source)) {
    return "ai";
  }

  return "computer-science";
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

  return {
    fileName: entryName,
    datasetKey,
    metadataTitle,
    trackId: detectTrackId(entryName, metadataTitle, metadataTrack),
    globalStudyPlan: toArrayOfStrings(raw.globalStudyPlan),
    referenceCatalog,
    subjects
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
    trackId: "system-design",
    globalStudyPlan: dedupeStrings([
      ...toDetailedLines(rawRecord.global_study_sequence),
      ...toDetailedLines(rawRecord.interview_answer_template)
    ]),
    referenceCatalog,
    subjects
  };
}

function parseAptitudeMaterialFile(
  entryName: string,
  datasetKey: string,
  rawRecord: JsonRecord
): ParsedMaterialFile | null {
  const sections = Array.isArray(rawRecord.sections)
    ? rawRecord.sections.map((entry) => toRecord(entry)).filter((entry): entry is JsonRecord => Boolean(entry))
    : [];
  if (sections.length === 0) {
    return null;
  }

  const metadataTitle = toStringValue(rawRecord.title) || entryName;
  const referenceCatalog: MaterialReference[] = [];
  const referenceByUrl = new Map<string, string>();

  const subjects: MaterialSubject[] = sections.map((section, sectionIndex) => {
    const sectionTitle =
      toStringValue(section.section_title) || toStringValue(section.section) || `Section ${sectionIndex + 1}`;
    const sectionId = toStringValue(section.section_id) || `section-${sectionIndex + 1}`;

    const topicsRaw = Array.isArray(section.topics)
      ? section.topics.map((entry) => toRecord(entry)).filter((entry): entry is JsonRecord => Boolean(entry))
      : [];

    const topics: MaterialTopic[] = topicsRaw.map((topic, topicIndex) => {
      const topicTitle = toStringValue(topic.topic) || `Topic ${topicIndex + 1}`;
      const topicId = toStringValue(topic.topic_id) || `topic-${topicIndex + 1}`;
      const readingMaterial = toRecord(topic.reading_material);
      const workedExamples = Array.isArray(topic.worked_examples)
        ? topic.worked_examples.map((entry) => toRecord(entry)).filter((entry): entry is JsonRecord => Boolean(entry))
        : [];

      const workedExampleLines = workedExamples.flatMap((example, exampleIndex) => {
        const title = `Worked Example ${exampleIndex + 1}`;
        return dedupeStrings([
          toStringValue(example.problem) ? `${title} Problem: ${toStringValue(example.problem)}` : "",
          ...toDetailedLines(example.solution_steps).map((step) => `${title} Step: ${step}`),
          toStringValue(example.answer) ? `${title} Answer: ${toStringValue(example.answer)}` : ""
        ]);
      });

      const topicReferences = collectReferenceIds(
        topic,
        `${sectionTitle} - ${topicTitle}`,
        datasetKey,
        referenceCatalog,
        referenceByUrl
      );

      return {
        topicId,
        title: topicTitle,
        difficulty: normalizeDifficulty(topic.difficulty_scope),
        focusKeywords: dedupeStrings([
          ...toDetailedLines(topic.subtopics_covered),
          toStringValue(topic.section)
        ]).slice(0, 8),
        learningObjectives: dedupeStrings([...toDetailedLines(topic.learning_objectives)]),
        coreNotes: dedupeStrings([
          toStringValue(readingMaterial?.overview),
          ...toDetailedLines(readingMaterial?.core_ideas_to_master),
          ...toDetailedLines(readingMaterial?.subtopic_wise_reading),
          ...toDetailedLines(readingMaterial?.advanced_preparation_notes)
        ]),
        rulesAndFormulas: dedupeStrings([
          ...toDetailedLines(readingMaterial?.rules_formulas_or_principles),
          ...toDetailedLines(readingMaterial?.solving_framework)
        ]),
        candidateTraps: dedupeStrings([...toDetailedLines(topic.common_traps)]),
        practiceDrills: dedupeStrings([
          ...toDetailedLines(topic.practice_drills),
          ...toDetailedLines(topic.mastery_check),
          ...toDetailedLines(topic.common_question_patterns),
          ...workedExampleLines
        ]),
        referenceIds: topicReferences
      };
    });

    return {
      subjectId: normalizeSlug(sectionId),
      order: sectionIndex + 1,
      title: sectionTitle,
      overview: `${topics.length} curated aptitude subtopics in this section.`,
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
    trackId: "aptitude",
    globalStudyPlan: dedupeStrings([
      toStringValue(rawRecord.source_note),
      `Total sections: ${toStringValue(rawRecord.total_sections)}`,
      `Total topics: ${toStringValue(rawRecord.total_topics)}`
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
    parseAptitudeMaterialFile(entryName, datasetKey, rawRecord) ??
    parseAiRoleMaterialFile(entryName, datasetKey, rawRecord)
  );
}

async function resolveLearningMaterialDir(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), "learning-material"),
    path.resolve(process.cwd(), "../learning-material"),
    path.resolve(process.cwd(), "../../learning-material"),
    path.resolve(process.cwd(), "../../../learning-material")
  ];

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        return candidate;
      }
    } catch {
      // Skip missing candidates.
    }
  }

  return null;
}

async function loadMaterialFiles(): Promise<ParsedMaterialFile[]> {
  const materialDir = await resolveLearningMaterialDir();
  if (!materialDir) {
    return [];
  }

  const entries = await fs.readdir(materialDir, { withFileTypes: true });
  const files: ParsedMaterialFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const fullPath = path.join(materialDir, entry.name);
    let raw: unknown = null;

    try {
      raw = JSON.parse(await fs.readFile(fullPath, "utf8"));
    } catch {
      continue;
    }

    const rawRecord = toRecord(raw);
    if (!rawRecord) {
      continue;
    }

    const parsed = parseMaterialFile(entry.name, rawRecord);
    if (!parsed) {
      continue;
    }

    files.push(parsed);
  }

  return files;
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
      imageSrc: TRACK_DEFS[trackId].imageSrc,
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
  const groups: TopicReferenceGroup[] = [];

  const topicRefs = toArrayOfStrings(topic.referenceIds)
    .map((id) => referencesById.get(id))
    .filter((entry): entry is MaterialReference => Boolean(entry));

  const visualRefs = toArrayOfStrings(topic.visualStudyReferenceIds)
    .map((id) => referencesById.get(id))
    .filter((entry): entry is MaterialReference => Boolean(entry));

  const defaultRefs = toArrayOfStrings(subject.defaultReferenceIds)
    .map((id) => referencesById.get(id))
    .filter((entry): entry is MaterialReference => Boolean(entry));

  if (topicRefs.length > 0) {
    groups.push({
      id: "topic-references",
      title: "Topic References",
      references: topicRefs
    });
  }

  if (visualRefs.length > 0) {
    groups.push({
      id: "visual-references",
      title: "Visual Study References",
      references: visualRefs
    });
  }

  if (defaultRefs.length > 0) {
    groups.push({
      id: "subject-default-references",
      title: "Subject Default References",
      references: defaultRefs
    });
  }

  return groups;
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
          focusKeywords: toArrayOfStrings(topic.focusKeywords),
          learningObjectives: toArrayOfStrings(topic.learningObjectives),
          coreNotes: toArrayOfStrings(topic.coreNotes),
          rulesAndFormulas: toArrayOfStrings(topic.rulesAndFormulas),
          candidateTraps: toArrayOfStrings(topic.candidateTraps),
          practiceDrills: toArrayOfStrings(topic.practiceDrills),
          unicodeSketch: typeof topic.unicodeSketch === "string" ? topic.unicodeSketch : "",
          studyPlan: dataset.globalStudyPlan,
          referenceGroups: buildReferenceGroups(topic, subject, referencesById)
        };
      }
    }
  }

  return null;
}
