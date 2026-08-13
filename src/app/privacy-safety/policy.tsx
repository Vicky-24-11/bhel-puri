import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye } from 'lucide-react-native';
import { router } from 'expo-router';

export default function PrivacyPolicyScreen() {
  const sections = [
    {
      title: '1. Information We Collect',
      content: 'We collect your profile details (username, full name, avatar, bio, location), email address for OTP-based authentication, and transaction data including auction listings, bids, messages, and reports.'
    },
    {
      title: '2. How We Use Data',
      content: 'Your credentials are used to identify you across the marketplace, enable real-time message exchange between buyers and sellers, deliver outbid/won notifications, and enforce account safety rules.'
    },
    {
      title: '3. Data Sharing & Privacy Controls',
      content: 'Your contact name and avatar are visible to other users on listing cards and active chat rooms. Private messages and reports are secured via database-level Row Level Security (RLS) policies and are not exposed to third parties.'
    },
    {
      title: '4. Image Storage Guidelines',
      content: 'Photos uploaded during product listing creation are securely hosted in public Supabase Storage buckets. Users are strictly prohibited from uploading executables, HTML, script vectors, or files exceeding standard upload limits.'
    },
    {
      title: '5. Account Deletion & Anonymization',
      content: 'When you delete your account, your auth identity and credentials are deleted immediately. To prevent breaking active bid sequences or listing history, your listed auctions and bid histories are preserved anonymously under a "Deleted User" flag.'
    },
    {
      title: '6. Policy Updates',
      content: 'We reserve the right to modify this Privacy Policy at any time. Changes will be posted here and updated with a revised modification date.'
    }
  ];

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header Panel */}
      <View className="px-5 py-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View className="flex-row items-center gap-1.5 flex-1">
          <Eye size={18} color="#FF6B35" />
          <View>
            <Text className="text-lg font-display font-extrabold text-brand-text">
              Privacy Policy
            </Text>
            <Text className="text-[10px] font-display text-brand-muted mt-0.5">
              How we manage storage and user metadata
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-white">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12 gap-5">
          
          <View className="bg-stone-50 border border-stone-200 rounded-3xl p-5 mb-2">
            <Text className="text-xs font-display font-bold text-brand-text mb-1">
              Data Security Standards
            </Text>
            <Text className="text-[11px] font-display text-brand-muted leading-relaxed">
              {"Bhel Puri utilizes enterprise-grade encryption for storage objects and authentications. RLS database policies isolate your private conversations and reports securely."}
            </Text>
          </View>

          {sections.map((sec, idx) => (
            <View key={idx} className="gap-2">
              <Text className="text-sm font-display font-extrabold text-brand-text">
                {sec.title}
              </Text>
              <Text className="text-xs font-display text-brand-muted leading-relaxed">
                {sec.content}
              </Text>
            </View>
          ))}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
