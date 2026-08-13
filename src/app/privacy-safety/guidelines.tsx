import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { router } from 'expo-router';

export default function CommunityGuidelinesScreen() {
  const sections = [
    {
      title: '1. Honest Representation',
      content: 'Always list items with accurate titles, descriptions, categories, and photos that honestly reflect their current condition. Do not hide defects, use misleading keywords, or list fake/scam items.'
    },
    {
      title: '2. Binding Bids & Rules',
      content: 'Place bids only on items you intend to buy. Once you win, you are committed to coordinate handover with the seller. Shill bidding, bid manipulation, or bidding on your own listings is strictly forbidden.'
    },
    {
      title: '3. Prohibited Category List',
      content: 'We enforce zero tolerance for prohibited items. The following items must not be listed:\n' +
        '• Illegal drugs, narcotics, or drug paraphernalia\n' +
        '• Weapons, firearms, knives, ammunition, or explosives\n' +
        '• Stolen items, counterfeit goods, or trademark-infringing copies\n' +
        '• Hazardous, toxic, radioactive, or chemically restricted goods\n' +
        '• Adults-only items or sexually explicit content\n' +
        '• Regulated financial instruments, cash, or credit cards.'
    },
    {
      title: '4. Safe and Respectful Chats',
      content: 'Keep direct chats professional and focused on coordinating payments and product handovers. Threatening language, spamming, harassment, or inappropriate messaging will lead to immediate account suspension.'
    },
    {
      title: '5. Moderation Reports & Abuse Policy',
      content: 'Users are encouraged to report any suspicious auctions or bad actors using the in-app "Report" options. Do not abuse reporting tools by submitting duplicate identical reports or targeting valid users maliciously.'
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
          <Lock size={18} color="#FF6B35" />
          <View>
            <Text className="text-lg font-display font-extrabold text-brand-text">
              Community Guidelines
            </Text>
            <Text className="text-[10px] font-display text-brand-muted mt-0.5">
              Rules of safety and listing behaviors
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-white">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12 gap-5">
          
          <View className="bg-stone-50 border border-stone-200 rounded-3xl p-5 mb-2">
            <Text className="text-xs font-display font-bold text-brand-text mb-1">
              Safety & Trust First
            </Text>
            <Text className="text-[11px] font-display text-brand-muted leading-relaxed">
              {"Bhel Puri relies on local community trust. Following these basic behavior standards protects you and other bidders from fraudulent or malicious activities."}
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
