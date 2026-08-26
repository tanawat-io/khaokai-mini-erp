import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-warmgray-900/45 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="ปิด" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-lg border border-warmgray-200 bg-white p-5 shadow-raised sm:rounded-lg">
        <h2 className="text-lg font-semibold text-warmgray-900">{title}</h2>
        <div className="mt-3 text-sm leading-6 text-warmgray-600">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
