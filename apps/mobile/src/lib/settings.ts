import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildDefaultSettings, type SettingsData } from "../types/settings";

const SETTINGS_STORAGE_KEY = "careeros-settings-v1";

export async function loadSettings(): Promise<SettingsData> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return buildDefaultSettings();
    const parsed = JSON.parse(raw) as Partial<SettingsData>;
    return { ...buildDefaultSettings(), ...parsed };
  } catch {
    return buildDefaultSettings();
  }
}

export async function saveSettings(settings: SettingsData): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
