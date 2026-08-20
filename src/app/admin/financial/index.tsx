import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput, Switch, Alert } from 'react-native';
import { RefreshCw, Percent, ShieldCheck, DollarSign, ListFilter, Calendar, Shield } from 'lucide-react-native';
import {
  getPlatformFeeConfig,
  getPlatformFeeConfigHistory,
  createPlatformFeeConfig,
  getPlatformProtectionConfig,
  updatePlatformProtectionConfig,
  getFinancialAuditLogs,
  getFinancialStats,
  getAdminPayments,
  adminRefundPayment,
  adminReleaseSettlement,
  getPaymentSystemConfig,
  updatePaymentSystemConfig,
  getSellerOnboardingProfiles,
  updateSellerOnboardingStatus,
  getFinancialReconciliationIssues,
  updateReconciliationIssueStatus,
  getProductionReadinessCheck,
} from '@/services/adminService';

export default function FinancialDashboardScreen() {
  const [stats, setStats] = useState<any>(null);
  const [activeFeeConfig, setActiveFeeConfig] = useState<any>(null);
  const [feeHistory, setFeeHistory] = useState<any[]>([]);
  const [activeProtectConfig, setActiveProtectConfig] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [sellerOnboardingList, setSellerOnboardingList] = useState<any[]>([]);
  const [productionPaymentsEnabled, setProductionPaymentsEnabled] = useState(false);
  const [paymentEnvironment, setPaymentEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [reconciliationIssues, setReconciliationIssues] = useState<any[]>([]);
  const [selectedResolutionFilter, setSelectedResolutionFilter] = useState<'open' | 'under_review' | 'resolved' | 'ignored'>('open');
  const [paymentsBlocked, setPaymentsBlocked] = useState(false);
  const [payoutsBlocked, setPayoutsBlocked] = useState(false);
  const [refundsBlocked, setRefundsBlocked] = useState(false);
  const [readinessCheck, setReadinessCheck] = useState<any>(null);
  const [providerActivationStatus, setProviderActivationStatus] = useState<'pending' | 'active' | 'blocked'>('pending');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  


  const handleReleasePayout = async (paymentId: string) => {
    try {
      Alert.alert(
        'Release Settlement',
        'Are you sure you want to release the held funds to the seller?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Release Payout',
            onPress: async () => {
              setLoading(true);
              await adminReleaseSettlement(paymentId);
              await loadData();
            }
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to release payout.');
    }
  };

  const handleRefund = async (paymentId: string, maxAmount: number) => {
    try {
      Alert.alert(
        'Refund Payment',
        `Initiate sandbox refund of ₹${maxAmount.toLocaleString('en-IN')}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Full Refund',
            onPress: async () => {
              setLoading(true);
              await adminRefundPayment(paymentId, maxAmount, 'Admin Full Refund');
              await loadData();
            }
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Refund failed.');
    }
  };

  const handleUpdateSystemConfig = async (
    newEnv: 'sandbox' | 'production',
    newProdEnabled: boolean,
    blockPayments?: boolean,
    blockPayouts?: boolean,
    blockRefunds?: boolean,
    newActivationStatus?: 'pending' | 'active' | 'blocked'
  ) => {
    try {
      const targetPaymentsBlocked = blockPayments !== undefined ? blockPayments : paymentsBlocked;
      const targetPayoutsBlocked = blockPayouts !== undefined ? blockPayouts : payoutsBlocked;
      const targetRefundsBlocked = blockRefunds !== undefined ? blockRefunds : refundsBlocked;
      const targetActivationStatus = newActivationStatus !== undefined ? newActivationStatus : providerActivationStatus;

      const triggerAction = async () => {
        setLoading(true);
        await updatePaymentSystemConfig(
          newProdEnabled,
          newEnv,
          targetPaymentsBlocked,
          targetPayoutsBlocked,
          targetRefundsBlocked,
          targetActivationStatus
        );
        await loadData();
      };

      if (newEnv === 'production' && newProdEnabled) {
        Alert.alert(
          'Enable Production Payments?',
          'WARNING: Real customer payments and payouts will be enabled. Are you sure you want to enable production payments?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Proceed',
              onPress: () => {
                Alert.alert(
                  'Final Production Gate Warning',
                  'I understand that enabling production payments will allow real-money transactions. Do you wish to proceed?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Enable Production', onPress: triggerAction }
                  ]
                );
              }
            }
          ]
        );
      } else {
        triggerAction();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update system config.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSellerStatus = async (accountId: string, status: 'approved' | 'rejected') => {
    try {
      setLoading(true);
      await updateSellerOnboardingStatus(
        accountId,
        status === 'approved' ? 'verified' : 'rejected',
        status === 'approved',
        status
      );
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update seller.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIssueStatus = async (issueId: string, status: 'open' | 'under_review' | 'resolved' | 'ignored') => {
    try {
      Alert.alert(
        'Update Resolution Status',
        `Are you sure you want to change issue status to ${status}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              setLoading(true);
              await updateReconciliationIssueStatus(issueId, status, 'Super Admin Manual Override');
              await loadData();
            }
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  // Form states
  const [newCommissionRate, setNewCommissionRate] = useState('');
  const [newProtectionDays, setNewProtectionDays] = useState('');
  const [payoutRequiresConfirm, setPayoutRequiresConfirm] = useState(true);
  const [payoutAutoExpiry, setPayoutAutoExpiry] = useState(true);
  const [submittingFee, setSubmittingFee] = useState(false);
  const [submittingProtect, setSubmittingProtect] = useState(false);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [
        statsData,
        feeConfig,
        feeHist,
        protectConfig,
        logs,
        pmts,
        sysConf,
        sellers,
        issues,
        readiness,
      ] = await Promise.all([
        getFinancialStats(),
        getPlatformFeeConfig(),
        getPlatformFeeConfigHistory(),
        getPlatformProtectionConfig(),
        getFinancialAuditLogs(),
        getAdminPayments(),
        getPaymentSystemConfig(),
        getSellerOnboardingProfiles(),
        getFinancialReconciliationIssues(),
        getProductionReadinessCheck(),
      ]);

      setStats(statsData);
      setActiveFeeConfig(feeConfig);
      setFeeHistory(feeHist);
      setActiveProtectConfig(protectConfig);
      setAuditLogs(logs);
      setPayments(pmts);
      setSystemConfig(sysConf);
      setSellerOnboardingList(sellers);
      setReconciliationIssues(issues);
      setReadinessCheck(readiness);

      if (feeConfig) setNewCommissionRate(feeConfig.commission_rate.toString());
      if (protectConfig) {
        setNewProtectionDays(protectConfig.buyer_protection_period_days.toString());
        setPayoutRequiresConfirm(protectConfig.payout_requires_buyer_confirmation);
        setPayoutAutoExpiry(protectConfig.payout_auto_after_protection_expiry);
      }
      if (sysConf) {
        setProductionPaymentsEnabled(sysConf.production_payments_enabled);
        setPaymentEnvironment(sysConf.payment_environment);
        setPaymentsBlocked(sysConf.payments_blocked_globally || false);
        setPayoutsBlocked(sysConf.payouts_blocked_globally || false);
        setRefundsBlocked(sysConf.refunds_blocked_globally || false);
        setProviderActivationStatus(sysConf.provider_activation_status || 'pending');
      }
    } catch (err) {
      console.error('Error loading financial admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateCommission = async () => {
    const rate = parseFloat(newCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    try {
      setSubmittingFee(true);
      await createPlatformFeeConfig(rate);
      await loadData();
    } catch (err) {
      console.error('Failed to create new commission rate:', err);
    } finally {
      setSubmittingFee(false);
    }
  };

  const handleUpdateProtection = async () => {
    const days = parseInt(newProtectionDays);
    if (isNaN(days) || days < 0) return;
    try {
      setSubmittingProtect(true);
      await updatePlatformProtectionConfig(days, payoutRequiresConfirm, payoutAutoExpiry);
      await loadData();
    } catch (err) {
      console.error('Failed to update protection config:', err);
    } finally {
      setSubmittingProtect(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-50">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-stone-50 p-6">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            Financial & Payments Control
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Platform commissions, protected holds, and audit logging parameters
          </Text>
        </View>

        <Pressable
          onPress={loadData}
          disabled={refreshing}
          className="flex-row items-center gap-1.5 px-4 py-2.5 bg-white border border-stone-200 rounded-xl active:bg-stone-50 shadow-sm"
        >
          <RefreshCw size={14} color="#FF6B35" className={refreshing ? 'animate-spin' : ''} />
          <Text className="text-brand-primary font-display font-bold text-xs">Refresh</Text>
        </Pressable>
      </View>

      {/* Production Readiness Control Center */}
      <View className="bg-white border border-stone-200 p-6 rounded-3xl shadow-sm gap-4 mb-8">
        <View className="flex-row items-center gap-2">
          <Shield size={20} color="#FF6B35" />
          <Text className="text-base font-display font-bold text-brand-text">Production Readiness Gate</Text>
        </View>

        <View className="flex-row flex-wrap gap-4 mt-2">
          <View className={`flex-1 min-w-[200px] p-4 rounded-2xl border ${readinessCheck?.status === 'READY' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <Text className="text-[10px] font-display font-bold text-stone-500 uppercase tracking-wide">Technical Readiness</Text>
            <Text className={`text-lg font-display font-extrabold mt-1 ${readinessCheck?.status === 'READY' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {readinessCheck?.status || 'UNKNOWN'}
            </Text>
          </View>

          <View className="flex-1 min-w-[200px] bg-stone-50 border border-stone-100 p-4 rounded-2xl">
            <Text className="text-[10px] font-display font-bold text-stone-500 uppercase tracking-wide">Cashfree Activation Status</Text>
            <View className="flex-row gap-1.5 mt-2">
              {(['pending', 'active', 'blocked'] as const).map((status) => (
                <Pressable
                  key={status}
                  onPress={() => handleUpdateSystemConfig(paymentEnvironment, productionPaymentsEnabled, paymentsBlocked, payoutsBlocked, refundsBlocked, status)}
                  className={`px-2.5 py-1 rounded-lg border ${providerActivationStatus === status ? 'bg-brand-primary border-brand-primary' : 'bg-white border-stone-200'}`}
                >
                  <Text className={`text-[10px] font-display font-bold uppercase ${providerActivationStatus === status ? 'text-white' : 'text-stone-600'}`}>
                    {status}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {readinessCheck?.reasons && readinessCheck.reasons.length > 0 && (
          <View className="bg-stone-50 p-4 rounded-2xl mt-2">
            <Text className="text-xs font-display font-bold text-brand-text mb-2">Unresolved Launch Prerequisites:</Text>
            {readinessCheck.reasons.map((reason: string, idx: number) => (
              <Text key={idx} className="text-[11px] font-display text-rose-600 mt-1">
                • {reason}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* System Environment Safety Config */}
      <View className="bg-white border border-stone-200 p-6 rounded-3xl shadow-sm gap-4 mb-8">
        <View className="flex-row items-center gap-2">
          <Shield size={20} color="#FF6B35" />
          <Text className="text-base font-display font-bold text-brand-text">System Environment Safety Switches</Text>
        </View>

        <View className="flex-row flex-wrap gap-6 mt-2">
          <View className="flex-1 min-w-[240px] bg-stone-50 border border-stone-100 p-4 rounded-2xl flex-row items-center justify-between">
            <View className="gap-0.5">
              <Text className="text-xs font-display font-bold text-brand-text">Payment Environment</Text>
              <Text className="text-[10px] font-display text-brand-muted uppercase font-bold">
                {paymentEnvironment} {systemConfig ? `(ID: ${systemConfig.id.slice(0, 8)})` : ''}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => handleUpdateSystemConfig('sandbox', productionPaymentsEnabled)}
                className={`px-3 py-1.5 rounded-lg border ${paymentEnvironment === 'sandbox' ? 'bg-brand-primary border-brand-primary' : 'bg-white border-stone-200'}`}
              >
                <Text className={`font-display font-bold text-xs ${paymentEnvironment === 'sandbox' ? 'text-white' : 'text-brand-text'}`}>Sandbox</Text>
              </Pressable>
              <Pressable
                onPress={() => handleUpdateSystemConfig('production', productionPaymentsEnabled)}
                className={`px-3 py-1.5 rounded-lg border ${paymentEnvironment === 'production' ? 'bg-brand-primary border-brand-primary' : 'bg-white border-stone-200'}`}
              >
                <Text className={`font-display font-bold text-xs ${paymentEnvironment === 'production' ? 'text-white' : 'text-brand-text'}`}>Production</Text>
              </Pressable>
            </View>
          </View>

          <View className="flex-1 min-w-[240px] bg-stone-50 border border-stone-100 p-4 rounded-2xl flex-row items-center justify-between">
            <View className="gap-0.5">
              <Text className="text-xs font-display font-bold text-brand-text">Production Payments State</Text>
              <Text className="text-[10px] font-display text-brand-muted uppercase font-bold">{productionPaymentsEnabled ? 'Enabled' : 'Disabled'}</Text>
            </View>
            <Switch
              value={productionPaymentsEnabled}
              onValueChange={(val) => handleUpdateSystemConfig(paymentEnvironment, val)}
            />
          </View>
        </View>

        {/* Emergency Financial Halts Switches */}
        <View className="border-t border-stone-100 pt-4 mt-2">
          <Text className="text-xs font-display font-bold text-brand-text uppercase mb-3">Emergency Financial Controls</Text>
          <View className="flex-row flex-wrap gap-4">
            <View className="flex-1 min-w-[180px] bg-stone-50 p-3.5 rounded-2xl flex-row items-center justify-between border border-stone-100">
              <View className="gap-0.5">
                <Text className="text-xs font-display font-bold text-brand-text">Payment Creation</Text>
                <Text className="text-[9px] font-display text-brand-muted uppercase font-bold">{paymentsBlocked ? 'BLOCKED' : 'ENABLED'}</Text>
              </View>
              <Switch
                value={paymentsBlocked}
                onValueChange={(val) => handleUpdateSystemConfig(paymentEnvironment, productionPaymentsEnabled, val, payoutsBlocked, refundsBlocked)}
              />
            </View>

            <View className="flex-1 min-w-[180px] bg-stone-50 p-3.5 rounded-2xl flex-row items-center justify-between border border-stone-100">
              <View className="gap-0.5">
                <Text className="text-xs font-display font-bold text-brand-text">Seller Payouts</Text>
                <Text className="text-[9px] font-display text-brand-muted uppercase font-bold">{payoutsBlocked ? 'BLOCKED' : 'ENABLED'}</Text>
              </View>
              <Switch
                value={payoutsBlocked}
                onValueChange={(val) => handleUpdateSystemConfig(paymentEnvironment, productionPaymentsEnabled, paymentsBlocked, val, refundsBlocked)}
              />
            </View>

            <View className="flex-1 min-w-[180px] bg-stone-50 p-3.5 rounded-2xl flex-row items-center justify-between border border-stone-100">
              <View className="gap-0.5">
                <Text className="text-xs font-display font-bold text-brand-text">Refund Execution</Text>
                <Text className="text-[9px] font-display text-brand-muted uppercase font-bold">{refundsBlocked ? 'BLOCKED' : 'ENABLED'}</Text>
              </View>
              <Switch
                value={refundsBlocked}
                onValueChange={(val) => handleUpdateSystemConfig(paymentEnvironment, productionPaymentsEnabled, paymentsBlocked, payoutsBlocked, val)}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Stats Cards Section */}
      <View className="flex-row flex-wrap gap-4 mb-8">
        <View className="flex-1 min-w-[200px] bg-white border border-stone-200 p-5 rounded-3xl shadow-sm flex-row items-center justify-between">
          <View className="gap-1 flex-1">
            <Text className="text-stone-400 font-display font-bold text-xs uppercase tracking-wide">Gross Volume</Text>
            <Text className="text-xl font-display font-extrabold text-brand-text">₹{stats?.grossVolume.toLocaleString('en-IN')}</Text>
          </View>
          <View className="w-10 h-10 rounded-2xl bg-amber-50 items-center justify-center">
            <DollarSign size={18} color="#D97706" />
          </View>
        </View>

        <View className="flex-1 min-w-[200px] bg-white border border-stone-200 p-5 rounded-3xl shadow-sm flex-row items-center justify-between">
          <View className="gap-1 flex-1">
            <Text className="text-stone-400 font-display font-bold text-xs uppercase tracking-wide">Commission Revenue</Text>
            <Text className="text-xl font-display font-extrabold text-brand-text">₹{stats?.commissionRevenue.toLocaleString('en-IN')}</Text>
          </View>
          <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center">
            <Percent size={18} color="#059669" />
          </View>
        </View>

        <View className="flex-1 min-w-[200px] bg-white border border-stone-200 p-5 rounded-3xl shadow-sm flex-row items-center justify-between">
          <View className="gap-1 flex-1">
            <Text className="text-stone-400 font-display font-bold text-xs uppercase tracking-wide">Provider Costs</Text>
            <Text className="text-xl font-display font-extrabold text-brand-text">₹{stats?.providerCosts.toLocaleString('en-IN')}</Text>
          </View>
          <View className="w-10 h-10 rounded-2xl bg-rose-50 items-center justify-center">
            <DollarSign size={18} color="#DC2626" />
          </View>
        </View>

        <View className="flex-1 min-w-[200px] bg-white border border-stone-200 p-5 rounded-3xl shadow-sm flex-row items-center justify-between">
          <View className="gap-1 flex-1">
            <Text className="text-stone-400 font-display font-bold text-xs uppercase tracking-wide">Refunded</Text>
            <Text className="text-xl font-display font-extrabold text-brand-text">₹{stats?.refundedAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View className="w-10 h-10 rounded-2xl bg-stone-100 items-center justify-center">
            <RefreshCw size={18} color="#6B7280" />
          </View>
        </View>
      </View>

      {/* Row of Controls: Commission & Protection */}
      <View className="flex-row flex-wrap gap-6 mb-8">
        {/* Commission Settings Box */}
        <View className="flex-1 min-w-[340px] bg-white border border-stone-200 p-6 rounded-3xl shadow-sm gap-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Percent size={20} color="#FF6B35" />
            <Text className="text-base font-display font-bold text-brand-text">Commission Settings</Text>
          </View>

          <View className="gap-1">
            <Text className="text-xs font-display text-brand-muted">
              Active Commission Rate (%) {activeFeeConfig ? `(Current: ${activeFeeConfig.commission_rate}%)` : ''}
            </Text>
            <View className="flex-row gap-3 mt-1.5">
              <TextInput
                value={newCommissionRate}
                onChangeText={setNewCommissionRate}
                placeholder="5.0"
                keyboardType="numeric"
                className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 font-display text-xs text-brand-text bg-stone-50"
              />
              <Pressable
                onPress={handleUpdateCommission}
                disabled={submittingFee}
                className="bg-brand-primary px-6 rounded-xl justify-center active:opacity-90 disabled:opacity-50"
              >
                <Text className="text-white font-display font-bold text-xs">Save</Text>
              </Pressable>
            </View>
          </View>

          {/* Fee History Log */}
          <Text className="text-[10px] uppercase font-display font-bold text-stone-400 tracking-wider mt-2 mb-1">Configuration History</Text>
          <ScrollView className="max-h-[140px] border border-stone-100 rounded-2xl bg-stone-50 p-3">
            {feeHistory.map((hist: any, idx: number) => (
              <View key={idx} className="flex-row justify-between items-center py-1.5 border-b border-stone-100">
                <Text className="text-[11px] font-display text-brand-text font-bold">
                  {hist.commission_rate}% {hist.is_active ? '(Active)' : ''}
                </Text>
                <Text className="text-[9px] font-display text-brand-muted">
                  {new Date(hist.created_at).toLocaleDateString()} by {hist.creator?.username || 'System'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Protection Settings Box */}
        <View className="flex-1 min-w-[340px] bg-white border border-stone-200 p-6 rounded-3xl shadow-sm gap-4">
          <View className="flex-row items-center gap-2 mb-2">
            <ShieldCheck size={20} color="#FF6B35" />
            <Text className="text-base font-display font-bold text-brand-text">
              Protection Settings {activeProtectConfig ? `(${activeProtectConfig.buyer_protection_period_days} Days)` : ''}
            </Text>
          </View>

          <View className="gap-3">
            <View className="gap-1">
              <Text className="text-xs font-display text-brand-muted">Buyer Protection Period (Days)</Text>
              <TextInput
                value={newProtectionDays}
                onChangeText={setNewProtectionDays}
                placeholder="7"
                keyboardType="numeric"
                className="border border-stone-200 rounded-xl px-4 py-2.5 mt-1.5 font-display text-xs text-brand-text bg-stone-50"
              />
            </View>

            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-xs font-display text-brand-muted">Payout Requires Buyer Confirmation</Text>
              <Switch value={payoutRequiresConfirm} onValueChange={setPayoutRequiresConfirm} />
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-display text-brand-muted">Auto-Release Payout After Expiry</Text>
              <Switch value={payoutAutoExpiry} onValueChange={setPayoutAutoExpiry} />
            </View>

            <Pressable
              onPress={handleUpdateProtection}
              disabled={submittingProtect}
              className="bg-brand-primary py-2.5 rounded-xl items-center active:opacity-90 disabled:opacity-50 mt-1"
            >
              <Text className="text-white font-display font-bold text-xs">Save Protection settings</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Payments Table list */}
      <View className="bg-white border border-stone-200 rounded-3xl shadow-sm p-6 mb-8 gap-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <ListFilter size={18} color="#FF6B35" />
            <Text className="text-base font-display font-bold text-brand-text">Payments Log</Text>
          </View>
        </View>

        <ScrollView horizontal className="border border-stone-100 rounded-2xl bg-stone-50">
          <View className="min-w-[800px] p-4 gap-2">
            <View className="flex-row border-b border-stone-200 pb-2">
              <Text className="flex-1 text-[10px] font-display font-bold text-stone-400 uppercase">Payment ID</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 uppercase">Buyer</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 uppercase">Seller</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-right uppercase">Amount</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-right uppercase">Commission</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-right uppercase">Seller Net</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Status</Text>
              <Text className="w-36 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Actions</Text>
            </View>

            {payments.map((p: any, idx: number) => (
              <View key={idx} className="flex-row py-2.5 border-b border-stone-100 items-center">
                <Text className="flex-1 text-[11px] font-display text-brand-text font-bold" numberOfLines={1}>
                  {p.id}
                </Text>
                <Text className="w-24 text-[11px] font-display text-stone-600">
                  {p.transaction?.buyer?.username || 'Unknown'}
                </Text>
                <Text className="w-24 text-[11px] font-display text-stone-600">
                  {p.transaction?.seller?.username || 'Unknown'}
                </Text>
                <Text className="w-24 text-[11px] font-display text-brand-text font-extrabold text-right">
                  ₹{p.amount.toLocaleString('en-IN')}
                </Text>
                <Text className="w-24 text-[11px] font-display text-emerald-600 font-bold text-right">
                  ₹{p.commission_amount ? p.commission_amount.toLocaleString('en-IN') : '0.00'}
                </Text>
                <Text className="w-24 text-[11px] font-display text-brand-text font-bold text-right">
                  ₹{p.seller_net_payout ? p.seller_net_payout.toLocaleString('en-IN') : '0.00'}
                </Text>
                <View className="w-24 items-center">
                  <View className="px-2 py-0.5 rounded-full bg-stone-100">
                    <Text className="text-[9px] font-display font-bold text-stone-600 uppercase">
                      {p.status}
                    </Text>
                  </View>
                </View>
                <View className="w-36 flex-row gap-1.5 justify-center">
                  {(p.status === 'held' || p.status === 'captured') && (
                    <>
                      <Pressable
                        onPress={() => handleReleasePayout(p.id)}
                        className="px-2 py-1 bg-emerald-600 rounded-lg active:opacity-90"
                      >
                        <Text className="text-white text-[9px] font-display font-bold">Release</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRefund(p.id, p.amount)}
                        className="px-2 py-1 bg-rose-600 rounded-lg active:opacity-90"
                      >
                        <Text className="text-white text-[9px] font-display font-bold">Refund</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>


      {/* Seller Onboarding Registry */}
      <View className="bg-white border border-stone-200 rounded-3xl shadow-sm p-6 mb-8 gap-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Shield size={18} color="#FF6B35" />
          <Text className="text-base font-display font-bold text-brand-text">Seller Onboarding Registry</Text>
        </View>

        <ScrollView horizontal className="border border-stone-100 rounded-2xl bg-stone-50">
          <View className="min-w-[800px] p-4 gap-2">
            <View className="flex-row border-b border-stone-200 pb-2">
              <Text className="flex-1 text-[10px] font-display font-bold text-stone-400 uppercase">Seller Username</Text>
              <Text className="w-40 text-[10px] font-display font-bold text-stone-400 uppercase">Provider Account ID</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-center uppercase">KYC Status</Text>
              <Text className="w-32 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Onboarding Status</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Payouts</Text>
              <Text className="w-36 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Actions</Text>
            </View>

            {sellerOnboardingList.map((s: any, idx: number) => (
              <View key={idx} className="flex-row py-2.5 border-b border-stone-100 items-center">
                <Text className="flex-1 text-[11px] font-display text-brand-text font-bold">
                  @{s.profile?.username || 'user'}
                </Text>
                <Text className="w-40 text-[11px] font-display text-stone-600">
                  {s.provider_account_id || 'Not onboarded'}
                </Text>
                <View className="w-24 items-center">
                  <View className={`px-2 py-0.5 rounded-full ${s.kyc_status === 'verified' ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                    <Text className={`text-[9px] font-display font-bold ${s.kyc_status === 'verified' ? 'text-emerald-700' : 'text-amber-700'} uppercase`}>
                      {s.kyc_status}
                    </Text>
                  </View>
                </View>
                <View className="w-32 items-center">
                  <Text className="text-[11px] font-display text-stone-600 uppercase font-bold">{s.onboarding_status}</Text>
                </View>
                <View className="w-24 items-center">
                  <Text className={`text-[11px] font-display ${s.payout_enabled ? 'text-emerald-600 font-bold' : 'text-stone-400'}`}>
                    {s.payout_enabled ? 'ENABLED' : 'BLOCKED'}
                  </Text>
                </View>
                <View className="w-36 flex-row gap-1.5 justify-center">
                  {s.onboarding_status !== 'approved' && (
                    <>
                      <Pressable
                        onPress={() => handleUpdateSellerStatus(s.id, 'approved')}
                        className="px-2 py-1 bg-emerald-600 rounded-lg active:opacity-90"
                      >
                        <Text className="text-white text-[9px] font-display font-bold">Approve</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleUpdateSellerStatus(s.id, 'rejected')}
                        className="px-2 py-1 bg-rose-600 rounded-lg active:opacity-90"
                      >
                        <Text className="text-white text-[9px] font-display font-bold">Reject</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>


      {/* Financial Reconciliation Discrepancies */}
      <View className="bg-white border border-stone-200 rounded-3xl shadow-sm p-6 mb-8 gap-4">
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center gap-2">
            <Shield size={18} color="#FF6B35" />
            <Text className="text-base font-display font-bold text-brand-text">Financial Reconciliation Discrepancies</Text>
          </View>

          {/* Filtering buttons */}
          <View className="flex-row gap-1 bg-stone-100 p-1 rounded-xl">
            {(['open', 'under_review', 'resolved', 'ignored'] as const).map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setSelectedResolutionFilter(filter)}
                className={`px-2.5 py-1 rounded-lg ${selectedResolutionFilter === filter ? 'bg-white shadow-sm' : 'active:opacity-80'}`}
              >
                <Text className={`text-[10px] font-display font-bold uppercase ${selectedResolutionFilter === filter ? 'text-brand-primary' : 'text-stone-500'}`}>
                  {filter.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView horizontal className="border border-stone-100 rounded-2xl bg-stone-50">
          <View className="min-w-[950px] p-4 gap-2">
            <View className="flex-row border-b border-stone-200 pb-2">
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 uppercase">Issue Type</Text>
              <Text className="flex-1 text-[10px] font-display font-bold text-stone-400 uppercase">Payment ID</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-right uppercase">Internal Amount</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-right uppercase">Provider Amount</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Internal Status</Text>
              <Text className="w-24 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Provider Status</Text>
              <Text className="w-48 text-[10px] font-display font-bold text-stone-400 text-center uppercase">Actions</Text>
            </View>

            {reconciliationIssues
              .filter((issue) => issue.resolution_status === selectedResolutionFilter)
              .map((issue: any, idx: number) => (
                <View key={idx} className="flex-row py-2.5 border-b border-stone-100 items-center">
                  <Text className="w-24 text-[11px] font-display text-brand-text font-bold uppercase">
                    {issue.issue_type.replace('_', ' ')}
                  </Text>
                  <Text className="flex-1 text-[11px] font-display text-stone-600">
                    {issue.payment_id || 'N/A'}
                  </Text>
                  <Text className="w-24 text-[11px] font-display text-stone-800 font-extrabold text-right">
                    ₹{issue.internal_amount?.toLocaleString('en-IN') || '0.00'}
                  </Text>
                  <Text className="w-24 text-[11px] font-display text-stone-800 font-extrabold text-right">
                    ₹{issue.provider_amount?.toLocaleString('en-IN') || '0.00'}
                  </Text>
                  <Text className="w-24 text-[11px] font-display text-stone-600 text-center uppercase">
                    {issue.internal_status || 'N/A'}
                  </Text>
                  <Text className="w-24 text-[11px] font-display text-stone-600 text-center uppercase">
                    {issue.provider_status || 'N/A'}
                  </Text>
                  <View className="w-48 flex-row gap-1 justify-center">
                    {issue.resolution_status === 'open' && (
                      <Pressable
                        onPress={() => handleUpdateIssueStatus(issue.id, 'under_review')}
                        className="px-2 py-1 bg-amber-600 rounded-lg active:opacity-90"
                      >
                        <Text className="text-white text-[9px] font-display font-bold">Investigate</Text>
                      </Pressable>
                    )}
                    {(issue.resolution_status === 'open' || issue.resolution_status === 'under_review') && (
                      <>
                        <Pressable
                          onPress={() => handleUpdateIssueStatus(issue.id, 'resolved')}
                          className="px-2 py-1 bg-emerald-600 rounded-lg active:opacity-90"
                        >
                          <Text className="text-white text-[9px] font-display font-bold">Resolve</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleUpdateIssueStatus(issue.id, 'ignored')}
                          className="px-2 py-1 bg-stone-600 rounded-lg active:opacity-90"
                        >
                          <Text className="text-white text-[9px] font-display font-bold">Ignore</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              ))}
          </View>
        </ScrollView>
      </View>

      {/* Financial Audit Logs */}
      <View className="bg-white border border-stone-200 rounded-3xl shadow-sm p-6 mb-8 gap-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Calendar size={18} color="#FF6B35" />
          <Text className="text-base font-display font-bold text-brand-text">Financial Audit Trail</Text>
        </View>

        <ScrollView className="max-h-[220px] border border-stone-100 rounded-2xl bg-stone-50 p-4">
          {auditLogs.map((log: any, idx: number) => (
            <View key={idx} className="py-2.5 border-b border-stone-100">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-[11px] font-display text-brand-text font-bold uppercase">{log.action}</Text>
                <Text className="text-[9px] font-display text-brand-muted">
                  {new Date(log.created_at).toLocaleString()}
                </Text>
              </View>
              <Text className="text-[10px] font-display text-stone-500">
                Performed by: {log.actor?.username || 'System'} | Entity: {log.entity_type} ({log.entity_id || 'N/A'})
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}
