import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import GlassCard from './GlassCard';
import { useTheme } from '../context/ThemeContext';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function IdeaCard({ idea, onPress, onArchive, index }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Animated.View
      entering={FadeIn.delay(index * 50).duration(300)}
      layout={Layout.springify()}
    >
      <AnimatedTouchable
        style={animatedStyle}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <GlassCard style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name="bulb" 
                size={20} 
                color={colors.accent} 
              />
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {idea.title}
              </Text>
              <Text style={[styles.date, { color: colors.textTertiary }]}>
                {formatDate(idea.updated_at)}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.archiveButton}
              onPress={() => onArchive(idea)}
            >
              <Ionicons 
                name={idea.is_archived ? 'arrow-undo' : 'archive-outline'} 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
          
          {idea.content ? (
            <Text 
              style={[styles.content, { color: colors.textSecondary }]} 
              numberOfLines={2}
            >
              {idea.content}
            </Text>
          ) : null}
          
          {idea.role === 'collaborator' && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>Shared</Text>
            </View>
          )}
        </GlassCard>
      </AnimatedTouchable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 214, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  archiveButton: {
    padding: 8,
  },
  content: {
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000',
  },
});
