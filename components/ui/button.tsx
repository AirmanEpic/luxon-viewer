import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90",
        ghost: "border border-transparent bg-transparent text-muted-foreground hover:bg-overlay hover:text-foreground",
        outline: "border border-border bg-background text-foreground hover:bg-overlay",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "border border-glass bg-glass text-foreground hover:bg-overlay",
        primary: "border border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
        favorite: "border border-favorite/30 bg-favorite/10 text-favorite hover:bg-favorite/20",
        destructive: "border border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/20",
        danger: "border border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);

Button.displayName = "Button";