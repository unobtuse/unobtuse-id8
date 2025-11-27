import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInUp } from 'react-native-reanimated';
import BackgroundWrapper from '../components/BackgroundWrapper';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { subscribeToPush, checkPushSubscription, isPushSupported } from '../services/pushNotifications';

export default function ThreadSettingsScreen({ route, navigation }) {
  const { ideaId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const [idea, setIdea] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ visible: false, type: null, item: null });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const iconInputRef = useRef(null);
  const bgInputRef = useRef(null);

  const isOwner = idea?.user_id === user?.id;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ideaData, collabData, notifData] = await Promise.all([
        api.get(`/ideas/${ideaId}`),
        api.get(`/collaborators/idea/${ideaId}`).catch(() => []),
        api.get(`/collaborators/idea/${ideaId}/notifications`).catch(() => ({ notifications_enabled: true })),
      ]);
      setIdea(ideaData);
      setCollaborators(collabData);
      
      // Check actual push subscription status on web
      if (Platform.OS === 'web') {
        const pushStatus = await checkPushSubscription();
        // Only show enabled if both: setting is enabled AND actually subscribed
        setNotificationsEnabled(
          notifData.notifications_enabled !== false && 
          pushStatus.subscribed && 
          pushStatus.permission === 'granted'
        );
      } else {
        setNotificationsEnabled(notifData.notifications_enabled !== false);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const [iosModal, setIosModal] = useState(false);

  const isIOS = () => {
    if (Platform.OS !== 'web') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  const isPWA = () => {
    if (Platform.OS !== 'web') return true;
    return window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true;
  };

  const toggleNotifications = async (enabled) => {
    if (enabled && Platform.OS === 'web') {
      // Check if iOS and not PWA
      if (isIOS() && !isPWA()) {
        setIosModal(true);
        return;
      }

      // Subscribe to push notifications (this handles permission request internally)
      const result = await subscribeToPush();
      if (!result.success) {
        console.log('Push subscription failed:', result.reason);
        return;
      }
    }

    setNotificationsEnabled(enabled);
    try {
      await api.patch(`/collaborators/idea/${ideaId}/notifications`, { enabled });
    } catch (error) {
      console.error('Toggle notifications error:', error);
      setNotificationsEnabled(!enabled); // Revert on error
    }
  };

  const handleIconPress = () => {
    if (!isOwner) return;
    if (Platform.OS === 'web') {
      iconInputRef.current?.click();
    } else {
      pickIconNative();
    }
  };

  const pickIconNative = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      uploadIcon(result.assets[0]);
    }
  };

  const handleIconWebChange = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadIcon(file);
  };

  const uploadIcon = async (file) => {
    setUploadingIcon(true);
    try {
      await api.uploadFile(`/ideas/${ideaId}/icon`, file);
      fetchData();
    } catch (error) {
      console.error('Failed to upload icon:', error);
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const removeIcon = async () => {
    try {
      await api.delete(`/ideas/${ideaId}/icon`);
      fetchData();
    } catch (error) {
      console.error('Failed to remove icon:', error);
    }
  };

  // Background functions
  const handleBgPress = () => {
    if (Platform.OS === 'web') {
      bgInputRef.current?.click();
    } else {
      pickBgNative();
    }
  };

  const pickBgNative = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
    });
    if (!result.canceled) {
      uploadBg(result.assets[0]);
    }
  };

  const handleBgWebChange = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadBg(file);
  };

  const uploadBg = async (file) => {
    setUploadingBg(true);
    try {
      await api.uploadFile(`/ideas/${ideaId}/background`, file);
      fetchData();
    } catch (error) {
      console.error('Failed to upload background:', error);
    } finally {
      setUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  const removeBg = async () => {
    try {
      await api.delete(`/ideas/${ideaId}/background`);
      fetchData();
    } catch (error) {
      console.error('Failed to remove background:', error);
    }
  };

  const canChangeBg = isOwner || collaborators.find(c => c.user_id === user?.id && c.can_change_background);

  const toggleMemberInvites = async (value) => {
    try {
      await api.patch(`/ideas/${ideaId}/settings`, { allow_member_invites: value });
      setIdea(prev => ({ ...prev, allow_member_invites: value }));
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const toggleCanInvite = async (collabId, value) => {
    try {
      await api.patch(`/collaborators/${collabId}/permissions`, { can_invite: value });
      setCollaborators(prev => 
        prev.map(c => c.id === collabId ? { ...c, can_invite: value } : c)
      );
    } catch (error) {
      console.error('Failed to update permissions:', error);
    }
  };

  const toggleCanChangeBg = async (collabId, value) => {
    try {
      await api.patch(`/collaborators/${collabId}/permissions`, { can_change_background: value });
      setCollaborators(prev => 
        prev.map(c => c.id === collabId ? { ...c, can_change_background: value } : c)
      );
    } catch (error) {
      console.error('Failed to update permissions:', error);
    }
  };

  const handleRemove = (item, type) => {
    setConfirmModal({ visible: true, type, item });
  };

  const confirmRemove = async () => {
    const { type, item } = confirmModal;
    setConfirmModal({ visible: false, type: null, item: null });
    
    try {
      await api.delete(`/collaborators/${item.id}`);
      setCollaborators(prev => prev.filter(c => c.id !== item.id));
    } catch (error) {
      console.error('Failed to remove:', error);
    }
  };

  const pendingInvites = collaborators.filter(c => c.status === 'pending');
  const acceptedMembers = collaborators.filter(c => c.status === 'accepted');

  if (loading) {
    return (
      <BackgroundWrapper>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        </SafeAreaView>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper>
      {Platform.OS === 'web' && (
        <>
          <input
            type="file"
            ref={iconInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleIconWebChange}
          />
          <input
            type="file"
            ref={bgInputRef}
            style={{ display: 'none' }}
            accept="image/*,video/*"
            onChange={handleBgWebChange}
          />
        </>
      )}
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Thread Settings</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isOwner && (
            <Animated.View entering={FadeInUp.delay(100).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Thread Icon
              </Text>
              <GlassCard>
                <View style={styles.iconSection}>
                  <TouchableOpacity 
                    onPress={handleIconPress}
                    disabled={uploadingIcon}
                    style={[styles.iconPreview, { backgroundColor: `${colors.accent}20` }]}
                  >
                    {uploadingIcon ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : idea?.icon_url ? (
                      <Image source={{ uri: idea.icon_url }} style={styles.iconImage} />
                    ) : (
                      <Ionicons name="bulb" size={32} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                  <View style={styles.iconActions}>
                    <Button title="Change Icon" onPress={handleIconPress} style={{ flex: 1 }} />
                    {idea?.icon_url && (
                      <Button 
                        title="Remove" 
                        variant="outline" 
                        onPress={removeIcon}
                        style={{ flex: 1, marginLeft: 8 }}
                      />
                    )}
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {canChangeBg && (
            <Animated.View entering={FadeInUp.delay(150).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Thread Background
              </Text>
              <GlassCard>
                <View style={styles.bgSection}>
                  <TouchableOpacity 
                    onPress={handleBgPress}
                    disabled={uploadingBg}
                    style={[styles.bgPreview, { backgroundColor: colors.surface }]}
                  >
                    {uploadingBg ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : idea?.background_url ? (
                      <Image source={{ uri: idea.background_url }} style={styles.bgImage} />
                    ) : (
                      <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
                    )}
                  </TouchableOpacity>
                  <Text style={[styles.bgHint, { color: colors.textTertiary }]}>
                    Image or video background for this thread
                  </Text>
                  <View style={styles.bgActions}>
                    <Button 
                      title={idea?.background_url ? "Change" : "Set Background"} 
                      onPress={handleBgPress} 
                      loading={uploadingBg}
                      style={{ flex: 1 }} 
                    />
                    {idea?.background_url && (
                      <Button 
                        title="Remove" 
                        variant="outline" 
                        onPress={removeBg}
                        style={{ flex: 1, marginLeft: 8 }}
                      />
                    )}
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Notifications
            </Text>
            <GlassCard>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="notifications-outline" size={22} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Push Notifications
                    </Text>
                    <Text style={[styles.settingHint, { color: colors.textTertiary }]}>
                      Get notified when there are new replies
                    </Text>
                  </View>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: colors.surface, true: colors.accent }}
                  thumbColor="#000"
                />
              </View>
            </GlassCard>
          </Animated.View>

          {isOwner && (
            <Animated.View entering={FadeInUp.delay(250).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Invite Permissions
              </Text>
              <GlassCard>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="people-outline" size={22} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        Allow Members to Invite
                      </Text>
                      <Text style={[styles.settingHint, { color: colors.textTertiary }]}>
                        Let participants invite others to this thread
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={idea?.allow_member_invites || false}
                    onValueChange={toggleMemberInvites}
                    trackColor={{ false: colors.surface, true: colors.accent }}
                    thumbColor="#000"
                  />
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {pendingInvites.length > 0 && (
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Pending Invitations ({pendingInvites.length})
              </Text>
              <GlassCard>
                {pendingInvites.map((collab, index) => (
                  <View key={collab.id}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                    <View style={styles.memberRow}>
                      <View style={[styles.memberAvatar, { backgroundColor: colors.surface }]}>
                        <Ionicons name="time-outline" size={18} color={colors.textTertiary} />
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: colors.text }]}>
                          {collab.name || collab.invite_email}
                        </Text>
                        <Text style={[styles.memberStatus, { color: colors.textTertiary }]}>
                          Pending
                        </Text>
                      </View>
                      {isOwner && (
                        <TouchableOpacity 
                          onPress={() => handleRemove(collab, 'invite')}
                          style={styles.removeButton}
                        >
                          <Ionicons name="close-circle" size={22} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </GlassCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.delay(400).duration(400)}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Participants ({acceptedMembers.length + 1})
            </Text>
            <GlassCard>
              <View style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: colors.accent }]}>
                  {idea?.owner_avatar ? (
                    <Image source={{ uri: idea.owner_avatar }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {idea?.owner_name?.charAt(0)?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {idea?.owner_name}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.accent }]}>
                    Owner
                  </Text>
                </View>
              </View>

              {acceptedMembers.map((collab) => (
                <View key={collab.id}>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                  <View style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: colors.surface }]}>
                      {collab.avatar_url ? (
                        <Image source={{ uri: collab.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <Text style={[styles.avatarText, { color: colors.text }]}>
                          {collab.name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.text }]}>
                        {collab.name || collab.email}
                      </Text>
                      <Text style={[styles.memberRole, { color: colors.textTertiary }]}>
                        {collab.role}
                      </Text>
                    </View>
                    {isOwner && (
                      <View style={styles.permToggles}>
                        {idea?.allow_member_invites && (
                          <View style={styles.permToggle}>
                            <Text style={[styles.permLabel, { color: colors.textTertiary }]}>
                              Invite
                            </Text>
                            <Switch
                              value={collab.can_invite || false}
                              onValueChange={(v) => toggleCanInvite(collab.id, v)}
                              trackColor={{ false: colors.surface, true: colors.accent }}
                              thumbColor="#000"
                              style={{ transform: [{ scale: 0.7 }] }}
                            />
                          </View>
                        )}
                        <View style={styles.permToggle}>
                          <Text style={[styles.permLabel, { color: colors.textTertiary }]}>
                            BG
                          </Text>
                          <Switch
                            value={collab.can_change_background || false}
                            onValueChange={(v) => toggleCanChangeBg(collab.id, v)}
                            trackColor={{ false: colors.surface, true: colors.accent }}
                            thumbColor="#000"
                            style={{ transform: [{ scale: 0.7 }] }}
                          />
                        </View>
                      </View>
                    )}
                    {isOwner && (
                      <TouchableOpacity 
                        onPress={() => handleRemove(collab, 'member')}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={22} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </GlassCard>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {confirmModal.visible && (
        Platform.OS === 'web' ? (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setConfirmModal({ visible: false, type: null, item: null })}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.glass,
                borderRadius: 16,
                padding: 24,
                maxWidth: 320,
                width: '90%',
                border: `1px solid ${colors.glassBorder}`,
              }}
            >
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                {confirmModal.type === 'invite' ? 'Revoke Invitation?' : 'Remove Participant?'}
              </Text>
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                {confirmModal.type === 'invite' 
                  ? `This will cancel the invitation to ${confirmModal.item?.name || confirmModal.item?.invite_email}.`
                  : `This will remove ${confirmModal.item?.name || confirmModal.item?.email} from this thread.`
                }
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity 
                  style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.glassBorder }]}
                  onPress={() => setConfirmModal({ visible: false, type: null, item: null })}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmButton, styles.deleteButtonStyle]}
                  onPress={confirmRemove}
                >
                  <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                    {confirmModal.type === 'invite' ? 'Revoke' : 'Remove'}
                  </Text>
                </TouchableOpacity>
              </View>
            </div>
          </div>
        ) : (
          <Modal transparent visible={confirmModal.visible} animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.confirmModal, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  {confirmModal.type === 'invite' ? 'Revoke Invitation?' : 'Remove Participant?'}
                </Text>
                <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                  {confirmModal.type === 'invite' 
                    ? `This will cancel the invitation to ${confirmModal.item?.name || confirmModal.item?.invite_email}.`
                    : `This will remove ${confirmModal.item?.name || confirmModal.item?.email} from this thread.`
                  }
                </Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity 
                    style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.glassBorder }]}
                    onPress={() => setConfirmModal({ visible: false, type: null, item: null })}
                  >
                    <Text style={[styles.confirmButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.confirmButton, styles.deleteButtonStyle]}
                    onPress={confirmRemove}
                  >
                    <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                      {confirmModal.type === 'invite' ? 'Revoke' : 'Remove'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )
      )}

      {iosModal && Platform.OS === 'web' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIosModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.glass,
              borderRadius: 16,
              padding: 24,
              maxWidth: 340,
              width: '90%',
              border: `1px solid ${colors.glassBorder}`,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="phone-portrait-outline" size={48} color={colors.accent} />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.text, textAlign: 'center' }]}>
              Add to Home Screen
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary, textAlign: 'center' }]}>
              To receive push notifications on iPhone, you need to add ID8 to your home screen.
            </Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  <Text style={{ fontWeight: '600' }}>1.</Text> Tap the <Text style={{ fontWeight: '600' }}>Share</Text> button
                </Text>
                <Ionicons name="share-outline" size={16} color={colors.accent} style={{ marginHorizontal: 4 }} />
                <Text style={{ color: colors.text, fontSize: 14 }}>at the bottom of Safari</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 14 }}>
                <Text style={{ fontWeight: '600' }}>2.</Text> Scroll down and tap <Text style={{ fontWeight: '600' }}>"Add to Home Screen"</Text>
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.confirmButton, { backgroundColor: colors.accent, width: '100%' }]}
              onPress={() => setIosModal(false)}
            >
              <Text style={[styles.confirmButtonText, { color: '#000' }]}>Got it</Text>
            </TouchableOpacity>
          </div>
        </div>
      )}
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconSection: {
    alignItems: 'center',
  },
  iconPreview: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  iconImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  iconActions: {
    flexDirection: 'row',
    width: '100%',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
  },
  settingHint: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  memberStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  bgSection: {
    alignItems: 'center',
  },
  bgPreview: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  bgImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  bgHint: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  bgActions: {
    flexDirection: 'row',
    width: '100%',
  },
  permToggles: {
    flexDirection: 'row',
    gap: 4,
  },
  permToggle: {
    alignItems: 'center',
  },
  permLabel: {
    fontSize: 9,
    marginBottom: -4,
  },
  removeButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
  deleteButtonStyle: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
