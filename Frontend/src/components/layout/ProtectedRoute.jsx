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
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
