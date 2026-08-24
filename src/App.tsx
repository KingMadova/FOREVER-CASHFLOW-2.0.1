import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StoreProvider } from './store/StoreProvider';
import { useAuthStore } from './store/slices/authSlice';
import { Layout } from './components/ui/Layout';
import { PWAInstallPrompt } from './components/ui/PWAInstallPrompt';

// View Imports
import { DashboardView } from './views/DashboardView';
import { ProspectsView } from './views/ProspectsView';
import { ClientsView } from './views/ClientsView';
import { OrdersView } from './views/OrdersView';
import { ProjectionView } from './views/ProjectionView';
import { BudgetView } from './views/BudgetView';
import { AgendaView } from './views/AgendaView';
import { ProfileView } from './views/ProfileView';
import { SettingsView } from './views/SettingsView';
import { TrackerView } from './views/TrackerView';
import { LoginView } from './views/LoginView';
import { SignupView } from './views/SignupView';

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

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
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
        <PWAInstallPrompt />
      </BrowserRouter>
    </StoreProvider>
  );
}
