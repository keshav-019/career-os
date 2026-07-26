import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";

/** Full-bleed themed scroll container every screen renders its content inside.
 *
 *  Keyboard handling: relying on `automaticallyAdjustKeyboardInsets` alone plus Android's native
 *  `windowSoftInputMode="adjustResize"` still left content unreachable below the keyboard in practice, so this
 *  now also runs `KeyboardAvoidingView` with "height" behavior on Android (not just "padding" on iOS) - belt and
 *  suspenders, since the two mechanisms compose rather than fight each other (adjustResize shrinks the window,
 *  KeyboardAvoidingView further reserves the keyboard's own height within that shrunk window). A generous
 *  `paddingBottom` on the scroll content guarantees there's always room to scroll the last field/button fully
 *  above the keyboard even if the automatic insets under- or over-estimate the keyboard height on a given device.
 *
 *  Scroll position: React Navigation keeps a screen's component instance (and thus its ScrollView's scroll offset)
 *  alive when you navigate away and back - both the drawer (switching sections) and native-stack (going back) cases
 *  - so without this, a screen reopens wherever it happened to be scrolled last instead of at the top. `useFocusEffect`
 *  fires on every focus (initial mount, drawer switch back, and stack pop), so resetting scroll there covers both
 *  "navigate to a screen" and "press back" - it does not fire from a TextInput gaining focus, so it never fights
 *  the keyboard-avoiding scroll above. */
export function Screen({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
}) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[
          { padding: 16, paddingBottom: 160, gap: 14 },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({
  children,
  style,
  highlight,
}: {
  children: ReactNode;
  style?: ViewStyle;
  highlight?: boolean;
}) {
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
          gap: 10,
        },
        style,
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
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { colors, fontSize } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        {eyebrow ? (
          <Text
            style={{
              color: colors.brand,
              fontSize: fontSize.eyebrow,
              fontWeight: "800",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={{
            color: colors.text,
            fontSize: fontSize.lg,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

type Tone = "brand" | "success" | "warning" | "danger" | "muted";

export function Pill({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: Tone;
}) {
  const { colors, radius, fontSize } = useTheme();
  const toneColor = {
    brand: colors.brand,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    muted: colors.muted,
  }[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: `${toneColor}22`,
        borderWidth: 1,
        borderColor: `${toneColor}55`,
      }}
    >
      <Text
        style={{ color: toneColor, fontSize: fontSize.sm, fontWeight: "700" }}
      >
        {label}
      </Text>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "brand",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  const { colors, fontSize, radius } = useTheme();
  const toneColor = {
    brand: colors.brand,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    muted: colors.muted,
  }[tone];
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
        borderLeftColor: toneColor,
      }}
    >
      <Text
        style={{
          color: colors.muted,
          fontSize: fontSize.eyebrow,
          fontWeight: "800",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSize.xxl,
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
      {detail ? (
        <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
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
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" size="small" /> : icon}
      <Text
        style={{ color: "#fff", fontWeight: "800", fontSize: fontSize.base }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  disabled,
  icon,
  tone = "muted",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const { colors, radius, fontSize } = useTheme();
  const toneColor = {
    brand: colors.brand,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    muted: colors.text,
  }[tone];
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
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon}
      <Text
        style={{ color: toneColor, fontWeight: "700", fontSize: fontSize.base }}
      >
        {label}
      </Text>
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
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: colors.muted,
          fontSize: fontSize.base,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export function LoadingView({ label = "Loading..." }: { label?: string }) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ padding: 24, alignItems: "center", gap: 10 }}>
      <ActivityIndicator color={colors.brand} />
      <Text style={{ color: colors.muted, fontSize: fontSize.base }}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorText({ text }: { text: string }) {
  const { colors, fontSize } = useTheme();
  return (
    <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{text}</Text>
  );
}

export function SuccessText({ text }: { text: string }) {
  const { colors, fontSize } = useTheme();
  return (
    <Text style={{ color: colors.success, fontSize: fontSize.sm }}>{text}</Text>
  );
}

export function FieldLabel({ text }: { text: string }) {
  const { colors, fontSize } = useTheme();
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: fontSize.eyebrow,
        fontWeight: "700",
        textTransform: "uppercase",
      }}
    >
      {text}
    </Text>
  );
}

export function TextField({
  label,
  revealSecureText = false,
  secureTextEntry,
  style,
  ...inputProps
}: TextInputProps & {
  label?: string;
  revealSecureText?: boolean;
  style?: TextInputProps["style"];
}) {
  const { colors, radius, fontSize } = useTheme();
  const [secureTextVisible, setSecureTextVisible] = useState(false);
  const canRevealSecureText = Boolean(revealSecureText && secureTextEntry);
  return (
    <View style={{ gap: 5 }}>
      {label ? <FieldLabel text={label} /> : null}
      <View>
        <TextInput
          {...inputProps}
          placeholderTextColor={colors.muted}
          secureTextEntry={
            canRevealSecureText ? !secureTextVisible : secureTextEntry
          }
          style={[
            {
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.text,
              fontSize: fontSize.base,
              backgroundColor: colors.surface,
            },
            canRevealSecureText ? { paddingRight: 48 } : null,
            style,
          ]}
        />
        {canRevealSecureText ? (
          <Pressable
            accessibilityLabel={
              secureTextVisible ? "Hide password" : "Show password"
            }
            accessibilityRole="button"
            accessibilityState={{ selected: secureTextVisible }}
            hitSlop={8}
            onPress={() => setSecureTextVisible((current) => !current)}
            style={({ pressed }) => [
              {
                position: "absolute",
                right: 8,
                top: 0,
                bottom: 0,
                width: 36,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            {secureTextVisible ? (
              <EyeOff color={colors.muted} size={19} />
            ) : (
              <Eye color={colors.muted} size={19} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ProgressBar({
  percentage,
  tone = "brand",
}: {
  percentage: number;
  tone?: Tone;
}) {
  const { colors, radius } = useTheme();
  const toneColor = {
    brand: colors.brand,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    muted: colors.muted,
  }[tone];
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <View
      style={{
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceMuted,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: toneColor,
          borderRadius: radius.pill,
        }}
      />
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

const styles = StyleSheet.create({});
void styles;
