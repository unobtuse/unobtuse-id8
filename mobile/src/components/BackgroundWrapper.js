import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { Video, ResizeMode } from 'expo-video';
import { useTheme } from '../context/ThemeContext';

export default function BackgroundWrapper({ children }) {
  const { colors, backgroundUrl, backgroundType } = useTheme();

  if (!backgroundUrl) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  if (backgroundType === 'video') {
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
