import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        gold: "text-white bg-[linear-gradient(135deg,#c9a35f_0%,#b68d40_50%,#92702e_100%)] shadow-[0_8px_20px_-8px_rgba(146,112,46,0.65)] hover:shadow-[0_12px_28px_-8px_rgba(146,112,46,0.75)] hover:brightness-[1.06]",
        outline: "border border-champagne/70 bg-white/70 text-gold-dark hover:bg-white hover:border-gold backdrop-blur",
        ghost: "text-ink/80 hover:bg-cream hover:text-ink",
        soft: "bg-cream text-gold-deep hover:bg-sand",
        dark: "bg-ink text-white hover:bg-black",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
        "danger-outline": "border border-rose-200 text-rose-700 bg-white hover:bg-rose-50",
        link: "text-gold-dark underline-offset-4 hover:underline rounded-none px-0",
        whatsapp: "bg-[#1f9d55] text-white hover:bg-[#178246] shadow-[0_8px_20px_-10px_rgba(31,157,85,0.7)]",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-6",
        lg: "h-13 px-8 text-[15px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
