import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileSwipeMenuProps {
  items: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
    badge?: number;
  }>;
  defaultActiveId?: string;
  onActiveChange?: (id: string) => void;
  className?: string;
}

export const MobileSwipeMenu: React.FC<MobileSwipeMenuProps> = ({
  items,
  defaultActiveId,
  onActiveChange,
  className,
}) => {
  const [activeId, setActiveId] = useState(defaultActiveId || items[0]?.id);
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeIndex = items.findIndex(item => item.id === activeId);

  const handleTabChange = (id: string) => {
    setActiveId(id);
    onActiveChange?.(id);
  };

  const goToPrevious = () => {
    if (activeIndex > 0) {
      handleTabChange(items[activeIndex - 1].id);
    }
  };

  const goToNext = () => {
    if (activeIndex < items.length - 1) {
      handleTabChange(items[activeIndex + 1].id);
    }
  };

  // Touch handlers for swipe functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    
    const currentTouch = e.touches[0].clientX;
    setCurrentX(currentTouch);
    
    const diffX = Math.abs(currentTouch - startX);
    if (diffX > 10) {
      setIsDragging(true);
      e.preventDefault(); // Prevent scroll
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startX === null || currentX === null) return;

    const endX = e.changedTouches[0].clientX;
    const diffX = startX - endX;
    const threshold = 75;

    if (Math.abs(diffX) > threshold && isDragging) {
      if (diffX > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    setStartX(null);
    setCurrentX(null);
    setIsDragging(false);
  };

  // Scroll active tab into view
  useEffect(() => {
    if (menuRef.current && activeId) {
      const activeElement = menuRef.current.querySelector(
        `[data-tab-id="${activeId}"]`
      ) as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeId]);

  return (
    <div className={cn("w-full", className)}>
      {/* Tab Menu */}
      <div className="relative">
        <div
          ref={menuRef}
          className="flex overflow-x-auto scrollbar-hide pb-2 px-1 snap-x snap-mandatory touch-pan-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              data-tab-id={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "flex-shrink-0 snap-center",
                "flex items-center gap-2",
                "px-4 py-3 mx-1",
                "text-sm font-medium",
                "rounded-lg",
                "whitespace-nowrap",
                "touch-manipulation",
                "transition-all duration-200",
                "border-2",
                activeId === item.id
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              )}
            >
              {item.icon && (
                <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
              )}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  "ml-1 px-2 py-0.5 text-xs font-bold rounded-full",
                  activeId === item.id
                    ? "bg-primary-foreground text-primary"
                    : "bg-primary text-primary-foreground"
                )}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Navigation Arrows for larger screens */}
        <div className="hidden md:flex absolute inset-y-0 left-0 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevious}
            disabled={activeIndex === 0}
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden md:flex absolute inset-y-0 right-0 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={activeIndex === items.length - 1}
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      <div
        ref={contentRef}
        className="mt-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "transition-opacity duration-200",
              activeId === item.id ? "block" : "hidden"
            )}
          >
            {item.content}
          </div>
        ))}
      </div>

      {/* Swipe Indicator */}
      {items.length > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                activeId === item.id
                  ? "bg-primary w-6"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileSwipeMenu;