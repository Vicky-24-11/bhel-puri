import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldAlert, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';

import { getReportHistory, UserReport } from '@/services/moderationService';
import { Badge } from '@/components/ui/Badge';

// Map database reason identifiers to user-friendly display labels
const REASON_LABELS: Record<string, string> = {
  fake_item: 'Fake or Scam Listing',
  scam: 'Scam Activity',
  prohibited_item: 'Prohibited Item',
  misleading_information: 'Misleading Information',
  offensive_content: 'Offensive Content',
  duplicate_listing: 'Duplicate Listing',
  harassment: 'Harassment',
  spam: 'Spam Activity',
  other: 'Other'
};

const STATUS_CONFIGS: Record<string, { label: string; badgeType: 'neutral' | 'primary' | 'success' | 'warning' | 'error' }> = {
  pending: { label: 'Pending Review', badgeType: 'neutral' },
  reviewing: { label: 'Under Review', badgeType: 'warning' },
  resolved: { label: 'Resolved', badgeType: 'success' },
  dismissed: { label: 'Dismissed', badgeType: 'neutral' },
  action_taken: { label: 'Action Taken', badgeType: 'primary' }
};

export default function ReportHistoryScreen() {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchReports = useCallback(async (isInitial = true) => {
    if (!isInitial && (!hasMore || loadingOlder)) return;

    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingOlder(true);
    }

    try {
      const beforeTimestamp = isInitial || reports.length === 0 ? undefined : reports[reports.length - 1].created_at;
      const data = await getReportHistory(20, beforeTimestamp);
      
      if (isInitial) {
        setReports(data);
        if (data.length < 20) setHasMore(false);
      } else {
        setReports(prev => {
          const combined = [...prev, ...data];
          // Deduplicate
          const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          return unique;
        });
        if (data.length < 20) setHasMore(false);
      }
    } catch (err: any) {
      Alert.alert('Load Failure', err.message || 'Unable to retrieve report history.');
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  }, [reports, hasMore, loadingOlder]);

  useEffect(() => {
    fetchReports(true);
  }, [fetchReports]);

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header Panel */}
      <View className="px-5 py-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View>
          <Text className="text-lg font-display font-extrabold text-brand-text">
            Report History
          </Text>
          <Text className="text-[10px] font-display text-brand-muted mt-0.5">
            Track safety and moderation reports submitted by you
          </Text>
        </View>
      </View>

      {loading && reports.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          onEndReached={() => fetchReports(false)}
          onEndReachedThreshold={0.25}
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
          ListFooterComponent={
            loadingOlder ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#FF6B35" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-16 px-6">
              <View className="w-14 h-14 rounded-full bg-stone-100 items-center justify-center mb-4">
                <ShieldAlert size={24} color="#7F8C8D" />
              </View>
              <Text className="text-sm font-display font-bold text-brand-text mb-1 text-center">
                No Reports Submitted
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center max-w-xs leading-relaxed">
                You have not submitted any trust, safety or content reports on Bhel Puri.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const dateStr = new Date(item.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            // Determine target description
            let targetDesc = 'Platform Report';
            if (item.auction) {
              targetDesc = `Listing: "${item.auction.title}"`;
            } else if (item.reported_user) {
              targetDesc = `User: @${item.reported_user.username}`;
            } else if (item.message_id) {
              targetDesc = 'Chat Message';
            }

            const statusObj = STATUS_CONFIGS[item.status] || { label: 'Pending', badgeType: 'neutral' };

            return (
              <View className="p-5 bg-white border border-stone-200 rounded-3xl mb-4 shadow-sm gap-3">
                <View className="flex-row justify-between items-start gap-2">
                  <View className="flex-1 gap-1">
                    <Text className="font-display font-extrabold text-brand-text text-sm">
                      {REASON_LABELS[item.reason] || 'Safety Report'}
                    </Text>
                    <Text className="text-[10px] font-display text-brand-muted">
                      {targetDesc}
                    </Text>
                  </View>
                  <Badge label={statusObj.label} type={statusObj.badgeType} size="sm" />
                </View>

                {item.description ? (
                  <View className="bg-stone-50 border border-stone-100 p-3 rounded-2xl">
                    <Text className="text-[11px] font-display text-brand-text leading-relaxed">
                      {item.description}
                    </Text>
                  </View>
                ) : null}

                <View className="h-[1px] bg-stone-100 my-0.5" />

                <View className="flex-row items-center gap-1">
                  <Calendar size={11} color="#7F8C8D" />
                  <Text className="text-[9px] font-display text-brand-muted">
                    Submitted on {dateStr}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
