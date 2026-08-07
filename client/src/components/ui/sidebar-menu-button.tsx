
import React from "react";
import { cn } from "@/lib/utils";

type ButtonElement = HTMLButtonElement;

interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<ButtonElement> {
  asChild?: boolean; // if true, render a div/span like a Slot wrapper
  isActive?: boolean;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      className,
      ...props
    },
    ref
  ) => {
  const Comp: any = asChild ? 'div' : 'button';

    return (
      <Comp
        // Only forward the ref when it's actually a button element
        ref={!asChild ? (ref as any) : undefined}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(
          "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:transition-all [&_svg]:duration-150 active:[&_svg]:brightness-125 active:[&_svg]:scale-95",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
          variant === "outline" && "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
          size === "sm" && "h-7 text-xs",
          size === "lg" && "h-12 text-sm",
          className
        )}
        {...props}
      />
    );
  }
);

SidebarMenuButton.displayName = "SidebarMenuButton";
