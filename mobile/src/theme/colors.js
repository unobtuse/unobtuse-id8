// id8 Color Theme - Glassmorphic with Yellow Accent
// Only shades of white/black (0 saturation) + bright yellow accent

export const colors = {
  // Accent - Bright Yellow (lightbulb)
  accent: '#FFD600',
  accentLight: '#FFEA00',
  accentDark: '#FFC400',
  
  // Dark Theme
  dark: {
    background: '#000000',
    surface: 'rgba(255, 255, 255, 0.05)',
    surfaceElevated: 'rgba(255, 255, 255, 0.08)',
    glass: 'rgba(255, 255, 255, 0.1)',
    glassBorder: 'rgba(255, 255, 255, 0.2)',
    text: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textTertiary: 'rgba(255, 255, 255, 0.5)',
    divider: 'rgba(255, 255, 255, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Light Theme
  light: {
    background: '#FFFFFF',
    surface: 'rgba(0, 0, 0, 0.03)',
    surfaceElevated: 'rgba(0, 0, 0, 0.05)',
    glass: 'rgba(255, 255, 255, 0.7)',
    glassBorder: 'rgba(0, 0, 0, 0.1)',
    text: '#000000',
    textSecondary: 'rgba(0, 0, 0, 0.7)',
    textTertiary: 'rgba(0, 0, 0, 0.5)',
    divider: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(255, 255, 255, 0.5)',
  },
  
  // Status colors (minimal saturation variants)
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
};

export const getThemeColors = (theme) => ({
  ...colors[theme],
  accent: colors.accent,
  accentLight: colors.accentLight,
  accentDark: colors.accentDark,
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
});
