import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { detectBrowser, type BrowserInfo } from "@/lib/browser-detect";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Share, Plus, MoreVertical, Smartphone, Monitor, CheckCircle2, ArrowDown, ExternalLink } from "lucide-react";
import { SiApple, SiAndroid, SiGooglechrome, SiSafari } from "react-icons/si";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

export default function InstallPage() {
  const [, setLocation] = useLocation();
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);
  const { installApp, hasPrompt, isInstalled } = useInstallPWA();
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    if (isStandalone() || isInstalled) {
      setLocation("/login");
      return;
    }
    setBrowser(detectBrowser());
  }, [isInstalled, setLocation]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimStep(prev => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  if (!browser) return null;

  const isIOSSafari = browser.isIOS && browser.name === 'safari';
  const isIOSChrome = browser.isIOS && browser.name === 'chrome';
  const isIOSOther = browser.isIOS && !isIOSSafari && !isIOSChrome;
  const isAndroidChrome = browser.isAndroid && (browser.name === 'chrome' || browser.supportsInstallPrompt);
  const isDesktop = !browser.isMobile;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center p-4" data-testid="install-page">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <img
            src={guardTrackLogo}
            alt="GuardTrack"
            className="h-14 w-auto mx-auto"
            data-testid="img-install-logo"
          />
          <h1 className="text-2xl font-bold" data-testid="text-install-title">Install GuardTrack</h1>
          <p className="text-muted-foreground text-sm">
            Install the app on your device for the best experience
          </p>
          <Badge variant="outline" className="text-xs" data-testid="badge-device-info">
            {browser.isIOS ? "iOS" : browser.isAndroid ? "Android" : "Desktop"} - {browser.name.charAt(0).toUpperCase() + browser.name.slice(1)}
          </Badge>
        </div>

        {isIOSSafari && <IOSSafariInstructions animStep={animStep} />}
        {isIOSChrome && <IOSChromeMessage />}
        {isIOSOther && <IOSOtherMessage />}
        {browser.isAndroid && <AndroidInstructions installApp={installApp} hasPrompt={hasPrompt} animStep={animStep} />}
        {isDesktop && <DesktopInstructions installApp={installApp} hasPrompt={hasPrompt} animStep={animStep} />}

        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Why install?</p>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  <li>Works offline and loads faster</li>
                  <li>Full-screen experience, no browser bars</li>
                  <li>Receive push notifications</li>
                  <li>Quick access from your home screen</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          After installing, open GuardTrack from your home screen to sign in.
        </p>
      </div>
    </div>
  );
}

function StepIndicator({ step, active, completed }: { step: number; active: boolean; completed: boolean }) {
  return (
    <div className={`
      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
      transition-all duration-500
      ${completed ? 'bg-green-500 text-white scale-100' :
        active ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30' :
        'bg-muted text-muted-foreground scale-100'}
    `}>
      {completed ? <CheckCircle2 className="h-4 w-4" /> : step}
    </div>
  );
}

