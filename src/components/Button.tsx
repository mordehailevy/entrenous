import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'gradient-accent text-white hover:opacity-90 shadow-sm',
  secondary: 'bg-white border border-gray-200 text-ink hover:bg-gray-50',
  ghost: 'bg-transparent text-ink hover:bg-gray-100',
  danger: 'bg-debt-bg text-debt hover:bg-red-100',
  success: 'bg-credit-bg text-credit hover:bg-green-100',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 outline-none focus:ring-2 focus:ring-[--color-accent-start] focus:ring-offset-2 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
