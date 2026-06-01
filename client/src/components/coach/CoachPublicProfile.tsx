import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User as UserIcon, Award, Target, Trophy, Mail, Phone, MessageCircle, Edit } from "lucide-react";
import { User, CoachInfo } from "@shared/schema";
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CoachPublicProfileProps {
  user: User;
  coachInfo: CoachInfo | null;
  isLoading: boolean;
}

export default function CoachPublicProfile({ user, coachInfo, isLoading }: CoachPublicProfileProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [nameForm, setNameForm] = useState({
    firstName: (user.firstName && typeof user.firstName === 'string' ? user.firstName : '') as string,
    lastName: (user.lastName && typeof user.lastName === 'string' ? user.lastName : '') as string
  });

  const updateNameMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('profileUpdated') || 'Profile updated',
        description: t('profileUpdatedSuccess') || 'Your profile has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditNameOpen(false);
    },
    onError: () => {
      toast({
        title: t('error') || 'Error',
        description: t('failedToUpdateProfile') || 'Failed to update profile. Please try again.',
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                {(user.firstName && typeof user.firstName === 'string' ? user.firstName[0] : '')}
                {(user.lastName && typeof user.lastName === 'string' ? user.lastName[0] : '')}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">
                  {user.firstName && typeof user.firstName === 'string' ? user.firstName : ''}{' '}
                  {user.lastName && typeof user.lastName === 'string' ? user.lastName : ''}
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNameForm({
                      firstName: (user.firstName && typeof user.firstName === 'string' ? user.firstName : '') as string,
                      lastName: (user.lastName && typeof user.lastName === 'string' ? user.lastName : '') as string
                    });
                    setEditNameOpen(true);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="default" className="text-sm">
                  {t('coachTrainer') || 'Coach / Trainer'}
                </Badge>
                {user.username && typeof user.username === 'string' ? (
                  <span className="text-sm text-gray-500">@{String(user.username)}</span>
                ) : null}
              </div>
              {coachInfo?.aboutMe && (
                <p className="text-gray-700 leading-relaxed">
                  {coachInfo.aboutMe}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Qualifications Section */}
      {coachInfo?.qualifications && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {t('qualifications') || 'Qualifications'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">
                {coachInfo.qualifications}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Professional Certificates */}
      {coachInfo?.certificateImages && coachInfo.certificateImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {t('professionalCertificates') || 'Professional Certificates'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {coachInfo.certificateImages.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`${t('certificate') || 'Certificate'} ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg border border-border hover:shadow-lg transition-shadow"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training Approach */}
      {coachInfo?.trainingApproach && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t('trainingApproach') || 'Training Approach'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">
                {coachInfo.trainingApproach}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Stories */}
      {coachInfo?.successStories && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t('successStories') || 'Success Stories'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">
                {coachInfo.successStories}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services and Programs */}
      {coachInfo?.servicesAndPrograms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              {t('servicesAndPrograms') || 'Services and Programs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">
                {coachInfo.servicesAndPrograms}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Information */}
      {coachInfo?.contact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {t('contactInformation') || 'Contact Information'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">
                {coachInfo.contact}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!coachInfo?.aboutMe && 
       !coachInfo?.qualifications && 
       !coachInfo?.trainingApproach && 
       !coachInfo?.successStories && 
       !coachInfo?.servicesAndPrograms && 
       !coachInfo?.contact &&
       (!coachInfo?.certificateImages || coachInfo.certificateImages.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center">
            <UserIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('profileNotComplete') || 'Profile Not Yet Complete'}
            </h3>
            <p className="text-gray-500">
              {t('profileNotCompleteDescription') || 'This coach has not yet completed their public profile.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Name Dialog */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('editName') || 'Edit Name'}</DialogTitle>
            <DialogDescription>
              {t('updateYourName') || 'Update your first and last name'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateNameMutation.mutate(nameForm);
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="firstName">{t('firstName') || 'First Name'}</Label>
              <Input
                id="firstName"
                value={nameForm.firstName}
                onChange={(e) => setNameForm({ ...nameForm, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">{t('lastName') || 'Last Name'}</Label>
              <Input
                id="lastName"
                value={nameForm.lastName}
                onChange={(e) => setNameForm({ ...nameForm, lastName: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditNameOpen(false)}
              >
                {t('cancel') || 'Cancel'}
              </Button>
              <Button type="submit" disabled={updateNameMutation.isPending}>
                {updateNameMutation.isPending ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
