import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import type { ResumeTemplateId } from "../../types/resume";

/**
 * A small schematic mockup of each resume layout - not a pixel-accurate render (the real templates are DOM/CSS
 * components on web, apps/web/src/components/resume/templates/*, not portable to RN), just enough visual shape
 * (single column vs sidebar, bold vs thin section breaks) that a user can tell the five templates apart before
 * picking one, instead of picking blind from name/tagline text alone.
 */

const bar = (width: `${number}%` | number, height: number, color: string, radius = 2) => (
  <View style={{ width, height, backgroundColor: color, borderRadius: radius }} />
);

export function TemplatePreview({ templateId, accent }: { templateId: ResumeTemplateId; accent: string }) {
  const { colors, radius } = useTheme();
  const lineColor = colors.border;
  const textColor = colors.mutedStrong;

  const page = (content: ReactNode) => (
    <View
      style={{
        width: 72,
        height: 96,
        backgroundColor: "#ffffff",
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 6,
        overflow: "hidden"
      }}
    >
      {content}
    </View>
  );

  if (templateId === "sidebar") {
    return page(
      <View style={{ flexDirection: "row", flex: 1, gap: 4 }}>
        <View style={{ width: 18, backgroundColor: `${accent}22`, borderRadius: 2, padding: 3, gap: 3 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent, alignSelf: "center" }} />
          {bar("100%", 3, accent)}
          {bar("70%", 3, accent)}
          {bar("85%", 3, accent)}
        </View>
        <View style={{ flex: 1, gap: 4, paddingTop: 2 }}>
          {bar("90%", 5, textColor)}
          {bar("60%", 3, lineColor)}
          <View style={{ height: 4 }} />
          {bar("100%", 2, lineColor)}
          {bar("100%", 2, lineColor)}
          {bar("75%", 2, lineColor)}
        </View>
      </View>
    );
  }

  if (templateId === "coral") {
    return page(
      <View style={{ gap: 5 }}>
        {bar("80%", 6, textColor)}
        <View style={{ backgroundColor: accent, borderRadius: 2, paddingVertical: 2, paddingHorizontal: 3, alignSelf: "flex-start" }}>
          {bar(28, 3, "#ffffff", 1)}
        </View>
        {bar("100%", 2, lineColor)}
        {bar("90%", 2, lineColor)}
        <View style={{ backgroundColor: accent, borderRadius: 2, paddingVertical: 2, paddingHorizontal: 3, alignSelf: "flex-start" }}>
          {bar(22, 3, "#ffffff", 1)}
        </View>
        {bar("100%", 2, lineColor)}
        {bar("70%", 2, lineColor)}
      </View>
    );
  }

  if (templateId === "spearmint") {
    return page(
      <View style={{ gap: 4 }}>
        {bar("75%", 6, textColor)}
        {bar("100%", 1.5, accent)}
        {bar("100%", 2, lineColor)}
        {bar("85%", 2, lineColor)}
        {bar("100%", 1.5, accent)}
        {bar("100%", 2, lineColor)}
        {bar("90%", 2, lineColor)}
        {bar("100%", 1.5, accent)}
        {bar("70%", 2, lineColor)}
      </View>
    );
  }

  if (templateId === "modern-writer") {
    return page(
      <View style={{ gap: 8, alignItems: "center", paddingTop: 8 }}>
        {bar("50%", 4, textColor)}
        {bar("30%", 2, lineColor)}
        <View style={{ height: 6 }} />
        {bar("60%", 2, lineColor)}
        {bar("55%", 2, lineColor)}
        {bar("45%", 2, lineColor)}
      </View>
    );
  }

  // "swiss" - clean single column, the default
  return page(
    <View style={{ gap: 4 }}>
      {bar("85%", 6, textColor)}
      {bar("55%", 3, accent)}
      <View style={{ height: 3 }} />
      {bar("100%", 2, lineColor)}
      {bar("100%", 2, lineColor)}
      {bar("80%", 2, lineColor)}
      <View style={{ height: 3 }} />
      {bar("100%", 2, lineColor)}
      {bar("65%", 2, lineColor)}
    </View>
  );
}
