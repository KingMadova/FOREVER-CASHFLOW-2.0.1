import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StoreProvider } from './store/StoreProvider';
import { useAuthStore } from './store/slices/authSlice';
import { Layout } from './components/ui/Layout';
import { PWAInstallPrompt } from './components/ui/PWAInstallPrompt';

// View Imports - lazy loading pour le code-splitting (un chunk par vue)
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const ProspectsView = lazy(() => import('./views/ProspectsView').then(m => ({ default: m.ProspectsView })));
const ClientsView = lazy(() => import('./views/ClientsView').then(m => ({ default: m.ClientsView })));
const OrdersView = lazy(() => import('./views/OrdersView').then(m => ({ default: m.OrdersView })));
const ProjectionView = lazy(() => import('./views/ProjectionView').then(m => ({ default: m.ProjectionView })));
const BudgetView = lazy(() => import('./views/BudgetView').then(m => ({ default: m.BudgetView })));
const AgendaView = lazy(() => import('./views/AgendaView').then(m => ({ default: m.AgendaView })));
const ProfileView = lazy(() => import('./views/ProfileView').then(m => ({ default: m.ProfileView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const TrackerView = lazy(() => import('./views/TrackerView').then(m => ({ default: m.TrackerView })));
const LoginView = lazy(() => import('./views/LoginView').then(m => ({ default: m.LoginView })));
const SignupView = lazy(() => import('./views/SignupView').then(m => ({ default: m.SignupView })));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const RouteFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
  </div>
);

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginView /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupView /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
            <Route path="/prospects" element={<ProtectedRoute><ProspectsView /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><ClientsView /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><OrdersView /></ProtectedRoute>} />
            <Route path="/projection" element={<ProtectedRoute><ProjectionView /></ProtectedRoute>} />
            <Route path="/budget" element={<ProtectedRoute><BudgetView /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><AgendaView /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfileView /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsView /></ProtectedRoute>} />
            <Route path="/tracker" element={<ProtectedRoute><TrackerView /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <PWAInstallPrompt />
      </BrowserRouter>
    </StoreProvider>
  );
}
