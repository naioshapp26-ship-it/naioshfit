import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SwipeableTabsProps {
  children: React.ReactNode;
  defaultValue: string;
  className?: string;
  onValueChange?: (value: string) => void;
}

interface SwipeableTabsListProps extends React.ComponentPropsWithoutRef<typeof TabsList> {
  children: React.ReactNode;
}

interface SwipeableTabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface SwipeableTabsContentProps extends React.ComponentPropsWithoutRef<typeof TabsContent> {
  value: string;
  children: React.ReactNode;
}

const SwipeableTabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
  tabs: string[];
  setTabs: React.Dispatch<React.SetStateAction<string[]>>;
}>({
  activeTab: "",
  setActiveTab: () => {},
  tabs: [],
  setTabs: () => {},
});

export const SwipeableTabs: React.FC<SwipeableTabsProps> = ({
  children,
  defaultValue,
  className,
  onValueChange,
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const [tabs, setTabs] = useState<string[]>([]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onValueChange?.(value);
  };

  return (
    <SwipeableTabsContext.Provider
      value={{ activeTab, setActiveTab: handleTabChange, tabs, setTabs }}
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className={className}>
        {children}
      </Tabs>
    </SwipeableTabsContext.Provider>
  );
};

export const SwipeableTabsList: React.FC<SwipeableTabsListProps> = ({
  children,
  className,
  ...props
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { activeTab, tabs } = React.useContext(SwipeableTabsContext);

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (listRef.current && activeTab) {
      const activeElement = listRef.current.querySelector(
        `[data-value="${activeTab}"]`
      ) as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeTab]);

  return (
    <div className="w-full overflow-hidden">
      <TabsList
        ref={listRef}
        className={cn(
          "w-full h-auto p-1 bg-muted rounded-lg",
          "flex overflow-x-auto scrollbar-hide",
          "snap-x snap-mandatory",
          "touch-pan-x",
          "md:justify-center md:overflow-visible",
          className
        )}
        {...props}
      >
        {children}
      </TabsList>
    </div>
  );
};

export const SwipeableTabsTrigger: React.FC<SwipeableTabsTriggerProps> = ({
  value,
  children,
  className,
}) => {
  const { setTabs } = React.useContext(SwipeableTabsContext);

  useEffect(() => {
    setTabs(prev => {
      if (!prev.includes(value)) {
        return [...prev, value];
      }
      return prev;
    });
  }, [value, setTabs]);

  return (
    <TabsTrigger
      value={value}
      data-value={value}
      className={cn(
        "flex-shrink-0 snap-center",
        "px-4 py-2.5 md:px-6 md:py-3",
        "text-sm font-medium",
        "whitespace-nowrap",
        "min-w-fit",
        "touch-manipulation",
        "data-[state=active]:bg-background",
        "data-[state=active]:text-foreground",
        "data-[state=active]:shadow-sm",
        "transition-all duration-200",
        "hover:bg-background/50",
        className
      )}
    >
      {children}
    </TabsTrigger>
  );
};

export const SwipeableTabsContent: React.FC<SwipeableTabsContentProps> = ({
  value,
  children,
  className,
  ...props
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { activeTab, setActiveTab, tabs } = React.useContext(SwipeableTabsContext);
  const [startX, setStartX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const currentIndex = tabs.indexOf(activeTab);
  const targetIndex = tabs.indexOf(value);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    
    const currentX = e.touches[0].clientX;
    const diffX = Math.abs(currentX - startX);
    
    if (diffX > 10) {
      setIsDragging(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startX === null || !isDragging) {
      setStartX(null);
      setIsDragging(false);
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const diffX = startX - endX;
    const threshold = 75; // Minimum swipe distance

    if (Math.abs(diffX) > threshold) {
      if (diffX > 0 && currentIndex < tabs.length - 1) {
        // Swipe left - next tab
        setActiveTab(tabs[currentIndex + 1]);
      } else if (diffX < 0 && currentIndex > 0) {
        // Swipe right - previous tab
        setActiveTab(tabs[currentIndex - 1]);
      }
    }

    setStartX(null);
    setIsDragging(false);
  };

  if (value !== activeTab) {
    return null;
  }

  return (
    <TabsContent
      ref={contentRef}
      value={value}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "mt-4 outline-none",
        "touch-pan-y",
        "select-none md:select-auto",
        className
      )}
      {...props}
    >
      {children}
    </TabsContent>
  );
};

// Export the context for custom usage
export const useSwipeableTabs = () => React.useContext(SwipeableTabsContext);