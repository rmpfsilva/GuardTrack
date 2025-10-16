import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.proforce.guardtrack',
  appName: 'GuardTrack',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // IMPORTANT: Replace with your actual Replit URL
    // Find it in your Replit webview URL (e.g., https://89026148-be12-4eb2-842c-9cd0afd3b68f-00-mtjsf5kyoq4z.picard.replit.dev)
    url: 'https://YOUR-REPLIT-URL.replit.dev',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563eb',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
