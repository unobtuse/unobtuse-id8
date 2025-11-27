import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeColors } from '../theme/colors';
import { api } from '../services/api';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [backgroundType, setBackgroundType] = useState('image');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      // First load from local storage for fast initial render
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme) setTheme(savedTheme);
    } catch (e) {
      console.log('Error loading theme:', e);
    } finally {
      setLoading(false);
    }
  };

  // Sync settings from server when user is authenticated
  const syncFromServer = useCallback(async () => {
    try {
      const settings = await api.get('/settings');
      if (settings) {
        if (settings.theme) {
          setTheme(settings.theme);
          await AsyncStorage.setItem('theme', settings.theme);
        }
        if (settings.background_url) {
          setBackgroundUrl(settings.background_url);
          setBackgroundType(settings.background_type || 'image');
        } else {
          setBackgroundUrl(null);
          setBackgroundType('image');
        }
      }
    } catch (e) {
      console.log('Error syncing settings from server:', e);
    }
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
    // Sync to server
    try {
      await api.patch('/settings/theme', { theme: newTheme });
    } catch (e) {
      console.log('Error syncing theme to server:', e);
    }
  };

  const updateBackground = async (url, type) => {
    setBackgroundUrl(url);
    setBackgroundType(type || 'image');
  };

  const colors = getThemeColors(theme);

  return (
    <ThemeContext.Provider value={{
      theme,
      colors,
      toggleTheme,
      backgroundUrl,
      backgroundType,
      updateBackground,
      syncFromServer,
      loading,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
