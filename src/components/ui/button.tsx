import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "sm";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground active:opacity-80",
  secondary:
    "bg-card text-foreground ring-1 ring-border/80 hover:bg-card-muted active:opacity-80",
  ghost:
    "bg-transparent text-muted ring-1 ring-border/60 hover:bg-card-muted hover:text-foreground active:opacity-80",
  danger:
    "bg-danger text-white active:opacity-80",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-5 text-sm font-semibold",
  sm: "h-9 px-4 text-[0.82rem] font-semibold",
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
    "inline-flex items-center justify-center rounded-xl transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-50",
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
