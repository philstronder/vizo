import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { RELOAD_AFTER_BACKGROUND_MS } from './config';

/**
 * Keeps the native shell's JavaScript current through Expo Update (OTA).
 *
 * - On launch, expo-updates checks and downloads in the background by itself
 *   (`checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`, so launch is
 *   never blocked on the network).
 * - Every time the app returns to the foreground we check again.
 * - A downloaded update is applied on the next cold start, or right away when
 *   the user returns after a long absence (they're not mid-task then).
 *
 * The website itself needs none of this: the WebView loads it live, so a web
 * deploy reaches users on their next page load.
 */
export function useOtaUpdates() {
  const { isUpdatePending } = Updates.useUpdates();
  const pendingRef = useRef(isUpdatePending);
  useEffect(() => {
    pendingRef.current = isUpdatePending;
  }, [isUpdatePending]);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let backgroundedAt: number | null = null;
    let checking = false;

    const checkAndFetch = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or the update server is unreachable; try again next time.
      } finally {
        checking = false;
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
        return;
      }
      if (state !== 'active') return;

      const awayFor = backgroundedAt === null ? 0 : Date.now() - backgroundedAt;
      backgroundedAt = null;

      if (pendingRef.current && awayFor >= RELOAD_AFTER_BACKGROUND_MS) {
        Updates.reloadAsync().catch(() => {});
        return;
      }
      checkAndFetch();
    });

    return () => sub.remove();
  }, []);
}
