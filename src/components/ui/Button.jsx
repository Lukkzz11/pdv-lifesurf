import { forwardRef } from "react";
import { cn } from "../../utils/cn";
import { Loader2 } from "lucide-react";

const buttonVariants = {
  primary:
    "bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold shadow-lg shadow-sky-500/20 active:scale-[0.98] border border-sky-400/30",
  secondary:
    "bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium border border-slate-700 active:scale-[0.98]",
  outline:
    "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-700 hover:border-slate-600 active:scale-[0.98]",
  ghost:
    "bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-slate-100 active:scale-[0.98]",
  danger:
    "bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-lg shadow-rose-600/20 border border-rose-500/30 active:scale-[0.98]",
  success:
    "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20 border border-emerald-400/30 active:scale-[0.98]"
};

const buttonSizes = {
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2.5",
  icon: "h-10 w-10 p-0 rounded-lg justify-center",
  iconSm: "h-8 w-8 p-0 rounded-md justify-center"
};

export const Button = forwardRef(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isActuallyDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isActuallyDisabled}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          buttonVariants[variant] || buttonVariants.primary,
          buttonSizes[size] || buttonSizes.md,
          isActuallyDisabled && "opacity-50 cursor-not-allowed active:scale-100 shadow-none pointer-events-none",
          className
        )}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
            {children && <span>{children}</span>}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
