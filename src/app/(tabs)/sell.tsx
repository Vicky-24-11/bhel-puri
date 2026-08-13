import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlusCircle, ChevronRight, Check, X, Camera, Info } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/AuthContext';
import { getCategories } from '@/services/categoryService';
import { createAuction } from '@/services/auctionService';
import { Category } from '@/types/database.types';
import { Badge } from '@/components/ui/Badge';

export default function SellScreen() {
  const { user, profile } = useAuth();
  
  // Wizard flow states
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Listing configuration states
  const [auctionType, setAuctionType] = useState<'forward' | 'reverse'>('forward');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState(profile?.city || '');
  
  // Auction settings states
  const [startingPrice, setStartingPrice] = useState('');
  const [minIncrement, setMinIncrement] = useState('500');
  const [minimumPrice, setMinimumPrice] = useState('');
  const [durationPreset, setDurationPreset] = useState<number>(24); // default 24 hours
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationHours, setCustomDurationHours] = useState('');

  const [publishing, setPublishing] = useState(false);
  const [confirmAuthorized, setConfirmAuthorized] = useState(false);
  const [confirmAuctionRules, setConfirmAuctionRules] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    getCategories()
      .then((data) => {
        setCategories(data);
        setLoadingCategories(false);
      })
      .catch((err) => {
        console.error('Error getting categories:', err);
        setLoadingCategories(false);
      });
  }, []);

  // Update default city if profile changes
  useEffect(() => {
    if (profile?.city) {
      setCity(profile.city);
    }
  }, [profile]);

  const requestPermissionsAndPickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Bhel Puri needs media library permissions to list products!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Permission Denied', msg);
      return;
    }

    const maxSelectable = 10 - imageUris.length;
    if (maxSelectable <= 0) {
      Alert.alert('Limit Reached', 'You can upload up to 10 photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxSelectable,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUris = result.assets.map(asset => asset.uri);
      setImageUris(prev => [...prev, ...selectedUris].slice(0, 10)); // enforce max 10
    }
  };

  const removeImage = (index: number) => {
    setImageUris(prev => prev.filter((_, i) => i !== index));
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) return true; // Auction type is always selected (default 'forward')
    if (currentStep === 2) return selectedCategory !== null;
    if (currentStep === 3) return auctionType === 'reverse' ? true : imageUris.length > 0;
    if (currentStep === 4) return title.trim().length >= 3 && description.trim().length >= 10;
    if (currentStep === 5) {
      const startPrice = parseFloat(startingPrice);
      const inc = parseFloat(minIncrement);
      const durationVal = isCustomDuration ? parseFloat(customDurationHours) : durationPreset;
      
      let isValid = !isNaN(startPrice) && startPrice > 0 &&
        !isNaN(inc) && inc > 0 &&
        !isNaN(durationVal) && durationVal > 0;
        
      if (auctionType === 'reverse' && minimumPrice !== '') {
        const minPriceVal = parseFloat(minimumPrice);
        isValid = isValid && !isNaN(minPriceVal) && minPriceVal >= 0 && minPriceVal <= startPrice;
      }
      return isValid;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to publish an auction.');
      return;
    }

    setPublishing(true);
    try {
      const startPrice = parseFloat(startingPrice);
      const minInc = parseFloat(minIncrement);
      const durationVal = isCustomDuration ? parseFloat(customDurationHours) : durationPreset;
      
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationVal * 60 * 60 * 1000);

      // Determine initial status based on times
      const status = 'live';

      // Perform client-side image compression on native devices
      const processedUris: string[] = [];
      for (const uri of imageUris) {
        if (Platform.OS === 'web') {
          processedUris.push(uri);
        } else {
          try {
            const compressed = await ImageManipulator.manipulateAsync(
              uri,
              [{ resize: { width: 1200 } }], // Resize large edge to 1200px max (retains aspect ratio)
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            processedUris.push(compressed.uri);
          } catch (compressErr) {
            console.warn('Compression failed for image, fallback to original:', compressErr);
            processedUris.push(uri);
          }
        }
      }

      await createAuction({
        seller_id: user.id,
        category_id: selectedCategory!.id,
        title: title.trim(),
        description: description.trim(),
        starting_price: startPrice,
        current_price: startPrice,
        minimum_bid_increment: minInc,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: status,
        winner_id: null,
        auction_type: auctionType,
        minimum_price: minimumPrice ? parseFloat(minimumPrice) : null,
      }, processedUris);

      Alert.alert(
        auctionType === 'reverse' ? 'Request Active' : 'Listing Active',
        auctionType === 'reverse' 
          ? 'Your buy request has been published and is now live!'
          : 'Your auction listing has been published and is now live!'
      );
      
      // Reset form variables
      setAuctionType('forward');
      setSelectedCategory(null);
      setImageUris([]);
      setTitle('');
      setDescription('');
      setStartingPrice('');
      setMinIncrement('500');
      setMinimumPrice('');
      setDurationPreset(24);
      setIsCustomDuration(false);
      setCustomDurationHours('');
      setConfirmAuthorized(false);
      setConfirmAuctionRules(false);
      setStep(1);

      // Redirect user to explore dashboard
      router.replace('/(tabs)/explore' as any);
    } catch (err: any) {
      Alert.alert('Publishing Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const durationPresetOptions = [
    { label: '1 Hr', value: 1 },
    { label: '6 Hrs', value: 6 },
    { label: '12 Hrs', value: 12 },
    { label: '24 Hrs', value: 24 },
    { label: '2 Days', value: 48 },
    { label: '3 Days', value: 72 },
    { label: '7 Days', value: 168 },
  ];

  if (loadingCategories) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background justify-center items-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Dynamic Header */}
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center border-b border-stone-200 bg-white">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            List an Item
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Step {step} of 6 — {step === 1 ? 'Type' : step === 2 ? 'Category' : step === 3 ? 'Photos' : step === 4 ? 'Details' : step === 5 ? 'Pricing' : 'Preview'}
          </Text>
        </View>
        <PlusCircle size={24} color="#FF6B35" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12">
          
          {/* Step Progress Line */}
          <View className="flex-row items-center gap-1.5 mb-6">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <View 
                key={s} 
                className={`flex-1 h-1.5 rounded-full ${step >= s ? 'bg-brand-primary' : 'bg-stone-200'}`} 
              />
            ))}
          </View>

          {/* STEP 1: CHOOSE AUCTION TYPE */}
          {step === 1 && (
            <View className="gap-5">
              <Text className="text-lg font-display font-bold text-brand-text">
                What do you want to do?
              </Text>
              
              <View className="gap-4 mb-4">
                {/* Option 1: Sell Something */}
                <Pressable
                  onPress={() => setAuctionType('forward')}
                  style={
                    auctionType === 'forward'
                      ? { backgroundColor: 'rgba(255, 107, 53, 0.08)', borderColor: '#FF6B35' }
                      : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }
                  }
                  className="p-5 rounded-3xl border shadow-sm flex-row items-center gap-4 active:opacity-95"
                >
                  <View className="w-12 h-12 rounded-2xl bg-brand-primary/10 items-center justify-center">
                    <Text className="text-xl">🔨</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-display text-base font-bold text-brand-text mb-0.5">
                      Sell Something
                    </Text>
                    <Text className="font-display text-xs text-brand-muted">
                      Buyers compete and the highest bid wins. Best for selling items.
                    </Text>
                  </View>
                  {auctionType === 'forward' && <Check size={18} color="#FF6B35" />}
                </Pressable>

                {/* Option 2: Buy Something */}
                <Pressable
                  onPress={() => setAuctionType('reverse')}
                  style={
                    auctionType === 'reverse'
                      ? { backgroundColor: 'rgba(255, 107, 53, 0.08)', borderColor: '#FF6B35' }
                      : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }
                  }
                  className="p-5 rounded-3xl border shadow-sm flex-row items-center gap-4 active:opacity-95"
                >
                  <View className="w-12 h-12 rounded-2xl bg-brand-primary/10 items-center justify-center">
                    <Text className="text-xl">🔄</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-display text-base font-bold text-brand-text mb-0.5">
                      Buy Request
                    </Text>
                    <Text className="font-display text-xs text-brand-muted">
                      Sellers compete and the lowest offer wins. Best for sourcing items.
                    </Text>
                  </View>
                  {auctionType === 'reverse' && <Check size={18} color="#FF6B35" />}
                </Pressable>
              </View>

              <Button
                label="Continue"
                onPress={() => setStep(2)}
                icon={<ChevronRight size={18} color="#FFFFFF" />}
                iconPosition="right"
              />
            </View>
          )}

          {/* STEP 2: CHOOSE CATEGORY */}
          {step === 2 && (
            <View className="gap-4">
              <Text className="text-lg font-display font-bold text-brand-text">
                Select a category for your {auctionType === 'reverse' ? 'buy request' : 'item'}
              </Text>
              
              <View className="flex-row flex-wrap justify-between gap-y-3 mb-4">
                {categories.map((cat) => {
                  const isSelected = selectedCategory?.id === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat)}
                      style={
                        isSelected
                          ? { backgroundColor: 'rgba(255, 107, 53, 0.08)', borderColor: '#FF6B35' }
                          : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }
                      }
                      className="w-[48%] p-4.5 rounded-2xl border flex-row items-center justify-between shadow-sm active:opacity-95"
                    >
                      <Text className={`font-display text-sm font-semibold ${isSelected ? 'text-brand-primary' : 'text-brand-text'}`}>
                        {cat.name}
                      </Text>
                      {isSelected && <Check size={16} color="#FF6B35" />}
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row justify-between gap-3 mt-4">
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setStep(1)}
                  className="flex-1"
                />
                <Button
                  label="Continue"
                  disabled={!validateStep(2)}
                  onPress={() => setStep(3)}
                  className="flex-1"
                />
              </View>
            </View>
          )}

          {/* STEP 3: ADD PHOTOS */}
          {step === 3 && (
            <View className="gap-5">
              <Text className="text-lg font-display font-bold text-brand-text">
                Add reference or item photos {auctionType === 'reverse' && '(Optional)'}
              </Text>

              {/* Photo uploader square */}
              <Pressable
                onPress={requestPermissionsAndPickImages}
                className="w-full aspect-[2/1] rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 items-center justify-center overflow-hidden active:bg-stone-100"
              >
                <Camera size={32} color="#FF6B35" className="mb-1.5" />
                <Text className="text-sm font-display font-bold text-brand-text">
                  Choose photos from library
                </Text>
                <Text className="text-xs font-display text-brand-muted mt-0.5">
                  Select up to 10 photos ({imageUris.length}/10 selected)
                </Text>
              </Pressable>

              {/* Photos row list */}
              {imageUris.length > 0 && (
                <View className="flex-row flex-wrap gap-3 my-2">
                  {imageUris.map((uri, idx) => (
                    <View key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200">
                      <Image source={{ uri }} className="w-full h-full" contentFit="cover" />
                      
                      {/* Flag primary image */}
                      {idx === 0 && (
                        <View className="absolute bottom-0 left-0 right-0 bg-brand-primary py-0.5 items-center">
                          <Text className="text-[8px] font-display font-bold text-white uppercase">Primary</Text>
                        </View>
                      )}

                      {/* Remove Image button */}
                      <Pressable
                        onPress={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-black/60 rounded-full w-5 h-5 items-center justify-center active:bg-black"
                      >
                        <X size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <View className="flex-row justify-between gap-3 mt-4">
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setStep(2)}
                  className="flex-1"
                />
                <Button
                  label="Continue"
                  disabled={!validateStep(3)}
                  onPress={() => setStep(4)}
                  className="flex-1"
                />
              </View>
            </View>
          )}

          {/* STEP 4: PRODUCT DETAILS */}
          {step === 4 && (
            <View className="gap-4">
              <Text className="text-lg font-display font-bold text-brand-text">
                Enter details
              </Text>

              <Input
                label={auctionType === 'reverse' ? 'Buy Request Title' : 'Auction Listing Title'}
                placeholder={auctionType === 'reverse' ? 'e.g. Looking for iPhone 15 Pro Max' : 'e.g. iPhone 15 Pro Max - 256GB'}
                value={title}
                onChangeText={setTitle}
                helperText="Must be at least 3 characters"
              />

              <Input
                label={auctionType === 'reverse' ? 'Requirements Detail' : 'Product Description'}
                placeholder={auctionType === 'reverse' ? 'Detail the required item condition, specific model specs, or color preferences...' : 'Detail the product condition, age, inclusions, or any blemishes...'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                className="h-24 pt-2 align-top"
                helperText={auctionType === 'reverse' ? 'Provide at least 10 characters to inform sellers' : 'Provide at least 10 characters to inform buyers'}
              />

              <Input
                label="Location / City (Optional)"
                placeholder="e.g. Mumbai, MH"
                value={city}
                onChangeText={setCity}
              />

              <View className="flex-row justify-between gap-3 mt-4">
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setStep(3)}
                  className="flex-1"
                />
                <Button
                  label="Continue"
                  disabled={!validateStep(4)}
                  onPress={() => setStep(5)}
                  className="flex-1"
                />
              </View>
            </View>
          )}

          {/* STEP 5: TIMINGS AND PRICES */}
          {step === 5 && (
            <View className="gap-5">
              <Text className="text-lg font-display font-bold text-brand-text">
                Configure Pricing & Timeline
              </Text>

              <Input
                label={auctionType === 'reverse' ? 'Maximum Budget (₹)' : 'Starting Price (₹)'}
                placeholder="e.g. 25000"
                keyboardType="numeric"
                value={startingPrice}
                onChangeText={setStartingPrice}
              />

              <Input
                label={auctionType === 'reverse' ? 'Minimum Offer Decrement (₹)' : 'Minimum Bid Increment (₹)'}
                placeholder="e.g. 500"
                keyboardType="numeric"
                value={minIncrement}
                onChangeText={setMinIncrement}
              />

              {auctionType === 'reverse' && (
                <Input
                  label="Minimum Acceptable Price (₹) (Optional)"
                  placeholder="e.g. 20000"
                  keyboardType="numeric"
                  value={minimumPrice}
                  onChangeText={setMinimumPrice}
                  helperText="Sellers cannot submit offers below this threshold."
                />
              )}

              {/* Duration Presets list */}
              <View>
                <Text className="text-xs font-display font-bold text-brand-text mb-2">
                  Auction Duration
                </Text>
                
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {durationPresetOptions.map((opt) => {
                    const isActive = !isCustomDuration && durationPreset === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          setIsCustomDuration(false);
                          setDurationPreset(opt.value);
                        }}
                        className={`px-4 py-2 rounded-xl border ${
                          isActive ? 'bg-brand-primary border-brand-primary' : 'bg-white border-stone-200'
                        }`}
                      >
                        <Text className={`text-xs font-display font-bold ${isActive ? 'text-white' : 'text-brand-text'}`}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setIsCustomDuration(true)}
                    className={`px-4 py-2 rounded-xl border ${
                      isCustomDuration ? 'bg-brand-primary border-brand-primary' : 'bg-white border-stone-200'
                    }`}
                  >
                    <Text className={`text-xs font-display font-bold ${isCustomDuration ? 'text-white' : 'text-brand-text'}`}>
                      Custom Duration
                    </Text>
                  </Pressable>
                </View>

                {isCustomDuration && (
                  <Input
                    label="Enter Custom Duration (Hours)"
                    placeholder="e.g. 3"
                    keyboardType="numeric"
                    value={customDurationHours}
                    onChangeText={setCustomDurationHours}
                  />
                )}
              </View>

              <View className="flex-row justify-between gap-3 mt-4">
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setStep(4)}
                  className="flex-1"
                />
                <Button
                  label="Continue"
                  disabled={!validateStep(5)}
                  onPress={() => setStep(6)}
                  className="flex-1"
                />
              </View>
            </View>
          )}

          {/* STEP 6: PREVIEW SCREEN */}
          {step === 6 && (
            <View className="gap-5">
              <Text className="text-lg font-display font-bold text-brand-text">
                Preview your {auctionType === 'reverse' ? 'buy request' : 'listing'}
              </Text>
              
              <View className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm p-4 gap-4">
                {/* Images grid preview */}
                {imageUris.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pb-1">
                    {imageUris.map((uri, idx) => (
                      <Image 
                        key={idx} 
                        source={{ uri }} 
                        className="w-48 h-36 rounded-2xl border border-stone-200" 
                        contentFit="cover" 
                      />
                    ))}
                  </ScrollView>
                )}

                <View className="gap-1.5 mt-2">
                  <View className="flex-row gap-2">
                    <Badge label={auctionType === 'reverse' ? '🔄 Buy Request' : '🔨 Auction Listing'} type={auctionType === 'reverse' ? 'warning' : 'success'} size="sm" />
                    <Badge label={selectedCategory?.name || 'Category'} type="neutral" size="sm" />
                  </View>
                  <Text className="text-xl font-display font-extrabold text-brand-text">{title}</Text>
                  <Text className="text-sm font-display text-brand-muted leading-relaxed">{description}</Text>
                </View>

                <View className="h-[1px] bg-stone-100 my-1" />

                {/* Logistics */}
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-[10px] font-display text-brand-muted uppercase font-bold tracking-wider">
                      {auctionType === 'reverse' ? 'Max Budget' : 'Starting Price'}
                    </Text>
                    <Text className="text-base font-display font-extrabold text-brand-text mt-0.5">₹{parseFloat(startingPrice).toLocaleString('en-IN')}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] font-display text-brand-muted uppercase font-bold tracking-wider">
                      {auctionType === 'reverse' ? 'Min. Decrement' : 'Min. Increment'}
                    </Text>
                    <Text className="text-base font-display font-extrabold text-brand-text mt-0.5">₹{parseFloat(minIncrement).toLocaleString('en-IN')}</Text>
                  </View>
                </View>

                {auctionType === 'reverse' && minimumPrice !== '' && (
                  <View className="flex-row justify-between pt-1">
                    <View>
                      <Text className="text-[10px] font-display text-brand-muted uppercase font-bold tracking-wider">Min. Acceptable Price</Text>
                      <Text className="text-sm font-display font-extrabold text-brand-text mt-0.5">₹{parseFloat(minimumPrice).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                )}

                <View className="flex-row justify-between pt-1">
                  <View>
                    <Text className="text-[10px] font-display text-brand-muted uppercase font-bold tracking-wider">Location</Text>
                    <Text className="text-sm font-display font-semibold text-brand-text mt-0.5">{city || 'India'}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] font-display text-brand-muted uppercase font-bold tracking-wider">Duration</Text>
                    <Text className="text-sm font-display font-semibold text-brand-text mt-0.5">
                      {isCustomDuration ? `${customDurationHours} Hours` : `${durationPreset} Hours`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Warning/Info message */}
              <View style={{ backgroundColor: 'rgba(255, 107, 53, 0.05)' }} className="flex-row border border-brand-primary/20 p-4 rounded-2xl gap-3">
                <Info size={20} color="#FF6B35" />
                <Text className="flex-1 text-[11px] font-display text-brand-muted leading-relaxed">
                  By clicking publish, this listing will go live immediately. All details, pricing settings, and schedules are authoritatively written to Supabase and cannot be modified once live.
                </Text>
              </View>

              {/* Confirmation Rules Panel */}
              <View className="bg-white border border-stone-200 rounded-3xl p-4 gap-3.5 mt-1">
                <Text className="text-xs font-display font-extrabold text-brand-text mb-0.5">
                  Publishing Affirmations
                </Text>
                
                <Pressable
                  onPress={() => setConfirmAuthorized(!confirmAuthorized)}
                  className="flex-row items-start gap-3"
                >
                  <View className={`w-5 h-5 rounded-lg border flex items-center justify-center ${confirmAuthorized ? 'bg-brand-primary border-brand-primary' : 'border-stone-300 bg-stone-50'}`}>
                    {confirmAuthorized && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text className="flex-1 text-[11px] font-display text-brand-text leading-relaxed">
                    I confirm that I am authorized to publish this request and the information provided is accurate.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setConfirmAuctionRules(!confirmAuctionRules)}
                  className="flex-row items-start gap-3"
                >
                  <View className={`w-5 h-5 rounded-lg border flex items-center justify-center ${confirmAuctionRules ? 'bg-brand-primary border-brand-primary' : 'border-stone-300 bg-stone-50'}`}>
                    {confirmAuctionRules && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text className="flex-1 text-[11px] font-display text-brand-text leading-relaxed">
                    I agree to the rules: listing details cannot be changed once live, bids/offers are binding, and bidding on my own listings is strictly forbidden.
                  </Text>
                </Pressable>
              </View>

              {publishing ? (
                <View className="py-4 items-center gap-2">
                  <ActivityIndicator size="small" color="#FF6B35" />
                  <Text className="text-xs font-display text-brand-muted font-medium">Publishing listing and uploading photos...</Text>
                </View>
              ) : (
                <View className="flex-row justify-between gap-3 mt-2">
                  <Button
                    label="Back"
                    variant="outline"
                    onPress={() => setStep(5)}
                    className="flex-1"
                  />
                  <Button
                    label={auctionType === 'reverse' ? 'Publish Request' : 'Publish Auction'}
                    disabled={!confirmAuthorized || !confirmAuctionRules}
                    onPress={handlePublish}
                    className="flex-1"
                  />
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
