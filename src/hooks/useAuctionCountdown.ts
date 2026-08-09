import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Custom hook to manage real-time countdown calculations.
 * Listens to AppState backgrounding/resume events to prevent stale timers on mobile devices.
 */
export function useAuctionCountdown(endTimeStr: string, onExpire?: () => void) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const intervalRef = useRef<any>(null);
  const onExpireRef = useRef(onExpire);

  // Keep callback reference updated to prevent interval restarts
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const calculateTimeLeft = useCallback(() => {
    const diff = +new Date(endTimeStr) - +new Date();
    if (diff <= 0) {
      setIsExpired(true);
      setTimeLeft('Ended');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (onExpireRef.current) {
        onExpireRef.current();
      }
      return;
    }

    setIsExpired(false);
    const secs = Math.floor(diff / 1000);
    const days = Math.floor(secs / (3600 * 24));
    const hours = Math.floor((secs % (3600 * 24)) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    let timeStr = '';
    if (days > 0) {
      timeStr += `${days}d `;
    }
    if (hours > 0 || days > 0) {
      timeStr += `${hours}h `;
    }
    if (mins > 0 || hours > 0 || days > 0) {
      timeStr += `${mins}m `;
    }
    timeStr += `${remainingSecs}s`;

    setTimeLeft(timeStr.trim());
  }, [endTimeStr]);

  useEffect(() => {
    calculateTimeLeft();

    intervalRef.current = setInterval(() => {
      calculateTimeLeft();
    }, 1000);

    // Re-verify difference when returning from device background state
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          calculateTimeLeft();
        }
      }
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      appStateSubscription.remove();
    };
  }, [endTimeStr, calculateTimeLeft]);

  return { timeLeft, isExpired };
}
