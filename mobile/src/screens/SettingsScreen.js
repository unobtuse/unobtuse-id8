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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import BackgroundWrapper from '../components/BackgroundWrapper';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { subscribeToPush, isPushSupported, checkPushSubscription } from '../services/pushNotifications';

export default function SettingsScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { colors, theme, toggleTheme, backgroundUrl, backgroundType, updateBackground } = useTheme();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const fileInputRef = useRef(null);
  
  const pushSupported = Platform.OS === 'web' && isPushSupported();

  useEffect(() => {
    // Check if notifications are actually subscribed (not just permission)
    const checkSubscription = async () => {
      if (Platform.OS === 'web') {
        const status = await checkPushSubscription();
        setNotificationsEnabled(status.subscribed && status.permission === 'granted');
        console.log('Push subscription status:', status);
      }
    };
    checkSubscription();
  }, []);

  const handleEnableNotifications = async () => {
    const result = await subscribeToPush();
    if (result.success) {
      setNotificationsEnabled(true);
      showToast('Notifications enabled!', 'success');
    } else {
      showToast(result.error || 'Failed to enable notifications', 'error');
    }
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      await api.post('/push/test');
      showToast('Test notification sent! Check your browser/device.', 'success');
    } catch (error) {
      showToast('Failed to send test notification', 'error');
    } finally {
      setTestingNotification(false);
    }
  };

  const handlePickBackground = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
    });

    if (!result.canceled) {
      await uploadBackgroundFile(result.assets[0]);
    }
  };

  const handleWebFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadBackgroundFile(file);
    }
  };

  const uploadBackgroundFile = async (file) => {
    setUploading(true);
    try {
      let fileToUpload;
      
      if (file instanceof File) {
        // Web file
        fileToUpload = file;
      } else {
        // React Native asset
        const isVideo = file.type === 'video' || file.mimeType?.startsWith('video/');
        fileToUpload = {
          uri: file.uri,
          name: isVideo ? 'background.mp4' : 'background.jpg',
          mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        };
      }
      
      const response = await api.uploadFile('/settings/background', fileToUpload);
      await updateBackground(response.background_url, response.background_type);
      
      if (Platform.OS === 'web') {
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload background', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await api.delete('/settings/background');
      await updateBackground(null, 'image');
      showToast('Background removed', 'success');
    } catch (error) {
      showToast('Failed to remove background', 'error');
    }
  };

  const handleSignOut = () => {
    setConfirmSignOut(true);
  };

  const confirmSignOutAction = () => {
    setConfirmSignOut(false);
    signOut();
  };

  return (
    <BackgroundWrapper>
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*,video/*"
          onChange={handleWebFileChange}
        />
      )}
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <GlassCard style={styles.profileCard}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <Text style={styles.avatarText}>
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.userName, { color: colors.text }]}>
                {user?.name}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {user?.email}
              </Text>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Appearance
            </Text>
            <GlassCard>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons 
                    name={theme === 'dark' ? 'moon' : 'sunny'} 
                    size={22} 
                    color={colors.accent} 
                  />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Dark Mode
                  </Text>
                </View>
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.surface, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.divider }]} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="image-outline" size={22} color={colors.accent} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Custom Background
                    </Text>
                    <Text style={[styles.settingHint, { color: colors.textTertiary }]}>
                      Image or video
                    </Text>
                  </View>
                </View>
              </View>
              
              {backgroundUrl && (
                <View style={styles.backgroundPreview}>
                  {backgroundType === 'video' ? (
                    Platform.OS === 'web' ? (
                      <video 
                        src={backgroundUrl} 
                        style={{ width: '100%', height: 120, borderRadius: 8, objectFit: 'cover' }}
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                    ) : (
                      <View style={[styles.backgroundImage, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="videocam" size={32} color={colors.textSecondary} />
                        <Text style={[styles.settingHint, { color: colors.textSecondary, marginTop: 4 }]}>
                          Video Background
                        </Text>
                      </View>
                    )
                  ) : (
                    <Image 
                      source={{ uri: backgroundUrl }} 
                      style={styles.backgroundImage}
                    />
                  )}
                </View>
              )}
              
              <View style={styles.backgroundActions}>
                <Button
                  title={backgroundUrl ? 'Change' : 'Choose Background'}
                  onPress={handlePickBackground}
                  loading={uploading}
                  style={{ flex: 1 }}
                />
                {backgroundUrl && (
                  <Button
                    title="Remove"
                    variant="outline"
                    onPress={handleRemoveBackground}
                    style={{ flex: 1, marginLeft: 8 }}
                  />
                )}
              </View>
            </GlassCard>
          </Animated.View>

          {Platform.OS === 'web' && (
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Notifications
              </Text>
              <GlassCard>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="notifications-outline" size={22} color={colors.accent} />
                    <View>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        Push Notifications
                      </Text>
                      <Text style={[styles.settingHint, { color: colors.textTertiary }]}>
                        {notificationsEnabled ? 'Enabled' : 'Disabled'}
                      </Text>
                    </View>
                  </View>
                  {!notificationsEnabled && pushSupported && (
                    <Button
                      title="Enable"
                      onPress={handleEnableNotifications}
                      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                    />
                  )}
                </View>
                
                {notificationsEnabled && (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Ionicons name="paper-plane-outline" size={22} color={colors.accent} />
                        <Text style={[styles.settingLabel, { color: colors.text }]}>
                          Test Notification
                        </Text>
                      </View>
                      <Button
                        title="Send Test"
                        variant="outline"
                        onPress={handleTestNotification}
                        loading={testingNotification}
                        style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                      />
                    </View>
                  </>
                )}
                
                {!pushSupported && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.settingHint, { color: colors.textTertiary }]}>
                      Add ID8 to your home screen to enable push notifications.
                    </Text>
                  </View>
                )}
              </GlassCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.delay(400).duration(400)}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              About
            </Text>
            <GlassCard>
              <View style={styles.aboutRow}>
                <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>
                  Version
                </Text>
                <Text style={[styles.aboutValue, { color: colors.text }]}>
                  1.0.0
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <TouchableOpacity style={styles.aboutRow}>
                <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>
                  GitHub
                </Text>
                <View style={styles.linkRow}>
                  <Text style={[styles.aboutValue, { color: colors.accent }]}>
                    unobtuse/unobtuse-id8
                  </Text>
                  <Ionicons name="open-outline" size={16} color={colors.accent} />
                </View>
              </TouchableOpacity>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.signOutSection}>
            <Button
              title="Sign Out"
              variant="outline"
              onPress={handleSignOut}
              icon={<Ionicons name="log-out-outline" size={20} color={colors.text} />}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {confirmSignOut && (
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Sign Out?</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.glassBorder }]}
                onPress={() => setConfirmSignOut(false)}
              >
                <Text style={[styles.confirmButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.signOutButton]}
                onPress={confirmSignOutAction}
              >
                <Text style={[styles.confirmButtonText, { color: '#fff' }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#000',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4,
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  backgroundPreview: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  backgroundActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signOutSection: {
    marginTop: 32,
    marginBottom: 40,
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
  signOutButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
