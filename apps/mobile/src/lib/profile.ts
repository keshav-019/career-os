import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildDefaultProfile, type ProfileData } from "../types/profile";

// Mirrors apps/web/src/app/profile/page.tsx's localStorage persistence exactly - same key name, same "not
// synced across devices" limitation the web app already has today (this is not a regression, it's parity).
const PROFILE_STORAGE_KEY = "careeros-profile-v1";

export async function loadProfile(): Promise<ProfileData> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return buildDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<ProfileData>;
    return { ...buildDefaultProfile(), ...parsed };
  } catch {
    return buildDefaultProfile();
  }
}

export async function saveProfile(profile: ProfileData): Promise<void> {
  const next: ProfileData = { ...profile, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
}
