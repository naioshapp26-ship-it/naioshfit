import * as React from "react"
import { cn } from "@/lib/utils"

export interface IconCircleProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: "blue" | "green" | "purple" | "pink" | "yellow" | "orange" | "red" | "indigo" | "teal"
  size?: "sm" | "default" | "lg"
  children: React.ReactNode
}

const colorClasses = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  pink: "bg-pink-100 text-pink-600",
  yellow: "bg-yellow-100 text-yellow-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-red-100 text-red-600",
  indigo: "bg-indigo-100 text-indigo-600",
  teal: "bg-teal-100 text-teal-600",
}

const sizeClasses = {
  sm: "w-8 h-8 [&_svg]:w-4 [&_svg]:h-4",
  default: "w-10 h-10 [&_svg]:w-5 [&_svg]:h-5",
  lg: "w-12 h-12 [&_svg]:w-6 [&_svg]:h-6",
}

const IconCircle = React.forwardRef<HTMLDivElement, IconCircleProps>(
  ({ className, color = "blue", size = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-full flex items-center justify-center shrink-0",
          "transition-all duration-200",
          colorClasses[color],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
IconCircle.displayName = "IconCircle"

export { IconCircle }
