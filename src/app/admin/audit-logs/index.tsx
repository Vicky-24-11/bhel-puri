import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react-native';
import { getAdminAuditLogsList, AuditLog } from '@/services/adminService';

export default function AdminAuditLogsScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 25;

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: total } = await getAdminAuditLogsList(pageSize, page * pageSize);
      setLogs(data);
      setCount(total);
    } catch (err) {
      console.error('Error loading admin audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(count / pageSize) || 1;

  const getActionColor = (action: string) => {
    if (action.includes('SUSPENDED') || action.includes('REMOVED') || action.includes('DEACTIVATED')) {
      return 'text-red-600 bg-red-50 border border-red-150';
    }
    if (action.includes('RESTORED') || action.includes('RESOLVED') || action.includes('CREATED')) {
      return 'text-green-600 bg-green-50 border border-green-150';
    }
    return 'text-blue-600 bg-blue-50 border border-blue-150';
  };

  return (
    <View className="flex-1 bg-stone-50 p-6">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            Admin Audit Trail
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Immutable log of all administrative and moderation actions
          </Text>
        </View>

        <Pressable
          onPress={loadLogs}
          className="flex-row items-center gap-1.5 px-4.5 py-2.5 bg-white border border-stone-200 rounded-xl active:bg-stone-50 shadow-sm"
        >
          <RefreshCw size={14} color="#FF6B35" />
          <Text className="text-brand-primary font-display font-bold text-xs">Refresh</Text>
        </Pressable>
      </View>

      {/* Table view */}
      <View className="flex-1 bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden mb-4">
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : logs.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <ClipboardList size={48} color="#BDC3C7" className="mb-3" />
            <Text className="text-base font-display font-bold text-brand-text">No Activity Logged</Text>
            <Text className="text-xs font-display text-brand-muted text-center mt-1 leading-relaxed">
              No actions have been executed by moderators in this environment yet.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full">
              {/* Header */}
              <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                <Text className="w-40 font-display font-bold text-[10px] text-brand-muted uppercase">Admin</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Action</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Target Entity</Text>
                <Text className="w-64 font-display font-bold text-[10px] text-brand-muted uppercase">Reason Description</Text>
                <Text className="w-44 font-display font-bold text-[10px] text-brand-muted uppercase">Timestamp</Text>
              </View>

              {/* Rows */}
              <ScrollView className="flex-1">
                {logs.map((item) => (
                  <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5">
                    {/* Admin */}
                    <Text className="w-40 font-display font-bold text-brand-text text-xs">
                      @{item.admin_profile?.username || 'admin'}
                    </Text>

                    {/* Action */}
                    <View className="w-48">
                      <View className={`self-start px-2 py-0.5 rounded-full ${getActionColor(item.action)}`}>
                        <Text className="text-[8px] font-display font-bold uppercase text-inherit">
                          {item.action.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    {/* Target */}
                    <Text className="w-48 font-display text-brand-text text-xs capitalize" numberOfLines={1}>
                      {item.target_type} ID: {item.target_id.slice(0, 12)}...
                    </Text>

                    {/* Reason */}
                    <Text className="w-64 font-display text-brand-muted text-xs" numberOfLines={1}>
                      {item.reason}
                    </Text>

                    {/* Timestamp */}
                    <Text className="w-44 font-display text-brand-muted text-xs">
                      {new Date(item.created_at).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Pagination */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-between px-2 py-3 bg-white border border-stone-200 rounded-3xl shadow-sm">
          <Pressable
            onPress={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className={`w-10 h-10 items-center justify-center rounded-full border border-stone-200 bg-white ${page === 0 ? 'opacity-40' : 'active:bg-stone-50'}`}
          >
            <ChevronLeft size={16} color="#1A1A1A" />
          </Pressable>

          <Text className="font-display font-semibold text-brand-muted text-xs">
            Page {page + 1} of {totalPages}
          </Text>

          <Pressable
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1 || loading}
            className={`w-10 h-10 items-center justify-center rounded-full border border-stone-200 bg-white ${page === totalPages - 1 ? 'opacity-40' : 'active:bg-stone-50'}`}
          >
            <ChevronRight size={16} color="#1A1A1A" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
