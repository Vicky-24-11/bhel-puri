import React, { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';

export interface CountdownTimerProps extends TextProps {
  endTime: string;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  endTime,
  className = '',
  ...props
}) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const difference = +new Date(endTime) - +new Date();
      if (difference <= 0) {
        setTimeLeft('Ended');
        setIsUrgent(false);
        return false;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      // Urgent if less than 5 minutes (300 seconds) remaining
      setIsUrgent(difference < 5 * 60 * 1000);

      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');
      const formattedSeconds = seconds.toString().padStart(2, '0');

      if (days > 0) {
        setTimeLeft(`${days}d ${formattedHours}h ${formattedMinutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`);
      } else {
        setTimeLeft(`${formattedMinutes}m ${formattedSeconds}s`);
      }
      return true;
    };

    calculateTime();
    const interval = setInterval(() => {
      const active = calculateTime();
      if (!active) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  const textColor = isUrgent ? 'text-brand-error font-extrabold animate-pulse' : 'text-brand-primary font-bold';

  return (
    <Text
      className={`font-display text-sm ${textColor} ${className}`}
      {...props}
    >
      {timeLeft}
    </Text>
  );
};
