import React from 'react';
import { Text, TextProps } from 'react-native';

export interface PriceDisplayProps extends TextProps {
  amount: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  className = '',
  size = 'md',
  ...props
}) => {
  // Format the price using Indian currency grouping system
  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

  // Size styling classes
  const sizeStyles = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-extrabold',
    xxl: 'text-3xl font-extrabold',
  };

  return (
    <Text
      className={`font-display text-brand-text ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {formattedPrice}
    </Text>
  );
};
