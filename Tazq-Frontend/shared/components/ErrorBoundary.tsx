import React from 'react';
import { router } from 'expo-router';
import { goHome } from '@/shared/utils/authNavigation';
import { CrashFallback } from '@/shared/components/CrashFallback';
import { reportRenderCrash } from '@/shared/utils/reportCrash';
import { swallow } from '@/shared/utils/swallow';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * KÖK hata sınırı — son çare. Ekran düzeyindeki çökmeleri rota sınırları yakalar
 * (bkz. CrashFallback.RouteErrorBoundary); buraya yalnız düzen/sağlayıcı katmanında
 * fırlayan hatalar düşer. Görünüm ortak: CrashFallback.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportRenderCrash(error, info.componentStack ?? '');
  }

  reset = () => this.setState({ hasError: false, error: null });

  goToHome = () => {
    this.reset();
    // Gezgin yeniden kurulduktan sonra: sınır yedek ekrandayken Stack bağlı değil.
    setTimeout(() => {
      try { goHome(router); } catch (e) { swallow('ErrorBoundary.goHome', e); }
    }, 0);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <CrashFallback error={this.state.error} onRetry={this.reset} onHome={this.goToHome} />;
    }
    return this.props.children;
  }
}
