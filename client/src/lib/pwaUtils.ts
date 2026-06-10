export type InstallPlatform = 'windows' | 'mac' | 'android' | 'ios' | 'other';

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'other';

  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Mac OS X/i.test(ua)) return 'mac';
  if (/Windows/i.test(ua)) return 'windows';
  return 'other';
}

export function getAppEntryUrl(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.origin}/dashboard`;
}

export function downloadDesktopShortcut(): void {
  const url = getAppEntryUrl();
  const platform = detectInstallPlatform();

  if (platform === 'mac') {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>URL</key>
    <string>${url}</string>
  </dict>
</plist>`;
    triggerFileDownload(content, 'Naiosh Fit.webloc', 'application/octet-stream');
    return;
  }

  const content = `[InternetShortcut]\r\nURL=${url}\r\nIconIndex=0\r\nHotKey=0\r\n`;
  triggerFileDownload(content, 'Naiosh Fit.url', 'application/octet-stream');
}

function triggerFileDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function copyAppLink(): Promise<boolean> {
  const url = getAppEntryUrl();
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
