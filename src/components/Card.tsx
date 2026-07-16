import type { ComponentPropsWithRef } from 'react';

export function Card({ className = '', ref, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}
      {...props}
    />
  );
}
