import React, { useEffect } from 'react';
import { View, StyleSheet, ImageBackground, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Video is only available on native platforms
const ExpoVideo = Platform.OS !== 'web' ? require('expo-video') : null;
const Video = ExpoVideo?.Video;
const ResizeMode = ExpoVideo?.ResizeMode;

// Initialize UnicornStudio on web (with error handling for iOS)
const initUnicornStudio = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.UnicornStudio) {
    try {
      window.UnicornStudio = { isInitialized: false };
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.34/dist/unicornStudio.umd.js';
      script.onload = () => {
        try {
          if (!window.UnicornStudio.isInitialized && window.UnicornStudio.init) {
            window.UnicornStudio.init();
            window.UnicornStudio.isInitialized = true;
          }
        } catch (e) {
          console.log('UnicornStudio init error:', e);
        }
      };
      script.onerror = () => {
        console.log('UnicornStudio failed to load');
      };
      document.head.appendChild(script);
    } catch (e) {
      console.log('UnicornStudio setup error:', e);
    }
  }
};

export default function BackgroundWrapper({ children }) {
  const { colors, backgroundUrl, backgroundType, theme } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'web') {
      initUnicornStudio();
    }
  }, []);

  // Web default background with UnicornStudio
  if (Platform.OS === 'web' && !backgroundUrl) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <div 
          data-us-project="bmaMERjX2VZDtPrh4Zwx" 
          className={`absolute w-full h-full left-0 top-0 -z-10 ${theme === 'light' ? 'invert' : ''}`}
          style={{ position: 'absolute', width: '100%', height: '100%', left: 0, top: 0, zIndex: -1 }}
        />
        <div 
          style={{ 
            position: 'absolute', 
            width: '100%', 
            height: '100%', 
            left: 0, 
            top: 0, 
            zIndex: -1,
            backgroundColor: '#ffd600',
            mixBlendMode: 'color',
            pointerEvents: 'none'
          }}
        />
        {children}
      </View>
    );
  }

  if (!backgroundUrl) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  if (backgroundType === 'video' && Platform.OS !== 'web' && Video) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Video
          source={{ uri: backgroundUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
        />
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
        {children}
      </View>
    );
  }

  // For web video backgrounds, use HTML5 video
  if (backgroundType === 'video' && Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <video
          src={backgroundUrl}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          autoPlay
          loop
          muted
          playsInline
        />
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
        {children}
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: backgroundUrl }}
      style={[styles.container, { backgroundColor: colors.background }]}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
