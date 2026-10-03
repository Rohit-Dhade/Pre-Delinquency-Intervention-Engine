import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import InterventionNewPage from './pages/InterventionNewPage';
import StatsPage from './pages/StatsPage';
import AdminEmployeesPage from './pages/AdminEmployeesPage';
import AdminAuditLogPage from './pages/AdminAuditLogPage';
import AtRiskPage from './pages/AtRiskPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '13.5px',
              borderRadius: '10px',
              padding: '11px 14px',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              boxShadow: '0 4px 12px rgba(16,24,40,.08)',
            },
            success: {
              iconTheme: { primary: '#067647', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#b42318', secondary: '#fff' },
            },
          }}
        />

        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected routes with sidebar layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/at-risk" element={<AtRiskPage />} />
            <Route path="/customer/:customerId" element={<CustomerDetailPage />} />
            <Route path="/intervention/new" element={<InterventionNewPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/admin/employees" element={<AdminEmployeesPage />} />
            <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
