import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlusCircle, Image as ImageIcon, ChevronRight, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mockCategories } from '@/mocks/auctions';

export default function SellScreen() {
  const [step, setStep] = useState(1);
  
  // Form states
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [increment, setIncrement] = useState('100');
  const [duration, setDuration] = useState('30'); // Default 30 mins
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    // Request permission first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Bhel Puri needs camera roll permissions to select photos!';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Permission Denied', msg);
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handlePublish = () => {
    if (Platform.OS === 'web') {
      window.alert('Bhel Puri: Auction listings require database linking. In V1, this publishes straight to Supabase.');
    } else {
      Alert.alert('Bhel Puri', 'Auction listings require database linking. In V1, this publishes straight to Supabase.');
    }
    // Reset form
    setCategory('');
    setTitle('');
    setDescription('');
    setStartingBid('');
    setIncrement('100');
    setDuration('30');
    setSelectedImage(null);
    setStep(1);
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center border-b border-stone-200/50">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            List an Item
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Step {step} of 3
          </Text>
        </View>
        <PlusCircle size={24} color="#FF6B35" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12">
          
          {/* Step Indicator Bar */}
          <View className="flex-row items-center gap-1.5 mb-6">
            <View className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-brand-primary' : 'bg-stone-200'}`} />
            <View className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-brand-primary' : 'bg-stone-200'}`} />
            <View className={`flex-1 h-1.5 rounded-full ${step >= 3 ? 'bg-brand-primary' : 'bg-stone-200'}`} />
          </View>

          {/* STEP 1: CHOOSE CATEGORY */}
          {step === 1 && (
            <View>
              <Text className="text-lg font-display font-bold text-brand-text mb-4">
                What are you selling today?
              </Text>
              
              <View className="flex-row flex-wrap justify-between gap-y-3 mb-8">
                {mockCategories.map((cat) => {
                  const isSelected = category === cat.slug;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategory(cat.slug)}
                      style={
                        isSelected
                          ? { backgroundColor: 'rgba(255, 107, 53, 0.1)', borderColor: '#FF6B35' }
                          : { backgroundColor: '#FFFFFF', borderColor: '#E6E6E6' }
                      }
                      className="w-[48%] p-4 rounded-2xl border flex-row items-center justify-between shadow-sm"
                    >
                      <Text className={`font-display font-semibold ${isSelected ? 'text-brand-primary' : 'text-brand-text'}`}>
                        {cat.name}
                      </Text>
                      {isSelected && <Check size={16} color="#FF6B35" />}
                    </Pressable>
                  );
                })}
              </View>

              <Button
                label="Continue"
                disabled={!category}
                onPress={() => setStep(2)}
                icon={<ChevronRight size={18} color="#FFFFFF" />}
                iconPosition="right"
              />
            </View>
          )}

          {/* STEP 2: PRODUCT INFORMATION */}
          {step === 2 && (
            <View>
              <Text className="text-lg font-display font-bold text-brand-text mb-4">
                Tell us about the item
              </Text>

              {/* Photo Upload area / Picked image view */}
              <Pressable
                onPress={pickImage}
                className="w-full aspect-[2/1] rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 items-center justify-center mb-6 overflow-hidden"
              >
                {selectedImage ? (
                  <Image
                    source={{ uri: selectedImage }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <ImageIcon size={32} color="#7F8C8D" className="mb-2" />
                    <Text className="text-sm font-display font-semibold text-brand-text">
                      Upload photos
                    </Text>
                    <Text className="text-xs font-display text-brand-muted mt-0.5">
                      Tap to select a photo from library
                    </Text>
                  </>
                )}
              </Pressable>

              <Input
                label="Product Title"
                placeholder="e.g. iPhone 15 Pro Max - 256GB"
                value={title}
                onChangeText={setTitle}
              />

              <Input
                label="Description"
                placeholder="Describe your product condition, defects, or details..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                className="h-24 pt-2 align-top"
              />

              <View className="flex-row justify-between gap-3 mt-4">
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setStep(1)}
                  className="flex-1"
                />
                <Button
                  label="Continue"
                  disabled={!title || !description}
                  onPress={() => setStep(3)}
                  className="flex-1"
                />
              </View>
            </View>
          )}

          {/* STEP 3: AUCTION LOGISTICS */}
          {step === 3 && (
            <View>
              <Text className="text-lg font-display font-bold text-brand-text mb-4">
                Configure Bidding & Timeline
              </Text>

              <Input
                label="Starting Bid (₹)"
                placeholder="e.g. 40,000"
                keyboardType="numeric"
                value={startingBid}
                onChangeText={setStartingBid}
              />

              <Input
                label="Minimum Bid Increment (₹)"
                placeholder="100"
                keyboardType="numeric"
                value={increment}
                onChangeText={setIncrement}
              />

              <Input
                label="Auction Duration (Minutes)"
                placeholder="30"
                keyboardType="numeric"
                value={duration}
                onChangeText={setDuration}
                helperText="How long the bidding war runs (Authoritative servers handle end time)"
              />

              <View className="flex-row justify-between gap-3 mt-6">
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setStep(2)}
                  className="flex-1"
                />
                <Button
                  label="Publish Auction"
                  disabled={!startingBid}
                  onPress={handlePublish}
                  className="flex-1"
                />
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
