import { router } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { hapticSelection } from '@/utils/haptics';

export const TAB_ROUTES = ['index', 'explore', 'sell', 'activity', 'profile'] as const;
export type TabRouteName = typeof TAB_ROUTES[number];

const TAB_NAV_PATHS: Record<TabRouteName, string> = {
  index: '/(tabs)',
  explore: '/(tabs)/explore',
  sell: '/(tabs)/sell',
  activity: '/(tabs)/activity',
  profile: '/(tabs)/profile',
};

interface SwipeableTabScreenProps {
  currentTab: TabRouteName;
  children: React.ReactNode;
}

/**
 * SwipeableTabScreen
 * Wraps tab screen content to allow native horizontal swipe gestures between
 * the 5 main tabs: Home <-> Explore <-> Post <-> Activity <-> Profile.
 *
 * Configured with activeOffsetX and failOffsetY so vertical scrolling inside
 * feeds and lists remains 100% fluid and unaffected.
 */
export function SwipeableTabScreen({ currentTab, children }: SwipeableTabScreenProps) {
  const currentIndex = TAB_ROUTES.indexOf(currentTab);

  const navigateTab = (targetTab: TabRouteName) => {
    hapticSelection();
    router.navigate(TAB_NAV_PATHS[targetTab] as any);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-35, 35])
    .failOffsetY([-20, 20])
    .onEnd((event) => {
      'worklet';
      // Swipe Left (finger moves left: translationX < -45) -> navigate to next tab
      if (event.translationX < -45 && Math.abs(event.velocityX) > 150) {
        if (currentIndex < TAB_ROUTES.length - 1) {
          const nextTab = TAB_ROUTES[currentIndex + 1];
          runOnJS(navigateTab)(nextTab);
        }
      }
      // Swipe Right (finger moves right: translationX > 45) -> navigate to previous tab
      else if (event.translationX > 45 && Math.abs(event.velocityX) > 150) {
        if (currentIndex > 0) {
          const prevTab = TAB_ROUTES[currentIndex - 1];
          runOnJS(navigateTab)(prevTab);
        }
      }
    });

  if (Platform.OS === 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </GestureDetector>
  );
}
