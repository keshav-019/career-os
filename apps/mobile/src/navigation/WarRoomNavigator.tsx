import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeContext";
import type { WarRoomStackParamList } from "./types";

import WarRoomHomeScreen from "../screens/warroom/WarRoomHomeScreen";
import TemplateListScreen from "../screens/warroom/TemplateListScreen";
import TestRoomScreen from "../screens/warroom/TestRoomScreen";
import SystemDesignListScreen from "../screens/warroom/SystemDesignListScreen";
import SystemDesignSolveScreen from "../screens/warroom/SystemDesignSolveScreen";
import CodingGateScreen from "../screens/warroom/CodingGateScreen";

const Stack = createNativeStackNavigator<WarRoomStackParamList>();

export default function WarRoomNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: colors.bg }
      }}
    >
      <Stack.Screen name="WarRoomHome" component={WarRoomHomeScreen} options={{ title: "Interview War Room" }} />
      <Stack.Screen name="TemplateList" component={TemplateListScreen} options={{ title: "Test Library" }} />
      <Stack.Screen name="TestRoom" component={TestRoomScreen} options={{ title: "Test Room" }} />
      <Stack.Screen name="SystemDesignList" component={SystemDesignListScreen} options={{ title: "System Design" }} />
      <Stack.Screen name="SystemDesignSolve" component={SystemDesignSolveScreen} options={{ title: "Design It" }} />
      <Stack.Screen name="CodingGate" component={CodingGateScreen} options={{ title: "Coding" }} />
    </Stack.Navigator>
  );
}
