import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, ShoppingBag, Gavel, AlertOctagon, ShieldAlert, Award, RefreshCw } from 'lucide-react-native';
import { getMarketplaceStats } from '@/services/adminService';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const data = await getMarketplaceStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-50">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#3B82F6', route: '/admin/users' },
    { label: 'Active Listings', value: stats.activeListings, icon: ShoppingBag, color: '#10B981', route: '/admin/listings' },
    { label: 'Live Auctions', value: stats.liveAuctions, icon: Gavel, color: '#F59E0B', route: '/admin/auctions' },
    { label: 'Completed Auctions', value: stats.completedAuctions, icon: Award, color: '#8B5CF6', route: '/admin/auctions' },
    { label: 'Open Reports', value: stats.openReports, icon: AlertOctagon, color: '#EF4444', route: '/admin/reports' },
    { label: 'Suspended Users', value: stats.suspendedUsers, icon: ShieldAlert, color: '#6B7280', route: '/admin/users' },
  ];

  return (
    <ScrollView className="flex-1 bg-stone-50 p-6">
      {/* Header title */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            Marketplace Overview
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Realtime database counters and safety statistics
          </Text>
        </View>
        
        <Pressable
          onPress={fetchStats}
          disabled={refreshing}
          className="flex-row items-center gap-1.5 px-4.5 py-2.5 bg-white border border-stone-200 rounded-xl active:bg-stone-50 shadow-sm"
        >
          <RefreshCw size={14} color="#FF6B35" className={refreshing ? 'animate-spin' : ''} />
          <Text className="text-brand-primary font-display font-bold text-xs">Refresh</Text>
        </Pressable>
      </View>

      {/* Grid of Stats Cards */}
      <View className="flex-row flex-wrap gap-4 mb-8">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Pressable
              key={idx}
              onPress={() => router.push(card.route as any)}
              className="flex-1 min-w-[240px] bg-white border border-stone-200 p-5 rounded-3xl shadow-sm flex-row items-center justify-between active:opacity-95"
            >
              <View className="gap-1 flex-1">
                <Text className="text-stone-400 font-display font-bold text-xs uppercase tracking-wide">
                  {card.label}
                </Text>
                <Text className="text-2xl font-display font-extrabold text-brand-text">
                  {card.value.toLocaleString('en-IN')}
                </Text>
              </View>
              <View
                style={{ backgroundColor: `${card.color}15` }}
                className="w-12 h-12 rounded-2xl items-center justify-center ml-4"
              >
                <Icon size={22} color={card.color} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
