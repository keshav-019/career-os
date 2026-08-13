# CareerOS Mobile

## Purpose

React Native / Expo Android app for CareerOS. This is the full app now, not a shell: Dashboard, Applications,
AI Match, Resume (Visual Mode), Interview War Room (Aptitude / Computer Science / AI tests, System Design, and a
desktop-only gate for the Coding track), Learning Center, Analytics, Calendar, Profile, and Settings all work here,
talking to the same deployed CareerOS backend and Firebase project the web app uses.

## What's different from web (on purpose)

- **CareerOS Desktop** section and the **Browser Extension** don't apply to a phone, so neither exists here.
- **Resume** is Visual Mode only - no LaTeX editor (needs a local LaTeX compiler, desktop-only).
- **Interview War Room's Coding track** shows the problem list and lets you read prompts/keep notes, but actual
  code execution stays desktop-only (needs local compilers). Aptitude, Computer Science, AI, and System Design are
  fully interactive here.
- **Sign-in** is email/password only. Web also offers Google/GitHub OAuth popups, which don't have a clean
  equivalent in a bare React Native app without extra native auth libraries - out of scope for this pass. Any
  account can still set/reset a password from "Forgot password" regardless of how it was originally created.
- **Settings** skips 2FA setup, Google Calendar account linking, and Chrome extension token pairing - none of those
  translate to a phone. Theme toggle, notification toggles, calendar sync (boolean, no OAuth), profile visibility,
  and password reset all work.
- Resume's Visual Mode saves to its own Firestore collection (`mobileResumes`) since web's Visual Mode has no
  persistence of its own to reuse (see `src/lib/mobileResumes.ts` for why).

## Backend configuration

The app talks to the **deployed production CareerOS backend** for server-only features and talks to **Firebase
directly** for everything else (jobs, reminders, practice attempts, resumes), exactly like the web app does. Public
mobile values are read from the repo-root `.env.local` through `EXPO_PUBLIC_*` keys, with hosted CareerOS defaults
kept in `src/config/env.ts` so a fresh checkout still runs. If you redeploy to a different URL, update the root
`.env.local` instead of editing app-local env files.

## One-time setup (do this before the first run)

1. Use the repo Node version:

```powershell
nvm install 20.20.2
nvm use 20.20.2
```

2. Install workspace dependencies from the repo root:

```powershell
npm install
```

3. **Install the mobile-only native dependencies.** These weren't safe to hand-pin in this session (their exact
   versions need to match whatever Expo SDK is on your machine), so install them with Expo's own resolver instead
   of plain `npm install`. From `apps/mobile`:

```powershell
npx expo install @react-navigation/native @react-navigation/drawer @react-navigation/native-stack react-native-gesture-handler react-native-reanimated react-native-screens @react-native-async-storage/async-storage firebase lucide-react-native react-native-svg expo-print expo-sharing expo-image-picker expo-clipboard @react-native-community/datetimepicker
```

   `npx expo install` picks versions compatible with your installed Expo SDK automatically - if it prompts you to
   upgrade/downgrade a package, accept its recommendation.

4. Install Android Studio, and in it install:

- Android SDK Platform
- Android SDK Platform-Tools
- Android SDK Build-Tools
- Android Emulator, optional if you only use a real phone

5. Add Android SDK environment variables. A common Windows path is:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
```

Add the same values permanently in Windows Environment Variables after confirming the path exists.

6. Enable USB debugging on the phone:

- Settings
- About phone
- Tap Build number seven times
- Developer options
- Enable USB debugging

7. Connect the phone by USB and approve the debugging prompt on the phone.

8. Confirm the device is visible:

```powershell
adb devices
```

The device should show as `device`, not `unauthorized`.

## Running the app on your phone

From the repo root:

```powershell
npm run mobile:android
```

That builds the development app, installs it on the connected Android device, and starts Metro. The very first
run takes longer than usual - Expo has to generate the native `android/` project and Gradle has to download its
toolchain. Sign in with the same CareerOS account you use on web (or create one) - your jobs, reminders, practice
attempts, and saved resumes all sync live through the same Firebase project.

If you'd rather use an emulator instead of a physical phone:

```powershell
npm run mobile:android:emulator
```

## Useful scripts

Run from the repo root:

```powershell
npm run mobile:start
npm run mobile:android
npm run mobile:android:emulator
npm run mobile:typecheck
```

Run directly inside this workspace:

```powershell
npm run start
npm run android
npm run android:emulator
npm run typecheck
```

## Troubleshooting

If `adb` is not recognized, Android Platform-Tools is not on `PATH`.

If no device appears in `adb devices`, reconnect the phone, choose File Transfer / USB mode if needed, and approve
the USB debugging prompt.

If the build cannot find Java, install Android Studio's bundled JDK or a compatible JDK and set `JAVA_HOME`.

If Metro complains about a missing native module right after the dependency install step, double check step 3 ran
successfully - a couple of these packages (`react-native-reanimated`, `react-native-screens`, `react-native-svg`)
need a native rebuild (`npm run mobile:android` again) after installing, not just a Metro restart.

If sign-in or any screen that talks to the backend shows a network error, confirm the phone has internet access -
everything here calls the deployed production CareerOS URL and Firebase directly, there is no local server to run.

## Project layout

```
src/
  config/        Firebase + Cloudinary + backend API base URL
  theme/         Dark/light color tokens and ThemeContext
  contexts/      AuthContext (email/password Firebase auth)
  lib/           Firestore hooks, API client, per-feature data helpers
  types/         TypeScript types mirroring the web app's data models
  components/    Shared UI primitives (Card, Pill, PickerField, DateTimeField, ...)
  navigation/    Drawer (top-level sections) + a nested stack for Interview War Room
  screens/       One folder per top-level section
```
