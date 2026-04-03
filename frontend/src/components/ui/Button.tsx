import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center rounded-lg px-4 py-3 text-base font-medium transition-opacity disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-app-primaryGreen text-white hover:opacity-90",
  outline: "border-2 border-app-border bg-transparent text-neutral-900 hover:bg-app-surface",
  ghost: "bg-transparent text-neutral-700 hover:bg-app-surface",
};

export default function Button({
  variant = "primary",
  fullWidth,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
