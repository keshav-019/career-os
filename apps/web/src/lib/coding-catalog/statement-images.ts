/**
 * Coding-problem statements can have images embedded anywhere in their plain-text `statement` field using a
 * `[[image:<https-url>]]` marker - no separate "figures" array, unlike the Learning Center's `[[figure:id]]`
 * convention (see apps/web/src/app/learning/page.tsx). The marker carries the full Cloudinary URL directly, since
 * the admin editor inserts it at the cursor position the moment an upload finishes - there's nothing else to look
 * up. This file is plain TS (no JSX) so it can be shared by both the admin editor (building/inserting markers) and
 * any statement renderer (parsing them back out) without pulling React into non-component code.
 */

export const STATEMENT_IMAGE_MARKER_PATTERN = /\[\[image:(https?:\/\/[^\s\]]+)\]\]/g;

export function buildStatementImageMarker(url: string): string {
  return `[[image:${url}]]`;
}

export type StatementSegment = { type: "text"; value: string } | { type: "image"; url: string };

/** Splits a statement string into alternating text/image segments so a renderer can map over them without owning
 *  any regex/parsing logic itself. */
export function splitStatementIntoSegments(statement: string): StatementSegment[] {
  const segments: StatementSegment[] = [];
  const pattern = new RegExp(STATEMENT_IMAGE_MARKER_PATTERN);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(statement)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: statement.slice(lastIndex, match.index) });
    }
    segments.push({ type: "image", url: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < statement.length) {
    segments.push({ type: "text", value: statement.slice(lastIndex) });
  }

  return segments;
}
