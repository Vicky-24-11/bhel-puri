import React from 'react';
import { Text, View } from 'react-native';

export interface BadgeProps {
  label: string;
  type?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  type = 'primary',
  size = 'sm',
  className = '',
}) => {
  // Styles for different variants
  const containerStyles = {
    primary: 'bg-brand-primary/10 border-brand-primary/20',
    secondary: 'bg-brand-secondary/10 border-brand-secondary/20',
    success: 'bg-brand-success/10 border-brand-success/20',
    warning: 'bg-brand-warning/10 border-brand-warning/20',
    error: 'bg-brand-error/10 border-brand-error/20',
    neutral: 'bg-brand-muted/10 border-brand-muted/20',
  };

  const textTypeStyles = {
    primary: 'text-brand-primary',
    secondary: 'text-brand-secondary',
    success: 'text-brand-success',
    warning: 'text-brand-warning',
    error: 'text-brand-error',
    neutral: 'text-brand-muted',
  };

  // Styles for sizes
  const sizeContainerStyles = {
    sm: 'px-2 py-0.5',
    md: 'px-3 py-1',
  };

  const sizeTextStyles = {
    sm: 'text-[10px] font-semibold',
    md: 'text-xs font-bold',
  };

  return (
    <View className={`self-start items-center justify-center border rounded-full ${containerStyles[type]} ${sizeContainerStyles[size]} ${className}`}>
      <Text className={`font-display tracking-wide uppercase text-center ${textTypeStyles[type]} ${sizeTextStyles[size]}`}>
        {label}
      </Text>
    </View>
  );
};
