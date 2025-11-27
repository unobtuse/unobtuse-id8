import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext();

const GOOGLE_CLIENT_ID = '87688464195-bherqspe5i9k1g1s92ap2c7aks3mr03d.apps.googleusercontent.com';

// Get the proper redirect URI for each platform
const redirectUri = makeRedirectUri({
  scheme: 'id8',
  path: Platform.OS === 'web' ? '' : undefined,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    loadStoredAuth();
    // Check for auth response in URL on web
    if (Platform.OS === 'web') {
      checkWebAuthResponse();
    }
  }, []);

  useEffect(() => {
    console.log('Auth response:', response);
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        handleGoogleAuth(id_token);
      }
    }
  }, [response]);

  const checkWebAuthResponse = () => {
    // Check URL hash for id_token (implicit flow)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        if (idToken) {
          handleGoogleAuth(idToken);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.setToken(storedToken);
        // Connect socket after restoring auth
        connectSocket();
      }
    } catch (e) {
      console.log('Error loading auth:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (idToken) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/google', { idToken });
      const { token: newToken, user: newUser } = response;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      
      api.setToken(newToken);
      setToken(newToken);
      setUser(newUser);
      connectSocket();
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = () => {
    promptAsync();
  };

  const signInWithEmail = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: newUser } = response;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      
      api.setToken(newToken);
      setToken(newToken);
      setUser(newUser);
      connectSocket();
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email, password, name) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { email, password, name });
      const { token: newToken, user: newUser } = response;
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      
      api.setToken(newToken);
      setToken(newToken);
      setUser(newUser);
      connectSocket();
    } catch (error) {
      throw new Error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    disconnectSocket();
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      signIn,
      signInWithEmail,
      registerWithEmail,
      signOut,
      isReady: request !== null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
