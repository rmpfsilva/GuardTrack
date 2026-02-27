# GuardTrack Android App — Build & Deploy Guide

## Overview
The GuardTrack Android app is a native wrapper around the web app using Capacitor.
It loads the production URL in a WebView and adds native capabilities:
- FCM push notifications (alongside existing Web Push for browser users)
- Native geolocation (higher accuracy, no browser permission prompt)
- Splash screen / app icon

---

## Prerequisites (do once on your local machine)

1. **Android Studio** — https://developer.android.com/studio
2. **Node.js 18+** — already installed
3. **Java 17+** — comes with Android Studio
4. **Firebase project** — https://console.firebase.google.com

---

## Step 1 — Clone / Pull the repo locally

```bash
git clone <your-repo-url>
cd guardtrack
npm install
```

---

## Step 2 — Set the Production URL in capacitor.config.ts

Open `capacitor.config.ts` and update the `server.url` field:

```ts
server: {
  url: 'https://guardtrack.live',  // or your Replit deployment URL
  ...
}
```

---

## Step 3 — Build the web app

```bash
npm run build
```

This generates `dist/public/` which Capacitor references as `webDir`.

---

## Step 4 — Add Android platform (first time only)

```bash
npx cap add android
```

This creates an `android/` directory in your project.

---

## Step 5 — Sync Capacitor

```bash
npx cap sync android
```

Run this every time you change `capacitor.config.ts` or install Capacitor plugins.

---

## Step 6 — Set up Firebase for FCM

1. Go to https://console.firebase.google.com
2. Create a new project named **GuardTrack**
3. Add an **Android app**:
   - Package name: `com.guardtrack.app`
   - App nickname: GuardTrack
4. Download `google-services.json`
5. Place it at: `android/app/google-services.json`

### Set Replit secrets for FCM server-side sending:

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click **Generate new private key** → download the JSON file
3. In Replit, set these secrets:
   - `FIREBASE_PROJECT_ID` = your Firebase project ID (e.g., `guardtrack-12345`)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = paste the entire JSON file contents
4. Install the auth library on the server:
   ```bash
   npm install google-auth-library
   ```

---

## Step 7 — Add App Icon & Splash Screen

Place your icon file (1024×1024 PNG) at `android/app/src/main/res/`:

```bash
# From project root, after npx cap add android:
npx @capacitor/assets generate --android
```

Or manually place resources following the Android mipmap convention.

---

## Step 8 — Open in Android Studio and Build

```bash
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to finish
2. **Build → Generate Signed Bundle/APK**
3. Choose **Android App Bundle (.aab)** for Google Play
4. Create a new keystore (keep the .jks file safe — you can't replace it):
   - Key alias: `guardtrack`
   - Validity: 25+ years
5. Build release `.aab`

---

## Step 9 — Google Play Upload

1. Go to https://play.google.com/console
2. Create a new app: **GuardTrack**
3. Package name: `com.guardtrack.app`
4. Upload your `.aab` to Internal Testing first
5. Complete store listing, screenshots, privacy policy
6. Promote to Production when ready

---

## FCM Architecture Notes

- **Web browser users** → existing VAPID Web Push (no change)
- **Android app users** → FCM via `@capacitor/push-notifications` plugin
- On first login in the native app, the guard is prompted for notification permission
- FCM token is stored in `users.fcm_token` column
- Server sends FCM notifications via Firebase HTTP v1 API (see `server/push-notifications.ts`)
- Both channels are independent — a guard with both web and native app gets notifications on whichever is active

---

## Permissions Added Automatically by Capacitor

The `@capacitor/push-notifications` and `@capacitor/geolocation` plugins automatically
add these to `AndroidManifest.xml` on `npx cap sync`:

- `RECEIVE_BOOT_COMPLETED`
- `VIBRATE`
- `POST_NOTIFICATIONS` (Android 13+)
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| WebView shows blank screen | Check `server.url` in capacitor.config.ts points to live URL |
| FCM token not stored | Ensure user is logged in before permission prompt fires |
| Geolocation denied | User must grant permission on first use — no fallback needed |
| Build fails on Gradle sync | File → Invalidate Caches → Restart in Android Studio |
| google-services.json not found | Must be at `android/app/google-services.json` |
