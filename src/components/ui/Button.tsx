import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

export interface ButtonProps {
  label: string;
  onPress?: (event: any) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  className = '',
}) => {
  // Base layout styles
  const baseStyles = 'flex-row items-center justify-center rounded-xl font-display font-medium';

  // Variant styles
  const variantStyles = {
    primary: 'bg-brand-primary border border-transparent',
    secondary: 'bg-brand-secondary border border-transparent',
    outline: 'bg-transparent border border-brand-primary',
    ghost: 'bg-transparent border border-transparent',
    danger: 'bg-brand-error border border-transparent',
  };

  // Label text styles
  const textStyles = {
    primary: 'text-brand-surface font-semibold',
    secondary: 'text-brand-text font-semibold',
    outline: 'text-brand-primary font-semibold',
    ghost: 'text-brand-text font-medium',
    danger: 'text-brand-surface font-semibold',
  };

  // Size configurations
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm h-10',
    md: 'px-6 py-3.5 text-base h-12',
    lg: 'px-8 py-4.5 text-lg h-14',
  };

  // Disable adjustments
  const opacityStyle = disabled || loading ? 'opacity-50' : 'opacity-100';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        pressed && !disabled && !loading ? { transform: [{ scale: 0.96 }] } : null
      ]}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${opacityStyle} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'outline' || variant === 'ghost'
              ? '#FF6B35'
              : variant === 'secondary'
              ? '#1A1A1A'
              : '#FFFFFF'
          }
          className="mr-2"
        />
      ) : (
        <View className="flex-row items-center justify-center">
          {icon && iconPosition === 'left' && <View className="mr-2">{icon}</View>}
          <Text className={`${textStyles[variant]} text-center`}>{label}</Text>
          {icon && iconPosition === 'right' && <View className="ml-2">{icon}</View>}
        </View>
      )}
    </Pressable>
  );
};
