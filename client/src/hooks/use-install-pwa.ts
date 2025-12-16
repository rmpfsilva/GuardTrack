import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [promptShown, setPromptShown] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    if (isIOSDevice) {
      setIsInstallable(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      promptRef.current = promptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      promptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    const prompt = deferredPrompt || promptRef.current;
    if (!prompt) return false;

    try {
      prompt.prompt();
      setPromptShown(true);
      const { outcome } = await prompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        promptRef.current = null;
        setIsInstallable(false);
        return true;
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    }
    return false;
  }, [deferredPrompt]);

  const triggerInstallOnInteraction = useCallback(() => {
    if (promptShown || isInstalled) return;
    
    const prompt = deferredPrompt || promptRef.current;
    if (prompt && !isIOS) {
      installApp();
    }
  }, [deferredPrompt, promptShown, isInstalled, isIOS, installApp]);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    installApp,
    promptShown,
    triggerInstallOnInteraction,
    hasPrompt: !!(deferredPrompt || promptRef.current),
  };
}
