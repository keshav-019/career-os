import { Laptop, CheckCircle2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { Card } from "./ui/Primitives";
import { useTheme } from "../theme/ThemeContext";

/**
 * Mirrors apps/web/src/components/ResumeStudioDesktopOnlyCard.tsx's two-card shape (hero card + "why desktop"
 * benefits card) - the same pattern the web app already uses to gate Resume Studio to desktop-only. Reused here
 * for the Coding track, which apps/web/src/app/interview-prep/page.tsx also gates to desktop-only (local
 * compilers, secure on-device execution). No "Open Desktop Setup" link on mobile since there's nowhere to send a
 * phone user to install a desktop app from itself - the benefits card explains why instead.
 */
export function DesktopOnlyCard({
  eyebrow,
  title,
  body,
  benefits
}: {
  eyebrow: string;
  title: string;
  body: string;
  benefits: string[];
}) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Card highlight>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.brand, fontSize: fontSize.eyebrow, fontWeight: "800", textTransform: "uppercase" }}>
              {eyebrow}
            </Text>
            <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800" }}>{title}</Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.base, lineHeight: 20 }}>{body}</Text>
          </View>
          <Laptop color={colors.brand} size={22} />
        </View>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800" }}>Why Desktop</Text>
        {benefits.map((benefit) => (
          <View key={benefit} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <CheckCircle2 color={colors.success} size={16} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.mutedStrong, fontSize: fontSize.base, flex: 1, lineHeight: 19 }}>{benefit}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
