import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import BackgroundWrapper from '../components/BackgroundWrapper';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export default function InvitationsScreen({ navigation }) {
  const { colors } = useTheme();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const data = await api.get('/collaborators/invitations');
      setInvitations(data);
    } catch (error) {
      console.error('Fetch invitations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (id, accept) => {
    try {
      await api.patch(`/collaborators/${id}/respond`, { accept });
      setInvitations(prev => prev.filter(inv => inv.id !== id));
      Alert.alert('Success', accept ? 'Invitation accepted!' : 'Invitation declined');
    } catch (error) {
      Alert.alert('Error', 'Failed to respond to invitation');
    }
  };

  const renderInvitation = ({ item, index }) => (
    <Animated.View entering={FadeInUp.delay(index * 100).duration(400)}>
      <GlassCard style={styles.invitationCard}>
        <View style={styles.invitationHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors.accent}20` }]}>
            <Ionicons name="bulb" size={24} color={colors.accent} />
          </View>
          <View style={styles.invitationInfo}>
            <Text style={[styles.ideaTitle, { color: colors.text }]} numberOfLines={1}>
              {item.idea_title}
            </Text>
            <Text style={[styles.inviterName, { color: colors.textSecondary }]}>
              Invited by {item.inviter_name}
            </Text>
          </View>
        </View>
        
        <View style={styles.actions}>
          <Button
            title="Decline"
            variant="outline"
            onPress={() => handleRespond(item.id, false)}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title="Accept"
            onPress={() => handleRespond(item.id, true)}
            style={{ flex: 1 }}
          />
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderEmpty = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.empty}>
      <Ionicons name="mail-open-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        No pending invitations
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
        When someone invites you to collaborate on an idea, it will appear here.
      </Text>
    </Animated.View>
  );

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Invitations</Text>
          <View style={{ width: 44 }} />
        </View>

        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          renderItem={renderInvitation}
          ListEmptyComponent={!loading && renderEmpty}
          contentContainerStyle={styles.list}
        />
      </SafeAreaView>
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  invitationCard: {
    marginBottom: 12,
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  ideaTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  inviterName: {
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
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
    lineHeight: 20,
  },
});
