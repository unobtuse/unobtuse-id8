import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { useTheme } from "../context/ThemeContext";

// BlurView is only available on native
const BlurView = Platform.OS !== "web" ? require("expo-blur").BlurView : View;

export default function GlassCard({ children, style, intensity = 20 }) {
  const { theme, colors } = useTheme();

  // Web fallback using Tailwind CSS backdrop-filter
  if (Platform.OS === "web") {
    // Convert React Native style to web style
    const flatStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : style;
    return (
      <div
        className="backdrop-blur-xl"
        style={{
          borderRadius: "16px",
          overflow: "hidden",
          backgroundColor: colors.glass,
          border: `1px solid ${colors.glassBorder}`,
          padding: "16px",
          ...flatStyle,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={intensity}
        tint={theme === "dark" ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: colors.glass,
            borderColor: colors.glassBorder,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
  },
  overlay: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
});
