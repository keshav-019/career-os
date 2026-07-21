import { Image, Linking, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { resolveAssetUrl } from "../../lib/learningClient";
import { FIGURE_MARKER_PATTERN, type MaterialFigure, type TopicDetail } from "../../types/learning";

/** Mobile equivalent of apps/web/src/app/learning/page.tsx's rich-text renderer (headings, fenced/triple-quoted
 *  code blocks, [[figure:id]] markers, inline links). Simplified for React Native's text-layout model - figures
 *  render as block-level images rather than truly inline, matching how they actually render on web too (the
 *  <figure> there is already a block element despite the inline-looking marker syntax). */

function InlineText({ text, mono, color, italic }: { text: string; mono?: boolean; color?: string; italic?: boolean }) {
  const { colors, fontSize } = useTheme();
  const parts = text.split(/`([^`]+)`/g);
  return (
    <Text style={{ color: color ?? colors.mutedStrong, fontSize: fontSize.base, lineHeight: 21, fontStyle: italic ? "italic" : "normal" }}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} style={{ fontFamily: "monospace", backgroundColor: colors.surfaceMuted, fontSize: fontSize.sm }}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

function Heading({ level, text }: { level: number; text: string }) {
  const { colors, fontSize } = useTheme();
  const size = level <= 1 ? fontSize.lg : level === 2 ? fontSize.md : fontSize.base;
  return <Text style={{ color: colors.text, fontSize: size, fontWeight: "800", marginTop: 10 }}>{text}</Text>;
}

function CodeBlock({ code }: { code: string }) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: fontSize.sm }}>{code}</Text>
    </View>
  );
}

function FigureBlock({ figure, index }: { figure: MaterialFigure; index: number }) {
  const { colors, fontSize } = useTheme();
  const uri = resolveAssetUrl(figure.src);
  const width = figure.width ?? 320;
  const height = figure.height ?? 200;
  const aspect = width / height;
  return (
    <View style={{ gap: 4 }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", aspectRatio: aspect || 1.5, borderRadius: 8, backgroundColor: colors.surfaceMuted }} resizeMode="contain" /> : null}
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{figure.caption || figure.description || `Figure ${index + 1}`}</Text>
      {figure.description && figure.caption ? <Text style={{ color: colors.muted, fontSize: 11 }}>{figure.description}</Text> : null}
      {figure.reference ? <Text style={{ color: colors.muted, fontSize: 11 }}>Reference: {figure.reference}</Text> : null}
    </View>
  );
}

function splitTripleQuotedChunks(value: string): { kind: "code" | "text"; content: string }[] {
  const chunks: { kind: "code" | "text"; content: string }[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const opening = value.indexOf('"""', cursor);
    if (opening === -1) {
      chunks.push({ kind: "text", content: value.slice(cursor) });
      break;
    }
    if (opening > cursor) chunks.push({ kind: "text", content: value.slice(cursor, opening) });
    const closing = value.indexOf('"""', opening + 3);
    if (closing === -1) {
      chunks.push({ kind: "code", content: value.slice(opening + 3) });
      break;
    }
    chunks.push({ kind: "code", content: value.slice(opening + 3, closing) });
    cursor = closing + 3;
  }
  return chunks;
}

function renderPlainTextBlock(text: string, keyBase: string) {
  const lines = text.split(/\r?\n/);
  const nodes: JSX.Element[] = [];
  let paragraphLines: string[] = [];

  function flush(suffix: string) {
    const paragraphText = paragraphLines.join(" ").trim();
    if (paragraphText) nodes.push(<InlineText key={`${keyBase}-p-${suffix}`} text={paragraphText} />);
    paragraphLines = [];
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flush(String(index));
      return;
    }
    const heading = line.match(/^(#{1,5})\s+(.+)$/);
    if (heading) {
      flush(`h-${index}`);
      nodes.push(<Heading key={`${keyBase}-heading-${index}`} level={heading[1].length} text={heading[2].trim()} />);
      return;
    }
    const numbered = line.match(/^(\d+\.\d+(?:\.\d+)*)\s+(.+)$/);
    if (numbered) {
      flush(`n-${index}`);
      nodes.push(<Heading key={`${keyBase}-nh-${index}`} level={3} text={`${numbered[1]} ${numbered[2]}`} />);
      return;
    }
    paragraphLines.push(line);
  });
  flush("final");
  return nodes;
}

function renderParagraphBlocks(paragraph: string, keyBase: string): JSX.Element[] {
  const fenceFragments = paragraph.split(/(```[\s\S]*?```)/g).filter(Boolean);
  const nodes: JSX.Element[] = [];
  fenceFragments.forEach((fragment, fragmentIndex) => {
    if (fragment.startsWith("```") && fragment.endsWith("```")) {
      const code = fragment.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/```$/, "").trim();
      if (code) nodes.push(<CodeBlock key={`${keyBase}-fence-${fragmentIndex}`} code={code} />);
      return;
    }
    splitTripleQuotedChunks(fragment).forEach((chunk, chunkIndex) => {
      if (chunk.kind === "code") {
        const code = chunk.content.trim();
        if (code) nodes.push(<CodeBlock key={`${keyBase}-triple-${fragmentIndex}-${chunkIndex}`} code={code} />);
        return;
      }
      nodes.push(...renderPlainTextBlock(chunk.content, `${keyBase}-text-${fragmentIndex}-${chunkIndex}`));
    });
  });
  return nodes;
}

