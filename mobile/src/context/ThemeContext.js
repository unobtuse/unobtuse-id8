import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeColors } from '../theme/colors';

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
      const savedTheme = await AsyncStorage.getItem('theme');
      const savedBgUrl = await AsyncStorage.getItem('backgroundUrl');
      const savedBgType = await AsyncStorage.getItem('backgroundType');
      
      if (savedTheme) setTheme(savedTheme);
      if (savedBgUrl) setBackgroundUrl(savedBgUrl);
      if (savedBgType) setBackgroundType(savedBgType);
    } catch (e) {
      console.log('Error loading theme:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  };

  const updateBackground = async (url, type) => {
    setBackgroundUrl(url);
    setBackgroundType(type);
    if (url) {
      await AsyncStorage.setItem('backgroundUrl', url);
      await AsyncStorage.setItem('backgroundType', type);
    } else {
      await AsyncStorage.removeItem('backgroundUrl');
      await AsyncStorage.removeItem('backgroundType');
    }
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
