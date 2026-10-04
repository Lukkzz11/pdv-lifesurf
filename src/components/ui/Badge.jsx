import { forwardRef } from "react";
import { cn } from "../../utils/cn";

const badgeVariants = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  neutral: "bg-slate-800 text-slate-300 border-slate-700",
  outline: "bg-transparent text-slate-300 border-slate-600"
};

const dotColors = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-rose-400",
  info: "bg-sky-400",
  neutral: "bg-slate-400",
  outline: "bg-slate-400"
};

export const Badge = forwardRef(
  (
    {
      className,
      variant = "neutral",
      size = "md",
      withDot = false,
      pulseDot = false,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "text-[10px] px-2 py-0.5 gap-1",
      md: "text-xs px-2.5 py-1 gap-1.5"
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-medium rounded-full border tracking-wide uppercase select-none",
          badgeVariants[variant] || badgeVariants.neutral,
          sizeClasses[size] || sizeClasses.md,
          className
        )}
        {...props}
      >
        {withDot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              dotColors[variant] || dotColors.neutral,
              pulseDot && "animate-pulse"
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
export default Badge;
