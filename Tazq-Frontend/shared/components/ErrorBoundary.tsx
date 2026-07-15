import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { captureError } from '@/shared/utils/sentry';
import { Touchable } from '@/shared/components/Touchable';
import { SupportService } from '@/shared/services/api';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { AlertCircle, RotateCcw } from 'lucide-react-native';
// Hata sınırı hook kullanamaz (render dışı yakalar), ama paleti elle kopyalamamalı:
// doğrudan Colors'tan okur ki tema değişince birlikte değişsin.
import { Colors } from '@/shared/constants/Colors';
import { S, ICON, R } from '@/shared/constants/tokens';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 1. Report to Sentry
    captureError(error, { componentStack: info.componentStack ?? '' });

    // 2. Report to our backend for Admin console tracking
    try {
      const errorMessage = error?.message || 'Unknown React Crash';
      const stackTrace = `${error?.stack ?? ''}\n\nComponent Stack:\n${info.componentStack ?? ''}`;
      const deviceName = Device.modelName || Device.designName || 'Unknown Device';
      const platform = `${Platform.OS} ${Platform.Version}`;
      const appVersion = Constants.expoConfig?.version || '1.0.0';

      SupportService.reportCrash({
        errorMessage,
        stackTrace,
        deviceName,
        platform,
        appVersion
      }).catch((e) => console.warn('[ErrorBoundary reportCrash failed]', e));
    } catch (e) {
      console.warn('[ErrorBoundary failed to gather crash metadata]', e);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrapper}>
              <AlertCircle size={ICON.xl} color="#EF4444" strokeWidth={2.2} />
            </View>
            
            <Text style={styles.title}>Bir Şeyler Ters Gitti</Text>
            <Text style={styles.subtitle}>Something went wrong</Text>
            
            <View style={styles.errorBox}>
              <Text style={styles.errorText} numberOfLines={4}>
                {this.state.error?.message || 'Bilinmeyen Hata / Unknown Error'}
              </Text>
            </View>

            <Text style={styles.info}>
              Hata detayları geliştirici panelimize otomatik olarak raporlandı. En kısa sürede düzelteceğiz!
            </Text>
            <Text style={[styles.info, { marginTop: S.xs, opacity: 0.5 }]}>
              Crash report has been automatically sent to the admin dashboard. We'll fix it soon!
            </Text>

            <Touchable onPress={this.reset} style={styles.btn}>
              <RotateCcw size={ICON.sm} color="white" style={{ marginRight: S.sm }} />
              <Text style={styles.btnText}>Tekrar Dene / Try Again</Text>
            </Touchable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: Colors.dark.background,
    padding: S.lg 
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.dark.surfaceVariant,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: S.slg,
    alignItems: 'center',
    gap: S.smd,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: R.full,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.sm,
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: Colors.dark.onSurface,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.onSurfaceVariant,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: S.sm,
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    borderRadius: R.md,
    padding: S.md,
  },
  errorText: { 
    fontSize: 12, 
    color: '#FDA4AF', 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  info: {
    fontSize: 11,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 15,
    fontWeight: '500',
  },
  btn: { 
    backgroundColor: '#3B82F6', 
    paddingHorizontal: S.lmd, 
    paddingVertical: S.smd, 
    borderRadius: R.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: S.smd,
  },
  btnText: { 
    color: 'white', 
    fontWeight: '700',
    fontSize: 14,
  },
});
