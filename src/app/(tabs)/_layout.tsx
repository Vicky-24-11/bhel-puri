import { Tabs } from "expo-router";
import { Gavel, Heart, Home, PlusCircle, User } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";

import { hapticSelection } from "@/utils/haptics";

export default function TabLayout() {
  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          hapticSelection();
        },
      }}
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarActiveTintColor: "#FF6B35",
        tabBarInactiveTintColor: "#7F8C8D",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E7EB",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
          paddingTop: 10,
          elevation: 8,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontFamily: "System",
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => <Gavel color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: "Post",
          tabBarIcon: ({ color, size }) => (
            <PlusCircle color={color} size={size + 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
