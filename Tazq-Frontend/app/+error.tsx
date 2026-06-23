import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldAlert, RefreshCcw } from 'lucide-react-native';
import { useAppTheme } from '../theme';
import { F, R, S } from '../tokens';

export default function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { theme, isDark } = useAppTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: isDark ? '#3f1a1a' : '#fee2e2' }]}>
          <ShieldAlert size={48} color={theme.error} />
        </View>
        
        <Text style={[styles.title, { color: theme.onBackground }]}>
          Ups! Bir şeyler ters gitti.
        </Text>
        
        <Text style={[styles.description, { color: theme.onSurfaceVariant }]}>
          Sistem beklenmedik bir hatayla karşılaştı. Verileriniz güvende, sayfayı yenilemeyi deneyebilirsiniz.
        </Text>

        {__DEV__ && (
          <View style={[styles.errorBox, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outline }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              {error.message}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]} 
            onPress={retry}
            activeOpacity={0.8}
          >
            <RefreshCcw size={20} color={theme.onPrimary || '#fff'} />
            <Text style={[styles.buttonText, { color: theme.onPrimary || '#fff' }]}>Yeniden Dene</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.outlineButton, { borderColor: theme.outline }]} 
            onPress={() => router.replace('/')}
            activeOpacity={0.8}
          >
            <Text style={[styles.outlineButtonText, { color: theme.onBackground }]}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: S.md,
    textAlign: 'center',
  },
  description: {
    fontSize: F.body,
    textAlign: 'center',
    marginBottom: S.xl,
    lineHeight: 24,
  },
  errorBox: {
    width: '100%',
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    marginBottom: S.xl,
  },
  errorText: {
    fontSize: F.caption,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: S.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.md,
    borderRadius: R.full,
    gap: S.sm,
  },
  buttonText: {
    fontSize: F.body,
    fontWeight: '700',
  },
  outlineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.md,
    borderRadius: R.full,
    borderWidth: 1,
  },
  outlineButtonText: {
    fontSize: F.body,
    fontWeight: '600',
  },
});
