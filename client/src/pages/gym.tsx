import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ShieldCheck, ShieldOff, UserMinus, RefreshCcw, Building2, Sparkles, UserCheck2, Copy, CheckCircle2, Link as LinkIcon, Eye, Edit, Search } from 'lucide-react';
import type { User } from '@shared/schema';
import { AdBanner } from '@/components/ads/AdBanner';
import { isPlatformAdminRole } from '@shared/roleAccess';

interface GymMember extends User {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  isApproved: boolean;
  coachId?: number | null;
}

interface GymMembersResponse {
  gymId: number;
  totals: {
    coaches: number;
    users: number;
  };
  coaches: GymMember[];
  users: GymMember[];
}

const AccessDeniedCard = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Access denied</CardTitle>
        <CardDescription className="text-center">
          Only gym owners or admins can access this page.
        </CardDescription>
      </CardHeader>
    </Card>
  </div>
);

const GymDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [location, navigate] = useLocation();
  const [detailViewUser, setDetailViewUser] = useState<any>(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editUserFormData, setEditUserFormData] = useState({
    firstName: '',
    lastName: '',
    whatsappWithCode: ''
  });
  const [coachSearchQuery, setCoachSearchQuery] = useState('');
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [selectedCoachFilter, setSelectedCoachFilter] = useState<string>('all');
  const searchParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, [location]);

  const rawGymId = searchParams.get('gymId') || '';
  const queryGymId = /^\d+$/.test(rawGymId) ? rawGymId : '';
  const [adminGymInput, setAdminGymInput] = useState(queryGymId);

  useEffect(() => {
    setAdminGymInput(queryGymId);
  }, [queryGymId]);

  useEffect(() => {
    if (user?.role === 'gym' && queryGymId) {
      navigate('/gym', { replace: true });
    }
  }, [user?.role, queryGymId, navigate]);

  const isPlatformAdmin = isPlatformAdminRole(user?.role);

  const authorized = !!user && (user.role === 'gym' || isPlatformAdmin);
  if (!authorized || !user) {
    return <AccessDeniedCard />;
  }

  const adminNeedsGymSelection = isPlatformAdmin && !queryGymId;
  const querySuffix = isPlatformAdmin && queryGymId ? `?gymId=${queryGymId}` : '';
  const queryScopeKey = isPlatformAdmin ? queryGymId || 'none' : 'self';

  const {
    data: membersData,
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useQuery<GymMembersResponse>({
    queryKey: ['/api/gym/members', queryScopeKey],
    enabled: !adminNeedsGymSelection,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/gym/members${querySuffix}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to load members');
      }
      return response.json();
    },
  });

  const {
    data: pendingCoaches = [],
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery<GymMember[]>({
    queryKey: ['/api/gym/pending-coaches', queryScopeKey],
    enabled: !adminNeedsGymSelection,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/gym/pending-coaches${querySuffix}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to load pending coaches');
      }
      return response.json();
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ coachId, isApproved }: { coachId: number; isApproved: boolean }) => {
      if (isPlatformAdmin && !queryGymId) {
        throw new Error('Choose a gym first');
      }
      const suffix = isPlatformAdmin && queryGymId ? `?gymId=${queryGymId}` : '';
      const response = await apiRequest('PATCH', `/api/gym/coaches/${coachId}/approval${suffix}`, { isApproved });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update approval');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gym/members', queryScopeKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/gym/pending-coaches', queryScopeKey] });
      toast({
        title: variables.isApproved ? 'Coach approved' : 'Marked as pending',
      });
    },
    onError: (error: any) => {
      toast({ title: 'Action failed', description: error?.message || 'Please try again', variant: 'destructive' });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (userId: number) => {
      if (isPlatformAdmin && !queryGymId) {
        throw new Error('Choose a gym first');
      }
      const suffix = isPlatformAdmin && queryGymId ? `?gymId=${queryGymId}` : '';
      const response = await apiRequest('PATCH', `/api/gym/users/${userId}/unassign${suffix}`, {});
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to unassign user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gym/members', queryScopeKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/gym/pending-coaches', queryScopeKey] });
      toast({ title: 'User removed from gym' });
    },
    onError: (error: any) => {
      toast({ title: 'Unassign failed', description: error?.message || 'Please try again', variant: 'destructive' });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: number; userData: any }) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}`, userData);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gym/members', queryScopeKey] });
      queryClient.invalidateQueries({ queryKey: ['/api/gym/pending-coaches', queryScopeKey] });
      toast({ title: 'User updated successfully' });
      setEditUserDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error?.message || 'Please try again', variant: 'destructive' });
    },
  });

  const handleRefresh = () => {
    refetchMembers();
    refetchPending();
  };

  const handleEditUser = (member: any) => {
    setEditingUser(member);
    setEditUserFormData({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      whatsappWithCode: member.whatsappWithCode || ''
    });
    setEditUserDialogOpen(true);
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserFormData.firstName || !editUserFormData.lastName) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    editUserMutation.mutate({
      userId: editingUser.id,
      userData: {
        firstName: editUserFormData.firstName,
        lastName: editUserFormData.lastName,
        whatsappWithCode: editUserFormData.whatsappWithCode
      }
    });
  };

  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  const handleCopyInviteLink = () => {
    const gymIdToUse = isPlatformAdmin && queryGymId ? queryGymId : user.id;
    const inviteUrl = `${window.location.origin}/signup?gymId=${gymIdToUse}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setInviteLinkCopied(true);
      toast({ title: 'Invite link copied!', description: 'Share this link to invite new members.' });
      setTimeout(() => setInviteLinkCopied(false), 3000);
    });
  };

  const coaches = membersData?.coaches ?? [];
  const athletes = membersData?.users ?? [];

  // Filter coaches based on search query
  const filteredCoaches = coaches.filter((coach) => {
    const searchLower = coachSearchQuery.toLowerCase();
    const fullName = `${coach.firstName} ${coach.lastName}`.toLowerCase();
    const whatsapp = coach.whatsappWithCode?.toLowerCase() || '';
    
    return fullName.includes(searchLower) || whatsapp.includes(searchLower);
  });

  // Filter athletes based on search query and coach assignment
  const filteredAthletes = athletes.filter((athlete) => {
    const searchLower = athleteSearchQuery.toLowerCase();
    const fullName = `${athlete.firstName} ${athlete.lastName}`.toLowerCase();
    const whatsapp = athlete.whatsappWithCode?.toLowerCase() || '';
    
    const matchesSearch = fullName.includes(searchLower) || whatsapp.includes(searchLower);
    
    if (selectedCoachFilter === 'all') {
      return matchesSearch;
    } else if (selectedCoachFilter === 'unassigned') {
      return matchesSearch && !athlete.coachId;
    } else {
      return matchesSearch && athlete.coachId === parseInt(selectedCoachFilter);
    }
  });

  return (
    <div className="min-h-screen bg-slate-50" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Ad Banners */}
        <AdBanner />
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
            <CardHeader className="space-y-1">
              <CardDescription className="text-slate-300">{t('gymControlRoom')}</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                {user.role === 'gym' ? t('myGym') : t('gymOverview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {membersData && (
                <Badge variant="secondary" className="bg-black/30 border-white/20 text-white">
                  Gym ID: {membersData.gymId}
                </Badge>
              )}
              {membersData && (
                <Badge variant="secondary" className="bg-black/30 border-white/20 text-white">
                  {t('totalMembers')}: {membersData.totals.users + membersData.totals.coaches}
                </Badge>
              )}
              <Button variant="secondary" size="sm" className="ml-auto" onClick={handleRefresh} disabled={membersLoading || pendingLoading}>
                <RefreshCcw className="h-4 w-4 mr-1" />
                {t('refreshGym')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>{t('activeCoaches')}</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                {membersData?.totals.coaches ?? '--'}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>{t('athletesUnderGym')}</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-500" />
                {membersData?.totals.users ?? '--'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {isPlatformAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Load a specific gym</CardTitle>
              <CardDescription>Enter a gym owner user ID to inspect their roster.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                placeholder="e.g. 142"
                value={adminGymInput}
                onChange={(event) => setAdminGymInput(event.target.value.replace(/[^\d]/g, ''))}
                className="md:max-w-xs"
              />
              <Button
                onClick={() => navigate(adminGymInput ? `/gym?gymId=${adminGymInput}` : '/gym')}
                disabled={!adminGymInput}
              >
                View roster
              </Button>
              <Button variant="ghost" onClick={() => navigate('/gym')} disabled={!queryGymId}>
                Clear
              </Button>
            </CardContent>
          </Card>
        )}

        {!adminNeedsGymSelection && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-blue-600" />
                {t('inviteLink')}
              </CardTitle>
              <CardDescription>{t('inviteLinkDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-white border rounded-lg">
                <code className="flex-1 text-sm text-slate-700 overflow-x-auto">
                  {`${window.location.origin}/signup?gymId=${isPlatformAdmin && queryGymId ? queryGymId : user.id}`}
                </code>
                <Button
                  size="sm"
                  variant={inviteLinkCopied ? "default" : "outline"}
                  onClick={handleCopyInviteLink}
                  className="shrink-0"
                >
                  {inviteLinkCopied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {t('copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      {t('copyInviteLink')}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('newSignupsDescription')}
              </p>
            </CardContent>
          </Card>
        )}

        {adminNeedsGymSelection && (
          <Card>
            <CardHeader>
              <CardTitle>Select a gym</CardTitle>
              <CardDescription>Use the control above to choose which gym roster to view.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {!adminNeedsGymSelection && (
          <Tabs defaultValue="roster">
            <TabsList className={language === 'ar' ? 'flex-row-reverse' : ''}>
              <TabsTrigger value="roster">{t('members')}</TabsTrigger>
              <TabsTrigger value="pending">
                {t('pendingCoaches')}
                {pendingCoaches.length > 0 && (
                  <Badge className="ml-2" variant="destructive">{pendingCoaches.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="roster" className="space-y-6 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-blue-100">
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse justify-end' : ''}`}>
                      <Sparkles className="h-5 w-5 text-blue-500" />
                      {t('coaches')}
                    </CardTitle>
                    <CardDescription>{t('coachesDescription')}</CardDescription>
                    <div className="relative mt-3">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('searchByNameOrWhatsapp') || 'Search by name or WhatsApp...'}
                        value={coachSearchQuery}
                        onChange={(e) => setCoachSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {membersLoading && <p className="text-sm text-muted-foreground">{t('loadingCoaches')}</p>}
                    {membersError && (
                      <p className="text-sm text-destructive">{(membersError as Error).message}</p>
                    )}
                    {!membersLoading && !filteredCoaches.length && (
                      <p className="text-sm text-muted-foreground">{coachSearchQuery ? t('noSearchResults') || 'No results found.' : t('noCoaches')}</p>
                    )}
                    <div className="space-y-3">
                      {filteredCoaches.map((coach) => (
                        <div key={coach.id} className="border rounded-lg p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{coach.firstName} {coach.lastName}</p>
                              <p className="text-xs text-muted-foreground">ID #{coach.id}</p>
                              {coach.whatsappWithCode && (
                                <p className="text-xs text-muted-foreground">📞 {coach.whatsappWithCode}</p>
                              )}
                            </div>
                            <Badge variant={coach.isApproved ? 'default' : 'outline'}>
                              {coach.isApproved ? 'Approved' : 'Pending'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDetailViewUser(coach);
                                setDetailViewOpen(true);
                              }}
                              className="text-green-500 hover:text-green-700 hover:bg-green-50"
                              title={t('viewDetails')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t('details')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditUser(coach)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              title={t('editProfile')}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              {t('edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approvalMutation.mutate({ coachId: coach.id, isApproved: true })}
                              disabled={approvalMutation.isPending}
                            >
                              <ShieldCheck className="h-4 w-4 mr-1" />
                              {t('approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approvalMutation.mutate({ coachId: coach.id, isApproved: false })}
                              disabled={approvalMutation.isPending}
                            >
                              <ShieldOff className="h-4 w-4 mr-1" />
                              {t('setPending')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => unassignMutation.mutate(coach.id)}
                              disabled={unassignMutation.isPending}
                            >
                              <UserMinus className="h-4 w-4 mr-1" />
                              {t('unassign')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-100">
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse justify-end' : ''}`}>
                      <Users className="h-5 w-5 text-emerald-500" />
                      {t('athletes')}
                    </CardTitle>
                    <CardDescription>{t('athletesDescription')}</CardDescription>
                    <div className="space-y-3 mt-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={t('searchByNameOrWhatsapp') || 'Search by name or WhatsApp...'}
                          value={athleteSearchQuery}
                          onChange={(e) => setAthleteSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">{t('assignedToCoach') || 'Assigned to Coach'}</Label>
                        <Select value={selectedCoachFilter} onValueChange={setSelectedCoachFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('allCoaches') || 'All coaches'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('allAthletes') || 'All Athletes'}</SelectItem>
                            <SelectItem value="unassigned">{t('unassignedAthletes') || 'Unassigned'}</SelectItem>
                            {coaches.map((coach) => (
                              <SelectItem key={coach.id} value={coach.id.toString()}>
                                {coach.firstName} {coach.lastName} (ID #{coach.id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {membersLoading && <p className="text-sm text-muted-foreground">{t('loadingMembers')}</p>}
                    {!membersLoading && !filteredAthletes.length && (
                      <p className="text-sm text-muted-foreground">
                        {athleteSearchQuery || selectedCoachFilter !== 'all' ? t('noSearchResults') || 'No results found.' : t('noMembers')}
                      </p>
                    )}
                    <div className="space-y-3">
                      {filteredAthletes.map((member) => (
                        <div key={member.id} className="border rounded-lg p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{member.firstName} {member.lastName}</p>
                              <div className="text-xs text-muted-foreground space-x-2">
                                <span>ID #{member.id}</span>
                              </div>
                              {member.whatsappWithCode && (
                                <p className="text-xs text-muted-foreground">📞 {member.whatsappWithCode}</p>
                              )}
                            </div>
                          </div>
                          {member.coachId && (
                            <p className="text-xs text-muted-foreground">Coach ID: {member.coachId}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDetailViewUser(member);
                                setDetailViewOpen(true);
                              }}
                              className="text-green-500 hover:text-green-700 hover:bg-green-50"
                              title={t('viewDetails')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t('details')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditUser(member)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              title={t('editProfile')}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              {t('edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => unassignMutation.mutate(member.id)}
                              disabled={unassignMutation.isPending}
                            >
                              <UserMinus className="h-4 w-4 mr-1" />
                              {t('unassign')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pending" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse justify-end' : ''}`}>
                    <UserCheck2 className="h-5 w-5 text-amber-500" />
                    {t('pendingApprovals')}
                  </CardTitle>
                  <CardDescription>{t('pendingApprovalsDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingLoading && <p className="text-sm text-muted-foreground">{t('loadingPendingCoaches')}</p>}
                  {pendingError && (
                    <p className="text-sm text-destructive">{(pendingError as Error).message}</p>
                  )}
                  {!pendingLoading && pendingCoaches.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('allCoachesApproved')}</p>
                  )}
                  <div className="space-y-3">
                    {pendingCoaches.map((coach) => (
                      <div key={coach.id} className="border rounded-lg p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{coach.firstName} {coach.lastName}</p>
                            <p className="text-xs text-muted-foreground">ID #{coach.id}</p>
                          </div>
                          <Badge variant="outline">Pending approval</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => approvalMutation.mutate({ coachId: coach.id, isApproved: true })}
                            disabled={approvalMutation.isPending}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            {t('approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => unassignMutation.mutate(coach.id)}
                            disabled={unassignMutation.isPending}
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            {t('removeFromGym')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update user profile information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUserSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={editUserFormData.firstName}
                  onChange={(e) => setEditUserFormData({...editUserFormData, firstName: e.target.value})}
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={editUserFormData.lastName}
                  onChange={(e) => setEditUserFormData({...editUserFormData, lastName: e.target.value})}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="editWhatsappWithCode">WhatsApp Number</Label>
              <Input
                id="editWhatsappWithCode"
                type="tel"
                value={editUserFormData.whatsappWithCode}
                onChange={(e) => setEditUserFormData({...editUserFormData, whatsappWithCode: e.target.value})}
                placeholder="+20 1xxxxxxxxx"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={editUserMutation.isPending}>
                {editUserMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditUserDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detailed View Sheet */}
      <Sheet open={detailViewOpen} onOpenChange={setDetailViewOpen}>
        <SheetContent className="w-full max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {detailViewUser ? `${detailViewUser.firstName} ${detailViewUser.lastName} - Detailed View` : 'User Details'}
            </SheetTitle>
            <SheetDescription>
              Comprehensive view of user information
            </SheetDescription>
          </SheetHeader>

          {detailViewUser && (
            <div className="py-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Name</Label>
                      <p className="text-sm font-semibold">{detailViewUser.firstName} {detailViewUser.lastName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">ID</Label>
                      <p className="text-sm">#{detailViewUser.id}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">WhatsApp</Label>
                      <p className="text-sm">{detailViewUser.whatsappWithCode || 'Not provided'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Role</Label>
                      <Badge variant="outline" className="text-xs">
                        {detailViewUser.role || 'user'}
                      </Badge>
                    </div>
                    {detailViewUser.role === 'user' && (
                      <>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">City</Label>
                          <p className="text-sm">{detailViewUser.city || 'Not set'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Country</Label>
                          <p className="text-sm">{detailViewUser.country || 'Not set'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Gender</Label>
                          <p className="text-sm capitalize">{detailViewUser.gender || 'Not set'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Age</Label>
                          <p className="text-sm">{detailViewUser.age || 'Not set'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Height</Label>
                          <p className="text-sm">{detailViewUser.height ? `${detailViewUser.height} cm` : 'Not set'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Weight</Label>
                          <p className="text-sm">{detailViewUser.weight ? `${detailViewUser.weight} kg` : 'Not set'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Fitness Goal</Label>
                          <p className="text-sm capitalize">{detailViewUser.fitnessGoal || 'Not set'}</p>
                        </div>
                      </>
                    )}
                    {detailViewUser.coachId && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Coach ID</Label>
                        <p className="text-sm">#{detailViewUser.coachId}</p>
                      </div>
                    )}
                    {detailViewUser.gymId && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Gym ID</Label>
                        <p className="text-sm">#{detailViewUser.gymId}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default GymDashboard;
