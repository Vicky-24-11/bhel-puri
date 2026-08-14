import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { Slot, useRouter, usePathname, Redirect } from 'expo-router';
import { LayoutDashboard, Users, ShoppingBag, Gavel, AlertOctagon, ShieldAlert, ArrowLeft, ClipboardList } from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import { getAdminRole } from '@/services/adminService';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminLayout() {
  const { user, authState } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<boolean>(true);

  const authLoading = authState === 'INITIALIZING';

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return;
      if (!user) {
        setLoadingRole(false);
        return;
      }
      try {
        const adminRole = await getAdminRole(user.id);
        setRole(adminRole);
      } catch (err) {
        console.error('Admin layout auth gate error:', err);
      } finally {
        setLoadingRole(false);
      }
    }
    checkAccess();
  }, [user, authLoading]);

  if (authLoading || loadingRole) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background justify-center items-center">
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text className="text-xs font-display text-brand-muted mt-3">Verifying Admin Credentials...</Text>
      </SafeAreaView>
    );
  }

  // Redirect to login if unauthenticated
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Show Access Denied if authenticated but not an active admin
  if (!role) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background px-6 justify-center items-center">
        <ShieldAlert size={60} color="#E71D36" className="mb-4" />
        <Text className="text-xl font-display font-extrabold text-brand-text mb-2 text-center">
          Access Denied
        </Text>
        <Text className="text-sm font-display text-brand-muted text-center max-w-sm mb-6 leading-relaxed">
          You do not have the required administrative permissions to access the Bhel Puri admin dashboard.
        </Text>
        <Pressable
          onPress={() => router.replace('/')}
          className="px-6 py-3 bg-brand-primary rounded-2xl active:opacity-90 flex-row items-center gap-2"
        >
          <ArrowLeft size={16} color="#FFFFFF" />
          <Text className="text-white font-display font-bold text-sm">Return to Marketplace</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isSuperAdmin = role === 'super_admin';
  const isModerator = role === 'moderator' || isSuperAdmin;
  const isSupport = role === 'support' || isModerator;

  // Sidebar links based on role authorization
  const sidebarLinks = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, show: true },
    { label: 'Users', path: '/admin/users', icon: Users, show: isSupport },
    { label: 'Listings', path: '/admin/listings', icon: ShoppingBag, show: isModerator },
    { label: 'Auctions', path: '/admin/auctions', icon: Gavel, show: isModerator },
    { label: 'Transactions', path: '/admin/transactions', icon: ClipboardList, show: isSupport },
    { label: 'Reports', path: '/admin/reports', icon: AlertOctagon, show: isSupport },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: ClipboardList, show: isSuperAdmin },
    { label: 'Admin Management', path: '/admin/admins', icon: ShieldAlert, show: isSuperAdmin },
  ].filter(l => l.show);

  // If path tries to access restricted routes manually, enforce routing protection
  if (pathname.includes('/admin/admins') && !isSuperAdmin) {
    return <Redirect href="/admin" />;
  }
  if (pathname.includes('/admin/audit-logs') && !isSuperAdmin) {
    return <Redirect href="/admin" />;
  }
  if (pathname.includes('/admin/transactions') && !isSupport) {
    return <Redirect href="/admin" />;
  }
  if ((pathname.includes('/admin/listings') || pathname.includes('/admin/auctions')) && !isModerator) {
    return <Redirect href="/admin" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-stone-50 flex-row" edges={['top', 'bottom']}>
      {/* Sidebar Panel for Desktop Web */}
      <View className="w-64 bg-stone-900 border-r border-stone-800 p-5 justify-between hidden md:flex">
        <View className="gap-6 flex-1">
          {/* Header Branding */}
          <View className="pb-4 border-b border-stone-800 gap-1">
            <Text className="text-white font-display font-extrabold text-lg tracking-tight">
              BHEL PURI <Text className="text-brand-primary">ADMIN</Text>
            </Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <Text className="text-[10px] font-display text-stone-400 capitalize font-bold">
                {role.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {/* Navigation Links list */}
          <ScrollView className="flex-1 gap-1">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.path || (link.path !== '/admin' && pathname.startsWith(link.path));
              return (
                <Pressable
                  key={link.path}
                  onPress={() => router.push(link.path as any)}
                  className={`flex-row items-center gap-3 px-4 py-3 rounded-xl mb-1 active:opacity-90 ${isActive ? 'bg-brand-primary' : 'bg-transparent'}`}
                >
                  <Icon size={16} color={isActive ? '#FFFFFF' : '#94A3B8'} />
                  <Text className={`font-display font-bold text-xs ${isActive ? 'text-white' : 'text-stone-400'}`}>
                    {link.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Footer actions */}
        <View className="pt-4 border-t border-stone-800 gap-2">
          <Pressable
            onPress={() => router.push('/')}
            className="flex-row items-center gap-3 px-4 py-2.5 rounded-xl bg-stone-800 border border-stone-700 active:opacity-95"
          >
            <ArrowLeft size={14} color="#E2E8F0" />
            <Text className="text-slate-200 font-display font-bold text-[11px]">Consumer App</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 flex-col">
        {/* Top bar for small screens or branding */}
        <View className="px-5 py-3 border-b border-stone-200 bg-white flex-row items-center justify-between md:hidden">
          <Text className="text-brand-text font-display font-extrabold text-base">
            Bhel Puri Admin
          </Text>
          <Pressable onPress={() => router.push('/')} className="bg-stone-100 p-2 rounded-full">
            <ArrowLeft size={16} color="#1A1A1A" />
          </Pressable>
        </View>

        <View className="flex-1">
          <Slot />
        </View>
      </View>
    </SafeAreaView>
  );
}
