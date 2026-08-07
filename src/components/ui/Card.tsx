import React from 'react';
import { Pressable, View } from 'react-native';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  className = '',
  testID,
}) => {
  const cardStyles = `bg-brand-surface border border-brand-border rounded-2xl p-4 shadow-sm overflow-hidden web:transition-all web:duration-300 ${
    onPress ? 'active:opacity-90 web:hover:shadow-md web:hover:-translate-y-0.5 cursor-pointer' : ''
  } ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={cardStyles}
        accessibilityRole="button"
        testID={testID}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={cardStyles} testID={testID}>
      {children}
    </View>
  );
};
