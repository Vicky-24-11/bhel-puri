import { router } from "expo-router";
import * as LucideIcons from "lucide-react-native";
import { Bell, Clock, Compass, Flame, MapPin } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuctionCard } from "@/components/ui/AuctionCard";
import { useAuth } from "@/lib/AuthContext";
import { getAuctions } from "@/services/auctionService";
import { getCategories } from "@/services/categoryService";
import { Auction, Category } from "@/types/database.types";

export default function HomeScreen() {
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Live auction feeds states
  const [recentAuctions, setRecentAuctions] = useState<Auction[]>([]);
  const [endingSoonAuctions, setEndingSoonAuctions] = useState<Auction[]>([]);

  const [selectedLocation] = useState("Mumbai, MH");

  useEffect(() => {
    let active = true;

    const fetchHomeData = async () => {
      try {
        const [cats, recent, ending] = await Promise.all([
          getCategories(),
          getAuctions({ status: 'live', sortBy: 'newest', limit: 6 }),
          getAuctions({ status: 'live', sortBy: 'ending_soon', limit: 6 }),
        ]);

        if (!active) return;

        setCategories(cats);
        setRecentAuctions(recent);
        setEndingSoonAuctions(ending);
      } catch (err) {
        console.error('Error loading home data:', err);
      } finally {
        if (active) {
          setLoadingCategories(false);
        }
      }
    };

    fetchHomeData();

    return () => {
      active = false;
    };
  }, []);

  const handleCategoryPress = (slug: string | null) => {
    setSelectedCategory(slug);
    // Push filters state directly to the Explore tab screen
    router.push({
      pathname: "/(tabs)/explore",
      params: slug ? { category: slug } : undefined,
    } as any);
  };

  // Dynamic icon helper for categories
  const renderCategoryIcon = (iconName: string | null, color: string) => {
    if (!iconName) return <LucideIcons.Package size={18} color={color} />;
    const formattedName = iconName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    const IconComponent =
      (LucideIcons as any)[formattedName] || LucideIcons.Package;
    return <IconComponent size={18} color={color} />;
  };

  // Build time-based greeting
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good morning";
    if (hours < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayName = profile?.full_name || profile?.username || "Guest";

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* 1. Header Area */}
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center">
        <View>
          <Text className="text-3xl font-display font-extrabold text-brand-primary tracking-tight">
            Bhel Puri
          </Text>
          <Text className="text-xs font-display font-semibold text-brand-muted uppercase tracking-widest mt-0.5">
            The Auction App
          </Text>
        </View>

        {/* Small Profile Avatar & Notifications */}
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => router.push("/(tabs)/activity")}
            className="w-10 h-10 items-center justify-center bg-white border border-stone-200 rounded-full shadow-sm active:bg-stone-50"
          >
            <Bell size={20} color="#1A1A1A" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={{ borderColor: "rgba(255, 107, 53, 0.2)" }}
            className="w-10 h-10 rounded-full bg-brand-secondary items-center justify-center border shadow-sm active:opacity-90 overflow-hidden"
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                className="w-full h-full"
              />
            ) : (
              <Text className="font-display font-bold text-brand-text">
                {displayName.substring(0, 2).toUpperCase()}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-5xl mx-auto px-5 pb-12">
          {/* 2. Personalised Greeting */}
          <View className="mb-4 mt-5">
            <Text className="text-sm font-display font-medium text-brand-muted">
              {getGreeting()},
            </Text>
            <Text className="text-2xl font-display font-extrabold text-brand-text mt-0.5">
              {displayName} 👋
            </Text>
          </View>

          {/* 3. Search & Location Bar */}
          <View className="flex-col md:flex-row gap-3 mt-2 mb-6">
            {/* Search Input */}
            <View className="flex-1 flex-row items-center bg-white border border-stone-200 rounded-2xl px-4 h-12 shadow-sm">
              <LucideIcons.Search size={20} color="#7F8C8D" className="mr-3" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search auctions..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={() => {
                  router.push({
                    pathname: "/(tabs)/explore",
                    params: { query: searchQuery },
                  } as any);
                }}
                className="flex-1 h-full text-base font-display text-brand-text"
              />
            </View>

            {/* Location selector */}
            <Pressable className="flex-row items-center bg-white border border-stone-200 rounded-2xl px-4 h-12 shadow-sm w-full md:w-auto md:min-w-[150px]">
              <MapPin size={18} color="#FF6B35" className="mr-2" />
              <View>
                <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold">
                  Location
                </Text>
                <Text className="text-sm font-display font-bold text-brand-text">
                  {selectedLocation}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* 4. Horizontal Categories Section */}
          <View className="mb-6">
            <Text className="text-lg font-display font-bold text-brand-text mb-3">
              Browse Categories
            </Text>
            {loadingCategories ? (
              <View className="flex-row items-center py-2 gap-2">
                <ActivityIndicator size="small" color="#FF6B35" />
                <Text className="text-xs font-display text-brand-muted font-medium">
                  Loading categories...
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="py-1"
              >
                <Pressable
                  onPress={() => handleCategoryPress(null)}
                  className={`flex-row items-center px-4 py-2.5 mr-3 rounded-full border shadow-sm ${
                    selectedCategory === null
                      ? "bg-brand-primary border-brand-primary"
                      : "bg-white border-stone-200"
                  }`}
                >
                  <Compass
                    size={18}
                    color={selectedCategory === null ? "#FFFFFF" : "#FF6B35"}
                    className="mr-2"
                  />
                  <Text
                    className={`text-sm font-display font-semibold ${selectedCategory === null ? "text-white" : "text-brand-text"}`}
                  >
                    All
                  </Text>
                </Pressable>

                {categories.map((cat) => {
                  const isActive = selectedCategory === cat.slug;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => handleCategoryPress(cat.slug)}
                      className={`flex-row items-center px-4 py-2.5 mr-3 rounded-full border shadow-sm ${
                        isActive
                          ? "bg-brand-primary border-brand-primary"
                          : "bg-white border-stone-200"
                      }`}
                    >
                      <View className="mr-2">
                        {renderCategoryIcon(
                          cat.icon,
                          isActive ? "#FFFFFF" : "#FF6B35",
                        )}
                      </View>
                      <Text
                        className={`text-sm font-display font-semibold ${isActive ? "text-white" : "text-brand-text"}`}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* 5. Feeds Loading / Listings Render */}
          {recentAuctions.length === 0 && endingSoonAuctions.length === 0 ? (
            <View className="items-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm mt-4 px-6">
              <View
                style={{ backgroundColor: "rgba(255, 107, 53, 0.08)" }}
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
              >
                <Compass size={32} color="#FF6B35" />
              </View>
              <Text className="text-xl font-display font-extrabold text-brand-text mb-2 text-center">
                Marketplace Coming Soon
              </Text>
              <Text className="text-sm font-display text-brand-muted text-center max-w-xs leading-relaxed">
                Be the first to start the bidding war! Go to the Sell tab and
                create a listing to go live now.
              </Text>
            </View>
          ) : (
            <View>
              {/* Ending Soon Section */}
              {endingSoonAuctions.length > 0 && (
                <View className="mb-8">
                  <View className="flex-row items-center mb-4 gap-1.5">
                    <Clock size={20} color="#E71D36" />
                    <Text className="text-xl font-display font-extrabold text-brand-text">
                      Ending Soon
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap justify-between">
                    {endingSoonAuctions.map((item) => (
                      <View
                        key={item.id}
                        className="w-full sm:w-[48%] md:w-[31%] mb-2"
                      >
                        <AuctionCard
                          id={item.id}
                          title={item.title}
                          current_price={item.current_price}
                          ends_at={item.ends_at}
                          starts_at={item.starts_at}
                          category_name={
                            categories.find((c) => c.id === item.category_id)
                              ?.name
                          }
                          status={item.status}
                          primary_image_url={item.primary_image_url}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Recently Added Section */}
              {recentAuctions.length > 0 && (
                <View className="mb-4">
                  <View className="flex-row items-center mb-4 gap-1.5">
                    <Flame size={20} color="#FF6B35" />
                    <Text className="text-xl font-display font-extrabold text-brand-text">
                      Recently Added
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap justify-between">
                    {recentAuctions.map((item) => (
                      <View
                        key={item.id}
                        className="w-full sm:w-[48%] md:w-[31%] mb-2"
                      >
                        <AuctionCard
                          id={item.id}
                          title={item.title}
                          current_price={item.current_price}
                          ends_at={item.ends_at}
                          starts_at={item.starts_at}
                          category_name={
                            categories.find((c) => c.id === item.category_id)
                              ?.name
                          }
                          status={item.status}
                          primary_image_url={item.primary_image_url}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
