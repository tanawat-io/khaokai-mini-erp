import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 disabled:bg-warmgray-200 disabled:text-warmgray-400',
  secondary:
    'bg-white text-warmgray-900 border border-warmgray-300 hover:bg-warmgray-50 active:bg-warmgray-100 disabled:text-warmgray-300 disabled:border-warmgray-200',
  tertiary: 'bg-transparent text-orange-600 hover:bg-orange-50 active:bg-orange-100 disabled:text-warmgray-300',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 disabled:bg-warmgray-200 disabled:text-warmgray-400',
};

const sizeClasses: Record<Size, string> = {
  md: 'min-h-touch px-5 text-[15px]',
  sm: 'min-h-[36px] px-3.5 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
