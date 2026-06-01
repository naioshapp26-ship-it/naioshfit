import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Mail } from 'lucide-react';

interface EmailSettings {
  id?: number;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_from: string | null;
  smtp_to: string | null;
  use_tls: boolean;
  has_password: boolean;
  configured: boolean;
  created_at?: string;
  updated_at?: string;
}

const TEXT = {
  en: {
    title: 'Email Settings',
    description: 'Configure SMTP credentials for password reset and contact emails.',
    statusConfigured: 'Configured',
    statusNotConfigured: 'Not configured',
    smtpHost: 'SMTP Host',
    smtpPort: 'SMTP Port',
    smtpUser: 'SMTP Username',
    smtpPass: 'SMTP Password',
    smtpFrom: 'From Email',
    smtpTo: 'Contact Recipient Email (optional)',
    smtpTls: 'Use TLS/STARTTLS',
    smtpPassSaved: 'Password is already saved. Leave blank to keep the current password.',
    smtpEncryptionHint: 'Sensitive credentials are stored encrypted in the database.',
    save: 'Save Settings',
    test: 'Test Connection',
    saveSuccessTitle: 'Saved',
    saveSuccessDesc: 'Email settings were updated successfully.',
    testSuccessTitle: 'Connection Successful',
    testSuccessDesc: 'SMTP connection is valid.',
    validationRequired: 'SMTP host, username, and from email are required.',
    validationPassRequired: 'SMTP password is required for first-time setup.',
    validationPort: 'SMTP port must be between 1 and 65535.',
    fetchError: 'Failed to fetch email settings.',
    saveError: 'Failed to save email settings.',
    testError: 'Failed to test SMTP connection.',
    error: 'Error',
  },
  ar: {
    title: 'إعدادات البريد الإلكتروني',
    description: 'تهيئة بيانات SMTP لإرسال رسائل إعادة تعيين كلمة المرور ورسائل التواصل.',
    statusConfigured: 'مفعلة',
    statusNotConfigured: 'غير مفعلة',
    smtpHost: 'خادم SMTP',
    smtpPort: 'منفذ SMTP',
    smtpUser: 'اسم مستخدم SMTP',
    smtpPass: 'كلمة مرور SMTP',
    smtpFrom: 'البريد المرسل منه',
    smtpTo: 'بريد استقبال رسائل التواصل (اختياري)',
    smtpTls: 'استخدام TLS/STARTTLS',
    smtpPassSaved: 'تم حفظ كلمة المرور مسبقاً. اترك الحقل فارغاً للاحتفاظ بها.',
    smtpEncryptionHint: 'يتم حفظ البيانات الحساسة مشفرة داخل قاعدة البيانات.',
    save: 'حفظ الإعدادات',
    test: 'اختبار الاتصال',
    saveSuccessTitle: 'تم الحفظ',
    saveSuccessDesc: 'تم تحديث إعدادات البريد الإلكتروني بنجاح.',
    testSuccessTitle: 'تم الاتصال بنجاح',
    testSuccessDesc: 'تم التحقق من اتصال SMTP بنجاح.',
    validationRequired: 'حقل الخادم واسم المستخدم وبريد الإرسال مطلوبة.',
    validationPassRequired: 'كلمة مرور SMTP مطلوبة عند الإعداد لأول مرة.',
    validationPort: 'منفذ SMTP يجب أن يكون بين 1 و 65535.',
    fetchError: 'فشل تحميل إعدادات البريد الإلكتروني.',
    saveError: 'فشل حفظ إعدادات البريد الإلكتروني.',
    testError: 'فشل اختبار اتصال SMTP.',
    error: 'خطأ',
  },
};

export default function EmailSettingsAdmin() {
  const { language } = useLanguage();
  const text = useMemo(() => (language === 'ar' ? TEXT.ar : TEXT.en), [language]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTo, setSmtpTo] = useState('');
  const [useTls, setUseTls] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<EmailSettings>({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/email-settings', { credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || text.fetchError);
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (!settings) return;
    setSmtpHost(settings.smtp_host || '');
    setSmtpPort(String(settings.smtp_port || 465));
    setSmtpUser(settings.smtp_user || '');
    setSmtpFrom(settings.smtp_from || '');
    setSmtpTo(settings.smtp_to || '');
    setUseTls(Boolean(settings.use_tls));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        smtp_user: smtpUser.trim(),
        smtp_pass: smtpPass.trim() || undefined,
        smtp_from: smtpFrom.trim(),
        smtp_to: smtpTo.trim() || null,
        use_tls: useTls,
      };

      const response = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payloadError = await response.json().catch(() => ({}));
        throw new Error(payloadError?.message || text.saveError);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setSmtpPass('');
      toast({
        title: text.saveSuccessTitle,
        description: text.saveSuccessDesc,
      });
    },
    onError: (err: Error) => {
      toast({
        title: text.error,
        description: err.message || text.saveError,
        variant: 'destructive',
      });
    },
  });

  const validateInputs = () => {
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpFrom.trim()) {
      toast({
        title: text.error,
        description: text.validationRequired,
        variant: 'destructive',
      });
      return false;
    }

    const portNum = Number(smtpPort);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      toast({
        title: text.error,
        description: text.validationPort,
        variant: 'destructive',
      });
      return false;
    }

    if (!smtpPass.trim() && !settings?.has_password) {
      toast({
        title: text.error,
        description: text.validationPassRequired,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateInputs()) return;
    saveMutation.mutate();
  };

  const handleTest = async () => {
    if (!validateInputs()) return;

    setIsTesting(true);
    try {
      const response = await fetch('/api/admin/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          smtp_host: smtpHost.trim(),
          smtp_port: Number(smtpPort),
          smtp_user: smtpUser.trim(),
          smtp_pass: smtpPass.trim() || undefined,
          use_tls: useTls,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result?.message || text.testError);
      }

      toast({
        title: text.testSuccessTitle,
        description: text.testSuccessDesc,
      });
    } catch (err: any) {
      toast({
        title: text.error,
        description: err?.message || text.testError,
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {text.title}
        </CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{text.fetchError}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Badge variant={settings?.configured ? 'default' : 'secondary'}>
            {settings?.configured ? text.statusConfigured : text.statusNotConfigured}
          </Badge>
          {settings?.configured ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{text.smtpHost}</Label>
            <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
          </div>

          <div className="space-y-2">
            <Label>{text.smtpPort}</Label>
            <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} type="number" min={1} max={65535} />
          </div>

          <div className="space-y-2">
            <Label>{text.smtpUser}</Label>
            <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="noreply@yourdomain.com" />
          </div>

          <div className="space-y-2">
            <Label>{text.smtpFrom}</Label>
            <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="noreply@yourdomain.com" />
          </div>

          <div className="space-y-2">
            <Label>{text.smtpTo}</Label>
            <Input value={smtpTo} onChange={(e) => setSmtpTo(e.target.value)} placeholder="support@yourdomain.com" />
          </div>

          <div className="space-y-2">
            <Label>{text.smtpPass}</Label>
            <div className="relative">
              <Input
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {settings?.has_password ? (
              <p className="text-xs text-muted-foreground">{text.smtpPassSaved}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <Label>{text.smtpTls}</Label>
          <Switch checked={useTls} onCheckedChange={setUseTls} />
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{text.smtpEncryptionHint}</AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {text.save}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {text.test}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
