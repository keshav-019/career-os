import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { FieldLabel } from "./Primitives";

export type PickerOption<T extends string> = { value: T; label: string };

/**
 * React Native has no native <select> - this is the shared replacement used everywhere the web app has a
 * dropdown (job status transitions, resume/job pickers, settings selects, etc.): a field that looks like an
 * input, and taps open a bottom sheet-style modal listing every option.
 */
export function PickerField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Select..."
}: {
  label?: string;
  value: T | null;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const { colors, radius, fontSize } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ gap: 5 }}>
      {label ? <FieldLabel text={label} /> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.surface
        }}
      >
        <Text style={{ color: selected ? colors.text : colors.muted, fontSize: fontSize.base }}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown color={colors.muted} size={16} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        >
          <View
            style={{
              backgroundColor: colors.surfaceElevated,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: 12,
              maxHeight: "70%"
            }}
          >
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  borderRadius: radius.sm,
                  backgroundColor: option.value === value ? `${colors.brand}22` : "transparent"
                }}
              >
                <Text
                  style={{
                    color: option.value === value ? colors.brand : colors.text,
                    fontSize: fontSize.md,
                    fontWeight: option.value === value ? "700" : "500"
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
