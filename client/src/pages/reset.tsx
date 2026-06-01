import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from '@/context/BrandingContext';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import PublicHeader from '@/components/layout/PublicHeader';
import { normalizeDigitsUniversal } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Schema for requesting password reset (email only)
const requestResetSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح").min(1, "البريد الإلكتروني مطلوب"),
});

// Schema for PIN-based reset (legacy)
const resetPasswordSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح").min(1, "البريد الإلكتروني مطلوب"),
  pinNumber: z.string()
    .regex(/^\d{4}$/, "رقم التحقق يجب أن يكون 4 أرقام بالضبط"),
  newPassword: z.string().min(6, "يجب أن تكون كلمة المرور 6 أحرف على الأقل"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "كلمتا المرور غير متطابقتين",
  path: ["confirmPassword"],
});

type RequestResetFormValues = z.infer<typeof requestResetSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPasswordPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [tokenNewPassword, setTokenNewPassword] = useState("");
  const [tokenConfirmPassword, setTokenConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { settings: branding } = useBranding();
  const [, navigate] = useLocation();
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);

  const extractResetToken = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const queryToken = queryParams.get('token');
    if (queryToken) return queryToken;

    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const hashToken = hashParams.get('token');
    if (hashToken) return hashToken;

    // Support /reset/:token style links as a fallback.
    const pathMatch = window.location.pathname.match(/^\/reset\/(.+)$/);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]);
    }

    return null;
  };

  // Resolve token when landing from email links and when history navigation changes.
  useEffect(() => {
    setResetToken(extractResetToken());

    const handlePopState = () => {
      setResetToken(extractResetToken());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const requestForm = useForm<RequestResetFormValues>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: "",
    },
  });

  const pinForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
      pinNumber: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Handle email request submission
  const onRequestSubmit = async (values: RequestResetFormValues) => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'فشل في إرسال رابط إعادة التعيين');
      }

      console.log("Password reset request successful:", data);

      setEmailSent(true);

      toast({
        title: language === 'ar' ? 'تم الإرسال' : 'Email Sent',
        description: data.message || (language === 'ar' ? 'تحقق من بريدك الإلكتروني' : 'Check your email'),
      });

    } catch (error) {
      console.error("Password reset request error:", error);
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء معالجة طلبك";
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password confirmation with token
  const onConfirmSubmit = async () => {
    if (tokenNewPassword.length < 6) {
      const message = 'يجب أن تكون كلمة المرور 6 أحرف على الأقل';
      setConfirmPasswordError(message);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    if (tokenNewPassword !== tokenConfirmPassword) {
      const message = 'كلمتا المرور غير متطابقتين';
      setConfirmPasswordError(message);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      setConfirmPasswordError(null);

      const response = await fetch('/api/auth/confirm-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetToken,
          newPassword: tokenNewPassword,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'فشل في إعادة تعيين كلمة المرور');
      }

      console.log("Password reset successful:", data);

      toast({
        title: language === 'ar' ? 'نجاح' : 'Success',
        description: data.message || (language === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully'),
      });

      // Redirect to auth page after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (error) {
      console.error("Password reset confirmation error:", error);
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء إعادة تعيين كلمة المرور";
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle PIN-based reset (legacy)
  const onPinSubmit = async (values: ResetPasswordFormValues) => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          pinNumber: values.pinNumber,
          newPassword: values.newPassword,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'فشل في إعادة تعيين كلمة المرور';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Password reset successful:", data);

      toast({
        title: language === 'ar' ? 'نجاح' : 'Success',
        description: t('passwordResetSuccess'),
      });

      // Redirect to auth page after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (error) {
      console.error("Password reset error:", error);
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء إعادة تعيين كلمة المرور";
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md mb-6">
        <PublicHeader
          title={t('resetPassword')}
          subtitle={t('resetPasswordDescription')}
          backHref="/auth"
          backLabel={t('login')}
        />
      </div>
      <div className="w-full max-w-md mb-8 text-center">
        <div className="flex justify-center items-center mb-2">
          <img
            src={logoUrl}
            alt="Naiosh Fit Logo"
            className="h-16 w-auto"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = DEFAULT_LOGO_ASSET;
            }}
          />
        </div>
        <p className="text-gray-600" dir="rtl">
          {t('resetPassword')}
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center" dir="rtl">
            {resetToken ? 'تعيين كلمة مرور جديدة' : t('resetPassword')}
          </CardTitle>
          <CardDescription className="text-center" dir="rtl">
            {resetToken 
              ? 'أدخل كلمة المرور الجديدة الخاصة بك'
              : emailSent 
                ? 'تحقق من بريدك الإلكتروني للحصول على رابط إعادة التعيين'
                : 'أدخل بريدك الإلكتروني لإعادة تعيين كلمة المرور'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetToken ? (
            // Confirm reset with token flow
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onConfirmSubmit();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" dir="rtl">{t('newPasswordLabel')} *</label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={tokenNewPassword}
                    name="new-password"
                    disabled={isLoading}
                    className="pl-10"
                    autoComplete="off"
                    autoFocus
                    dir="ltr"
                    spellCheck={false}
                    data-lpignore="true"
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setTokenNewPassword(e.target.value);
                      if (confirmPasswordError) setConfirmPasswordError(null);
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLInputElement;
                      setTokenNewPassword(target.value);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" dir="rtl">{t('confirmPassword')} *</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={tokenConfirmPassword}
                    name="confirm-new-password"
                    disabled={isLoading}
                    className="pl-10"
                    autoComplete="off"
                    dir="ltr"
                    spellCheck={false}
                    data-lpignore="true"
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setTokenConfirmPassword(e.target.value);
                      if (confirmPasswordError) setConfirmPasswordError(null);
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLInputElement;
                      setTokenConfirmPassword(target.value);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPasswordError ? (
                  <p className="text-sm font-medium text-destructive" dir="rtl">{confirmPasswordError}</p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
              </Button>
            </form>
          ) : emailSent ? (
            // Email sent confirmation
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium" dir="rtl">
                  تحقق من بريدك الإلكتروني
                </p>
                <p className="text-sm text-gray-600" dir="rtl">
                  إذا كان البريد الإلكتروني مسجلاً لدينا، فستتلقى رابط إعادة تعيين كلمة المرور خلال بضع دقائق.
                </p>
                <p className="text-xs text-gray-500" dir="rtl">
                  لم تتلق البريد؟ تحقق من مجلد الرسائل غير المرغوب فيها.
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setEmailSent(false);
                  requestForm.reset();
                }}
                className="w-full"
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            // Request reset flow
            <>
              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-4">
                  <FormField
                    control={requestForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel dir="rtl">البريد الإلكتروني *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="example@email.com"
                            {...field}
                            disabled={isLoading}
                            dir="ltr"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
                  </Button>
                </form>
              </Form>

              {/* Legacy PIN-based reset as fallback */}
              <Collapsible
                open={showPinFallback}
                onOpenChange={setShowPinFallback}
                className="mt-6"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full flex items-center justify-center gap-2 text-gray-600"
                  >
                    <span dir="rtl">لديك رقم تحقق؟ استخدم الطريقة القديمة</span>
                    {showPinFallback ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 pt-4 border-t">
                  <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="space-y-4">
                      <FormField
                        control={pinForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel dir="rtl">البريد الإلكتروني *</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="example@email.com"
                                {...field}
                                disabled={isLoading}
                                dir="ltr"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={pinForm.control}
                        name="pinNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel dir="rtl">{t('pinNumber')} *</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="1234"
                                {...field}
                                inputMode="numeric"
                                maxLength={4}
                                onChange={(e) => {
                                  const raw = normalizeDigitsUniversal(e.target.value);
                                  const cleaned = raw.replace(/\D/g, '').slice(0, 4);
                                  field.onChange(cleaned);
                                }}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1" dir="rtl">
                              أدخل رقم التحقق المكون من 4 أرقام
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={pinForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel dir="rtl">{t('newPasswordLabel')} *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showNewPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  {...field}
                                  disabled={isLoading}
                                  className="pl-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  disabled={isLoading}
                                >
                                  {showNewPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={pinForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel dir="rtl">{t('confirmPassword')} *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  {...field}
                                  disabled={isLoading}
                                  className="pl-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                  disabled={isLoading}
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'جاري التحديث...' : t('continue')}
                      </Button>
                    </form>
                  </Form>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p dir="rtl">
          تذكرت كلمة المرور؟{" "}
          <button
            onClick={() => navigate('/auth')}
            className="text-primary underline"
          >
            تسجيل الدخول
          </button>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
