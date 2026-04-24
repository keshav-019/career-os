import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { RESUME_VISUAL_TEMPLATES, type ResumeTemplateId } from "../../types/resume";
import { SectionHeader } from "../../components/ui/Primitives";
import { TemplatePreview } from "./TemplatePreview";

export function TemplateGallery({ onSelect }: { onSelect: (templateId: ResumeTemplateId) => void }) {
  const { colors, fontSize, radius } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader eyebrow="Choose a template" title="Pick a starting layout" subtitle="You can switch templates anytime without losing your details." />
      {RESUME_VISUAL_TEMPLATES.map((template) => (
        <Pressable
          key={template.id}
          onPress={() => onSelect(template.id)}
          style={{
            flexDirection: "row",
            gap: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: 14,
            backgroundColor: colors.surface,
            borderLeftWidth: 4,
            borderLeftColor: template.accent
          }}
        >
          <TemplatePreview templateId={template.id} accent={template.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800" }}>{template.name}</Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.sm, marginTop: 2 }}>{template.tagline}</Text>
            <Text style={{ color: colors.mutedStrong, fontSize: fontSize.sm, marginTop: 6, lineHeight: 18 }}>{template.bestFor}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
