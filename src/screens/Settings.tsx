import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function Settings() {
  const { store, submitUpdateStoreName } = useAppStore();
  const [name, setName] = useState(store.name);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(store.name);
  }, [store.name]);

  async function handleSave() {
    setSaved(false);
    const result = await submitUpdateStoreName(name);
    if (!result.ok) {
      setErrors(result.errors ?? ['บันทึกไม่สำเร็จ']);
      return;
    }
    setErrors([]);
    setSaved(true);
  }

  const dirty = name !== store.name;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-warmgray-900">ตั้งค่า</h1>
        <p className="text-sm text-warmgray-500">ตั้งค่าพื้นฐานของร้าน</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">ชื่อร้าน</label>
            <input
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-warmgray-500">สกุลเงิน</label>
            <div className="flex min-h-touch w-full items-center rounded-md border border-warmgray-200 bg-warmgray-50 px-3 text-[15px] text-warmgray-500">
              {store.currency}
            </div>
            <p className="mt-1 text-xs text-warmgray-400">แสดงผลเท่านั้น — V1 รองรับสกุลเงินเดียว</p>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-danger-500/40 bg-danger-50/40 p-3 text-sm text-danger-700">
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}

          {saved && <div className="rounded-md border border-success-500/40 bg-success-50/40 p-3 text-sm text-success-700">บันทึกแล้ว</div>}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!dirty || !name.trim()}>
              บันทึก
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
