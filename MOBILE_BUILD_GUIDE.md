# GuardTrack Mobile App Build Guide

## Overview
GuardTrack now supports **native Android and iOS apps** using Capacitor. Your web app continues to work in browsers while also being available as mobile apps on Google Play Store and Apple App Store.

## ✅ What's Already Set Up
- ✅ Capacitor configured
- ✅ Android platform added
- ✅ iOS platform added
- ✅ Native plugins installed:
  - Geolocation
  - Push Notifications
  - Splash Screen
  - App metadata

## 📱 How It Works
1. **Web app continues working** - No changes to your existing web app
2. **Same codebase** - One codebase generates web, Android, and iOS apps
3. **Native features** - Full access to device hardware (camera, GPS, notifications)
4. **App store ready** - Can be published to Google Play and Apple App Store

---

## 🚀 Quick Start: Testing on Your Phone

### Step 1: Build the Web App
```bash
npm run build
```

### Step 2: Sync to Mobile Platforms
```bash
npx cap sync
```

This command:
- Copies your built web app to Android and iOS projects
- Updates native plugins
- Prepares apps for testing

### Step 3: Test on Android
```bash
# Open Android Studio
npx cap open android
```

Then in Android Studio:
1. Wait for Gradle sync to complete
2. Connect your Android phone via USB (enable USB debugging)
3. Click the green "Run" button
4. Select your device
5. App installs and launches!

### Step 4: Test on iOS (Mac only)
```bash
# Open Xcode
npx cap open ios
```

Then in Xcode:
1. Select your team/signing certificate
2. Connect your iPhone via USB
3. Select your device in the toolbar
4. Click the "Play" button
5. App installs and launches!

---

## 📦 Building for Production

### Android APK/AAB

**Option 1: Using Android Studio (Recommended)**
1. Open Android project: `npx cap open android`
2. In Android Studio:
   - Go to Build → Generate Signed Bundle/APK
   - Select "Android App Bundle" (for Play Store) or "APK" (for testing)
   - Create or select signing key
   - Choose "release" build variant
   - Build

**Option 2: Command Line**
```bash
cd android
./gradlew assembleRelease  # For APK
./gradlew bundleRelease    # For AAB (Play Store)
```

Output locations:
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

### iOS IPA

**Requirements:**
- Mac computer
- Xcode installed
- Apple Developer Account ($99/year)

**Steps:**
1. Open iOS project: `npx cap open ios`
2. In Xcode:
   - Select "Any iOS Device (arm64)" as target
   - Go to Product → Archive
   - Wait for archive to complete
   - Click "Distribute App"
   - Choose distribution method:
     - App Store Connect (for App Store)
     - Ad Hoc (for testing)
     - Enterprise (if you have enterprise account)
   - Follow the wizard to export IPA

---

## 🎨 Customizing Your App

### App Icons

