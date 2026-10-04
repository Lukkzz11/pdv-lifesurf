import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Card = forwardRef(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default:
        "bg-slate-900/80 backdrop-blur-md border border-slate-800/90 text-slate-100 shadow-xl rounded-xl",
      interactive:
        "bg-slate-900/80 backdrop-blur-md border border-slate-800/90 hover:border-sky-500/50 hover:shadow-sky-500/10 text-slate-100 shadow-xl rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.99]",
      subtle:
        "bg-slate-850/50 backdrop-blur-sm border border-slate-800/60 text-slate-100 rounded-xl",
      flat:
        "bg-slate-900 text-slate-100 border border-slate-800 rounded-xl"
    };

    return (
      <div
        ref={ref}
        className={cn(variants[variant] || variants.default, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 border-b border-slate-800/60", className)}
    {...props}
  >
    {children}
  </div>
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold tracking-tight text-white", className)}
    {...props}
  >
    {children}
  </h3>
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-slate-400 font-normal", className)}
    {...props}
  >
    {children}
  </p>
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("p-5", className)} {...props}>
    {children}
  </div>
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0 border-t border-slate-800/60 mt-4", className)}
    {...props}
  >
    {children}
  </div>
));
CardFooter.displayName = "CardFooter";

export default Card;
