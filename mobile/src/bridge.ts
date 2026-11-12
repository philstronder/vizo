import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { APP_VERSION } from './config';

/**
 * Web <-> native bridge. Nothing uses it yet; it is the hook point for native
 * features such as push notifications.
 *
 * The page can detect the app with `window.VizoNative` (or the `VizoApp/x.y.z`
 * user-agent suffix) and send messages with:
 *
 *   window.VizoNative.postMessage({ type: 'ready' })
 *
 * Add new message types to `WebMessage` and handle them in `handleWebMessage`.
 */
export type WebMessage = { type: 'ready' };

export const USER_AGENT_SUFFIX = `VizoApp/${APP_VERSION}`;

const nativeInfo = {
  platform: Platform.OS,
  appVersion: APP_VERSION,
  updateId: Updates.updateId,
};

/** Runs in the page before its own scripts, on every navigation. */
export const injectedBeforeLoad = `
  (function () {
    var info = ${JSON.stringify(nativeInfo)};
    info.postMessage = function (message) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    };
    window.VizoNative = info;
  })();
  true;
`;

export function parseWebMessage(data: string): WebMessage | null {
  try {
    const message = JSON.parse(data);
    return message && typeof message.type === 'string' ? (message as WebMessage) : null;
  } catch {
    return null;
  }
}

export function handleWebMessage(message: WebMessage) {
  switch (message.type) {
    case 'ready':
      break;
  }
}
