import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

export default function GlassCard({ children, style, intensity = 20 }) {
  const { theme, colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={intensity}
        tint={theme === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[
        styles.overlay,
        { 
          backgroundColor: colors.glass,
          borderColor: colors.glassBorder,
        }
      ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
});
