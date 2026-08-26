import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '', ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`rounded-lg border border-warmgray-200 bg-white p-4 shadow-resting ${className}`} {...rest}>
      {children}
    </div>
  );
}
