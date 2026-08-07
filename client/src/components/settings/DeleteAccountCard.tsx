import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/context/LanguageContext';
import { Trash2 } from 'lucide-react';

export function DeleteAccountCard() {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <AlertDialog>
      <Card className="border-red-100">
        <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CardTitle className={`flex items-center text-red-600 ${isRTL ? 'w-full justify-end text-right' : ''}`}>
            <Trash2 className="ltr:mr-2 rtl:ml-2 h-5 w-5" />
            {t('deleteAccount')}
          </CardTitle>
          <CardDescription>{t('permanentlyDeleteAccount')}</CardDescription>
        </CardHeader>
        <CardContent className={isRTL ? 'text-right' : 'text-left'}>
          <p className="text-gray-500 mb-4">{t('accountDeletionWarning')}</p>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">{t('deleteAccount')}</Button>
          </AlertDialogTrigger>
        </CardContent>
      </Card>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('areYouAbsolutelySure')}</AlertDialogTitle>
          <AlertDialogDescription>{t('actionCannotBeUndone')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700">
            {t('yesDeleteMyAccount')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
