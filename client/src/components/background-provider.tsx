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

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["/api/platform-settings", refreshKey],
    staleTime: 5 * 60 * 1000,
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
    if (!settings || settings.backgroundType === 'default') {
      document.body.style.removeProperty('background');
      document.body.style.removeProperty('background-image');
      document.body.style.removeProperty('background-size');
      document.body.style.removeProperty('background-position');
      document.body.style.removeProperty('background-attachment');
      document.body.classList.remove('guardtrack-bg', 'guardtrack-bg-light', 'custom-bg-image', 'custom-bg-image-light');
      return;
    }

    document.body.classList.remove('guardtrack-bg', 'guardtrack-bg-light', 'custom-bg-image', 'custom-bg-image-light');
    
    if (settings.backgroundType === 'guardtrack') {
      const className = theme === 'dark' ? 'guardtrack-bg' : 'guardtrack-bg-light';
      document.body.classList.add(className);
      document.body.style.removeProperty('background-image');
    } else if (settings.backgroundType === 'custom' && settings.customBackgroundUrl) {
      const lightClass = theme === 'light' ? 'custom-bg-image-light' : '';
      document.body.classList.add('custom-bg-image');
      if (lightClass) {
        document.body.classList.add(lightClass);
      }
      document.body.style.backgroundImage = `url(${settings.customBackgroundUrl})`;
    }

    return () => {
      document.body.style.removeProperty('background');
      document.body.style.removeProperty('background-image');
      document.body.classList.remove('guardtrack-bg', 'guardtrack-bg-light', 'custom-bg-image', 'custom-bg-image-light');
    };
  }, [settings, theme]);

  return (
    <BackgroundContext.Provider value={{ settings: settings || null, isLoading }}>
      {children}
    </BackgroundContext.Provider>
  );
}
