import { Platform } from 'react-native';
import { api } from './api';

const isPushSupported = () => {
  return Platform.OS === 'web' && 
    'serviceWorker' in navigator && 
    'PushManager' in window &&
    'Notification' in window;
};

const registerServiceWorker = async () => {
  if (!isPushSupported()) return null;
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered');
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

const getVapidPublicKey = async () => {
  try {
    const response = await api.get('/push/vapid-public-key');
    return response.publicKey;
  } catch (error) {
    console.error('Failed to get VAPID key:', error);
    return null;
  }
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const subscribeToPush = async () => {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return { success: false, reason: 'not_supported' };
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return { success: false, reason: 'permission_denied' };
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      return { success: false, reason: 'sw_failed' };
    }

    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      return { success: false, reason: 'no_vapid_key' };
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to server
    await api.post('/push/subscribe', { subscription: subscription.toJSON() });
    
    console.log('Push subscription successful');
    return { success: true, subscription };
  } catch (error) {
    console.error('Push subscription failed:', error);
    return { success: false, reason: 'error', error };
  }
};

const unsubscribeFromPush = async () => {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
    }
    
    console.log('Push unsubscribed');
    return { success: true };
  } catch (error) {
    console.error('Push unsubscribe failed:', error);
    return { success: false, error };
  }
};

const checkPushSubscription = async () => {
  if (!isPushSupported()) return { subscribed: false, supported: false };

  try {
    // Add timeout to prevent hanging if service worker isn't ready
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Service worker ready timeout')), 3000)
    );
    
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      timeoutPromise
    ]);
    
    const subscription = await registration.pushManager.getSubscription();
    return { 
      subscribed: !!subscription, 
      supported: true,
      permission: Notification.permission 
    };
  } catch (error) {
    return { subscribed: false, supported: true, error };
  }
};

export {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  checkPushSubscription,
  registerServiceWorker,
};
