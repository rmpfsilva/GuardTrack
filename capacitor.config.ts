import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.guardtrack.app',
  appName: 'GuardTrack',
  webDir: 'dist/public',
  server: {
    // UPDATE THIS to your live production URL before building.
    // Once guardtrack.live is verified: https://guardtrack.live
    // Until then, use your Replit deployment URL from the Deploy tab.
    url: 'https://guardtrack.replit.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {},
  },
};

export default config;
