import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';
import BackgroundWrapper from '../components/BackgroundWrapper';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import IdeaCard from '../components/IdeaCard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export default function IdeasScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchIdeas = useCallback(async () => {
    try {
      const data = await api.get(`/ideas?archived=${showArchived}`);
      setIdeas(data);
    } catch (error) {
      console.error('Fetch ideas error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIdeas();
  };

  const handleCreateIdea = async () => {
    if (!newIdeaTitle.trim()) return;
    
    setCreating(true);
    try {
      const newIdea = await api.post('/ideas', { title: newIdeaTitle.trim() });
      setIdeas(prev => [newIdea, ...prev]);
      setNewIdeaTitle('');
      setShowNewIdea(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create idea');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (idea) => {
    try {
      await api.patch(`/ideas/${idea.id}/archive`, { archived: !idea.is_archived });
      fetchIdeas();
    } catch (error) {
      Alert.alert('Error', 'Failed to archive idea');
    }
  };

  const handleDelete = async (idea) => {
    Alert.alert(
      'Delete Idea',
      'Are you sure you want to permanently delete this idea?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/ideas/${idea.id}`);
              fetchIdeas();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        },
      ]
    );
  };

  const renderHeader = () => (
    <Animated.View entering={FadeInUp.duration(400)}>
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
        <Animated.View entering={FadeIn.duration(200)} style={styles.newIdeaContainer}>
          <GlassCard>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="What's your idea?"
              placeholderTextColor={colors.textTertiary}
              value={newIdeaTitle}
              onChangeText={setNewIdeaTitle}
              autoFocus
              onSubmitEditing={handleCreateIdea}
            />
            <View style={styles.newIdeaActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowNewIdea(false);
                  setNewIdeaTitle('');
                }}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Create"
                onPress={handleCreateIdea}
                loading={creating}
                disabled={!newIdeaTitle.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </Animated.View>
      )}
    </Animated.View>
  );

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
              onArchive={showArchived ? handleDelete : handleArchive}
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
});
