import React from 'react';
import { View, Text } from 'react-native';
import { LoadingState } from '../components/ui/LoadingState';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFBF7' }}>
      <LoadingState variant="spinner" />
      <Text style={{ fontFamily: 'System', fontSize: 14, color: '#7F8C8D', marginTop: 12 }}>
        Connecting to Bhel Puri...
      </Text>
    </View>
  );
}
