/**
 * AuthContext — manages authentication state in React Context.
 *
 * On mount: calls GET /auth/me to silently restore session from
 * the refresh cookie. Shows a full-page spinner during this check.
 * Access token is stored in-memory only (via setAccessToken).
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAccessToken, clearAccessToken } from '../api/client';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true); // true on mount = full-page spinner

  // ── Silent session restore on app mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        // Try to refresh the access token using the httpOnly cookie
        const refreshRes = await authApi.refresh();
        setAccessToken(refreshRes.access_token);

        // Now fetch employee profile
        const me = await authApi.getMe();
        if (!cancelled) {
          setEmployee(me);
        }
      } catch {
        // No valid session — clear state silently
        clearAccessToken();
        if (!cancelled) {
          setEmployee(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    setAccessToken(data.access_token);
    setEmployee(data.employee);
    return data;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout API failure is non-critical
    } finally {
      clearAccessToken();
      setEmployee(null);
    }
  }, []);

  const value = {
    employee,
    isAuthenticated: !!employee,
    loading,
    login: handleLogin,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
