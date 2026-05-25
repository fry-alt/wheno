import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "sm";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-foreground text-background shadow-[0_24px_55px_-28px_rgba(8,20,39,0.82)] hover:translate-y-[-1px] hover:opacity-95",
  secondary:
    "bg-card-muted text-foreground ring-1 ring-border/80 hover:bg-background/72 hover:translate-y-[-1px]",
  ghost: "bg-transparent text-muted ring-1 ring-border/70 hover:bg-card-muted hover:text-foreground",
  danger: "bg-danger text-white shadow-[0_18px_40px_-24px_rgba(227,91,125,0.75)] hover:opacity-95",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-5 text-sm font-semibold",
  sm: "h-10 px-4 text-[0.82rem] font-semibold",
};

export function buttonStyles({
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center rounded-[20px] transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function Button({
  className,
  variant,
  size,
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
