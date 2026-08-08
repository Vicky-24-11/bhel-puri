import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, ShieldCheck, MapPin, AlignLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/services/authService';

export default function ProfileSetupScreen() {
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill fields with existing profile data or user email metadata on mount
  React.useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setAvatarUrl(profile.avatar_url || user?.user_metadata?.avatar_url || '');
    } else if (user) {
      const emailPrefix = user.email ? user.email.split('@')[0].replace(/[^a-z0-9_]/g, '') : '';
      setUsername(emailPrefix);
      setFullName(user.user_metadata?.full_name || emailPrefix);
      setAvatarUrl(user.user_metadata?.avatar_url || '');
    }
  }, [profile, user]);

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

  const handleSaveProfile = async () => {
    if (!validateForm() || !user) return;

    setLoading(true);
    const cleanUsername = username.trim().toLowerCase();
    
    try {
      // 1. Verify username availability (exclude current user)
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', user.id);
        
      if (checkError) {
        if (checkError.code === 'PGRST205' || checkError.code === '42P01') {
          throw new Error('Database tables are missing. Please run the SQL migrations from your supabase/migrations/ folder in your Supabase SQL Editor (see docs/SUPABASE_SETUP.md).');
        }
        throw checkError;
      }

      if (existingUser && existingUser.length > 0) {
        setErrors((prev) => ({
          ...prev,
          username: 'That username is already taken. Please choose another one.'
        }));
        setLoading(false);
        return;
      }

      // 2. Write upsert to create or update the profile database row (including avatar_url)
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName.trim(),
          username: cleanUsername,
          bio: bio.trim(),
          location: location.trim(),
          avatar_url: avatarUrl,
          is_profile_completed: true,
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        if (updateError.code === 'PGRST205' || updateError.code === '42P01') {
          throw new Error('Database tables are missing. Please run the SQL migrations from your supabase/migrations/ folder in your Supabase SQL Editor.');
        }
        throw updateError;
      }

      // 3. Sync Auth State
      await refreshProfile();
      
      const successMsg = 'Your profile is set up! Welcome to Bhel Puri.';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Profile Complete', successMsg);
      }
    } catch (error: any) {
      console.error('Profile setup failed:', error);
      const errAlert = error.message || 'Failed to save profile. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(errAlert);
      } else {
        Alert.alert('Setup Failed', errAlert);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (err: any) {
      console.error('Logout error:', err);
      const errMsg = err.message || 'Failed to sign out. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Error', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-6 py-8 max-w-lg mx-auto w-full gap-6">
          <View>
            <Text className="text-3xl font-display font-extrabold text-brand-text tracking-tight">
              Complete your profile
            </Text>
            <Text className="text-sm font-display text-brand-muted mt-2">
              Choose your display credentials to begin bidding.
            </Text>
          </View>

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
                setUsername(text.replace(/\s/g, '')); // remove spaces in real-time
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
              label="Location (Optional)"
              placeholder="e.g. Mumbai, MH"
              value={location}
              onChangeText={setLocation}
              leftIcon={<MapPin size={18} color="#7F8C8D" />}
            />
          </View>

          {/* Action Buttons */}
          <View className="gap-2 mt-4">
            <Button
              label="Save & Continue"
              onPress={handleSaveProfile}
              loading={loading}
            />

            <Button
              label="Log Out / Cancel"
              variant="outline"
              onPress={handleLogout}
              className="border-brand-error/20 active:bg-red-50"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
