import { useState, useEffect, useRef } from "react";
import { Bug, ImagePlus, Send, X } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Textarea } from "./textarea";
import { Input } from "./input";
import { Label } from "./label";
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/hooks/use-auth';

interface IssueReport {
  type: string;
  description: string;
  email?: string;
  whatsapp?: string;
}

interface UploadedScreenshot {
  data: string;
  filename: string;
  size: number;
  type: string;
}

export function TechnicalIssueWidget() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canRequestCoachAssignment = !user || (user.role === 'user' || user.role === 'visitor');
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<UploadedScreenshot | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<IssueReport>({
    type: "",
    description: "",
    email: "",
    whatsapp: ""
  });

  useEffect(() => {
    if (!open || !user) return;
    setFormData((prev) => ({
      ...prev,
      email: prev.email || user.email || "",
      whatsapp: prev.whatsapp || (user as any).whatsappWithCode || (user as any).phoneNumber || "",
    }));
  }, [open, user]);

  const compressScreenshot = async (dataUrl: string, maxChars = 1_800_000): Promise<string | null> => {
    if (dataUrl.length <= maxChars) return dataUrl;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, Math.sqrt(maxChars / dataUrl.length) * 0.85);
        canvas.width = Math.max(320, Math.floor(img.width * scale));
        canvas.height = Math.max(240, Math.floor(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.75;
        let compressed = canvas.toDataURL('image/jpeg', quality);
        while (compressed.length > maxChars && quality > 0.35) {
          quality -= 0.05;
          compressed = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressed.length <= maxChars ? compressed : null);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('screenshotInvalidType'));
      event.target.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert(t('screenshotTooLarge'));
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const compressed = await compressScreenshot(dataUrl);
      if (!compressed) {
        alert(t('screenshotTooLarge'));
        event.target.value = '';
        return;
      }

      setScreenshot({
        data: compressed,
        filename: file.name.replace(/[^\w.\-]/g, '_') || `upload-${Date.now()}.jpg`,
        size: file.size,
        type: file.type || 'image/jpeg',
      });
    } catch (error) {
      console.error('Failed to read uploaded image:', error);
      alert(t('screenshotUploadFailed'));
      event.target.value = '';
    }
  };

  const clearScreenshot = () => {
    setScreenshot(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.description) return;

    setIsSubmitting(true);

    try {
      const reporterName = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
        : '';
      const reporterAccount = user
        ? [reporterName, user.email, (user as any).username ? `@${(user as any).username}` : ''].filter(Boolean).join(' | ')
        : '';

      const reportData = {
        type: formData.type,
        description: formData.description,
        email: formData.email || user?.email || undefined,
        phone: formData.whatsapp || (user as any)?.whatsappWithCode || (user as any)?.phoneNumber || undefined,
        reporterUserId: user?.id,
        reporterName: reporterName || undefined,
        reporterUsername: (user as any)?.username || undefined,
        reporterAccount: reporterAccount || undefined,
        screenshot: screenshot?.data || null,
        screenshotFilename: screenshot?.filename || null,
        screenshotSize: screenshot?.size || null,
        screenshotType: screenshot?.type || null,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      const response = await fetch('/api/technical-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(reportData)
      });

      const result = await response.json().catch(() => ({} as Record<string, unknown>));

      if (!response.ok) {
        const message = (result.message as string) || 'Failed to submit report';
        if (response.status === 413 || /entity too large/i.test(message)) {
          throw new Error(t('technicalIssuePayloadTooLarge'));
        }
        throw new Error(message);
      }

      setFormData({ type: "", description: "", email: "", whatsapp: "" });
      clearScreenshot();
      setOpen(false);

      alert(t('issueReportSubmitted').replace('{reportId}', result.reportId as string));
    } catch (error) {
      console.error('Failed to submit issue report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit report. Please try again.';
      alert(t('submitReportError').replace('{error}', errorMessage));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            data-technical-issue-trigger
            className="hidden"
            aria-label={t('reportTechnicalIssue')}
          />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-red-500" />
              {t('reportTechnicalIssue')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="issue-type">{t('typeOfIssue')} *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectIssueType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">{t('technicalProblem')}</SelectItem>
                  <SelectItem value="bug">{t('bugReport')}</SelectItem>
                  <SelectItem value="performance">{t('performanceIssue')}</SelectItem>
                  <SelectItem value="ui">{t('userInterfaceProblem')}</SelectItem>
                  <SelectItem value="feature">{t('featureRequest')}</SelectItem>
                  {canRequestCoachAssignment && (
                    <SelectItem value="coach_request">{t('coachAssignmentRequest')}</SelectItem>
                  )}
                  <SelectItem value="other">{t('issueTypeOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">{t('describeProblem')} *</Label>
              <Textarea
                id="description"
                placeholder={t('describeProblemPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[100px]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">{t('emailOptional')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">{t('whatsappOptional')}</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="+1234567890"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-screenshot">{t('attachScreenshotOptional')}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {t('uploadScreenshot')}
                </Button>
                <input
                  ref={fileInputRef}
                  id="issue-screenshot"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                {screenshot && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearScreenshot}>
                    <X className="h-4 w-4 mr-1" />
                    {t('removeScreenshot')}
                  </Button>
                )}
              </div>
              {screenshot && (
                <img
                  src={screenshot.data}
                  alt={t('uploadedScreenshotPreview')}
                  className="max-h-40 rounded-md border object-contain"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!formData.type || !formData.description || isSubmitting}
                className="bg-red-500 hover:bg-red-600"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    {t('submitting')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t('submitReport')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