1. **Generate Icons:**
   - Use a tool like [Icon Kitchen](https://icon.kitchen/)
   - Upload a 1024x1024 PNG logo
   - Download Android and iOS icon sets

2. **Android Icons:**
   - Replace files in `android/app/src/main/res/`
   - Folders: `mipmap-hdpi`, `mipmap-mdpi`, `mipmap-xhdpi`, etc.

3. **iOS Icons:**
   - Open Xcode: `npx cap open ios`
   - Click on `Assets.xcassets` in left sidebar
   - Click `AppIcon`
   - Drag and drop icon files into the appropriate slots

### Splash Screen

Edit `capacitor.config.ts`:
```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,
    backgroundColor: '#2563eb',  // Change to your brand color
    showSpinner: false,
  },
}
```

### App Name & Package ID

Edit `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.proforce.guardtrack',  // Change to your package ID
  appName: 'GuardTrack',              // Change to your app name
  // ...
};
```

**Note:** Changing `appId` after release requires a new app listing in stores!

---

## 📱 Publishing to App Stores

### Google Play Store

**Requirements:**
- Google Play Developer account ($25 one-time fee)
- App signed with release key
- Privacy policy URL
- App screenshots

**Steps:**
1. Create app in Google Play Console
2. Upload AAB file (from build step above)
3. Complete store listing:
   - App title: "GuardTrack"
   - Short description
   - Full description
   - Screenshots (phone, tablet)
   - Feature graphic (1024x500)
4. Set content rating
5. Add privacy policy
6. Submit for review

**Review time:** Usually 1-3 days

### Apple App Store

**Requirements:**
- Apple Developer account ($99/year)
- App signed with distribution certificate
- Privacy policy URL
- App screenshots for required device sizes

**Steps:**
1. Create app in App Store Connect
2. Upload IPA via Xcode or Transporter app
3. Complete App Store listing:
   - App name: "GuardTrack"
   - Subtitle
   - Description
   - Keywords
   - Screenshots (iPhone, iPad if applicable)
   - App preview video (optional)
4. Add privacy policy
5. Answer App Privacy questions
6. Submit for review

**Review time:** Usually 1-5 days

---

## 🔄 Development Workflow

### Making Changes

1. **Edit your web app** as normal (client/src files)
2. **Test in browser** during development
3. **Build and sync** when ready to test on mobile:
   ```bash
   npm run build
   npx cap sync
   ```
4. **Open native IDE** and run on device

### Live Reload (Optional)

For faster development, use live reload:

1. Find your computer's local IP:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. Edit `capacitor.config.ts`:
   ```typescript
   server: {
     url: 'http://YOUR_IP:5000',  // e.g., http://192.168.1.100:5000
     cleartext: true
   }
   ```

3. Run your dev server: `npm run dev`
4. Sync: `npx cap sync`
5. Run app - it will connect to your dev server!

**Remember:** Remove `server.url` before building for production!

---

## 🔧 Common Issues & Solutions

### Android Build Fails
- **Error:** "SDK location not found"
  - **Solution:** Set `ANDROID_HOME` environment variable
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk  # Mac
  export ANDROID_HOME=$HOME/Android/Sdk          # Linux
  ```

- **Error:** Gradle sync failed
  - **Solution:** Update Gradle in `android/gradle/wrapper/gradle-wrapper.properties`

### iOS Build Fails
- **Error:** "Signing for 'App' requires a development team"
  - **Solution:** In Xcode, select your team in Signing & Capabilities

- **Error:** CocoaPods not installed
  - **Solution:** Install CocoaPods:
  ```bash
  sudo gem install cocoapods
  cd ios/App
  pod install
  ```

### App Not Updating
- **Problem:** Changes not showing in app
  - **Solution:** 
  ```bash
  npm run build
  npx cap sync
  ```
  Then rebuild in Android Studio/Xcode

### Geolocation Not Working
- **Android:** Add to `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  ```

- **iOS:** Add to `ios/App/App/Info.plist`:
  ```xml
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>GuardTrack needs your location to verify check-ins at security sites.</string>
  ```

### Push Notifications Not Working
- Ensure you've configured VAPID keys (see main README)
- Android: No additional setup needed
- iOS: Requires Apple Push Notification certificate setup in Apple Developer portal

---

## 📊 App Store Listing Content

### App Title
**GuardTrack - Security Shift Manager**

### Short Description (80 chars)
Security guard shift scheduling, attendance tracking, and billing management

### Full Description

**Streamline Your Security Operations**

GuardTrack is the complete shift management solution for security companies. Designed for both guards in the field and administrators in the office.

**For Guards:**
- Quick check-in/check-out with GPS verification
- View your schedule
- Track breaks and overtime
- Apply for available shifts
- Receive instant notifications

**For Administrators:**
- Real-time guard monitoring
- Automatic billing reports
- Shift scheduling
- Leave management
- Break and overtime approvals
- Site and rate configuration
- User management

**Key Features:**
✓ GPS-verified attendance
✓ Automated billing calculations
✓ Push notifications
✓ Offline support
✓ Professional invoicing
✓ Multi-site management
✓ Role-based access control

**Security & Privacy:**
Location data is only collected during check-in, check-out, and breaks - never in the background. All data is encrypted and securely stored.

Perfect for security companies of all sizes looking to modernize their operations and reduce administrative overhead.

### Keywords (Play Store/App Store)
security, guard, shift, scheduling, attendance, tracking, workforce, management, billing, timesheet

### Category
- **Google Play:** Business
- **App Store:** Business

### Screenshots Needed
1. Guard check-in screen (with location)
2. Admin dashboard overview
3. Shift schedule calendar
4. Billing reports
5. Real-time monitoring
6. Invoice generation

---

## 🎯 Next Steps

1. **Test on your devices** - Run on your Android/iPhone
2. **Customize branding** - Add your icons and splash screen
3. **Build release versions** - Follow production build steps
4. **Prepare store listings** - Screenshots, descriptions, etc.
5. **Submit to stores** - Google Play and Apple App Store

---

## 📞 Support

For Capacitor issues, see: https://capacitorjs.com/docs
For GuardTrack issues, check the main README.md

**Remember:** Your web app continues to work normally. The mobile apps are an addition, not a replacement!
