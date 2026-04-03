import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

interface FormFieldProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, children, className = "" }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-lg font-medium leading-snug text-neutral-900">{label}</label>
      {children}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className = "", error, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={`w-full border-0 border-b-2 border-app-border bg-transparent py-2 text-xl outline-none placeholder:text-neutral-400 focus:border-neutral-600 ${
        error ? "border-red-500" : ""
      } ${className}`}
      {...rest}
    />
  );
});
