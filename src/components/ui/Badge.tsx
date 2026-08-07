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
  const typeStyles = {
    primary: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
    secondary: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20',
    success: 'bg-brand-success/10 text-brand-success border-brand-success/20',
    warning: 'bg-brand-warning/10 text-brand-warning border-brand-warning/20',
    error: 'bg-brand-error/10 text-brand-error border-brand-error/20',
    neutral: 'bg-brand-muted/10 text-brand-muted border-brand-muted/20',
  };

  // Styles for sizes
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px] font-semibold border rounded-full',
    md: 'px-3 py-1 text-xs font-bold border rounded-full',
  };

  return (
    <View className={`self-start items-center justify-center ${typeStyles[type]} ${sizeStyles[size]} ${className}`}>
      <Text className="font-display tracking-wide uppercase text-inherit text-center">
        {label}
      </Text>
    </View>
  );
};
