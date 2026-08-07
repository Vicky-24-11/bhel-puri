import { useEffect } from 'react';
   import { useColorScheme } from 'react-native';
   import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
   import { Stack } from 'expo-router';
   import * as SplashScreen from 'expo-splash-screen';
   
   import '../global.css';
   
   // Prevent the splash screen from auto-hiding before assets load.
   SplashScreen.preventAutoHideAsync().catch(() => {});
   
   export default function RootLayout() {
     const colorScheme = useColorScheme();
   
     useEffect(() => {
       // Hide splash screen when root mounts
       SplashScreen.hideAsync().catch(() => {});
     }, []);
   
     return (
       <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
         <Stack screenOptions={{ headerShown: false }}>
           <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
           <Stack.Screen 
             name="auction/[id]" 
             options={{ 
               headerShown: false, 
               title: 'Auction Details',
               headerStyle: { backgroundColor: '#FDFBF7' },
               headerTintColor: '#FF6B35',
               headerTitleStyle: { fontWeight: 'bold' }
             }} 
           />
         </Stack>
       </ThemeProvider>
     );
   }
