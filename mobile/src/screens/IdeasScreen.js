import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';
import BackgroundWrapper from '../components/BackgroundWrapper';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import IdeaCard from '../components/IdeaCard';
import OnboardingModal from '../components/OnboardingModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { onSocketEvent } from '../services/socket';

const NewIdeaForm = memo(({ onSubmit, onCancel, colors }) => {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await onSubmit(title.trim());
      setTitle('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.newIdeaContainer}>
      <GlassCard>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="What's your idea?"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          autoFocus
          onSubmitEditing={handleSubmit}
        />
        <View style={styles.newIdeaActions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => {
              setTitle('');
              onCancel();
            }}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title="Create"
            onPress={handleSubmit}
            loading={creating}
            disabled={!title.trim()}
            style={{ flex: 1 }}
          />
        </View>
      </GlassCard>
    </Animated.View>
  );
});

export default function IdeasScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ visible: false, idea: null });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const hasAnimated = useRef(false);

  // Check if user has seen onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const settings = await api.get('/settings');
        if (!settings.has_seen_onboarding) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.log('Error checking onboarding:', e);
      }
    };
    checkOnboarding();
  }, []);

  const fetchIdeas = useCallback(async (isPolling = false) => {
    try {
      const data = await api.get(`/ideas?archived=${showArchived}`);
      // Only update state if data has changed (prevents re-renders during polling)
      setIdeas(prev => {
        const prevStr = JSON.stringify(prev);
        const newStr = JSON.stringify(data);
        return prevStr === newStr ? prev : data;
      });
    } catch (error) {
      console.error('Fetch ideas error:', error);
    } finally {
      if (!isPolling) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [showArchived]);

  useEffect(() => {
    fetchIdeas();
    
    // Listen for ideas updates via WebSocket
    const unsubUpdated = onSocketEvent('ideas:updated', () => {
      fetchIdeas(true);
    });
    
    return () => {
      unsubUpdated();
    };
  }, [fetchIdeas]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIdeas();
  };

  const handleCreateIdea = async (title) => {
    try {
      const newIdea = await api.post('/ideas', { title });
      setIdeas(prev => [newIdea, ...prev]);
      setShowNewIdea(false);
    } catch (error) {
      showToast('Failed to create idea', 'error');
      throw error;
    }
  };

  const handleArchive = async (idea) => {
    try {
      await api.patch(`/ideas/${idea.id}/archive`, { archived: !idea.is_archived });
      fetchIdeas();
    } catch (error) {
      showToast('Failed to archive idea', 'error');
    }
  };

  const handleDelete = (idea) => {
    setConfirmModal({ visible: true, idea });
  };

  const confirmDelete = async () => {
    const idea = confirmModal.idea;
    setConfirmModal({ visible: false, idea: null });
    try {
      await api.delete(`/ideas/${idea.id}`);
      fetchIdeas();
      showToast('Idea deleted', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to delete idea', 'error');
    }
  };

  const renderHeader = () => {
    const shouldAnimate = !hasAnimated.current;
    if (shouldAnimate) hasAnimated.current = true;
    
    return (
    <Animated.View entering={shouldAnimate ? FadeInUp.duration(400) : undefined}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            Hello, {user?.name?.split(' ')[0]}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {showArchived ? 'Archived Ideas' : 'Your Ideas'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Invitations')}
          >
            <Ionicons name="mail-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            !showArchived && { backgroundColor: colors.accent },
          ]}
          onPress={() => setShowArchived(false)}
        >
          <Text style={[
            styles.tabText,
            { color: !showArchived ? '#000' : colors.textSecondary }
          ]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            showArchived && { backgroundColor: colors.accent },
          ]}
          onPress={() => setShowArchived(true)}
        >
          <Text style={[
            styles.tabText,
            { color: showArchived ? '#000' : colors.textSecondary }
          ]}>
            Archived
          </Text>
        </TouchableOpacity>
      </View>

      {showNewIdea && (
        <NewIdeaForm 
          onSubmit={handleCreateIdea}
          onCancel={() => setShowNewIdea(false)}
          colors={colors}
        />
      )}
    </Animated.View>
  );
  };

  const renderEmpty = () => (
    <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.empty}>
      <Ionicons 
        name={showArchived ? 'archive-outline' : 'bulb-outline'} 
        size={64} 
        color={colors.textTertiary} 
      />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        {showArchived ? 'No archived ideas' : 'No ideas yet'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
        {showArchived 
          ? 'Archived ideas will appear here' 
          : 'Tap the button below to capture your first idea'}
      </Text>
    </Animated.View>
  );

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          data={ideas}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <IdeaCard
              idea={item}
              index={index}
              onPress={() => navigation.navigate('IdeaDetail', { ideaId: item.id })}
              onArchive={handleArchive}
              onRestore={handleArchive}
              onDelete={handleDelete}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!loading && renderEmpty}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
        />

        {!showArchived && !showNewIdea && (
          <Animated.View 
            entering={FadeIn.duration(300)}
            style={styles.fabContainer}
          >
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: colors.accent }]}
              onPress={() => setShowNewIdea(true)}
            >
              <Ionicons name="add" size={32} color="#000" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>

      {confirmModal.visible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Delete Idea?</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              This will permanently delete "{confirmModal.idea?.title}". This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.glassBorder }]}
                onPress={() => setConfirmModal({ visible: false, idea: null })}
              >
                <Text style={[styles.confirmButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.deleteButton]}
                onPress={confirmDelete}
              >
                <Text style={[styles.confirmButtonText, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <OnboardingModal 
        visible={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
      />
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  newIdeaContainer: {
    marginBottom: 16,
  },
  input: {
    fontSize: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  newIdeaActions: {
    flexDirection: 'row',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD600',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmModal: {
    borderRadius: 16,
    padding: 24,
    maxWidth: 320,
    width: '90%',
    borderWidth: 1,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
