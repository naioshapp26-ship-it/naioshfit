import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User as UserIcon, Loader2, LogIn, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AiAgentChatProps {
  compact?: boolean;
  onRequireAuth?: () => void;
}

export function AiAgentChat({ compact = false, onRequireAuth }: AiAgentChatProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [guestChatEnabled, setGuestChatEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canChat = Boolean(user) || guestChatEnabled;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !canChat) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: input,
          language: language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to get response from AI Agent');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: t('error') || 'Error',
        description: error.message || 'Failed to send message to AI Agent',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!canChat) {
    return (
      <Card className="h-full flex flex-col border-border/70 bg-gradient-to-b from-background to-muted/20 shadow-lg">
        <CardHeader className={cn("space-y-2", compact ? "pb-4" : "pb-5")}>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {language === 'ar' ? 'وكيل الذكاء الاصطناعي' : 'AI Agent Chat'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'يمكنك تسجيل الدخول للحصول على ردود شخصية، أو المتابعة كضيف للدردشة العامة.'
              : 'Sign in for personalized responses, or continue as a guest for general chat.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="rounded-2xl border bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
              {language === 'ar'
                ? 'مرحباً! اختر بين تسجيل الدخول للحصول على نصائح مخصصة لملفك، أو المتابعة كضيف لبدء دردشة سريعة الآن.'
                : 'Hi! Choose sign in for profile-based guidance, or continue as guest to start chatting right away.'}
            </div>
            <Badge variant="secondary" className="w-fit">
              {language === 'ar' ? 'متاح من أي صفحة عامة' : 'Available from any public page'}
            </Badge>
          </div>
          <div className="space-y-3 border-t pt-4">
            <Button className="w-full gap-2" onClick={onRequireAuth ?? (() => {})} disabled={!onRequireAuth}>
              <LogIn className="h-4 w-4" />
              {language === 'ar' ? 'تسجيل الدخول للمتابعة' : 'Sign in to continue'}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 border-primary/25 bg-primary/5 hover:bg-primary/10"
              onClick={() => setGuestChatEnabled(true)}
            >
              <UserRound className="h-4 w-4" />
              {language === 'ar' ? 'المتابعة كضيف' : 'Continue as guest'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border-border/70 bg-gradient-to-b from-background via-background to-muted/20 shadow-lg">
      <CardHeader className={cn("space-y-2 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent", compact ? "pb-4" : "pb-5")}>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          {language === 'ar' ? 'وكيل الذكاء الاصطناعي' : 'AI Agent Chat'}
        </CardTitle>
        <CardDescription className={compact ? "text-xs sm:text-sm" : undefined}>
          {guestChatEnabled
            ? (language === 'ar' ? 'أنت في وضع الضيف — احصل على إرشادات عامة للصحة واللياقة.' : 'You are in guest mode — get general fitness and wellness guidance.')
            : (language === 'ar' ? 'اسأل عن تقدمك، خططك، أو احصل على توصيات شخصية' : 'Ask about your progress, plans, or get personalized recommendations')}
        </CardDescription>
        <Badge variant="secondary" className={cn("w-fit", compact && "text-[11px]")}>
          {guestChatEnabled
            ? (language === 'ar' ? 'وضع الضيف: إجابات عامة' : 'Guest mode: general answers')
            : (language === 'ar' ? 'مدعوم بمعلومات ملفك الشخصي وسجل نشاطك' : 'Powered by your profile and activity data')}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 text-primary/60" />
              <p className="text-lg font-medium mb-2">
                {language === 'ar' ? 'مرحباً! كيف يمكنني مساعدتك اليوم؟' : 'Hello! How can I help you today?'}
              </p>
              <p className="text-sm">
                {language === 'ar' 
                  ? 'اسألني عن تقدمك، خطة التمرين، التغذية، أو أي شيء متعلق بصحتك'
                  : 'Ask me about your progress, workout plan, nutrition, or anything related to your health'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={msg.role === 'user' ? 'bg-primary' : 'bg-secondary'}>
                      {msg.role === 'user' ? (
                        <UserIcon className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`flex-1 rounded-2xl border p-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'border-primary/20 bg-primary text-primary-foreground ml-12'
                        : 'border-border/70 bg-muted/70 backdrop-blur-sm mr-12'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {msg.timestamp.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-2xl border border-border/70 p-3 bg-muted/70 mr-12 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        {language === 'ar' ? 'جاري التفكير...' : 'Thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        <div className="p-4 border-t bg-background/90">
          <div className="flex gap-2">
            <Input
              placeholder={language === 'ar' ? 'اطرح سؤالك...' : 'Ask your question...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className={cn("border-border/70 bg-background/95", language === 'ar' ? 'text-right' : '')}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
