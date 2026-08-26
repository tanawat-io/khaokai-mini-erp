import { useState } from 'react';
import { useAuthStore } from '@/state/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function Login() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(username, password);
    setSubmitting(false);
    if (!result.ok) setError(result.error ?? 'เข้าสู่ระบบไม่สำเร็จ');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-warmgray-50 px-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-warmgray-900">เข้าสู่ระบบ</h1>
            <p className="text-sm text-warmgray-500">Food Cost &amp; Profit Mini ERP</p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-warmgray-500">ชื่อผู้ใช้</label>
            <input
              autoFocus
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-warmgray-500">รหัสผ่าน</label>
            <input
              type="password"
              className="min-h-touch w-full rounded-md border border-warmgray-300 px-3 text-[15px]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="rounded-md border border-danger-500/40 bg-danger-50/40 p-3 text-sm text-danger-700">{error}</div>}

          <Button type="submit" className="w-full" disabled={submitting || !username || !password}>
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
