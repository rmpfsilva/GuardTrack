import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { detectBrowser, type BrowserInfo } from "@/lib/browser-detect";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { isNativePlatform } from "@/lib/native";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Share, Plus, MoreVertical, Smartphone, Monitor, CheckCircle2, ArrowDown } from "lucide-react";
import { SiApple, SiAndroid, SiGooglechrome, SiSafari } from "react-icons/si";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

function trackEvent(companyId: string | null, event: 'page_view' | 'install_click') {
  if (!companyId) return;
  fetch('/api/install/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, event }),
  }).catch(() => {});
}

function QRCodeDisplay({ url }: { url: string }) {
  const encoded = encodeURIComponent(url);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}&bgcolor=ffffff&color=1d4ed8&margin=10`;
  return (
    <div className="flex flex-col items-center gap-3">
      <img src={qrUrl} alt="QR Code" className="w-48 h-48 rounded-lg border border-border" data-testid="img-install-qr" />
      <p className="text-xs text-muted-foreground text-center">Scan with your mobile device to install</p>
    </div>
  );
}

export default function InstallPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ companyId?: string }>();
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);
  const { installApp, hasPrompt, isInstalled } = useInstallPWA();
  const [animStep, setAnimStep] = useState(0);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const companyId = params?.companyId || localStorage.getItem('installCompanyId');

  useEffect(() => {
    if (isNativePlatform() || isStandalone() || isInstalled) {
      const storedCompanyId = localStorage.getItem('installCompanyId');
      if (storedCompanyId) {
        setLocation("/login");
      } else {
        setLocation("/login");
      }
      return;
    }
    setBrowser(detectBrowser());

    if (params?.companyId) {
      localStorage.setItem('installCompanyId', params.companyId);
      fetch(`/api/install/company-info/${params.companyId}`)
        .then(r => r.json())
        .then(data => { if (data.name) setCompanyName(data.name); })
        .catch(() => {});
      trackEvent(params.companyId, 'page_view');
    }
  }, [isInstalled, setLocation, params?.companyId]);

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
  const isDesktop = !browser.isMobile;

  const installUrl = companyId
    ? `${window.location.origin}/install/${companyId}`
    : `${window.location.origin}/install`;

  const handleInstall = async () => {
    trackEvent(companyId, 'install_click');
    return installApp();
  };

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
          <h1 className="text-2xl font-bold" data-testid="text-install-title">
            {companyName ? `${companyName}` : "Install GuardTrack"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {companyName
              ? "Install the GuardTrack app on your device to get started"
              : "Install the app on your device for the best experience"}
          </p>
          <Badge variant="outline" className="text-xs" data-testid="badge-device-info">
            {browser.isIOS ? "iOS" : browser.isAndroid ? "Android" : "Desktop"} &mdash; {browser.name.charAt(0).toUpperCase() + browser.name.slice(1)}
          </Badge>
        </div>

        {isIOSSafari && <IOSSafariInstructions animStep={animStep} />}
        {isIOSChrome && <IOSChromeMessage installUrl={installUrl} />}
        {isIOSOther && <IOSOtherMessage installUrl={installUrl} />}
        {browser.isAndroid && <AndroidInstructions installApp={handleInstall} hasPrompt={hasPrompt} animStep={animStep} />}
        {isDesktop && <DesktopInstructions installApp={handleInstall} hasPrompt={hasPrompt} animStep={animStep} installUrl={installUrl} />}

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

function IOSChromeMessage({ installUrl }: { installUrl: string }) {
  return (
    <Card data-testid="install-instructions-ios-chrome">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SiGooglechrome className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-orange-700 dark:text-orange-400">Safari Required</h2>
        </div>

        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-3">
          <p className="text-sm font-medium">To install GuardTrack, open this page in Safari.</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 font-bold">1</span>
              <span className="text-sm">Copy this link:</span>
            </div>
            <div className="bg-muted rounded-md p-2 text-xs break-all font-mono">{installUrl}</div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigator.clipboard.writeText(installUrl)}
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

function IOSOtherMessage({ installUrl }: { installUrl: string }) {
  return (
    <Card data-testid="install-instructions-ios-other">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SiApple className="h-5 w-5" />
          <h2 className="font-semibold text-orange-700 dark:text-orange-400">Please use Safari</h2>
        </div>
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-3">
          <p className="text-sm">To install GuardTrack on your iOS device, open this link in Safari:</p>
          <div className="bg-muted rounded-md p-2 text-xs break-all font-mono">{installUrl}</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigator.clipboard.writeText(installUrl)}
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

function DesktopInstructions({ installApp, hasPrompt, animStep, installUrl }: { installApp: () => Promise<boolean>; hasPrompt: boolean; animStep: number; installUrl: string }) {
  const [, setLocation] = useLocation();

  return (
    <Card data-testid="install-instructions-desktop">
      <CardContent className="py-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Monitor className="h-5 w-5 text-blue-500" />
          <h2 className="font-semibold">Mobile App Required</h2>
        </div>

        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            GuardTrack is designed for mobile devices. Scan this QR code with your phone to install the app.
          </p>
          <QRCodeDisplay url={installUrl} />
        </div>

        {hasPrompt && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">Or install as a desktop app:</p>
            <Button
              className="w-full"
              size="lg"
              onClick={installApp}
              data-testid="button-desktop-install"
            >
              <Download className="h-5 w-5 mr-2" />
              Install on this device
            </Button>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setLocation("/login")}
            data-testid="button-skip-install-desktop"
          >
            Continue in browser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
