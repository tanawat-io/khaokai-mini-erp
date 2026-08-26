interface Props {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start justify-between gap-3 rounded-md border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
    >
      <div className="flex-1">
        <div className="font-medium">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>
        <div className="mt-0.5 text-danger-600">{message}</div>
        <div className="mt-1 text-xs text-danger-600/80">กรุณาตรวจสอบการเชื่อมต่อหรือลองรีเฟรชหน้า</div>
      </div>
      <button
        type="button"
        aria-label="ปิดข้อความแจ้งเตือน"
        onClick={onDismiss}
        className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md px-2 text-danger-700 hover:bg-danger-100"
      >
        ✕
      </button>
    </div>
  );
}
