import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Image,
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
import { api } from '../services/api';

export default function SettingsScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { colors, theme, toggleTheme, backgroundUrl, updateBackground } = useTheme();
  const [uploading, setUploading] = useState(false);

  const handlePickBackground = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: true,
      aspect: [9, 16],
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        
        const response = await api.uploadFile('/settings/background', {
          uri: asset.uri,
          name: isVideo ? 'background.mp4' : 'background.jpg',
          mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        });
        
        await updateBackground(response.background_url, response.background_type);
        Alert.alert('Success', 'Background updated!');
      } catch (error) {
        Alert.alert('Error', 'Failed to upload background');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await api.delete('/settings/background');
      await updateBackground(null, 'image');
      Alert.alert('Success', 'Background removed');
    } catch (error) {
      Alert.alert('Error', 'Failed to remove background');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <BackgroundWrapper>
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
                  <Image 
                    source={{ uri: backgroundUrl }} 
                    style={styles.backgroundImage}
                  />
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

          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
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
});
