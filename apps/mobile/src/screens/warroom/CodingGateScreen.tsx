import { DesktopOnlyCard } from "../../components/DesktopOnlyCard";
import { GhostButton, Screen } from "../../components/ui/Primitives";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { WarRoomStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WarRoomStackParamList, "CodingGate">;

export default function CodingGateScreen({ navigation }: Props) {
  return (
    <Screen>
      <DesktopOnlyCard
        eyebrow="Coding Track"
        title="Coding is available only on CareerOS Desktop"
        body="Coding tests need local compilers and secure on-device execution, so this track is reserved for the Desktop app. On your phone you can still prep with Aptitude, Computer Science, and AI tracks."
        benefits={[
          "LeetCode-style arena with 28 hard Google & Amazon interview problems.",
          "Local compiler stack for C, C++, Java, JavaScript, Python, and Rust to keep execution instant and reliable.",
          "Desktop-first setup ensures consistent environment parity for future proctoring and analytics."
        ]}
      />
      <GhostButton label="Open Aptitude Track" onPress={() => navigation.replace("TemplateList", { testType: "aptitude" })} />
    </Screen>
  );
}
