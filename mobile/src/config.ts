import Constants from 'expo-constants';

/**
 * The website the app wraps. Production value lives in app.json
 * (`expo.extra.webUrl`) so it ships with both store builds and OTA updates.
 * For local development, override it without touching app.json:
 *
 *   EXPO_PUBLIC_WEB_URL=http://192.168.0.10:3000 npx expo start
 */
const fromEnv = process.env.EXPO_PUBLIC_WEB_URL;
const fromConfig = Constants.expoConfig?.extra?.webUrl as string | undefined;

export const WEB_URL = (fromEnv || fromConfig || '').replace(/\/+$/, '');

if (!WEB_URL) {
  throw new Error('Missing web URL: set expo.extra.webUrl in app.json or EXPO_PUBLIC_WEB_URL.');
}

export const WEB_ORIGIN = new URL(WEB_URL).origin;

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** Matches the page background so safe areas and the splash blend in. */
export const BACKGROUND_COLOR = '#faf6ec';
export const TEXT_COLOR = '#1e1c15';

/**
 * A downloaded update is applied on the next cold start, or when the user
 * comes back to the app after it sat in the background at least this long.
 * Short absences (switching to another app for a moment) never reload.
 */
export const RELOAD_AFTER_BACKGROUND_MS = 10 * 60 * 1000;
