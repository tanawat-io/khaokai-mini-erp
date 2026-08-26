import type { ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const toneClasses: Record<Tone, string> = {
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-600',
  neutral: 'bg-warmgray-100 text-warmgray-600',
  primary: 'bg-orange-50 text-orange-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