function IOSSafariInstructions({ animStep }: { animStep: number }) {
  return (
    <Card data-testid="install-instructions-ios-safari">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SiSafari className="h-5 w-5 text-blue-500" />
          <h2 className="font-semibold">Install on iPhone / iPad</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <StepIndicator step={1} active={animStep === 0} completed={animStep > 0} />
            <div className={`flex-1 transition-opacity duration-500 ${animStep === 0 ? 'opacity-100' : 'opacity-70'}`}>
              <p className="font-medium text-sm">Tap the Share button</p>
              <div className={`mt-2 flex items-center justify-center p-3 bg-muted/50 rounded-lg transition-transform duration-500 ${animStep === 0 ? 'scale-105' : 'scale-100'}`}>
                <Share className={`h-8 w-8 text-primary transition-all duration-500 ${animStep === 0 ? 'animate-bounce' : ''}`} />
                <ArrowDown className={`h-4 w-4 ml-1 text-muted-foreground transition-opacity duration-500 ${animStep === 0 ? 'opacity-100' : 'opacity-0'}`} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Find it at the bottom of Safari</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <StepIndicator step={2} active={animStep === 1} completed={animStep > 1} />
            <div className={`flex-1 transition-opacity duration-500 ${animStep === 1 ? 'opacity-100' : 'opacity-70'}`}>
              <p className="font-medium text-sm">Tap "Add to Home Screen"</p>
              <div className={`mt-2 flex items-center gap-2 p-3 bg-muted/50 rounded-lg transition-transform duration-500 ${animStep === 1 ? 'scale-105' : 'scale-100'}`}>
                <Plus className={`h-6 w-6 text-primary transition-all duration-500 ${animStep === 1 ? 'animate-pulse' : ''}`} />
                <span className="text-sm font-medium">Add to Home Screen</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Scroll down in the share menu</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <StepIndicator step={3} active={animStep === 2} completed={animStep > 2} />
            <div className={`flex-1 transition-opacity duration-500 ${animStep === 2 ? 'opacity-100' : 'opacity-70'}`}>
              <p className="font-medium text-sm">Tap "Add" to confirm</p>
              <div className={`mt-2 flex items-center justify-center transition-transform duration-500 ${animStep === 2 ? 'scale-105' : 'scale-100'}`}>
                <div className={`px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-all duration-500 ${animStep === 2 ? 'shadow-lg shadow-primary/30' : ''}`}>
                  Add
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <StepIndicator step={4} active={animStep === 3} completed={false} />
            <div className={`flex-1 transition-opacity duration-500 ${animStep === 3 ? 'opacity-100' : 'opacity-70'}`}>
              <p className="font-medium text-sm">Open from Home Screen</p>
              <div className={`mt-2 flex items-center justify-center transition-transform duration-500 ${animStep === 3 ? 'scale-105' : 'scale-100'}`}>
                <div className={`w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center transition-all duration-500 ${animStep === 3 ? 'shadow-lg' : ''}`}>
                  <Smartphone className={`h-7 w-7 text-primary ${animStep === 3 ? 'animate-pulse' : ''}`} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Find the GuardTrack icon on your home screen</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IOSChromeMessage() {
  const currentUrl = window.location.origin + '/install';

  return (
    <Card data-testid="install-instructions-ios-chrome">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SiGooglechrome className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-orange-700 dark:text-orange-400">Safari Required</h2>
        </div>

        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-3">
          <p className="text-sm font-medium">To install GuardTrack, you need to open this page in Safari.</p>
          <p className="text-sm text-muted-foreground">
            Chrome on iOS does not support app installation. Please follow these steps:
          </p>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 font-bold">1</span>
              <span className="text-sm">Copy this link:</span>
            </div>
            <div className="bg-muted rounded-md p-2 text-xs break-all font-mono">{currentUrl}</div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigator.clipboard.writeText(currentUrl)}
              data-testid="button-copy-url"
            >
              Copy Link
            </Button>

            <div className="flex items-start gap-2 pt-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 font-bold">2</span>
              <div className="flex items-center gap-1.5 text-sm">
                <span>Open in</span>
                <SiSafari className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Safari</span>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 font-bold">3</span>
              <span className="text-sm">Follow the install instructions there</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IOSOtherMessage() {
  const currentUrl = window.location.origin + '/install';

  return (
    <Card data-testid="install-instructions-ios-other">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SiApple className="h-5 w-5" />
          <h2 className="font-semibold text-orange-700 dark:text-orange-400">Please use Safari</h2>
        </div>
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-3">
          <p className="text-sm">To install GuardTrack on your iOS device, open this link in Safari:</p>
          <div className="bg-muted rounded-md p-2 text-xs break-all font-mono">{currentUrl}</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigator.clipboard.writeText(currentUrl)}
            data-testid="button-copy-url-other"
          >
            Copy Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AndroidInstructions({ installApp, hasPrompt, animStep }: { installApp: () => Promise<boolean>; hasPrompt: boolean; animStep: number }) {
  return (
    <Card data-testid="install-instructions-android">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SiAndroid className="h-5 w-5 text-green-500" />
          <h2 className="font-semibold">Install on Android</h2>
        </div>

        {hasPrompt ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Tap the button below to install GuardTrack on your device.</p>
            <Button
              className="w-full"
              size="lg"
              onClick={installApp}
              data-testid="button-native-install"
            >
              <Download className="h-5 w-5 mr-2" />
              Install GuardTrack
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <StepIndicator step={1} active={animStep === 0} completed={animStep > 0} />
              <div className={`flex-1 transition-opacity duration-500 ${animStep === 0 ? 'opacity-100' : 'opacity-70'}`}>
                <p className="font-medium text-sm">Tap the menu button</p>
                <div className={`mt-2 flex items-center justify-center p-3 bg-muted/50 rounded-lg transition-transform duration-500 ${animStep === 0 ? 'scale-105' : 'scale-100'}`}>
                  <MoreVertical className={`h-8 w-8 text-primary transition-all duration-500 ${animStep === 0 ? 'animate-bounce' : ''}`} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Three dots in the top-right corner</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <StepIndicator step={2} active={animStep === 1} completed={animStep > 1} />
              <div className={`flex-1 transition-opacity duration-500 ${animStep === 1 ? 'opacity-100' : 'opacity-70'}`}>
                <p className="font-medium text-sm">Tap "Install app" or "Add to Home screen"</p>
                <div className={`mt-2 flex items-center gap-2 p-3 bg-muted/50 rounded-lg transition-transform duration-500 ${animStep === 1 ? 'scale-105' : 'scale-100'}`}>
                  <Download className={`h-6 w-6 text-primary ${animStep === 1 ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-medium">Install app</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <StepIndicator step={3} active={animStep === 2} completed={animStep > 2} />
              <div className={`flex-1 transition-opacity duration-500 ${animStep === 2 ? 'opacity-100' : 'opacity-70'}`}>
                <p className="font-medium text-sm">Tap "Install" to confirm</p>
                <div className={`mt-2 flex items-center justify-center transition-transform duration-500 ${animStep === 2 ? 'scale-105' : 'scale-100'}`}>
                  <div className={`px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-all duration-500 ${animStep === 2 ? 'shadow-lg shadow-primary/30' : ''}`}>
                    Install
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <StepIndicator step={4} active={animStep === 3} completed={false} />
              <div className={`flex-1 transition-opacity duration-500 ${animStep === 3 ? 'opacity-100' : 'opacity-70'}`}>
                <p className="font-medium text-sm">Open from Home Screen</p>
                <div className={`mt-2 flex items-center justify-center transition-transform duration-500 ${animStep === 3 ? 'scale-105' : 'scale-100'}`}>
                  <div className={`w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center transition-all duration-500 ${animStep === 3 ? 'shadow-lg' : ''}`}>
                    <Smartphone className={`h-7 w-7 text-primary ${animStep === 3 ? 'animate-pulse' : ''}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DesktopInstructions({ installApp, hasPrompt, animStep }: { installApp: () => Promise<boolean>; hasPrompt: boolean; animStep: number }) {
  const [, setLocation] = useLocation();

  return (
    <Card data-testid="install-instructions-desktop">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Monitor className="h-5 w-5 text-blue-500" />
          <h2 className="font-semibold">Install on Desktop</h2>
        </div>

        {hasPrompt ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Click the button below to install GuardTrack as a desktop app.</p>
            <Button
              className="w-full"
              size="lg"
              onClick={installApp}
              data-testid="button-desktop-install"
            >
              <Download className="h-5 w-5 mr-2" />
              Install GuardTrack
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <StepIndicator step={1} active={animStep === 0} completed={animStep > 0} />
              <div className={`flex-1 transition-opacity duration-500 ${animStep === 0 ? 'opacity-100' : 'opacity-70'}`}>
                <p className="font-medium text-sm">Look for the install icon in the address bar</p>
                <div className={`mt-2 flex items-center gap-2 p-3 bg-muted/50 rounded-lg transition-transform duration-500 ${animStep === 0 ? 'scale-105' : 'scale-100'}`}>
                  <Download className={`h-6 w-6 text-primary ${animStep === 0 ? 'animate-bounce' : ''}`} />
                  <span className="text-sm text-muted-foreground">or use browser menu</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <StepIndicator step={2} active={animStep === 1} completed={animStep > 1} />
              <div className={`flex-1 transition-opacity duration-500 ${animStep === 1 ? 'opacity-100' : 'opacity-70'}`}>
                <p className="font-medium text-sm">Click "Install" to confirm</p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setLocation("/login")}
            data-testid="button-skip-install-desktop"
          >
            Continue without installing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
