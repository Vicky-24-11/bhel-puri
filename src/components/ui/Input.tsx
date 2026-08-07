import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerClassName = '',
  onFocus,
  onBlur,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  // Border and background state colors
  const borderStyle = error
    ? 'border-brand-error'
    : isFocused
    ? 'border-brand-primary'
    : 'border-brand-muted/30';

  const bgStyle = isFocused ? 'bg-white' : 'bg-stone-50';

  return (
    <View className={`w-full mb-4 ${containerClassName}`}>
      {label && (
        <Text className="text-sm font-display font-semibold text-brand-text mb-1.5 ml-0.5">
          {label}
        </Text>
      )}

      <View
        className={`flex-row items-center border rounded-xl px-3.5 h-12 transition-all duration-200 ${borderStyle} ${bgStyle}`}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}

        <TextInput
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor="#999999"
          className={`flex-1 h-full font-display text-brand-text text-base ${className}`}
          style={{ paddingVertical: 0 }} // Remove default Android vertical paddings
          {...props}
        />

        {rightIcon && <View className="ml-2">{rightIcon}</View>}
      </View>

      {error ? (
        <Text className="text-xs font-display font-medium text-brand-error mt-1.5 ml-1">
          {error}
        </Text>
      ) : helperText ? (
        <Text className="text-xs font-display text-brand-muted mt-1.5 ml-1">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};
