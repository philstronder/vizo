# Vizo mobile

iOS and Android app (Expo SDK 58 / React Native) that shows the Vizo website in
a full-screen WebView. The native shell exists so we can add native features
later (push notifications first) without changing how the site is built.

## How updates reach users

There are three layers, and only the last one goes through the stores:

| What changed | How it ships | User action |
| --- | --- | --- |
| The website (`frontend/`) | Deploy the frontend as usual. The WebView loads the live site. | None. They see it on the next page load. |
| The shell's JavaScript (`App.tsx`, `src/`) | `npm run update:production` (Expo Update, over the air) | None. See below. |
| Native code (new native library, permissions, SDK upgrade, icon) | `npm run build:production` and submit to the stores | Install the store update |

**OTA behaviour** (`src/useOtaUpdates.ts`): on launch, expo-updates checks and
downloads in the background without delaying startup. The app checks again
every time it returns to the foreground. A downloaded update is applied on the
next cold start, or when the user comes back after 10+ minutes away
(`RELOAD_AFTER_BACKGROUND_MS` in `src/config.ts`). It never reloads in the
middle of a session.

**Runtime version** uses the `fingerprint` policy: an OTA update is only
delivered to binaries with the same native code. If you add a native module
(for example `expo-notifications`), the fingerprint changes. Ship a store build
first. OTA updates published afterwards only reach that new build, so older
installs never get JS they can't run.

## One-time setup

You need an [Expo account](https://expo.dev/signup). For store builds you also
need an Apple Developer account and a Google Play Console account.

```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init               # creates the Expo project, writes extra.eas.projectId
npx eas-cli@latest update:configure   # writes updates.url into app.json
```

Before the first store build, check these values in `app.json`:

- `expo.extra.webUrl`: the public HTTPS URL of the frontend. It currently
  points at the CloudFront distribution.
- `ios.bundleIdentifier` / `android.package`: currently `com.vizo.app`.
  **These can't be changed after the first store release.**
- Icons and splash in `assets/`: these are still the Expo placeholders.

## Day to day

```bash
# Run against your local frontend in Expo Go or a simulator. Use your machine's
# LAN IP, not localhost, so a phone or the Android emulator can reach it.
EXPO_PUBLIC_WEB_URL=http://192.168.0.10:3000 npm start

npm run typecheck && npm run lint

npm run build:preview        # internal-distribution builds for testers (channel: preview)
npm run update:preview       # OTA to those testers

npm run build:production     # store builds (channel: production, build number auto-incremented)
npx eas-cli@latest submit --platform all
npm run update:production    # OTA to store users
```

Roll back a bad OTA with `npx eas-cli@latest update:rollback`.

## Talking to the website

The page can tell when it is running inside the app:

- The user agent ends with `VizoApp/<version>`.
- `window.VizoNative` is defined before the page's own scripts run. It
  contains `{ platform, appVersion, updateId, postMessage }`.

`window.VizoNative.postMessage({ type: '...' })` sends a message to the native
side, where `src/bridge.ts` handles it. Add new message types there. For push
notifications, the site will post a message such as `register-push` after
login, and native will reply with the device token.

## WebView behaviour

- Links to other domains, plus `tel:`, `mailto:` and `whatsapp:` links, open
  in the system browser or app. The site itself stays in the app.
- On Android, the hardware back button goes back in the site's history.
  Swipe-back works on iOS.
- The session cookie persists across app restarts.
- If the first load fails (for example, offline), the app shows a retry
  screen instead of a blank page.
- If the OS kills the web content process, the app reloads it automatically.
