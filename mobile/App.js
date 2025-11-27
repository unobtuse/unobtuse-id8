import React, { useEffect } from 'react';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Platform, Text, TextInput } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ToastProvider } from './src/context/ToastContext';
import AuthScreen from './src/screens/AuthScreen';
import IdeasScreen from './src/screens/IdeasScreen';
import IdeaDetailScreen from './src/screens/IdeaDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import InvitationsScreen from './src/screens/InvitationsScreen';
import ThreadSettingsScreen from './src/screens/ThreadSettingsScreen';

// Set default font for all Text and TextInput components on native
if (Platform.OS !== 'web') {
  const oldTextRender = Text.render;
  Text.render = function (...args) {
    const origin = oldTextRender.call(this, ...args);
    const style = origin.props.style;
    const fontWeight = style?.fontWeight || (Array.isArray(style) ? style.find(s => s?.fontWeight)?.fontWeight : null);
    
    // Map fontWeight to the correct Inter font variant
    let fontFamily = 'Inter_400Regular';
    const weight = String(fontWeight);
    if (weight === '700' || weight === 'bold') fontFamily = 'Inter_700Bold';
    else if (weight === '600') fontFamily = 'Inter_600SemiBold';
    else if (weight === '500') fontFamily = 'Inter_500Medium';
    else if (weight === '300' || weight === 'light') fontFamily = 'Inter_300Light';
    
    return React.cloneElement(origin, {
      style: [{ fontFamily }, style],
    });
  };
  
  TextInput.defaultProps = TextInput.defaultProps || {};
  TextInput.defaultProps.style = { fontFamily: 'Inter_400Regular' };
}

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();
  const { theme, syncFromServer } = useTheme();

  // Sync settings from server when user logs in
  useEffect(() => {
    if (user) {
      syncFromServer();
    }
  }, [user, syncFromServer]);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Ideas" component={IdeasScreen} />
            <Stack.Screen 
              name="IdeaDetail" 
              component={IdeaDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen 
              name="Invitations" 
              component={InvitationsScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen 
              name="ThreadSettings" 
              component={ThreadSettingsScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // On web, fonts are loaded via CSS, so don't block rendering
  if (!fontsLoaded && Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
