import * as React from "react"
import { cn } from "@/lib/utils"
import { IconCircle, IconCircleProps } from "./icon-circle"

export interface IconTextProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode
  iconColor?: IconCircleProps["color"]
  iconSize?: IconCircleProps["size"]
  spacing?: "sm" | "default" | "lg"
  children: React.ReactNode
}

const spacingClasses = {
  sm: "gap-2",
  default: "gap-3",
  lg: "gap-4",
}

const IconText = React.forwardRef<HTMLDivElement, IconTextProps>(
  ({ className, icon, iconColor, iconSize, spacing = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center",
          spacingClasses[spacing],
          className
        )}
        {...props}
      >
        <IconCircle color={iconColor} size={iconSize}>
          {icon}
        </IconCircle>
        <div className="flex-1">{children}</div>
      </div>
    )
  }
)
IconText.displayName = "IconText"

export { IconText }
