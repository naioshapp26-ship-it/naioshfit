import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Smartphone, X, Monitor, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import {
  copyAppLink,
  detectInstallPlatform,
  downloadDesktopShortcut,
  getAppEntryUrl,
  isStandaloneDisplayMode,
  type InstallPlatform,
} from '@/lib/pwaUtils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PWAInstallContextValue = {
  install: () => Promise<boolean>;
  triggerInstall: () => Promise<void>;
  openInstallGuide: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
};

const PWAInstallContext = createContext<PWAInstallContextValue | null>(null);

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  promptListeners.forEach((listener) => listener());
}

function setGlobalDeferredPrompt(prompt: BeforeInstallPromptEvent | null) {
  globalDeferredPrompt = prompt;
  notifyPromptListeners();
}

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplayMode);
  const [showAutoPrompt, setShowAutoPrompt] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [promptVersion, setPromptVersion] = useState(0);

  useEffect(() => {
    const onChange = () => setPromptVersion((value) => value + 1);
    promptListeners.add(onChange);
    return () => {
      promptListeners.delete(onChange);
    };
  }, []);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplayMode());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setGlobalDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowAutoPrompt(false);
      setShowGuide(false);
      setGlobalDeferredPrompt(null);
      localStorage.setItem('pwa-install-prompted', 'true');
      toast({
        title: isArabic ? 'تم تثبيت التطبيق' : 'App installed',
        description: isArabic
          ? 'يمكنك فتح Naiosh Fit من سطح المكتب أو الشاشة الرئيسية.'
          : 'You can open Naiosh Fit from your desktop or home screen.',
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isArabic, toast]);

  useEffect(() => {
    if (!globalDeferredPrompt || isInstalled) return;

    const timer = window.setTimeout(() => {
      const hasPromptedBefore = localStorage.getItem('pwa-install-prompted');
      if (!hasPromptedBefore) {
        setShowAutoPrompt(true);
      }
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [promptVersion, isInstalled]);

  const install = useCallback(async (): Promise<boolean> => {
    if (!globalDeferredPrompt) return false;

    try {
      await globalDeferredPrompt.prompt();
      const choice = await globalDeferredPrompt.userChoice;
      setGlobalDeferredPrompt(null);
      localStorage.setItem('pwa-install-prompted', 'true');
      setShowAutoPrompt(false);
      return choice.outcome === 'accepted';
    } catch (error) {
      console.error('PWA install prompt failed:', error);
      return false;
    }
  }, []);

  const openInstallGuide = useCallback(() => {
    setShowGuide(true);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (isInstalled) {
      toast({
        title: isArabic ? 'التطبيق مثبت بالفعل' : 'App already installed',
        description: isArabic
          ? 'افتح Naiosh Fit من أيقونة التطبيق على جهازك.'
          : 'Open Naiosh Fit from the app icon on your device.',
      });
      return;
    }

    if (globalDeferredPrompt) {
      const accepted = await install();
      if (accepted) return;
    }

    setShowGuide(true);
  }, [install, isArabic, isInstalled, toast]);

  const contextValue = useMemo<PWAInstallContextValue>(
    () => ({
      install,
      triggerInstall,
      openInstallGuide,
      isInstallable: Boolean(globalDeferredPrompt),
      isInstalled,
    }),
    [install, isInstalled, openInstallGuide, promptVersion, triggerInstall],
  );

  const handleDismissAutoPrompt = () => {
    setShowAutoPrompt(false);
    localStorage.setItem('pwa-install-prompted', 'true');
  };

  return (
    <PWAInstallContext.Provider value={contextValue}>
      {children}

      <Dialog open={showAutoPrompt && !isInstalled && Boolean(globalDeferredPrompt)} onOpenChange={setShowAutoPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              {isArabic ? 'تثبيت تطبيق Naiosh Fit' : 'Install Naiosh Fit'}
            </DialogTitle>
            <DialogDescription>
              {isArabic
                ? 'ثبّت التطبيق للوصول السريع وتجربة أقرب للتطبيق الأصلي.'
                : 'Install the app for quick access and a native-like experience.'}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2" dir={isArabic ? 'rtl' : 'ltr'}>
            <Button variant="outline" onClick={handleDismissAutoPrompt} className="w-full sm:w-auto">
              <X className="h-4 w-4 ml-2" />
              {isArabic ? 'ليس الآن' : 'Not now'}
            </Button>
            <Button
              onClick={async () => {
                await install();
                handleDismissAutoPrompt();
              }}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 ml-2" />
              {isArabic ? 'تثبيت التطبيق' : 'Install app'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InstallGuideDialog open={showGuide} onOpenChange={setShowGuide} onInstall={install} />
    </PWAInstallContext.Provider>
  );
}

function InstallGuideDialog({
  open,
  onOpenChange,
  onInstall,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => Promise<boolean>;
}) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const platform = detectInstallPlatform();
  const appUrl = getAppEntryUrl();
  const canNativeInstall = Boolean(globalDeferredPrompt);

  const handleNativeInstall = async () => {
    const accepted = await onInstall();
    if (accepted) {
      onOpenChange(false);
    }
  };

  const handleDownloadShortcut = () => {
    downloadDesktopShortcut();
    toast({
      title: isArabic ? 'تم تنزيل الاختصار' : 'Shortcut downloaded',
      description: isArabic
        ? 'افتح الملف الذي تم تنزيله لتثبيت اختصار Naiosh Fit على جهازك.'
        : 'Open the downloaded file to add a Naiosh Fit shortcut on your device.',
    });
  };

  const handleCopyLink = async () => {
    const copied = await copyAppLink();
    toast({
      title: copied
        ? isArabic
          ? 'تم نسخ الرابط'
          : 'Link copied'
        : isArabic
          ? 'تعذر النسخ'
          : 'Copy failed',
      description: copied ? appUrl : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {isArabic ? 'تنزيل / تثبيت Naiosh Fit' : 'Download / Install Naiosh Fit'}
          </DialogTitle>
          <DialogDescription>
            {isArabic
              ? 'اختر الطريقة المناسبة لجهازك. على Chrome العادي يمكن التثبيت مباشرة بدون رسائل تنبيه.'
              : 'Choose the option for your device. In regular Chrome you can install directly without browser alerts.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm" dir={isArabic ? 'rtl' : 'ltr'}>
          {canNativeInstall && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="font-medium text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {isArabic ? 'التثبيت المباشر متاح' : 'Direct install is available'}
              </p>
              <p className="mt-2 text-green-700">
                {isArabic
                  ? 'اضغط الزر بالأسفل لتثبيت التطبيق كبرنامج مستقل على جهازك.'
                  : 'Use the button below to install the app as a standalone program.'}
              </p>
              <Button className="mt-3 w-full" onClick={handleNativeInstall}>
                <Download className="h-4 w-4 ml-2" />
                {isArabic ? 'تثبيت التطبيق الآن' : 'Install app now'}
              </Button>
            </div>
          )}

          <PlatformInstructions platform={platform} isArabic={isArabic} appUrl={appUrl} />

          {(platform === 'windows' || platform === 'mac' || platform === 'other') && (
            <div className="rounded-lg border p-4">
              <p className="font-medium flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                {isArabic ? 'تنزيل اختصار سطح المكتب' : 'Download desktop shortcut'}
              </p>
              <p className="mt-2 text-muted-foreground">
                {isArabic
                  ? 'سيتم تنزيل ملف اختصار. افتحه مرة واحدة لإضافة Naiosh Fit إلى سطح المكتب.'
                  : 'A shortcut file will download. Open it once to add Naiosh Fit to your desktop.'}
              </p>
              <Button variant="secondary" className="mt-3 w-full" onClick={handleDownloadShortcut}>
                <Download className="h-4 w-4 ml-2" />
                {isArabic ? 'تنزيل ملف الاختصار' : 'Download shortcut file'}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 ml-2" />
              {isArabic ? 'نسخ رابط التطبيق' : 'Copy app link'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {isArabic
              ? 'ملاحظة: وضع التصفح الخفي (Incognito) لا يدعم تثبيت التطبيق. افتح الرابط في نافذة عادية.'
              : 'Note: Incognito/private mode cannot install PWAs. Open the app in a normal browser window.'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isArabic ? 'إغلاق' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlatformInstructions({
  platform,
  isArabic,
  appUrl,
}: {
  platform: InstallPlatform;
  isArabic: boolean;
  appUrl: string;
}) {
  const lines =
    platform === 'android'
      ? isArabic
        ? [
            '1. افتح الرابط في Chrome (ليس Incognito).',
            '2. اضغط ⋮ ثم "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق".',
            '3. أكّد التثبيت.',
          ]
        : [
            '1. Open the link in Chrome (not Incognito).',
            '2. Tap ⋮ then "Add to Home screen" or "Install app".',
            '3. Confirm installation.',
          ]
      : platform === 'ios'
        ? isArabic
          ? [
              '1. افتح الرابط في Safari.',
              '2. اضغط زر المشاركة.',
              '3. اختر "إضافة إلى الشاشة الرئيسية".',
            ]
          : [
              '1. Open the link in Safari.',
              '2. Tap the Share button.',
              '3. Choose "Add to Home Screen".',
            ]
        : isArabic
          ? [
              '1. افتح الرابط في Chrome أو Edge (ليس Incognito).',
              '2. في Chrome: اضغط أيقونة التثبيت ⊕ في شريط العناوين.',
              '3. في Edge: القائمة ← التطبيقات ← تثبيت هذا الموقع كتطبيق.',
            ]
          : [
              '1. Open the link in Chrome or Edge (not Incognito).',
              '2. In Chrome: click the install icon ⊕ in the address bar.',
              '3. In Edge: Menu → Apps → Install this site as an app.',
            ];

  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium">{isArabic ? 'خطوات التثبيت' : 'Install steps'}</p>
      <p className="mt-1 break-all text-xs text-muted-foreground">{appUrl}</p>
      <ul className="mt-3 space-y-2">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function usePWAInstall(): PWAInstallContextValue {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error('usePWAInstall must be used within PWAInstallProvider');
  }
  return context;
}

/** Backwards-compatible export for existing imports. */
export function PWAInstallPrompt() {
  return null;
}
