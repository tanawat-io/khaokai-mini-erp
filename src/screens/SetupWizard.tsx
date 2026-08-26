// First-run Setup Wizard (Phase 3B §14) — minimum scope per Phase 2D's own finding: store name +
// currency display + finish. Every other "step" in PRODUCT_SPEC.md/USER_FLOWS.md's flow reuses
// existing screens (Ingredients/Menus/etc.) rather than duplicating them here. Currency is
// read-only in V1 (UI_SPEC.md §11b) — nothing to configure for it, just a confirmation step.

import { useState } from 'react';
import { useAppStore } from '@/state/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const store = useAppStore((s) => s.store);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(store.name);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function finish() {
    if (!name.trim()) {
      setError('กรุณาระบุชื่อร้าน');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError('บันทึกไม่สำเร็จ กรุณาลองใหม่');
      return;
    }
    onComplete();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-warmgray-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-warmgray-400">ขั้นตอนที่ {step} จาก 2</div>
            <h1 className="text-xl font-semibold text-warmgray-900">ตั้งค่าร้านครั้งแรก</h1>
          </div>

          {step === 1 ? (
            <>
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">ชื่อร้าน</label>
                <input
                  autoFocus
                  className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={!name.trim()} onClick={() => setStep(2)}>
                ถัดไป
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm text-warmgray-500">สกุลเงิน</label>
                <div className="flex min-h-touch w-full items-center rounded-md border border-warmgray-200 bg-warmgray-50 px-3 text-[15px] text-warmgray-500">
                  {store.currency}
                </div>
                <p className="mt-1 text-xs text-warmgray-400">แสดงผลเท่านั้น — V1 รองรับสกุลเงินเดียว</p>
              </div>

              {error && <div className="rounded-md border border-danger-500/40 bg-danger-50/40 p-3 text-sm text-danger-700">{error}</div>}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  ย้อนกลับ
                </Button>
                <Button className="flex-1" disabled={submitting} onClick={finish}>
                  {submitting ? 'กำลังบันทึก...' : 'เริ่มใช้งาน'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
