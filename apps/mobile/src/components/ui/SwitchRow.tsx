import { Switch, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export function SwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: "700" }}>{title}</Text>
        {description ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.brand, false: colors.borderStrong }}
        thumbColor="#ffffff"
      />
    </View>
  );
}
