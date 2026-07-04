/**
 * useRequireRole — enforces frontend role gating as a UX layer.
 *
 * Usage:   useRequireRole(['admin', 'risk_analyst']);
 *
 * If the current employee's role isn't in allowedRoles,
 * redirects to /dashboard with a toast error.
 *
 * Role access rules (from permissions.py):
 *   admin              → everything
 *   risk_analyst       → predict, intervention:history, intervention:stats
 *   relationship_manager → predict, intervention:trigger, intervention:outcome, intervention:history
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export function useRequireRole(allowedRoles) {
  const { employee, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && employee && !allowedRoles.includes(employee.role)) {
      toast.error(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
      navigate('/dashboard', { replace: true });
    }
  }, [employee, isAuthenticated, allowedRoles, navigate]);

  return {
    allowed: isAuthenticated && employee && allowedRoles.includes(employee.role),
    employee,
  };
}
