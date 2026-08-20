import { router } from "expo-router";
import {
  ChevronRight,
  Gavel,
  LogOut,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Star,
  User,
} from "lucide-react-native";
import React, { useState, useEffect } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";
import { signOut } from "@/services/authService";
import { supabase } from "@/lib/supabase";
import { getRatingsForUser } from "@/services/ratingService";

export default function ProfileScreen() {
  const { user, profile } = useAuth();
  const [createdCount, setCreatedCount] = useState<number>(0);
  const [wonCount, setWonCount] = useState<number>(0);
  const [reviewsList, setReviewsList] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch Created Auctions Count
    supabase
      .from('auctions')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .then(({ count }) => {
        if (count !== null) setCreatedCount(count);
      });

    // Fetch Won Purchases Count
    supabase
      .from('auctions')
      .select('id', { count: 'exact', head: true })
      .eq('winner_id', user.id)
      .then(({ count }) => {
        if (count !== null) setWonCount(count);
      });

    // Fetch Recent Reviews Received
    if (user.id) {
      getRatingsForUser(user.id, undefined, 5, 0)
        .then((data) => setReviewsList(data))
        .catch((err) => console.error('Error fetching profile reviews:', err));
    }
  }, [user]);

  const handleLogout = () => {
    const action = async () => {
      try {
        await signOut();
      } catch (err: any) {
        console.error("Logout error:", err);
        const errMsg = err.message || "Failed to sign out. Please try again.";
        if (Platform.OS === "web") {
          window.alert(errMsg);
        } else {
          Alert.alert("Error", errMsg);
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to log out of Bhel Puri?")) {
        action();
      }
    } else {
      Alert.alert(
        "Confirm Log Out",
        "Are you sure you want to log out of Bhel Puri?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: action },
        ],
      );
    }
  };

  const menuItems: { label: string; icon: any; count?: number; action: () => void }[] = [
    {
      label: "Edit Profile",
      icon: User,
      action: () => router.push("/edit-profile" as any),
    },
    {
      label: "My Listings (Listed Auctions)",
      icon: Gavel,
      action: () => router.push("/my-auctions" as any),
    },
    {
      label: "My Sales Transactions",
      icon: ShieldCheck,
      action: () => router.push("/my-sales" as any),
    },
    {
      label: "My Purchases (Won Auctions)",
      icon: ShieldCheck,
      action: () => router.push("/my-purchases" as any),
    },
    {
      label: "Privacy & Safety",
      icon: ShieldAlert,
      action: () => router.push("/privacy-safety" as any),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center border-b border-stone-200">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            My Profile
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Manage your bidding credentials
          </Text>
        </View>
        <User size={24} color="#FF6B35" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12">
          {/* User Hero Section Card */}
          <View className="w-full bg-white border border-stone-200 rounded-3xl p-5 mb-6 shadow-sm items-center">
            {/* Large Avatar */}
            {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
              <Image
                source={{
                  uri: profile?.avatar_url || user?.user_metadata?.avatar_url,
                }}
                className="w-20 h-20 rounded-full mb-3 border border-stone-200"
              />
            ) : (
              <View
                style={{
                  backgroundColor: "rgba(255, 107, 53, 0.1)",
                  borderColor: "rgba(255, 107, 53, 0.25)",
                }}
                className="w-20 h-20 border rounded-full items-center justify-center mb-3"
              >
                <User size={40} color="#FF6B35" />
              </View>
            )}

            {/* Name and Verification Badge */}
            <View className="flex-row items-center justify-center gap-1.5 mb-1">
              <Text className="text-xl font-display font-extrabold text-brand-text">
                {profile?.full_name || "Bhel Puri Bidder"}
              </Text>
              {profile?.is_verified && (
                <ShieldCheck
                  size={18}
                  color="#2EC4B6"
                  fill="#2EC4B6"
                  fillOpacity={0.2}
                />
              )}
            </View>

            <Text className="text-sm font-display text-brand-muted mb-1">
              @{profile?.username || "bidder"}
            </Text>
            {user?.email ? (
              <Text className="text-xs font-display text-brand-muted mb-3">
                {user.email}
              </Text>
            ) : null}

            <Text className="text-xs font-display text-brand-muted mb-4 text-center px-4 leading-relaxed">
              {profile?.bio || "No bio provided yet."}
            </Text>

            {profile?.city ? (
              <View className="flex-row items-center mb-4">
                <MapPin size={12} color="#7F8C8D" className="mr-1" />
                <Text className="text-xs font-display text-brand-muted">
                  {profile.city}
                </Text>
              </View>
            ) : null}

            {/* Star Ratings Empty State Check */}
            {profile?.total_ratings && profile.total_ratings > 0 ? (
              <View
                style={{ backgroundColor: "rgba(255, 182, 39, 0.15)" }}
                className="flex-row items-center px-3 py-1.5 rounded-full mb-5"
              >
                <Star
                  size={14}
                  color="#FFB627"
                  fill="#FFB627"
                  className="mr-1"
                />
                <Text className="text-xs font-display font-bold text-brand-text">
                  {profile?.rating || "0.00"} Seller Rating (
                  {profile?.total_ratings} deals)
                </Text>
              </View>
            ) : (
              <View
                style={{ backgroundColor: "rgba(127, 140, 141, 0.08)" }}
                className="flex-row items-center px-3 py-1.5 rounded-full mb-5"
              >
                <Star size={14} color="#7F8C8D" className="mr-1" />
                <Text className="text-xs font-display font-semibold text-brand-muted">
                  No ratings yet (0 deals)
                </Text>
              </View>
            )}

            {/* Stats row */}
            <View className="w-full flex-row justify-around border-t border-stone-100 pt-4">
              <View className="items-center">
                <Text className="text-xl font-display font-extrabold text-brand-text">
                  {createdCount}
                </Text>
                <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold mt-0.5">
                  Created
                </Text>
              </View>

              <View className="h-8 w-[1px] bg-stone-200 self-center" />

              <View className="items-center">
                <Text className="text-xl font-display font-extrabold text-brand-text">
                  {wonCount}
                </Text>
                <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold mt-0.5">
                  Won
                </Text>
              </View>
            </View>
          </View>

          {/* Action List Menu */}
          <View className="bg-white border border-stone-200 rounded-3xl overflow-hidden mb-6 shadow-sm">
            {menuItems.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <Pressable
                  key={idx}
                  onPress={item.action}
                  className={`flex-row items-center justify-between p-4 ${
                    idx < menuItems.length - 1
                      ? "border-b border-stone-100"
                      : ""
                  } active:bg-stone-50`}
                >
                  <View className="flex-row items-center">
                    <View
                      style={{ backgroundColor: "rgba(255, 107, 53, 0.1)" }}
                      className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                    >
                      <IconComp size={16} color="#FF6B35" />
                    </View>
                    <Text className="font-display font-semibold text-brand-text text-sm">
                      {item.label}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1">
                    {item.count !== undefined && item.count > 0 && (
                      <View className="bg-stone-100 px-2 py-0.5 rounded-full">
                        <Text className="text-xs font-display text-brand-muted font-bold">
                          {item.count}
                        </Text>
                      </View>
                    )}
                    <ChevronRight size={16} color="#BDC3C7" />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Log Out Button */}
          <Button
            label="Log Out"
            variant="outline"
            icon={<LogOut size={16} color="#E71D36" />}
            onPress={handleLogout}
            className="border-brand-error/20 active:bg-red-50"
          />

          {/* Recent Reviews Received */}
          {reviewsList.length > 0 && (
            <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm mt-6 gap-4">
              <View className="flex-row items-center gap-2">
                <Star size={16} color="#FF6B35" fill="#FF6B35" />
                <Text className="text-sm font-display font-bold text-brand-text">
                  Recent Reviews Received
                </Text>
              </View>
              <View className="gap-3">
                {reviewsList.map((item) => (
                  <View key={item.id} className="border-b border-stone-100 pb-3 last:border-b-0">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-xs font-display font-bold text-brand-text">
                        @{item.reviewer?.username || 'user'}
                      </Text>
                      <View className="flex-row items-center">
                        <Star size={10} color="#F59E0B" fill="#F59E0B" className="mr-0.5" />
                        <Text className="text-[10px] font-display font-extrabold text-brand-text">
                          {item.rating_value}.0
                        </Text>
                      </View>
                    </View>
                    {item.comment && (
                      <Text className="text-xs font-display text-brand-muted leading-relaxed">
                        {item.comment}
                      </Text>
                    )}
                    <Text className="text-[8px] font-display text-brand-muted mt-1">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
