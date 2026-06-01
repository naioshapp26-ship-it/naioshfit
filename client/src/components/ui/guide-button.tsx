import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useLanguage } from '@/context/LanguageContext';
import { getGuideForPage } from '@/lib/guide-content';
import { BookOpen, X, Info, Lightbulb, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GuideButtonProps {
  className?: string;
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const GuideButton: React.FC<GuideButtonProps> = ({
  className = '',
  variant = 'outline',
  size = 'sm',
}) => {
  const [location] = useLocation();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const isRTL = language === 'ar';

  // Get guide content for current page
  const guideContent = getGuideForPage(location, language);

  // Reset panel when page changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const buttonLabel = language === 'ar' ? 'دليل' : 'Guide';

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        variant={variant}
        size={size as any}
        className={cn(
          'font-medium transition-all hover:scale-105',
          className
        )}
        title={buttonLabel}
      >
        <BookOpen className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
        {buttonLabel}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={isRTL ? 'right' : 'left'}
          className={cn(
            'w-[400px] sm:w-[540px] bg-gradient-to-br from-white to-gray-50 border-2',
            isRTL ? 'text-right' : 'text-left'
          )}
        >
          {/* Custom close button for better positioning in RTL */}
          <button
            onClick={() => setIsOpen(false)}
            className={cn(
              'absolute top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10',
              isRTL ? 'left-4' : 'right-4'
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>

          <ScrollArea className="h-full pr-4">
            <div className="space-y-6 pb-6">
              {/* Header Section */}
              <SheetHeader className={cn('space-y-3 pt-2', isRTL && 'text-right')}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                    {guideContent?.pageTitle || (language === 'ar' ? 'دليل الصفحة' : 'Page Guide')}
                  </SheetTitle>
                </div>
              </SheetHeader>

              {guideContent ? (
                <>
                  {/* Page Explanation */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className={cn(
                          'font-semibold text-gray-900 mb-2',
                          isRTL && 'text-right'
                        )}>
                          {language === 'ar' ? 'ما هذه الصفحة؟' : 'What is this page?'}
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {guideContent.pageExplanation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Important Buttons Section */}
                  {guideContent.importantButtons && guideContent.importantButtons.length > 0 && (
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="flex items-start gap-3 mb-3">
                        <KeyRound className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900">
                          {language === 'ar' ? 'الأزرار الهامة' : 'Important Buttons'}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {guideContent.importantButtons.map((button, index) => (
                          <div
                            key={index}
                            className="pl-8 border-l-2 border-green-200 py-2"
                          >
                            <p className="font-medium text-green-700 mb-1">
                              {button.title}
                            </p>
                            <p className="text-sm text-gray-600">
                              {button.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Fields Section */}
                  {guideContent.mainFields && guideContent.mainFields.length > 0 && (
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="flex items-start gap-3 mb-3">
                        <Info className="h-5 w-5 text-purple-500 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900">
                          {language === 'ar' ? 'الحقول الرئيسية' : 'Main Fields'}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {guideContent.mainFields.map((field, index) => (
                          <div
                            key={index}
                            className="pl-8 border-l-2 border-purple-200 py-2"
                          >
                            <p className="font-medium text-purple-700 mb-1">
                              {field.title}
                            </p>
                            <p className="text-sm text-gray-600">
                              {field.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes & Tips Section */}
                  {guideContent.notesAndTips && guideContent.notesAndTips.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-4 shadow-sm border border-amber-200">
                      <div className="flex items-start gap-3 mb-3">
                        <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900">
                          {language === 'ar' ? 'نصائح وملاحظات' : 'Notes & Tips'}
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {guideContent.notesAndTips.map((tip, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <span className="text-amber-500 flex-shrink-0 mt-0.5">●</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {language === 'ar'
                    ? 'لا يوجد دليل متاح لهذه الصفحة'
                    : 'No guide available for this page'}
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-200">
                {language === 'ar'
                  ? 'هل تحتاج مساعدة إضافية؟ تواصل مع الدعم'
                  : 'Need more help? Contact support'}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default GuideButton;
