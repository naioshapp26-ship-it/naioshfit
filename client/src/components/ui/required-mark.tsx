import type { ReactNode } from "react";

/** Visible required-field indicator for form labels */
export function RequiredMark() {
  return (
    <span className="text-destructive font-semibold leading-none" aria-hidden="true">
      *
    </span>
  );
}

export function RequiredLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-sm font-medium leading-none inline-flex items-center gap-1 ${className ?? ''}`}
    >
      {children}
      <RequiredMark />
    </label>
  );
}
