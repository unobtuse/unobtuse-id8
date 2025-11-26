import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import BackgroundWrapper from '../components/BackgroundWrapper';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AuthScreen() {
  const { signIn, loading, isReady } = useAuth();
  const { colors } = useTheme();

  return (
    <BackgroundWrapper>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Animated.View 
            entering={FadeIn.duration(800)}
            style={styles.logoContainer}
          >
            <View style={[styles.logoBackground, { backgroundColor: colors.glass }]}>
              <Ionicons name="bulb" size={80} color={colors.accent} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).duration(600)}>
            <Text style={[styles.title, { color: colors.text }]}>id8</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Capture ideas. Iterate. Collaborate.
            </Text>
          </Animated.View>

          <Animated.View 
            entering={FadeInUp.delay(500).duration(600)}
            style={styles.cardContainer}
          >
            <GlassCard style={styles.card} intensity={30}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Welcome
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                Sign in to start tracking your ideas and collaborate with others.
              </Text>
              
              <Button
                title="Continue with Google"
                onPress={signIn}
                loading={loading}
                disabled={!isReady}
                icon={<Ionicons name="logo-google" size={20} color="#000" />}
                style={styles.googleButton}
              />
            </GlassCard>
          </Animated.View>
        </View>

        <Animated.Text 
          entering={FadeIn.delay(800).duration(600)}
          style={[styles.footer, { color: colors.textTertiary }]}
        >
          By continuing, you agree to our Terms of Service
        </Animated.Text>
      </SafeAreaView>
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBackground: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  googleButton: {
    width: '100%',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 16,
  },
});
