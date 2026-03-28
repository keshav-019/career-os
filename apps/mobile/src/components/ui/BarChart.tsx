import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export type BarChartDatum = { label: string; value: number };

/**
 * Custom CSS-free bar chart mirroring web's approach (Dashboard's "Application Velocity" and Analytics' "Score
 * Timeline" are both plain divs with computed heights, not a charting library - see the Dashboard/Analytics
 * research notes). Values are normalized against the max value in the set; bars are plain colored Views.
 */
export function BarChart({ data, height = 120, tone }: { data: BarChartDatum[]; height?: number; tone?: string }) {
  const { colors, radius } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  const barColor = tone ?? colors.brand;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height }}>
      {data.map((datum, index) => {
        const barHeight = Math.max(3, (datum.value / max) * (height - 20));
        return (
          <View key={`${datum.label}-${index}`} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View style={{ flex: 1, justifyContent: "flex-end", width: "100%" }}>
              <View
                style={{
                  width: "100%",
                  height: barHeight,
                  backgroundColor: barColor,
                  borderRadius: radius.sm,
                  opacity: 0.85
                }}
              />
            </View>
            <Text style={{ color: colors.muted, fontSize: 9 }} numberOfLines={1}>
              {datum.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
