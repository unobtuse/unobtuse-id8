import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import BackgroundWrapper from '../components/BackgroundWrapper';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

export default function IdeaDetailScreen({ route, navigation }) {
  const { ideaId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const [idea, setIdea] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newReply, setNewReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [ideaData, repliesData] = await Promise.all([
        api.get(`/ideas/${ideaId}`),
        api.get(`/replies/idea/${ideaId}`),
      ]);
      setIdea(ideaData);
      setReplies(repliesData);
    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('Error', 'Failed to load idea');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendReply = async () => {
    if (!newReply.trim() && !selectedFile) return;

    setSending(true);
    try {
      let reply;
      if (newReply.trim()) {
        reply = await api.post('/replies', { 
          ideaId, 
          content: newReply.trim() 
        });
      }

      if (selectedFile) {
        await api.uploadFile('/attachments/upload', selectedFile, {
          ideaId,
          replyId: reply?.id,
        });
      }

      setNewReply('');
      setSelectedFile(null);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setSelectedFile({
        uri: asset.uri,
        name: asset.fileName || 'image.jpg',
        mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
      });
    }
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setSelectedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    try {
      await api.post('/collaborators/invite', {
        ideaId,
        email: inviteEmail.trim(),
        role: 'contributor',
      });
      Alert.alert('Success', 'Invitation sent!');
      setInviteEmail('');
      setShowInvite(false);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderReply = ({ item, index }) => {
    const isOwn = item.user_id === user?.id;
    
    return (
      <Animated.View 
        entering={FadeInUp.delay(index * 50).duration(300)}
        style={[styles.replyContainer, isOwn && styles.ownReply]}
      >
        <GlassCard style={[styles.replyCard, isOwn && styles.ownReplyCard]}>
          <View style={styles.replyHeader}>
            {item.author_avatar ? (
              <Image source={{ uri: item.author_avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarText}>
                  {item.author_name?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.replyMeta}>
              <Text style={[styles.authorName, { color: colors.text }]}>
                {item.author_name}
              </Text>
              <Text style={[styles.replyTime, { color: colors.textTertiary }]}>
                {new Date(item.created_at).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
          </View>
          <Text style={[styles.replyContent, { color: colors.text }]}>
            {item.content}
          </Text>
          {item.attachments?.filter(Boolean).length > 0 && (
            <View style={styles.attachments}>
              {item.attachments.filter(Boolean).map((att) => (
                <View key={att.id} style={[styles.attachment, { borderColor: colors.glassBorder }]}>
                  <Ionicons name="attach" size={14} color={colors.textSecondary} />
                  <Text style={[styles.attachmentName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {att.file_name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </GlassCard>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Animated.View entering={FadeIn.duration(400)}>
        <GlassCard intensity={40}>
          <View style={styles.ideaHeader}>
            <View style={[styles.bulbIcon, { backgroundColor: `${colors.accent}20` }]}>
              <Ionicons name="bulb" size={28} color={colors.accent} />
            </View>
            <Text style={[styles.ideaTitle, { color: colors.text }]}>
              {idea?.title}
            </Text>
          </View>
          {idea?.content && (
            <Text style={[styles.ideaContent, { color: colors.textSecondary }]}>
              {idea.content}
            </Text>
          )}
          <View style={styles.ideaMeta}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              by {idea?.owner_name} • {new Date(idea?.created_at).toLocaleDateString()}
            </Text>
            {idea?.user_id === user?.id && (
              <TouchableOpacity 
                style={styles.inviteButton}
                onPress={() => setShowInvite(!showInvite)}
              >
                <Ionicons name="person-add-outline" size={18} color={colors.accent} />
                <Text style={[styles.inviteText, { color: colors.accent }]}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>
      </Animated.View>

      {showInvite && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.inviteSection}>
          <GlassCard>
            <Text style={[styles.inviteTitle, { color: colors.text }]}>
              Invite Collaborator
            </Text>
            <TextInput
              style={[styles.inviteInput, { color: colors.text, borderColor: colors.glassBorder }]}
              placeholder="Enter email address"
              placeholderTextColor={colors.textTertiary}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button title="Send Invite" onPress={handleInvite} />
          </GlassCard>
        </Animated.View>
      )}

      <Text style={[styles.repliesTitle, { color: colors.textSecondary }]}>
        Thread ({replies.length})
      </Text>
    </View>
  );

  if (loading) {
    return (
      <BackgroundWrapper>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Ionicons name="bulb" size={48} color={colors.accent} />
          </View>
        </SafeAreaView>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
            {idea?.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView 
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={replies}
            keyExtractor={(item) => item.id}
            renderItem={renderReply}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.list}
          />

          <View style={[styles.inputContainer, { borderTopColor: colors.glassBorder }]}>
            {selectedFile && (
              <View style={[styles.filePreview, { backgroundColor: colors.surface }]}>
                <Ionicons name="document" size={16} color={colors.accent} />
                <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                  {selectedFile.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <TouchableOpacity onPress={handlePickImage} style={styles.attachButton}>
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickDocument} style={styles.attachButton}>
                <Ionicons name="attach" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.replyInput, { color: colors.text, backgroundColor: colors.surface }]}
                placeholder="Add to the thread..."
                placeholderTextColor={colors.textTertiary}
                value={newReply}
                onChangeText={setNewReply}
                multiline
              />
              <TouchableOpacity 
                onPress={handleSendReply}
                disabled={(!newReply.trim() && !selectedFile) || sending}
                style={[
                  styles.sendButton, 
                  { backgroundColor: colors.accent },
                  (!newReply.trim() && !selectedFile) && styles.sendButtonDisabled,
                ]}
              >
                <Ionicons name="send" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  list: {
    padding: 16,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 16,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bulbIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ideaTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  ideaContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  ideaMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inviteText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inviteSection: {
    marginTop: 12,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inviteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  repliesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  replyContainer: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  ownReply: {
    alignSelf: 'flex-end',
  },
  replyCard: {
  },
  ownReplyCard: {
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  replyMeta: {
    marginLeft: 8,
    flex: 1,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
  },
  replyTime: {
    fontSize: 11,
  },
  replyContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  attachments: {
    marginTop: 8,
    gap: 4,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  attachmentName: {
    fontSize: 12,
    flex: 1,
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    padding: 8,
  },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
