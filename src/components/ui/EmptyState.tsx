import React from 'react';
import { Text, View } from 'react-native';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onActionPress,
  className = '',
}) => {
  return (
    <View className={`flex-1 justify-center items-center px-6 py-12 ${className}`}>
      {/* Icon Area */}
      {icon && <View className="mb-4 opacity-75">{icon}</View>}

      {/* Text Area */}
      <Text className="text-lg font-display font-semibold text-brand-text text-center mb-1">
        {title}
      </Text>
      <Text className="text-sm font-display text-brand-muted text-center max-w-xs mb-6">
        {description}
      </Text>

      {/* Action Button */}
      {actionLabel && onActionPress && (
        <Button
          label={actionLabel}
          onPress={onActionPress}
          variant="outline"
          size="sm"
        />
      )}
    </View>
  );
};
