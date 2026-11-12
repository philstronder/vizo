import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { BACKGROUND_COLOR } from './src/config';
import { useOtaUpdates } from './src/useOtaUpdates';
import { WebShell } from './src/WebShell';

// Keep the splash up until the website's first paint, instead of a blank WebView.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useOtaUpdates();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="dark" />
        <WebShell />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND_COLOR },
});