function renderParagraphWithFigures(
  paragraph: string,
  keyBase: string,
  figuresById: Map<string, MaterialFigure>,
  renderedIds: Set<string>
): JSX.Element[] {
  FIGURE_MARKER_PATTERN.lastIndex = 0;
  const nodes: JSX.Element[] = [];
  let cursor = 0;
  let match = FIGURE_MARKER_PATTERN.exec(paragraph);
  while (match) {
    const before = paragraph.slice(cursor, match.index).trim();
    if (before) nodes.push(...renderParagraphBlocks(before, `${keyBase}-before-${nodes.length}`));
    const figure = figuresById.get(match[1]);
    if (figure) {
      renderedIds.add(figure.id);
      nodes.push(<FigureBlock key={`${keyBase}-fig-${match[1]}`} figure={figure} index={renderedIds.size - 1} />);
    }
    cursor = match.index + match[0].length;
    match = FIGURE_MARKER_PATTERN.exec(paragraph);
  }
  const after = paragraph.slice(cursor).trim();
  if (after) nodes.push(...renderParagraphBlocks(after, `${keyBase}-after`));
  return nodes.length > 0 ? nodes : renderParagraphBlocks(paragraph, keyBase);
}

function collectFigureMarkerIds(paragraphs: string[]): Set<string> {
  const ids = new Set<string>();
  paragraphs.forEach((paragraph) => {
    FIGURE_MARKER_PATTERN.lastIndex = 0;
    let match = FIGURE_MARKER_PATTERN.exec(paragraph);
    while (match) {
      ids.add(match[1]);
      match = FIGURE_MARKER_PATTERN.exec(paragraph);
    }
  });
  return ids;
}

export function TopicReadingContent({ detail }: { detail: TopicDetail }) {
  const { colors, fontSize } = useTheme();
  const figures = [...detail.figures].sort((a, b) => (a.page ?? 9999) - (b.page ?? 9999));
  const figuresById = new Map(figures.map((f) => [f.id, f]));
  const markedIds = collectFigureMarkerIds(detail.readingParagraphs);
  const renderedIds = new Set<string>();
  const pageHints =
    detail.paragraphPages.length === detail.readingParagraphs.length
      ? detail.paragraphPages
      : detail.readingParagraphs.map((_, i) => detail.pageStart ?? i + 1);

  const blocks: JSX.Element[] = [];
  let figureIndex = 0;

  detail.readingParagraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphPage = typeof pageHints[paragraphIndex] === "number" ? pageHints[paragraphIndex] : 0;
    while (figureIndex < figures.length) {
      const currentFigure = figures[figureIndex];
      const figurePage = currentFigure.page ?? Number.POSITIVE_INFINITY;
      if (!markedIds.has(currentFigure.id) && !renderedIds.has(currentFigure.id) && paragraphPage > 0 && Number.isFinite(figurePage) && figurePage <= paragraphPage) {
        renderedIds.add(currentFigure.id);
        blocks.push(<FigureBlock key={`${detail.topicId}-fig-auto-${figureIndex}`} figure={currentFigure} index={figureIndex} />);
        figureIndex += 1;
        continue;
      }
      if (markedIds.has(currentFigure.id) || renderedIds.has(currentFigure.id)) {
        figureIndex += 1;
        continue;
      }
      break;
    }
    blocks.push(
      <View key={`${detail.topicId}-p-${paragraphIndex}`} style={{ gap: 6 }}>
        {renderParagraphWithFigures(paragraph, `${detail.topicId}-p-${paragraphIndex}`, figuresById, renderedIds)}
      </View>
    );
  });

  while (figureIndex < figures.length) {
    const figure = figures[figureIndex];
    if (!renderedIds.has(figure.id) && !markedIds.has(figure.id)) {
      blocks.push(<FigureBlock key={`${detail.topicId}-fig-tail-${figureIndex}`} figure={figure} index={figureIndex} />);
    }
    figureIndex += 1;
  }

  return (
    <View style={{ gap: 12 }}>
      {blocks}
      {detail.referenceGroups.length > 0 ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>References</Text>
          {detail.referenceGroups.map((group) => (
            <View key={group.id} style={{ gap: 4 }}>
              <Text style={{ color: colors.mutedStrong, fontWeight: "700", fontSize: fontSize.sm }}>{group.title}</Text>
              {group.references.map((reference) => (
                <Text
                  key={reference.id}
                  onPress={() => reference.url && Linking.openURL(reference.url)}
                  style={{ color: reference.url ? colors.brand : colors.muted, fontSize: fontSize.sm, textDecorationLine: reference.url ? "underline" : "none" }}
                >
                  {reference.title}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
