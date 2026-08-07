import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { isPlatformAdminRole } from '@shared/roleAccess';
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from '@/context/BrandingContext';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

const createSignInSchema = (t: (key: string) => string) => z.object({
  email: z.string().email({ message: 'البريد الإلكتروني غير صحيح' }).min(1, { message: 'البريد الإلكتروني مطلوب' }),
  password: z.string().min(6, { message: t('passwordMinLength') }),
});

type SignInFormValues = z.infer<ReturnType<typeof createSignInSchema>>;

interface SignInProps {
  onToggleForm: () => void;
  onSuccess?: () => void; // Add onSuccess callback prop
}

interface DemoAccount {
  label: string;
  note: string;
  email: string;
  name: string;
}

const DEMO_PASSWORD = "Demo123!";

const SignIn: React.FC<SignInProps> = ({ onToggleForm, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [loadingDemoAccounts, setLoadingDemoAccounts] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { settings: branding } = useBranding();
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);

  const signInSchema = createSignInSchema(t);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Fetch demo users from the database
  useEffect(() => {
    const fetchDemoUsers = async () => {
      try {
        const response = await fetch('/api/auth/demo-users');
        if (response.ok) {
          const users = await response.json();
          setDemoAccounts(users);
        } else {
          console.error('Failed to fetch demo users');
          // Fallback to empty array if API fails
          setDemoAccounts([]);
        }
      } catch (error) {
        console.error('Error fetching demo users:', error);
        // Fallback to empty array if API fails
        setDemoAccounts([]);
      } finally {
        setLoadingDemoAccounts(false);
      }
    };

    fetchDemoUsers();
  }, []);

  const onSubmit = async (values: SignInFormValues) => {
    try {
      setIsLoading(true);
      
      console.log("Attempting to log in with email:", values.email);
      
      // Direct fetch for login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Language': 'ar',
        },
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          password: values.password
        }),
        credentials: 'include',
      });
      
      // Check if the request was successful
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Login failed';
        throw new Error(errorMessage);
      }
      
      const user = await response.json();
      console.log("Login successful:", user);
      
      toast({
        title: t('success'),
        description: t('welcomeBackToXTraining'),
      });
      
      // Store user in localStorage to maintain session
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // Redirect based on user role - admin goes to /admin, others to /dashboard
      setTimeout(() => {
        if (isPlatformAdminRole(user.role)) {
          window.location.href = '/admin';
        } else {
          window.location.href = '/dashboard';
        }
      }, 500);
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Sign in error:", error);
      const serverMessage = error instanceof Error ? error.message : '';
      const description =
        serverMessage && !['Login failed', 'Invalid credentials'].includes(serverMessage)
          ? serverMessage
          : t('loginFailedDesc');
      toast({
        title: t('loginFailed'),
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerDemoLogin = async (account: DemoAccount) => {
    // Directly call onSubmit with the demo credentials
    await onSubmit({
      email: account.email,
      password: DEMO_PASSWORD,
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center flex justify-center">
          <img
            src={logoUrl}
            alt="Naiosh Fit Logo"
            className="h-10 w-auto"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = DEFAULT_LOGO_ASSET;
            }}
          />
        </CardTitle>
        <CardDescription className="text-center">{t('signInToYourAccount')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
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
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('password')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        placeholder={t('enterYourPassword')} 
                        {...field} 
                        disabled={isLoading}
                        className="pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        disabled={isLoading}
                      >
                        {showPassword ? (
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
              {isLoading ? t('signingIn') : t('login')}
            </Button>
          </form>
        </Form>
        <div className="mt-6 border-t pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            {t('or')} explore instantly
          </p>
          {loadingDemoAccounts ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Loading demo accounts...
            </div>
          ) : demoAccounts.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No demo accounts available
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    className="h-auto flex flex-col items-start gap-1 text-left"
                    disabled={isLoading}
                    onClick={() => triggerDemoLogin(account)}
                    title={`Login as ${account.name}`}
                  >
                    <span className="text-sm font-semibold">{account.label}</span>
                    <span className="text-xs text-muted-foreground">{account.note}</span>
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {t('demoAccountsNote')} Uses password <span className="font-mono">{DEMO_PASSWORD}</span> automatically.
              </p>
            </>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t('dontHaveAccount')} {" "}
          <Link href="/signup" className="text-primary underline">
            {t('signup')}
          </Link>
        </p>
        <Link href="/reset" className="text-sm text-primary underline" dir="rtl">
          {t('forgotPassword')}
        </Link>
      </CardFooter>
    </Card>
  );
};

export default SignIn;
