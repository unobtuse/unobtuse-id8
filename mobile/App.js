import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AuthScreen from './src/screens/AuthScreen';
import IdeasScreen from './src/screens/IdeasScreen';
import IdeaDetailScreen from './src/screens/IdeaDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import InvitationsScreen from './src/screens/InvitationsScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
