import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  type ViewStyle
} from "react-native";
import { useTheme } from "../../theme/ThemeContext";

/** Full-bleed themed scroll container every screen renders its content inside. */
export function Screen({ children, contentStyle }: { children: ReactNode; contentStyle?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[{ padding: 16, paddingBottom: 40, gap: 14 }, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, highlight }: { children: ReactNode; style?: ViewStyle; highlight?: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: highlight ? colors.surfaceElevated : colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: highlight ? colors.brand : colors.border,
          padding: 16,
          gap: 10
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  right
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <View style={{ flex: 1, gap: 3 }}>
        {eyebrow ? (
          <Text style={{ color: colors.brand, fontSize: fontSize.eyebrow, fontWeight: "800", textTransform: "uppercase" }}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800" }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

type Tone = "brand" | "success" | "warning" | "danger" | "muted";

export function Pill({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  const { colors, radius, fontSize } = useTheme();
  const toneColor = { brand: colors.brand, success: colors.success, warning: colors.warning, danger: colors.danger, muted: colors.muted }[
    tone
  ];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: `${toneColor}22`,
        borderWidth: 1,
        borderColor: `${toneColor}55`
      }}
    >
      <Text style={{ color: toneColor, fontSize: fontSize.sm, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "brand"
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  const { colors, fontSize, radius } = useTheme();
  const toneColor = { brand: colors.brand, success: colors.success, warning: colors.warning, danger: colors.danger, muted: colors.muted }[
    tone
  ];
  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 6,
        borderLeftWidth: 3,
        borderLeftColor: toneColor
      }}
    >
      <Text style={{ color: colors.muted, fontSize: fontSize.eyebrow, fontWeight: "800", textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: fontSize.xxl, fontWeight: "900" }}>{value}</Text>
      {detail ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{detail}</Text> : null}
    </View>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}) {
  const { colors, radius, fontSize } = useTheme();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: isDisabled ? colors.borderStrong : colors.brand,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 18,
          opacity: pressed ? 0.85 : 1
        }
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" size="small" /> : icon}
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: fontSize.base }}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  disabled,
  icon,
  tone = "muted"
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const { colors, radius, fontSize } = useTheme();
  const toneColor = { brand: colors.brand, success: colors.success, warning: colors.warning, danger: colors.danger, muted: colors.text }[
    tone
  ];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: 10,
          paddingHorizontal: 16,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1
        }
      ]}
    >
      {icon}
      <Text style={{ color: toneColor, fontWeight: "700", fontSize: fontSize.base }}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ text }: { text: string }) {
  const { colors, radius, fontSize } = useTheme();
  return (
    <View
      style={{
        padding: 18,
        borderRadius: radius.md,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.border,
        alignItems: "center"
      }}
    >
      <Text style={{ color: colors.muted, fontSize: fontSize.base, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

export function LoadingView({ label = "Loading..." }: { label?: string }) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ padding: 24, alignItems: "center", gap: 10 }}>
      <ActivityIndicator color={colors.brand} />
      <Text style={{ color: colors.muted, fontSize: fontSize.base }}>{label}</Text>
    </View>
  );
}

export function ErrorText({ text }: { text: string }) {
  const { colors, fontSize } = useTheme();
  return <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{text}</Text>;
}

export function SuccessText({ text }: { text: string }) {
  const { colors, fontSize } = useTheme();
  return <Text style={{ color: colors.success, fontSize: fontSize.sm }}>{text}</Text>;
}

export function FieldLabel({ text }: { text: string }) {
  const { colors, fontSize } = useTheme();
  return <Text style={{ color: colors.muted, fontSize: fontSize.eyebrow, fontWeight: "700", textTransform: "uppercase" }}>{text}</Text>;
}

export function TextField({
  label,
  style,
  ...inputProps
}: TextInputProps & { label?: string; style?: ViewStyle }) {
  const { colors, radius, fontSize } = useTheme();
  return (
    <View style={{ gap: 5 }}>
      {label ? <FieldLabel text={label} /> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[
          {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: colors.text,
            fontSize: fontSize.base,
            backgroundColor: colors.surface
          },
          style
        ]}
        {...inputProps}
      />
    </View>
  );
}

export function ProgressBar({ percentage, tone = "brand" }: { percentage: number; tone?: Tone }) {
  const { colors, radius } = useTheme();
  const toneColor = { brand: colors.brand, success: colors.success, warning: colors.warning, danger: colors.danger, muted: colors.muted }[
    tone
  ];
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: toneColor, borderRadius: radius.pill }} />
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({});
void styles;
