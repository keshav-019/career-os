import { Alert, Pressable, Switch, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export function SwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
  comingSoon
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Renders the row disabled and greyed out with an "In development" badge - touchscreens have no hover state,
   *  so tapping the row (instead of just the switch) surfaces the explanation via an Alert. Use this instead of
   *  a bare `disabled` for any feature that isn't wired up to real functionality yet, so the user understands why
   *  it's off rather than assuming it's broken. */
  comingSoon?: boolean;
}) {
  const { colors, fontSize } = useTheme();
  const isDisabled = disabled || comingSoon;

  const row = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, opacity: comingSoon ? 0.6 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: "700" }}>{title}</Text>
          {comingSoon ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: `${colors.muted}22`,
                borderWidth: 1,
                borderColor: `${colors.muted}55`
              }}
            >
              <Text style={{ color: colors.muted, fontSize: fontSize.sm, fontWeight: "700" }}>In development</Text>
            </View>
          ) : null}
        </View>
        {description ? <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{description}</Text> : null}
      </View>
      <Switch
        value={comingSoon ? false : value}
        onValueChange={onValueChange}
        disabled={isDisabled}
        trackColor={{ true: colors.brand, false: colors.borderStrong }}
        thumbColor="#ffffff"
      />
    </View>
  );

  if (!comingSoon) {
    return row;
  }

  return (
    <Pressable onPress={() => Alert.alert("Coming soon", `${title} is still in development.`)}>
      {row}
    </Pressable>
  );
}
