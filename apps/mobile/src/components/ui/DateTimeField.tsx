import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarClock } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { FieldLabel } from "./Primitives";

/** Shared date/time picker field - replaces every `<input type="datetime-local">`/`type="date"` on web. Android
 *  shows the native platform dialog (calendar then clock), so this looks and feels like every other Android app. */
export function DateTimeField({
  label,
  value,
  onChange,
  mode = "datetime"
}: {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode?: "date" | "datetime" | "time";
}) {
  const { colors, radius, fontSize } = useTheme();
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const displayText = value
    ? mode === "date"
      ? value.toLocaleDateString()
      : mode === "time"
        ? value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : value.toLocaleString()
    : "Tap to select";

  function handleDateChange(_event: unknown, selected?: Date) {
    setShowDate(false);
    if (!selected) return;
    if (mode === "datetime") {
      setShowTime(true);
      onChange(selected);
    } else {
      onChange(selected);
    }
  }

  function handleTimeChange(_event: unknown, selected?: Date) {
    setShowTime(false);
    if (!selected || !value) return;
    const merged = new Date(value);
    merged.setHours(selected.getHours(), selected.getMinutes());
    onChange(merged);
  }

  return (
    <View style={{ gap: 5 }}>
      {label ? <FieldLabel text={label} /> : null}
      <Pressable
        onPress={() => setShowDate(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.surface
        }}
      >
        <CalendarClock color={colors.muted} size={16} />
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: fontSize.base }}>{displayText}</Text>
      </Pressable>

      {showDate ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode === "time" ? "time" : "date"}
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={handleDateChange}
        />
      ) : null}
      {showTime ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="time"
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={handleTimeChange}
        />
      ) : null}
    </View>
  );
}
