import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { logError } from '@/services/errorMonitoringService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, {
      component: 'ErrorBoundary',
      errorInfo: errorInfo as any,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Attempt reloading web page or routing back on native
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-brand-background justify-center items-center p-6">
          <View className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6 shadow-sm items-center gap-4">
            <View 
              style={{ backgroundColor: 'rgba(231, 29, 54, 0.08)' }}
              className="w-12 h-12 rounded-full items-center justify-center"
            >
              <AlertCircle size={24} color="#E71D36" />
            </View>

            <View className="items-center gap-1.5">
              <Text className="font-display font-extrabold text-brand-text text-base text-center">
                Something went wrong
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center leading-relaxed">
                {"An unexpected error occurred while loading this interface. Let's try reloading the screen."}
              </Text>
            </View>

            {__DEV__ && this.state.error && (
              <ScrollView className="bg-stone-50 border border-stone-100 rounded-xl p-3 max-h-32 w-full">
                <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }} className="text-[10px] text-brand-muted leading-tight">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </Text>
              </ScrollView>
            )}

            <Pressable
              onPress={this.handleReset}
              className="w-full h-11 bg-brand-primary active:bg-brand-primary/95 rounded-2xl items-center justify-center flex-row gap-2"
            >
              <RefreshCw size={14} color="#FFFFFF" />
              <Text className="text-xs font-display font-bold text-white">
                Try Again
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
