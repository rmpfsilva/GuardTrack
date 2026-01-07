import { useEffect, useState, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/theme-provider";

interface PlatformSettings {
  backgroundType: 'default' | 'guardtrack' | 'custom';
  customBackgroundUrl: string | null;
  overlayOpacity: number;
}

interface BackgroundContextValue {
  settings: PlatformSettings | null;
  isLoading: boolean;
}

const BackgroundContext = createContext<BackgroundContextValue>({
  settings: null,
  isLoading: true,
});

export function useBackground() {
  return useContext(BackgroundContext);
}

function cleanupBackground() {
  document.body.style.removeProperty('background');
  document.body.style.removeProperty('background-image');
  document.body.style.removeProperty('background-size');
  document.body.style.removeProperty('background-position');
  document.body.style.removeProperty('background-attachment');
  document.body.classList.remove('guardtrack-bg', 'guardtrack-bg-light', 'custom-bg-image', 'custom-bg-image-light');
  document.documentElement.style.removeProperty('--bg-overlay-opacity');
}

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: settings, isLoading, isError } = useQuery<PlatformSettings>({
    queryKey: ["/api/platform-settings", refreshKey],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const handleSettingsChange = () => {
      setRefreshKey(prev => prev + 1);
    };
    
    window.addEventListener('platform-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('platform-settings-changed', handleSettingsChange);
    };
  }, []);

  useEffect(() => {
    if (isError || !settings || settings.backgroundType === 'default') {
      cleanupBackground();
      return;
    }

    cleanupBackground();
    
    const overlayOpacity = settings.overlayOpacity ?? 50;
    document.documentElement.style.setProperty('--bg-overlay-opacity', String(overlayOpacity / 100));
    
    if (settings.backgroundType === 'guardtrack') {
      const className = theme === 'dark' ? 'guardtrack-bg' : 'guardtrack-bg-light';
      document.body.classList.add(className);
    } else if (settings.backgroundType === 'custom' && settings.customBackgroundUrl) {
      document.body.classList.add('custom-bg-image');
      if (theme === 'light') {
        document.body.classList.add('custom-bg-image-light');
      }
      document.body.style.backgroundImage = `url(${settings.customBackgroundUrl})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    }

    return () => {
      cleanupBackground();
    };
  }, [settings, theme, isError]);

  return (
    <BackgroundContext.Provider value={{ settings: settings || null, isLoading }}>
      {children}
    </BackgroundContext.Provider>
  );
}
