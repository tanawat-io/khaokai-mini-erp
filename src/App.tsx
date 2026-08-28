import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Dashboard } from '@/screens/Dashboard';
import { NewOrder } from '@/screens/NewOrder';
import { OrderDetail } from '@/screens/OrderDetail';
import { OrdersList } from '@/screens/OrdersList';
import { Stock } from '@/screens/Stock';
import { Ingredients } from '@/screens/Ingredients';
import { Menus } from '@/screens/Menus';
import { AddOns } from '@/screens/AddOns';
import { More } from '@/screens/More';
import { Purchases } from '@/screens/Purchases';
import { Processing } from '@/screens/Processing';
import { Waste } from '@/screens/Waste';
import { History } from '@/screens/History';
import { Settings } from '@/screens/Settings';
import { Login } from '@/screens/Login';
import { Register } from '@/screens/Register';
import { SetupWizard } from '@/screens/SetupWizard';
import { useAuthStore } from '@/state/authStore';
import { useAppStore, loadInitialSnapshot } from '@/state/store';
import { setUnauthenticatedHandler } from '@/repository/apiRepository';

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-warmgray-50 text-warmgray-500">กำลังโหลด...</div>;
}

// Gate order: session check → (login if none) → data load → (setup wizard if store isn't set
// up yet) → the normal app. setupComplete is read only from the snapshot (RepositorySnapshot.
// store) — never from a second source — so there is exactly one place that can decide the
// wizard should show (see repository/index.ts / authRouter.ts's /me for the reasoning).
export default function App() {
  const authStatus = useAuthStore((s) => s.status);
  const checkSession = useAuthStore((s) => s.checkSession);
  const loading = useAppStore((s) => s.loading);
  const setupComplete = useAppStore((s) => s.store.setupComplete);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    // Any 401 from the real API repository must drive the app back to Login — not a generic
    // banner. ApiRepository cannot import the store directly (circular), so App registers the
    // callback once. Mock repository never triggers it.
    setUnauthenticatedHandler(() => useAuthStore.setState({ status: 'unauthenticated', username: null }));
    return () => setUnauthenticatedHandler(null);
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadInitialSnapshot();
    }
  }, [authStatus]);

  if (authStatus === 'checking') return <LoadingScreen />;
  if (authStatus === 'unauthenticated') {
    return authMode === 'login' ? (
      <Login onRegisterClick={() => setAuthMode('register')} />
    ) : (
      <Register onLoginClick={() => setAuthMode('login')} />
    );
  }
  if (loading) return <LoadingScreen />;
  if (!setupComplete) return <SetupWizard onComplete={() => loadInitialSnapshot()} />;

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<OrdersList />} />
          <Route path="/orders/new" element={<NewOrder />} />
          <Route path="/orders/:orderId" element={<OrderDetail />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/ingredients" element={<Ingredients />} />
          <Route path="/menus" element={<Menus />} />
          <Route path="/addons" element={<AddOns />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/waste" element={<Waste />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/more" element={<More />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
