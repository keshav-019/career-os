import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from "@react-navigation/drawer";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Sparkles,
  Swords,
  User,
  GraduationCap
} from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import type { DrawerParamList } from "./types";

import DashboardScreen from "../screens/dashboard/DashboardScreen";
import ApplicationsScreen from "../screens/applications/ApplicationsScreen";
import AiMatchScreen from "../screens/aimatch/AiMatchScreen";
import ResumeScreen from "../screens/resume/ResumeScreen";
import WarRoomNavigator from "./WarRoomNavigator";
import LearningScreen from "../screens/learning/LearningScreen";
import AnalyticsScreen from "../screens/analytics/AnalyticsScreen";
import CalendarScreen from "../screens/calendar/CalendarScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";

const Drawer = createDrawerNavigator<DrawerParamList>();
const careerLogo = require("../../assets/icon.png");

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { colors, fontSize } = useTheme();
  const { user, signOutUser } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <View style={{ padding: 20, paddingTop: 48, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Image source={careerLogo} style={{ width: 44, height: 44, borderRadius: 12 }} resizeMode="contain" />
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "900" }}>CareerOS</Text>
        <Text style={{ color: colors.muted, fontSize: fontSize.sm }} numberOfLines={1}>
          {user?.email ?? "Signed in"}
        </Text>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 8 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <Pressable
        onPress={() => void signOutUser()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          margin: 16,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border
        }}
      >
        <LogOut color={colors.danger} size={16} />
        <Text style={{ color: colors.danger, fontWeight: "700" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

export default function DrawerNavigator() {
  const { colors } = useTheme();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        drawerActiveTintColor: colors.brand,
        drawerInactiveTintColor: colors.muted,
        drawerActiveBackgroundColor: `${colors.brand}22`,
        drawerStyle: { backgroundColor: colors.bgSoft, width: 280 },
        sceneContainerStyle: { backgroundColor: colors.bg }
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ drawerIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{ drawerIcon: ({ color, size }) => <Briefcase color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="AiMatch"
        component={AiMatchScreen}
        options={{ title: "AI Match", drawerIcon: ({ color, size }) => <Sparkles color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="Resume"
        component={ResumeScreen}
        options={{ drawerIcon: ({ color, size }) => <FileText color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="WarRoom"
        component={WarRoomNavigator}
        options={{ title: "Interview War Room", headerShown: false, drawerIcon: ({ color, size }) => <Swords color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="Learning"
        component={LearningScreen}
        options={{ title: "Learning Center", drawerIcon: ({ color, size }) => <GraduationCap color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ drawerIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ drawerIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ drawerIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ drawerIcon: ({ color, size }) => <SettingsIcon color={color} size={size} /> }}
      />
    </Drawer.Navigator>
  );
}
