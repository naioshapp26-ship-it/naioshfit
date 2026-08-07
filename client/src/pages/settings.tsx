import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  User, 
  Bell, 
  Lock, 
  LogOut, 
  Shield, 
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { ThemeProvider } from "@/context/ThemeContext";
import { useLanguage } from '@/context/LanguageContext';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import { AlertsCenter, SecurityOpsPanel } from '@/components/epics/EpicWidgets';

export default function Settings() {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [appNotifications, setAppNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const allowedTabs = new Set(['account', 'notifications', 'security']);
    const url = new URL(window.location.href);
    const tabParam = url.searchParams.get('tab');
    if (tabParam === 'billing') {
      window.location.replace('/billing');
      return;
    }
    if (tabParam && allowedTabs.has(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (value === 'account') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', value);
      }
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: t('passwordsDontMatch'),
        description: t('passwordsMatchError'),
        variant: "destructive"
      });
      return;
    }

    try {
      await apiRequest('POST', '/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      toast({
        title: t('passwordUpdated'),
        description: t('passwordUpdatedSuccess')
      });

      // Clear the fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: t('failedToUpdatePassword'),
        description: t('checkCurrentPassword'),
        variant: "destructive"
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: t('loggedOut'),
        description: t('loggedOutSuccess')
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToLogOut'),
        variant: "destructive"
      });
    }
  };

  return (
    <ThemeProvider>
    <section className={`p-4 md:p-6 lg:p-8 relative min-h-screen ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <AnimatedBackground />
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">{t('settings')}</h2>
        <p className="text-gray-600">{t('manageAccountSettings')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList
          className={`mb-6 ${isRTL ? 'w-full !justify-end !flex-row-reverse' : ''}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <TabsTrigger value="account">{t('account')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('notifications')}</TabsTrigger>
          <TabsTrigger value="security">{t('security')}</TabsTrigger>
        </TabsList>

        {/* Account Settings */}
        <TabsContent value="account" className={isRTL ? 'text-right' : 'text-left'}>
          <div className="grid gap-6">
            <Card>
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle className={`flex items-center ${isRTL ? 'w-full justify-end text-right' : ''}`}>
                  <User className="ltr:mr-2 rtl:ml-2 h-5 w-5" />
                  {t('accountInformation')}
                </CardTitle>
                <CardDescription className={isRTL ? 'text-right' : ''}>{t('managePersonalInfo')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`grid gap-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={isRTL ? 'text-right md:col-start-2' : ''}>
                      <Label htmlFor="username" className={isRTL ? 'block w-full text-right' : ''}>{t('username')}</Label>
                      <Input
                        id="username"
                        value={user?.username}
                        readOnly
                        dir={isRTL ? 'rtl' : 'ltr'}
                        className={isRTL ? 'text-right' : ''}
                      />
                    </div>
                    <div className={isRTL ? 'md:col-start-1' : ''}>
                      {/* Email removed from settings */}
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <a href="/profile">{t('editProfileInformation')}</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle>{t('deleteAccount')}</CardTitle>
                <CardDescription>{t('permanentlyDeleteAccount')}</CardDescription>
              </CardHeader>
              <CardContent className={isRTL ? 'text-right' : 'text-left'}>
                <p className="text-sm text-muted-foreground mb-4">{t('accountDeletionWarning')}</p>
                <Button variant="outline" asChild>
                  <a href="/profile#delete-account">{t('deleteAccount')}</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="ltr:mr-2 rtl:ml-2 h-5 w-5" />
                  {t('notificationPreferences')}
                </CardTitle>
                <CardDescription>{t('controlCommunication')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{t('emailNotifications')}</h4>
                    <p className="text-sm text-gray-500">{t('receiveNotificationsViaEmail')}</p>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={setEmailNotifications} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{t('appNotifications')}</h4>
                    <p className="text-sm text-gray-500">{t('receiveNotificationsInApp')}</p>
                  </div>
                  <Switch 
                    checked={appNotifications} 
                    onCheckedChange={setAppNotifications} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{t('marketingEmails')}</h4>
                    <p className="text-sm text-gray-500">{t('receivePromotionalEmails')}</p>
                  </div>
                  <Switch 
                    checked={marketingEmails} 
                    onCheckedChange={setMarketingEmails} 
                  />
                </div>

                <Button>{t('savePreferences')}</Button>
              </CardContent>
            </Card>
            <AlertsCenter compact hideEpicBadge />
          </div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className={isRTL ? 'text-right' : 'text-left'}>
          <div className="grid gap-6">
            <Card>
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle className={`flex items-center ${isRTL ? 'w-full justify-end text-right' : ''}`}>
                  <Lock className="ltr:mr-2 rtl:ml-2 h-5 w-5" />
                  {t('changePassword')}
                </CardTitle>
                <CardDescription>{t('updateYourPassword')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div>
                    <Label htmlFor="current-password">{t('currentPassword')}</Label>
                    <div className="relative">
                      <Input 
                        id="current-password" 
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder={t('enterCurrentPassword')} 
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new-password">{t('newPassword')}</Label>
                    <div className="relative">
                      <Input 
                        id="new-password" 
                        type={showNewPassword ? "text" : "password"}
                        placeholder={t('enterNewPassword')} 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">{t('confirmNewPassword')}</Label>
                    <div className="relative">
                      <Input 
                        id="confirm-password" 
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t('confirmYourNewPassword')} 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button type="submit">{t('updatePassword')}</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle className={`flex items-center ${isRTL ? 'w-full justify-end text-right' : ''}`}>
                  <Shield className="ltr:mr-2 rtl:ml-2 h-5 w-5" />
                  {t('securitySettings')}
                </CardTitle>
                <CardDescription>{t('manageSecurityPreferences')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div>
                    <h4 className="font-medium">{t('activeSessions')}</h4>
                    <p className="text-sm text-gray-500">{t('manageActiveSessions')}</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowSessionsDialog(true)}>{t('view')}</Button>
                </div>

                <div className="border-t pt-4">
                  <Button variant="outline" className={`flex items-center ${isRTL ? 'mr-auto' : ''}`} onClick={handleLogout}>
                    <LogOut className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                    {t('signOut')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <SecurityOpsPanel compact hideEpicBadge />
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Active Sessions Dialog */}
      <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
        <DialogContent className={`max-w-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
          <DialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <DialogTitle className={isRTL ? 'text-right' : 'text-left'}>{t('activeSessions')}</DialogTitle>
            <DialogDescription className={isRTL ? 'text-right' : 'text-left'}>
              {t('activeSessionsDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{t('currentSession')}</h4>
                    <p className="text-sm text-muted-foreground">{t('thisDevice')}</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  {t('active')}
                </span>
              </div>
              <div className={`text-sm text-muted-foreground space-y-1 ${isRTL ? 'text-right' : ''}`}>
                <p>{t('browser')}: {navigator.userAgent.split(' ').slice(-1)[0]}</p>
                <p>{t('ipAddress')}: {t('hidden')}</p>
                <p>{t('lastActive')}: {t('justNow')}</p>
              </div>
            </div>
            
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                {t('noOtherActiveSessions')}
              </p>
            </div>
            
            <div className="flex justify-end">
              <Button onClick={() => setShowSessionsDialog(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Technical Issue Widget - visible on all tabs */}
      <TechnicalIssueWidget />
    </section>
     </ThemeProvider>
  );
}
