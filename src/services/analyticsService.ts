import { Platform } from 'react-native';

interface EventProperties {
  [key: string]: any;
}

/**
 * Strips personal message content, passwords, tokens, and verification codes from analytics payloads.
 */
function sanitizeAnalyticsProps(props?: EventProperties): EventProperties | undefined {
  if (!props) return undefined;
  
  const sanitized: EventProperties = {};
  for (const key of Object.keys(props)) {
    const lowerKey = key.toLowerCase();
    
    // Explicitly drop fields that may carry private text or credentials
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('code') ||
      lowerKey.includes('content') ||
      lowerKey.includes('message') ||
      lowerKey.includes('text') ||
      lowerKey.includes('email') ||
      lowerKey.includes('phone')
    ) {
      // Omit completely or flag as present
      sanitized[key] = '[REDACTED_FOR_PRIVACY]';
    } else {
      const val = props[key];
      if (typeof val === 'object' && val !== null) {
        sanitized[key] = sanitizeAnalyticsProps(val);
      } else {
        sanitized[key] = val;
      }
    }
  }
  return sanitized;
}

/**
 * Tracks Bhel Puri marketplace user funnel interactions.
 * 
 * Target Core Funnel:
 * - sign_up_completed | login_completed (Signup/Login)
 * - app_opened (Browse init)
 * - auction_viewed (Auction details)
 * - auction_joined (Registering bid eligibility)
 * - bid_placed (Placing bids)
 * - auction_won (Declaring win coordinates)
 * - chat_started (Winner contact)
 * - message_sent (Message handshakes)
 */
export function trackEvent(eventName: string, properties?: EventProperties): void {
  const cleanProperties = sanitizeAnalyticsProps(properties);

  if (__DEV__) {
    console.log(`[Analytics Track] "${eventName}"`, cleanProperties || 'No Props');
  } else {
    // Production tracker. Hook up PostHog, Mixpanel, or Amplitude here.
    console.log(`[Analytics Production] event: "${eventName}"`, {
      properties: cleanProperties,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });
  }
}
