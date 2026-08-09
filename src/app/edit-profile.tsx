import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Platform, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { User, ShieldCheck, MapPin, AlignLeft, ArrowLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/AuthContext';
import { updateProfile, isUsernameAvailable } from '@/services/profileService';

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setCity(profile.city || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      newErrors.username = 'Username is required.';
    } else if (cleanUsername.length < 3) {
      newErrors.username = 'Username must be at least 3 characters.';
    } else if (cleanUsername.length > 20) {
      newErrors.username = 'Username must be less than 20 characters.';
    } else if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      newErrors.username = 'Username can only contain lowercase letters, numbers, and underscores.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveChanges = async () => {
    if (!validateForm() || !user) return;

    setLoading(true);
    const cleanUsername = username.trim().toLowerCase();
    
    try {
      // 1. Verify username availability if it changed
      if (profile && cleanUsername !== profile.username) {
        const available = await isUsernameAvailable(cleanUsername, user.id);
        if (!available) {
          setErrors((prev) => ({
            ...prev,
            username: 'That username is already taken. Please choose another one.'
          }));
          setLoading(false);
          return;
        }
      }

      // 2. Write updates to the profile database row using service module
      await updateProfile({
        id: user.id,
        full_name: fullName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        city: city.trim(),
        avatar_url: avatarUrl,
      });

      // 3. Sync Auth State & return to profile screen
      await refreshProfile();
      
      const successMsg = 'Your profile modifications have been saved.';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Profile Saved', successMsg);
      }
      router.back();
    } catch (error: any) {
      console.error('Profile modification failed:', error);
      const errAlert = error.message || 'Something went wrong. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(errAlert);
      } else {
        Alert.alert('Save Failed', errAlert);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header with back button */}
      <View className="px-5 pt-3 pb-2 flex-row items-center border-b border-stone-200 gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center bg-white border border-stone-200 rounded-full shadow-sm active:bg-stone-50"
        >
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View>
          <Text className="text-xl font-display font-extrabold text-brand-text">
            Edit Profile
          </Text>
          <Text className="text-xs font-display text-brand-muted">
            Update your public credentials
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-6 py-6 max-w-lg mx-auto w-full gap-6">
          
          {/* Avatar Preview */}
          {avatarUrl ? (
            <View className="items-center my-2">
              <View className="relative">
                <Image
                  source={{ uri: avatarUrl }}
                  className="w-24 h-24 rounded-full border-4 border-brand-primary/10"
                />
                <View className="absolute bottom-0 right-0 bg-brand-primary p-2 rounded-full border border-white">
                  <User size={12} color="#FFF" />
                </View>
              </View>
            </View>
          ) : null}

          {/* Input Form Fields */}
          <View className="gap-4">
            <Input
              label="Full Name"
              placeholder="e.g. Vikas Pandey"
              value={fullName}
              onChangeText={setFullName}
              error={errors.fullName || undefined}
              leftIcon={<User size={18} color="#7F8C8D" />}
            />

            <Input
              label="Username"
              placeholder="e.g. vikas_pandey"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={(text) => {
                setUsername(text.replace(/\s/g, ''));
                if (errors.username) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.username;
                    return next;
                  });
                }
              }}
              error={errors.username || undefined}
              leftIcon={<ShieldCheck size={18} color="#7F8C8D" />}
            />

            <Input
              label="Bio (Optional)"
              placeholder="Tell other bidders a bit about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              className="h-20 pt-2 align-top"
              leftIcon={<AlignLeft size={18} color="#7F8C8D" />}
            />

            <Input
              label="City (Optional)"
              placeholder="e.g. Mumbai"
              value={city}
              onChangeText={setCity}
              leftIcon={<MapPin size={18} color="#7F8C8D" />}
            />
          </View>

          {/* Action Buttons */}
          <View className="gap-2 mt-4">
            <Button
              label="Save Changes"
              onPress={handleSaveChanges}
              loading={loading}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
