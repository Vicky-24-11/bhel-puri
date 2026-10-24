import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Safe, platform-agnostic haptic feedback helpers.
 * Silently no-ops on Web and unsupported hardware.
 */

export const hapticLight = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ignore
  }
};

export const hapticMedium = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // ignore
  }
};

export const hapticHeavy = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // ignore
  }
};

export const hapticSelection = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // ignore
  }
};

export const hapticSuccess = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // ignore
  }
};

export const hapticWarning = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // ignore
  }
};

export const hapticError = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // ignore
  }
};
