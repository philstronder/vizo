import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Linking, Platform, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import * as SplashScreen from 'expo-splash-screen';
import { BACKGROUND_COLOR, WEB_ORIGIN, WEB_URL } from './config';
import { handleWebMessage, injectedBeforeLoad, parseWebMessage, USER_AGENT_SUFFIX } from './bridge';
import { ErrorScreen } from './ErrorScreen';

/** Hide the splash even if the first load hangs, so the user isn't stuck. */
// react-native-webview's class defaults its generic to `undefined`, which
// collapses the props type to `never` under TS 6. Pin it to `object`.
type AppWebView = WebView<object>;

const SPLASH_TIMEOUT_MS = 8000;

/** Schemes the WebView handles itself; anything else (tel:, mailto:, whatsapp:…) goes to the OS. */
const IN_WEBVIEW_SCHEMES = ['http:', 'https:', 'about:', 'data:', 'blob:'];

export function WebShell() {
  const webViewRef = useRef<AppWebView>(null);
  const canGoBackRef = useRef(false);
  const [failed, setFailed] = useState(false);
  // Changing the key remounts the WebView: a clean reload from the start URL.
  const [instance, setInstance] = useState(0);

  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(hideSplash, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hideSplash]);

  // Android hardware back button navigates the site's history first.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  // Keep our own site inside the app; open everything else in the system browser/app.
  const onShouldStartLoadWithRequest = useCallback((req: ShouldStartLoadRequest) => {
    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      return false;
    }
    if (!IN_WEBVIEW_SCHEMES.includes(url.protocol)) {
      Linking.openURL(req.url).catch(() => {});
      return false;
    }
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    // Only redirect top-level navigations; iframes (maps, embeds) stay inline.
    if (isHttp && url.origin !== WEB_ORIGIN && req.isTopFrame !== false) {
      Linking.openURL(req.url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setInstance((n) => n + 1);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // Android is edge-to-edge, so the window no longer resizes for the keyboard.
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
    >
      <WebView<object>
        key={instance}
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        containerStyle={styles.webview}
        applicationNameForUserAgent={USER_AGENT_SUFFIX}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
        onMessage={(e: WebViewMessageEvent) => {
          const message = parseWebMessage(e.nativeEvent.data);
          if (message) handleWebMessage(message);
        }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={hideSplash}
        onError={() => {
          setFailed(true);
          hideSplash();
        }}
        // The OS can kill the web content process under memory pressure; recover.
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
        onRenderProcessGone={() => webViewRef.current?.reload()}
        // Session cookie (httpOnly JWT) must survive app restarts.
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        bounces={false}
        overScrollMode="never"
        textZoom={100}
        webviewDebuggingEnabled={__DEV__}
      />
      {failed && <ErrorScreen onRetry={retry} />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  webview: { flex: 1, backgroundColor: BACKGROUND_COLOR },
});
