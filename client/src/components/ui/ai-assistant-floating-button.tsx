import { Bot, X } from "lucide-react";
import { Button } from "./button";
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from "wouter";
import { AiAgentChat } from "@/components/ai/AiAgentChat";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AiAssistantFloatingButton() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleOpenAiAssistant = () => {
    setIsChatOpen((prev) => !prev);
  };

  const sideClass = language === "ar" ? "left-4 md:left-6" : "right-4 md:right-6";

  return (
    <>
      {isChatOpen && (
        <div
          data-ai-assistant-widget
          className={cn(
            "fixed z-[9998] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-3xl border border-primary/15 bg-background/95 backdrop-blur-xl shadow-2xl",
            "bottom-28 md:bottom-32 max-h-[min(32rem,calc(100vh-8rem))]",
            sideClass
          )}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-16 rounded-full bg-primary/20 blur-2xl" />
          <button
            type="button"
            onClick={() => setIsChatOpen(false)}
            className="absolute top-3 right-3 z-10 rounded-full border border-border/60 bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label={language === "ar" ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
          <div className="h-[28rem]">
            <AiAgentChat compact onRequireAuth={() => navigate("/auth")} />
          </div>
        </div>
      )}

      <div className={`fixed bottom-8 md:bottom-10 ${sideClass} z-[9999]`}>
        <Button
          data-ai-assistant-trigger
          size="lg"
          onClick={handleOpenAiAssistant}
          className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-br from-primary via-primary to-primary/85 hover:scale-[1.03] text-white border border-white/15"
          aria-label={t('aiAssistant')}
          title={t('aiAssistant')}
        >
          <Bot className="h-6 w-6 text-white" />
        </Button>
      </div>
    </>
  );
}
