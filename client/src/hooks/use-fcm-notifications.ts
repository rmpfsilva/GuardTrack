import { useEffect } from 'react';
import { isNativePlatform } from '@/lib/native';

async function registerFCMToken() {
  if (!isNativePlatform()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('[FCM] Push notification permission denied');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[FCM] Token received:', token.value);
      try {
        await fetch('/api/push/fcm-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: token.value }),
        });
      } catch (err) {
        console.error('[FCM] Failed to send token to server:', err);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[FCM] Registration error:', err.error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[FCM] Foreground notification received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[FCM] Notification tapped:', action);
      if (action.notification.data?.url) {
        window.location.href = action.notification.data.url;
      }
    });
  } catch (err) {
    console.error('[FCM] Push notification setup failed:', err);
  }
}

export function useFCMNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (isAuthenticated && isNativePlatform()) {
      registerFCMToken();
    }
  }, [isAuthenticated]);
}
