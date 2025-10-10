export interface BrowserInfo {
  name: 'chrome' | 'edge' | 'firefox' | 'safari' | 'samsung' | 'opera' | 'unknown';
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  supportsInstallPrompt: boolean;
}

export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/.test(ua);
  
  let name: BrowserInfo['name'] = 'unknown';
  let supportsInstallPrompt = false;

  // Detect specific browsers (order matters - check more specific first)
  if (/EdgA?\//.test(ua)) {
    name = 'edge';
    supportsInstallPrompt = isAndroid || !isMobile; // Edge on Android and Desktop
  } else if (/SamsungBrowser/.test(ua)) {
    name = 'samsung';
    supportsInstallPrompt = true; // Samsung Internet supports install prompt
  } else if (/CriOS/.test(ua)) {
    name = 'chrome'; // Chrome on iOS (but no install prompt support)
    supportsInstallPrompt = false;
  } else if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    name = 'chrome';
    supportsInstallPrompt = isAndroid || !isMobile; // Chrome on Android and Desktop
  } else if (/Firefox/.test(ua) || /FxiOS/.test(ua)) {
    name = 'firefox';
    supportsInstallPrompt = false; // Firefox doesn't support install prompt
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    name = 'safari';
    supportsInstallPrompt = false; // Safari uses Add to Home Screen, not install prompt
  } else if (/OPR|Opera/.test(ua)) {
    name = 'opera';
    supportsInstallPrompt = isAndroid || !isMobile; // Opera supports on some platforms
  }

  return {
    name,
    isIOS,
    isAndroid,
    isMobile,
    supportsInstallPrompt,
  };
}

export interface InstallInstructions {
  title: string;
  steps: string[];
  note?: string;
}

export function getInstallInstructions(browser: BrowserInfo): InstallInstructions {
  const { name, isIOS, isAndroid, isMobile } = browser;

  if (isIOS) {
    return {
      title: 'For iPhone/iPad (Safari):',
      steps: [
        'Tap the Share button (square with arrow) at the bottom of the screen',
        'Scroll down and tap "Add to Home Screen"',
        'Tap "Add" to confirm',
        'Find the GuardTrack app icon on your home screen',
      ],
      note: 'Note: You must use Safari browser on iOS. If you opened this in another browser, copy the link and open it in Safari.',
    };
  }

  if (name === 'chrome' && isAndroid) {
    return {
      title: 'For Android (Chrome):',
      steps: [
        'Tap the menu (⋮) button in the top-right corner',
        'Select "Add to Home screen" or "Install app"',
        'Tap "Install" to confirm',
        'Find the GuardTrack app icon on your home screen',
      ],
    };
  }

  if (name === 'edge' && isAndroid) {
    return {
      title: 'For Android (Edge):',
      steps: [
        'Tap the menu (⋯) button at the bottom of the screen',
        'Select "Add to phone"',
        'Tap "Add" to confirm',
        'Find the GuardTrack app icon on your home screen',
      ],
    };
  }

  if (name === 'samsung' && isAndroid) {
    return {
      title: 'For Android (Samsung Internet):',
      steps: [
        'Tap the menu (≡) button at the bottom of the screen',
        'Select "Add page to" → "Home screen"',
        'Tap "Add" to confirm',
        'Find the GuardTrack app icon on your home screen',
      ],
    };
  }

  if (name === 'firefox' && isAndroid) {
    return {
      title: 'For Android (Firefox):',
      steps: [
        'Tap the menu (⋮) button in the top-right corner',
        'Select "Install"',
        'Tap "Add to Home screen"',
        'Tap "Add" to confirm',
      ],
    };
  }

  if (name === 'chrome' && !isMobile) {
    return {
      title: 'For Desktop (Chrome):',
      steps: [
        'Look for the install icon (⊕) in the address bar',
        'Click it and select "Install"',
        'Or: Click menu (⋮) → "Install GuardTrack"',
        'The app will open in its own window',
      ],
    };
  }

  if (name === 'edge' && !isMobile) {
    return {
      title: 'For Desktop (Edge):',
      steps: [
        'Look for the app icon (⊕) in the address bar',
        'Click it and select "Install"',
        'Or: Click menu (⋯) → "Apps" → "Install GuardTrack"',
        'The app will open in its own window',
      ],
    };
  }

  if (name === 'firefox') {
    return {
      title: `For ${isMobile ? 'Mobile' : 'Desktop'} (Firefox):`,
      steps: [
        'Firefox has limited PWA support',
        'For best experience, use Chrome, Edge, or Safari',
        'Or bookmark this page for quick access',
      ],
      note: 'Firefox doesn\'t fully support app installation. Consider switching to Chrome or Edge.',
    };
  }

  // Fallback for unknown browsers
  return {
    title: 'To Install:',
    steps: [
      'Look for an install or "Add to Home Screen" option in your browser menu',
      'Or use Chrome, Edge, or Safari for the best experience',
      'You can also bookmark this page for quick access',
    ],
    note: 'Installation steps vary by browser. For the best experience, use Chrome, Edge, or Safari.',
  };
}
