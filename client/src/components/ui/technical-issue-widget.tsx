import { useState } from "react";
import { Bug, Camera, Send, X } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Textarea } from "./textarea";
import { Input } from "./input";
import { Label } from "./label";
import { useLanguage } from '@/context/LanguageContext';

interface IssueReport {
  type: string;
  description: string;
  email?: string;
  whatsapp?: string;
  screenshot?: string;
}

export function TechnicalIssueWidget() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [formData, setFormData] = useState<IssueReport>({
    type: "",
    description: "",
    email: "",
    whatsapp: ""
  });


  const captureScreenshot = async () => {
    try {
      // Hide the dialog temporarily to capture the page behind it
      const dialogElement = document.querySelector('[role="dialog"]');
      const originalDisplay = dialogElement ? (dialogElement as HTMLElement).style.display : '';
      
      if (dialogElement) {
        (dialogElement as HTMLElement).style.display = 'none';
      }
      
      // Wait a brief moment for the dialog to hide
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use html2canvas to capture the current viewport (excluding the dialog)
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true,
        allowTaint: true,
        scale: 0.7, // Good quality for bug reports
        backgroundColor: '#ffffff',
        removeContainer: true,
        ignoreElements: (element) => {
          // Ignore any dialog or modal elements
          return element.getAttribute('role') === 'dialog' || 
                 element.classList.contains('dialog') ||
                 element.hasAttribute('data-radix-portal');
        }
      });
      
      // Restore the dialog visibility
      if (dialogElement) {
        (dialogElement as HTMLElement).style.display = originalDisplay;
      }
      
      // Convert to blob for proper file handling
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png', 0.9);
      });
      
      // Create a filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      
      // Convert to base64 for transmission
      const reader = new FileReader();
      const screenshotData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      setScreenshot(screenshotData);
      
      // Return both the data and filename for backend processing
      return {
        data: screenshotData,
        filename: filename,
        size: blob.size,
        type: 'image/png'
      };
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      
      // Ensure dialog is restored on error
      const dialogElement = document.querySelector('[role="dialog"]');
      if (dialogElement) {
        (dialogElement as HTMLElement).style.display = '';
      }
      
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.description) return;

    setIsSubmitting(true);
    
    try {
      // Capture screenshot automatically before submitting
      const screenshotResult = await captureScreenshot();
      
      const reportData = {
        type: formData.type,
        description: formData.description,
        email: formData.email || undefined,
        phone: formData.whatsapp || undefined, // Map whatsapp field to phone
        screenshot: screenshotResult?.data || null,
        screenshotFilename: screenshotResult?.filename || null,
        screenshotSize: screenshotResult?.size || null,
        screenshotType: screenshotResult?.type || null,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.log('Sending technical issue report to backend...');
      
      // Send to backend API which will forward to webhook
      const response = await fetch('/api/technical-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit report');
      }
      
      console.log('Technical issue report submitted successfully:', result);
      
      // Reset form and close modal
      setFormData({ type: "", description: "", email: "", whatsapp: "" });
      setScreenshot(null);
      setOpen(false);
      
      // Show success message with report ID
      alert(t('issueReportSubmitted').replace('{reportId}', result.reportId));
      
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
      {/* Hidden button that can be triggered from menu */}
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
              {/* Issue Type Dropdown */}
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
                    <SelectItem value="other">{t('issueTypeOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
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

              {/* Optional Contact Fields */}
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

              {/* Screenshot Info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <Camera className="h-4 w-4" />
                <span>{t('screenshotAutoCapture')}</span>
              </div>

              {/* Action Buttons */}
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