import { DrawerActions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Menu } from "lucide-react-native";
import { Pressable } from "react-native";
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
      screenOptions={({ navigation, route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: colors.bg },
        // WarRoomHome is this stack's initial route, so native-stack gives it no back arrow - and since the
        // Drawer navigator hands this whole route headerShown:false (see DrawerNavigator.tsx), it never gets the
        // Drawer's automatic hamburger either. Without this, WarRoomHome is a dead end with no way back to the
        // drawer. Every other screen in this stack keeps the default (automatic back arrow).
        headerLeft:
          route.name === "WarRoomHome"
            ? () => (
                <Pressable
                  hitSlop={12}
                  onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                  style={{ paddingHorizontal: 4 }}
                >
                  <Menu color={colors.text} size={22} />
                </Pressable>
              )
            : undefined
      })}
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
