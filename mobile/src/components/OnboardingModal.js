import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { subscribeToPush, isPushSupported } from '../services/pushNotifications';
import { api } from '../services/api';

export default function OnboardingModal({ visible, onClose }) {
  const { colors, theme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const isIOS = Platform.OS === 'web' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = Platform.OS === 'web' && /Android/.test(navigator.userAgent);
  const isDesktop = Platform.OS === 'web' && !isIOS && !isAndroid;
  const pushSupported = Platform.OS === 'web' && isPushSupported();

  const handleEnableNotifications = async () => {
    setLoading(true);
    const result = await subscribeToPush();
    setNotificationsEnabled(result.success);
    setLoading(false);
  };

  const handleClose = async () => {
    try {
      await api.post('/push/onboarding-seen');
    } catch (e) {
      console.log('Failed to mark onboarding seen:', e);
    }
    onClose();
  };

  if (!visible) return null;

  const logoUrl = theme === 'dark' 
    ? '/id8-logo-darkmode.svg' 
    : '/id8-logo-lightmode.svg';

  return (
    <View style={styles.overlay}>
      <Animated.View 
        entering={FadeIn.duration(300)}
        style={[styles.modal, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}
      >
        {step === 1 && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.content}>
            {Platform.OS === 'web' && (
              <img src={logoUrl} style={{ width: 120, height: 45, marginBottom: 16 }} alt="id8" />
            )}
            <Text style={[styles.title, { color: colors.text }]}>Welcome to id8!</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Capture ideas, iterate on them, and collaborate with others.
            </Text>

            <View style={[styles.tipCard, { backgroundColor: `${colors.accent}15` }]}>
              <Ionicons name="phone-portrait-outline" size={24} color={colors.accent} />
              <View style={styles.tipContent}>
                <Text style={[styles.tipTitle, { color: colors.text }]}>Add to Home Screen</Text>
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                  {isIOS && "Tap the share button, then 'Add to Home Screen'"}
                  {isAndroid && "Tap the menu (⋮), then 'Add to Home Screen'"}
                  {isDesktop && "Click the install icon in your browser's address bar"}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={() => setStep(2)}
            >
              <Text style={styles.buttonText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}20` }]}>
              <Ionicons name="notifications" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Stay Updated</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Get notified when collaborators reply to your threads.
            </Text>

            {pushSupported ? (
              <View style={styles.notificationToggle}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="notifications-outline" size={22} color={colors.accent} />
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Enable Notifications
                  </Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => {
                    if (value) {
                      handleEnableNotifications();
                    } else {
                      setNotificationsEnabled(false);
                    }
                  }}
                  trackColor={{ false: colors.surface, true: colors.accent }}
                  thumbColor="#fff"
                  disabled={loading}
                />
              </View>
            ) : (
              <View style={[styles.notSupported, { backgroundColor: `${colors.surface}50` }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.notSupportedText, { color: colors.textSecondary }]}>
                  Push notifications require adding the app to your home screen first.
                </Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.buttonOutline, { borderColor: colors.glassBorder }]}
                onPress={() => setStep(1)}
              >
                <Ionicons name="arrow-back" size={18} color={colors.text} />
                <Text style={[styles.buttonOutlineText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: colors.accent, flex: 1, marginLeft: 12 }]}
                onPress={handleClose}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: 24,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  tipCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
    alignItems: 'flex-start',
  },
  tipContent: {
    marginLeft: 12,
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  notificationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  notSupported: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
    alignItems: 'flex-start',
    gap: 8,
  },
  notSupportedText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
  },
  buttonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  buttonOutlineText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
