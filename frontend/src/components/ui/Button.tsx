import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-amber text-ink hover:bg-amber-500 active:bg-amber-600 border border-amber-600/20 shadow-sm",
  secondary:
    "bg-paper text-ink border border-line-strong hover:bg-cream-100",
  ghost: "bg-transparent text-ink-600 hover:bg-cream-100 border border-transparent",
  danger: "bg-danger text-white hover:opacity-90 border border-transparent",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-6 py-3.5 gap-2",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type LinkButtonProps = BaseProps & {
  href: string;
  children?: React.ReactNode;
  target?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  href,
  ...props
}: ButtonProps | LinkButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className
  );

  if (href) {
    const { children, target } = props as LinkButtonProps;
    return (
      <Link href={href} target={target} className={classes}>
        {children}
      </Link>
    );
  }

  return <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
