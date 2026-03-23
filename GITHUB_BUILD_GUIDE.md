# GuardTrack — GitHub Automatic APK Build Guide

Every time you push code or make changes, GitHub will automatically build a signed release APK and make it available to download. Here is the complete setup (one-time only).

---

## PART 1 — Connect Replit to GitHub

1. In Replit, click the **Git** icon in the left sidebar (looks like a branch)
2. Click **Connect to GitHub**
3. Authorise Replit to access your GitHub account
4. Click **Create a GitHub Repository** and name it `guardtrack`
5. Click **Push** — your code is now on GitHub

---

## PART 2 — Generate Your Signing Keystore (one-time only)

You need a keystore file to sign the APK. **Keep this file safe forever** — if you lose it you cannot update your app on the Play Store.

### Option A — Using Android Studio (easiest, no command line)
1. Open Android Studio
2. Go to **Build → Generate Signed Bundle / APK**
3. Select **APK**, click Next
4. Click **Create new...** next to Key store path
5. Fill in:
   - Key store path: save as `guardtrack-release-key.jks` on your Desktop
   - Password: `GuardTrack@Store2024!`
   - Key alias: `guardtrack-key`
   - Key password: `GuardTrack@Key2024!`
   - First and Last Name: GuardTrack
   - Country Code: GB
6. Click OK — the `.jks` file is now on your Desktop

### Option B — Command line (if you have Java installed)
```bash
keytool -genkeypair \
  -keystore guardtrack-release-key.jks \
  -alias guardtrack-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "GuardTrack@Store2024!" \
  -keypass "GuardTrack@Key2024!" \
  -dname "CN=GuardTrack,O=ProForce,L=London,C=GB"
```

---

## PART 3 — Convert Keystore to Base64

GitHub Secrets can't store binary files directly, so you convert the `.jks` to a text string.

**Mac / Linux:**
```bash
base64 -i guardtrack-release-key.jks > keystore.b64
```
Then open `keystore.b64` in any text editor and copy the entire contents.

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("guardtrack-release-key.jks")) | Out-File keystore.b64
```
Then open `keystore.b64` in Notepad and copy the entire contents.

---

## PART 4 — Add Secrets to GitHub

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add each of these four secrets:

| Secret Name | Value |
|---|---|
| `KEYSTORE_BASE64` | The base64 text you copied in Part 3 |
| `KEYSTORE_STORE_PASSWORD` | `GuardTrack@Store2024!` |
| `KEYSTORE_KEY_PASSWORD` | `GuardTrack@Key2024!` |
| `KEYSTORE_ALIAS` | `guardtrack-key` |

---

## PART 5 — Trigger Your First Build

1. Go to your GitHub repo → **Actions** tab
2. You should see **Build & Sign Android APK** in the list
3. Click it → click **Run workflow** → click the green **Run workflow** button
4. Wait 5–8 minutes for it to complete (green tick = success)

---

## PART 6 — Download Your APK

1. In the **Actions** tab, click on the completed workflow run
2. Scroll to the bottom to the **Artifacts** section
3. Click **guardtrack-release-{number}** to download the signed APK zip
4. Extract the zip — inside is `app-release.apk`
5. Send this file to your guards to install

---

## Going Forward — Automatic Builds

From now on, **every time you push changes from Replit to GitHub, a new APK is automatically built**. You don't need to do anything — just:

1. Make changes in Replit
2. Push to GitHub (Git icon → Push)
3. Go to the Actions tab → download the new APK when it's done

---

## Keeping Your Keystore Safe

- **Store `guardtrack-release-key.jks` somewhere safe** (cloud backup, password manager)
- **Write down your passwords** — losing them means you can't update the app
- Never share the `.jks` file publicly or commit it to GitHub
- The GitHub Secrets store it securely and encrypted

---

## Signing Credentials (keep these private)

| | |
|---|---|
| Keystore file | `guardtrack-release-key.jks` |
| Key alias | `guardtrack-key` |
| Keystore password | `GuardTrack@Store2024!` |
| Key password | `GuardTrack@Key2024!` |
