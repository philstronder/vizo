import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BACKGROUND_COLOR, TEXT_COLOR } from './config';

export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sem conexão · No connection</Text>
      <Text style={styles.body}>
        Verifique sua internet e tente novamente.{'\n'}Check your connection and try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Tentar novamente · Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: BACKGROUND_COLOR,
  },
  title: { fontSize: 20, fontWeight: '600', color: TEXT_COLOR, marginBottom: 8 },
  body: { fontSize: 15, color: '#4a4738', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  button: { backgroundColor: '#f2b705', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999 },
  buttonPressed: { backgroundColor: '#e2a900' },
  buttonText: { fontSize: 16, fontWeight: '600', color: TEXT_COLOR },
});
