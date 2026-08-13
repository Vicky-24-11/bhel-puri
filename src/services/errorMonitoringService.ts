import { Platform } from 'react-native';

interface ErrorContext {
  component?: string;
  action?: string;
  [key: string]: any;
}

/**
 * Sanitizes sensitive identifiers, credentials, and OTPs from logging payloads.
 */
function sanitizePayload(data: any): any {
  if (!data) return data;
  if (typeof data === 'string') {
    // Redact OTP codes, access tokens, passwords, and private secrets
    return data
      .replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, '[EMAIL]') // Emails
      .replace(/\b\d{6}\b/g, '[OTP]') // Standard 6-digit OTPs
      .replace(/(?:password|token|secret|access_token|refresh_token|otp|code)=[^&\s]+/gi, '$1=[REDACTED]');
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('otp') ||
        lowerKey.includes('code') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('key')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizePayload(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Initializes global error handlers for uncaught Javascript exceptions.
 */
export function initErrorMonitoring(): void {
  if (__DEV__) {
    console.log('Error Monitoring: Initialized in development mode.');
    return;
  }

  // Global error handler for uncaught JS exceptions
  if (typeof ErrorUtils !== 'undefined') {
    const globalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: any, isFatal: any) => {
      logError(error, { fatal: isFatal, origin: 'GlobalHandler' });
      if (globalHandler) {
        globalHandler(error, isFatal);
      }
    });
  }

  // Global promise rejection tracker for web or polyfilled native
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      logError(event.reason || new Error('Unhandled Promise Rejection'), { origin: 'UnhandledRejection' });
    });
  }
}

/**
 * Capture and route errors to logs and diagnostics services.
 */
export function logError(error: Error | any, context?: ErrorContext): void {
  const message = error?.message || String(error);
  const stack = error?.stack;
  
  const cleanContext = sanitizePayload(context || {});
  const cleanMessage = sanitizePayload(message);

  if (__DEV__) {
    console.warn(`[Error Monitor] Logged: "${cleanMessage}"`, {
      stack: stack ? 'Available' : 'None',
      context: cleanContext,
    });
  } else {
    // Production tracking. Replace this with Sentry.captureException in the future if desired.
    console.error(`[Error Monitor] Production Exception: ${cleanMessage}`, {
      stack,
      context: cleanContext,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });
  }
}
