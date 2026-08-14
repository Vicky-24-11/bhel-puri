import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, AlertOctagon, User, ShoppingBag, ShieldAlert, Award } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { updateReportStatus } from '@/services/adminService';
import { Button } from '@/components/ui/Button';

export default function AdminReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modal states
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveType, setResolveType] = useState<'resolved' | 'dismissed'>('resolved');
  const [resolutionNote, setResolutionNote] = useState('');

  const loadReportDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('reports')
        .select('*, reporter:profiles!reports_reporter_id_fkey(*), reported_user:profiles!reports_reported_user_id_fkey(*), auction:auctions(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setReport(data);
    } catch (err: any) {
      console.error('Error fetching report details:', err);
      Alert.alert('Error', 'Failed to retrieve report data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReportDetails();
  }, [loadReportDetails]);

  const handleStartReview = async () => {
    try {
      setUpdating(true);
      await updateReportStatus(id!, 'reviewing', 'Admin started reviewing this report.');
      setReport((prev: any) => prev ? { ...prev, status: 'reviewing' } : null);
      Alert.alert('Success', 'Report marked under review.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update report.');
    } finally {
      setUpdating(false);
    }
  };

  const openResolutionDialog = (type: 'resolved' | 'dismissed') => {
    setResolveType(type);
    setShowResolveModal(true);
  };

  const handleResolveDismiss = async () => {
    if (!resolutionNote.trim()) {
      Alert.alert('Note Required', 'Please enter a resolution justification summary note.');
      return;
    }
    try {
      setUpdating(true);
      await updateReportStatus(id!, resolveType, resolutionNote.trim());
      setReport((prev: any) => prev ? { ...prev, status: resolveType } : null);
      setShowResolveModal(false);
      setResolutionNote('');
      Alert.alert('Success', `Report marked as ${resolveType}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update report.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-50">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!report) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-50 px-6">
        <AlertOctagon size={48} color="#E71D36" className="mb-4" />
        <Text className="text-base font-display font-bold text-brand-text mb-2">Report Not Found</Text>
        <Pressable onPress={() => router.back()} className="px-6 py-3 bg-brand-primary rounded-xl">
          <Text className="text-white font-display font-bold text-xs">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isOpen = report.status === 'pending';
  const isReviewing = report.status === 'reviewing';
  const isResolved = report.status === 'resolved';
  const isDismissed = report.status === 'dismissed';

  return (
    <ScrollView className="flex-1 bg-stone-50 p-6">
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-6">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center bg-white border border-stone-200 rounded-full shadow-sm active:bg-stone-50"
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            Report Details
          </Text>
          <Text className="text-xs font-display text-brand-muted">
            Safety complaint investigation #_{report.id.slice(0, 8)}
          </Text>
        </View>
      </View>

      <View className="flex-col lg:flex-row gap-6 mb-12">
        {/* Left Column: Report Summary Cards */}
        <View className="flex-1 gap-6">
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <View className="flex-row items-center justify-between border-b border-stone-100 pb-3">
              <Text className="text-sm font-display font-extrabold text-brand-text uppercase">
                Safety Incident Summary
              </Text>
              <View className="px-3 py-1 rounded-full bg-stone-50 border border-stone-200">
                <Text className="text-[10px] font-display font-bold text-brand-text uppercase">
                  Status: {report.status === 'pending' ? 'open' : report.status}
                </Text>
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-bold tracking-wider">Reason:</Text>
              <Text className="text-sm font-display font-bold text-brand-text capitalize">
                {report.reason.replace('_', ' ')}
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-bold tracking-wider">Description Details:</Text>
              <Text className="text-xs font-display text-brand-text leading-relaxed bg-stone-50 p-4 border border-stone-200 rounded-2xl">
                {report.description || 'No description provided by the reporter.'}
              </Text>
            </View>

            <View className="gap-1 flex-row items-center justify-between border-t border-stone-100 pt-3">
              <Text className="text-[10px] font-display text-brand-muted">Date Reported:</Text>
              <Text className="text-xs font-display text-brand-text font-bold">
                {new Date(report.created_at).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Action Modals panel */}
          {!isResolved && !isDismissed && (
            <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
              <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                Investigator Action Options
              </Text>

              {isOpen && (
                <Button
                  label="Start Review Process"
                  onPress={handleStartReview}
                  disabled={updating}
                  className="bg-brand-primary active:bg-brand-primary/95 w-full"
                />
              )}

              {isReviewing && (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => openResolutionDialog('resolved')}
                    disabled={updating}
                    className="flex-1 bg-emerald-600 active:bg-emerald-700 h-11 rounded-xl items-center justify-center"
                  >
                    <Text className="text-white font-display font-bold text-xs">Resolve Report</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openResolutionDialog('dismissed')}
                    disabled={updating}
                    className="flex-1 bg-stone-200 active:bg-stone-300 h-11 rounded-xl items-center justify-center border border-stone-300"
                  >
                    <Text className="text-stone-700 font-display font-bold text-xs">Dismiss Report</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Right Column: Involves Parties Cards */}
        <View className="flex-1 lg:max-w-md gap-6">
          {/* Reporter details */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3">
            <View className="flex-row items-center gap-2">
              <User size={16} color="#FF6B35" />
              <Text className="text-xs font-display font-bold text-brand-text uppercase">Reporter Info</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-display text-brand-muted">Username:</Text>
              <Text className="text-xs font-display text-brand-text font-bold">@{report.reporter?.username}</Text>
            </View>
          </View>

          {/* Reported Target Details */}
          {report.reported_user_id && (
            <Pressable
              onPress={() => router.push(`/admin/users/${report.reported_user_id}`)}
              className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3 active:opacity-95"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ShieldAlert size={16} color="#EF4444" />
                  <Text className="text-xs font-display font-bold text-brand-text uppercase">Reported User</Text>
                </View>
                <Text className="text-[10px] font-display text-brand-primary font-bold">View Profile</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-display text-brand-muted">Username:</Text>
                <Text className="text-xs font-display text-brand-text font-bold">@{report.reported_user?.username}</Text>
              </View>
            </Pressable>
          )}

          {/* Reported Product Listing details */}
          {report.auction_id && (
            <Pressable
              onPress={() => router.push(`/admin/listings?search=${report.auction?.title}`)}
              className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3 active:opacity-95"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ShoppingBag size={16} color="#F59E0B" />
                  <Text className="text-xs font-display font-bold text-brand-text uppercase">Reported Listing</Text>
                </View>
                <Text className="text-[10px] font-display text-brand-primary font-bold">View Listing</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-display text-brand-muted">Title:</Text>
                <Text className="text-xs font-display text-brand-text font-bold flex-1 text-right ml-4" numberOfLines={1}>
                  {report.auction?.title}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>

      {/* Resolution note entry Modal */}
      <Modal
        visible={showResolveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResolveModal(false)}
      >
        <Pressable 
          onPress={() => setShowResolveModal(false)} 
          className="flex-1 bg-black/40 justify-center items-center px-6"
        >
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm gap-4">
            <View className="flex-row items-center gap-2">
              <Award size={18} color="#FF6B35" />
              <Text className="font-display font-extrabold text-brand-text text-sm capitalize">
                {resolveType} Report
              </Text>
            </View>

            <Text className="text-xs font-display text-brand-muted leading-relaxed">
              Please enter an explanation note regarding this report resolution decision.
            </Text>

            <TextInput
              placeholder="e.g. Listing removed for compliance, user warned, scam verified..."
              value={resolutionNote}
              onChangeText={setResolutionNote}
              maxLength={200}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 h-12 text-xs font-display text-brand-text"
            />

            <View className="flex-row gap-3 mt-1">
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setShowResolveModal(false)}
                className="flex-1"
              />
              <Button
                label="Confirm"
                onPress={handleResolveDismiss}
                className="flex-1 bg-brand-primary"
                disabled={updating}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
