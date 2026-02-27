import webpush from 'web-push';
import type { PushSubscription } from '@shared/schema';

// FCM HTTP v1 API support for Android native push notifications.
// To enable: set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON env vars.
// FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(serviceAccountKeyFile)
async function getFCMAccessToken(): Promise<string | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!projectId || !serviceAccountJson) return null;

  try {
    // Dynamically import google-auth-library (install when ready: npm install google-auth-library)
    const { GoogleAuth } = await import('google-auth-library' as any);
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token?.token ?? null;
  } catch {
    return null;
  }
}

export async function sendFCMNotification(
  fcmToken: string,
  payload: { title: string; body: string; url?: string }
): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) return false;

  const accessToken = await getFCMAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title: payload.title, body: payload.body },
            data: payload.url ? { url: payload.url } : {},
            android: { priority: 'high' },
          },
        }),
      }
    );
    return response.ok;
  } catch (err) {
    console.error('[FCM] Failed to send FCM notification:', err);
    return false;
  }
}

// VAPID keys - should be set as environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
let VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@guardtrack.com';

// Ensure VAPID_SUBJECT has mailto: prefix
if (VAPID_SUBJECT && !VAPID_SUBJECT.startsWith('mailto:') && !VAPID_SUBJECT.startsWith('http')) {
  VAPID_SUBJECT = `mailto:${VAPID_SUBJECT}`;
}

// Configure web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('Warning: VAPID keys not configured. Push notifications will not work.');
}

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured, skipping push notification');
    return false;
  }

  try {
    // Parse keys from JSON string
    const keys = JSON.parse(subscription.keys);
    
    // Create push subscription object
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    };

    // Send notification
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    return true;
  } catch (error: any) {
    // Handle specific error codes
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription is no longer valid (Gone or Not Found)
      console.log(`Subscription no longer valid (${error.statusCode}): ${subscription.endpoint}`);
      // TODO: Remove invalid subscription from database
      return false;
    }
    
    console.error('Error sending push notification:', error);
    return false;
  }
}

export async function sendNotificationToAll(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload))
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - sent;

  return { sent, failed };
}

export async function sendNoticeNotification(
  subscriptions: PushSubscription[],
  noticeType: string,
  noticeTitle: string,
  noticeDate: string
): Promise<{ sent: number; failed: number }> {
  const typeLabel = noticeType === 'overtime' ? 'Overtime Opportunity' : 'Event';
  
  const payload: NotificationPayload = {
    title: `New ${typeLabel} Available!`,
    body: `${noticeTitle} - ${noticeDate}`,
    url: '/notices',
    tag: 'notice-' + Date.now(),
    requireInteraction: false,
  };

  return sendNotificationToAll(subscriptions, payload);
}
