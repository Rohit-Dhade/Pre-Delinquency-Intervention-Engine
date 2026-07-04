/**
 * ProtectedRoute — guards routes behind authentication.
 * Shows full-page spinner during session restore (loading=true).
 * Redirects to /login if not authenticated after restore completes.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Full-page spinner during session restore — never flash login page
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-on-surface-variant text-sm mt-4">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
