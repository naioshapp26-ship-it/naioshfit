import { motion } from "framer-motion";
import { Link } from "wouter";
import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

type RentSystemCTAProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "header";
  showIcon?: boolean;
};

export function RentSystemCTA({
  className,
  size = "md",
  variant = "primary",
  showIcon = true,
}: RentSystemCTAProps) {
  const sizeClasses = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-base",
    lg: "h-14 px-10 text-lg",
  };

  const variantClasses =
    variant === "header"
      ? "bg-white text-[#8B0000] border border-[#E5E5E5] hover:bg-[#F5F5F5] shadow-sm backdrop-blur-md"
      : "bg-white text-[#8B0000] border border-white/30 hover:bg-white/95 shadow-[0_0_24px_rgba(255,255,255,0.35)] hover:shadow-[0_0_32px_rgba(255,200,200,0.55)]";

  return (
    <Link href="/saas">
      <motion.span
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold cursor-pointer transition-colors",
          sizeClasses[size],
          variantClasses,
          className,
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        {showIcon && (
          <motion.span
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          >
            <Rocket className="h-4 w-4 md:h-5 md:w-5" />
          </motion.span>
        )}
        <span>🚀 استأجر نظام الآن</span>
      </motion.span>
    </Link>
  );
}

export default RentSystemCTA;
