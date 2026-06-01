import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if PWA is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebApp = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInWebApp);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show install prompt after a delay (not immediately)
      setTimeout(() => {
        const hasPromptedBefore = localStorage.getItem('pwa-install-prompted');
        if (!hasPromptedBefore && !isInstalled) {
          setShowPrompt(true);
        }
      }, 10000); // Show after 10 seconds
    };

    // Listen for app installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-install-prompted', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    
    localStorage.setItem('pwa-install-prompted', 'true');
    setShowPrompt(false);
    setDeferredPrompt(null);

    if (choiceResult.outcome === 'accepted') {
      console.log('PWA installation accepted');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompted', 'true');
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !deferredPrompt || !showPrompt) {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            تثبيت تطبيق Naiosh Fit
          </DialogTitle>
          <DialogDescription>
            قم بتثبيت تطبيق Naiosh Fit على جهازك للحصول على تجربة أفضل. ستحصل على:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 my-4" dir="rtl">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>وصول سريع من الشاشة الرئيسية</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>العمل بدون إنترنت عند الحاجة</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>تجربة تطبيق أصلي</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>إشعارات للتذكير</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2" dir="rtl">
          <Button variant="outline" onClick={handleDismiss} className="w-full sm:w-auto">
            <X className="h-4 w-4 ml-2" />
            ليس الآن
          </Button>
          <Button onClick={handleInstallClick} className="w-full sm:w-auto">
            <Download className="h-4 w-4 ml-2" />
            تثبيت التطبيق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for manual install trigger
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebApp = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInWebApp);

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);

    return choiceResult.outcome === 'accepted';
  };

  return { install, isInstallable, isInstalled };
}