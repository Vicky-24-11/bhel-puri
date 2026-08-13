import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Scale } from 'lucide-react-native';
import { router } from 'expo-router';

export default function TermsConditionsScreen() {
  const sections = [
    {
      title: '1. Introduction',
      content: 'Welcome to Bhel Puri, a short-auction local marketplace. By accessing or using our platform, you agree to comply with and be bound by these Terms and Conditions. Please review them carefully.'
    },
    {
      title: '2. Auction Rules & Listing Policies',
      content: 'Sellers are solely responsible for the accuracy of their listings, including titles, descriptions, and condition images. Listings cannot be updated, duration-altered, or cancelled once they have received a valid active bid.'
    },
    {
      title: '3. Binding Bidding Commitment',
      content: 'Every bid placed is a binding contract. Bidders must not bid unless they have genuine intent and immediate financial capacity to complete the purchase at the specified bid amount. Bid manipulation, duplicate/fake bidding, or shill bidding is strictly prohibited.'
    },
    {
      title: '4. Local Handover & Delivery Coordination',
      content: 'Once an auction ends, the winning bidder and the seller are matched in a secure direct chat conversation. Users must coordinate handover location, timings, and payment terms directly. Bhel Puri does not handle payments, escrow, shipping, or physical verify.'
    },
    {
      title: '5. Prohibited Items',
      content: 'Users are prohibited from listing illegal goods, weapons, illegal drugs, stolen property, counterfeit items, hazardous chemicals, or legally restricted services. Any violating listings will be deleted immediately.'
    },
    {
      title: '6. User Conduct & Abuse Prevention',
      content: 'We maintain zero tolerance for spamming, duplicate identical listing alerts, offensive messaging, harassment, or malicious reports. Bhel Puri reserves the right to suspend accounts or delete profiles violating platform guidelines.'
    },
    {
      title: '7. Limitation of Liability',
      content: 'Bhel Puri is provided "as is" without warranties of any kind. We do not guarantee listing accuracy, seller legitimacy, or product condition. Handover coordination is done at the users\' own risk.'
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
          <Scale size={18} color="#FF6B35" />
          <View>
            <Text className="text-lg font-display font-extrabold text-brand-text">
              Terms & Conditions
            </Text>
            <Text className="text-[10px] font-display text-brand-muted mt-0.5">
              Legal rules for bidding and listings
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-white">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12 gap-5">
          
          <View className="bg-stone-50 border border-stone-200 rounded-3xl p-5 mb-2">
            <Text className="text-xs font-display font-bold text-brand-text mb-1">
              General Disclaimer
            </Text>
            <Text className="text-[11px] font-display text-brand-muted leading-relaxed">
              {"This document outlines the standard legal structure of the Bhel Puri marketplace. It does not constitute formal legal advice. These terms are subject to update as local regulatory frameworks adapt."}
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
