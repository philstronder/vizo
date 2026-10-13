import { cn } from "@/lib/cn";
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-sm font-semibold text-ink mb-1.5", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-400 outline-none transition-shadow focus:ring-2 focus:ring-amber/60 focus:border-amber-500",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-400 outline-none transition-shadow focus:ring-2 focus:ring-amber/60 focus:border-amber-500 min-h-24 resize-y",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-shadow focus:ring-2 focus:ring-amber/60 focus:border-amber-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldGroup({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex items-center gap-2 text-sm text-ink-600 cursor-pointer select-none", className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-line-strong text-amber-600 accent-amber focus:ring-amber/60"
        {...props}
      />
      {label}
    </label>
  );
}

export function Radio({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex items-center gap-2 text-sm text-ink-600 cursor-pointer select-none", className)}>
      <input
        type="radio"
        className="h-4 w-4 border-line-strong text-amber-600 accent-amber focus:ring-amber/60"
        {...props}
      />
      {label}
    </label>
  );
}
