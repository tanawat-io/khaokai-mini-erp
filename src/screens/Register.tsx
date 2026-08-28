import { useState } from 'react';
import { useAuthStore } from '@/state/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function Register({ onLoginClick }: { onLoginClick: () => void }) {
  const register = useAuthStore((s) => s.register);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await register(username, password);
    setSubmitting(false);
    if (!result.ok) setError(result.error ?? 'สมัครสมาชิกไม่สำเร็จ');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-warmgray-50 px-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-warmgray-900">สมัครสมาชิก</h1>
            <p className="text-sm text-warmgray-500">Food Cost &amp; Profit Mini ERP</p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-warmgray-500">ชื่อผู้ใช้</label>
            <input
              autoFocus
              name="username"
              autoComplete="username"
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">รหัสผ่าน</label>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-warmgray-400">อย่างน้อย 8 ตัวอักษร</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <div className="rounded-md border border-danger-500/40 bg-danger-50/40 p-3 text-sm text-danger-700">{error}</div>}

          <Button type="submit" className="w-full" disabled={submitting || !username || !password || !confirmPassword}>
            {submitting ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
          </Button>

          <button
            type="button"
            onClick={onLoginClick}
            className="w-full text-center text-sm text-warmgray-500 underline-offset-2 hover:underline"
          >
            มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
          </button>
        </form>
      </Card>
    </div>
  );
}
