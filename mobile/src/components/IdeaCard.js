import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
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

export default function IdeaCard({ idea, onPress, onArchive, onRestore, onDelete, index }) {
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
            <View style={[styles.iconContainer, idea.icon_url && styles.iconContainerCustom]}>
              {idea.icon_url ? (
                <Image 
                  source={{ uri: idea.icon_url }} 
                  style={styles.customIcon}
                />
              ) : (
                <Ionicons 
                  name="bulb" 
                  size={20} 
                  color={colors.accent} 
                />
              )}
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {idea.title}
              </Text>
              <Text style={[styles.date, { color: colors.textTertiary }]}>
                {formatDate(idea.updated_at)}
              </Text>
            </View>
            {!idea.is_archived && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => onArchive(idea)}
              >
                <Ionicons name="archive-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Archive</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {idea.is_archived && (
            <View style={styles.archivedActions}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.restoreButton, { backgroundColor: `${colors.accent}20` }]}
                onPress={() => onRestore(idea)}
              >
                <Ionicons name="arrow-undo" size={18} color={colors.accent} />
                <Text style={[styles.actionText, { color: colors.accent }]}>Restore to Active</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => onDelete(idea)}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          )}

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
    marginBottom: 16,
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
    overflow: 'hidden',
  },
  iconContainerCustom: {
    backgroundColor: 'transparent',
  },
  customIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  archivedActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  restoreButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
