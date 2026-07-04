/**
 * Login Page — Stitch-designed centered card with email/password form.
 * Error on invalid credentials, link to reset.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '../utils/schemas';
import Spinner from '../components/ui/Spinner';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setApiError('');
    setSubmitting(true);
    try {
      await login(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed. Please try again.';
      setApiError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-navy/[0.03]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent/[0.03]" />
      </div>

      <div className="relative w-full max-w-[420px] animate-fade-in">
        {/* Card */}
        <div className="bg-white rounded-xl shadow-elevated border border-outline-variant p-8">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-on-surface">FinTrust</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Pre-Delinquency Intervention Engine
            </p>
          </div>

          {/* Error */}
          {apiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-sm mb-6 animate-slide-down">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {apiError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@fintrust.com"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white text-on-surface placeholder:text-outline transition-all focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 ${
                  errors.email ? 'border-error' : 'border-outline-variant'
                }`}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-error text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className={`w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white text-on-surface placeholder:text-outline pr-10 transition-all focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 ${
                    errors.password ? 'border-error' : 'border-outline-variant'
                  }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-error text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-navy hover:bg-navy-hover text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" className="border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Reset link */}
          <div className="text-center mt-5">
            <Link
              to="/reset-password"
              className="text-sm text-accent hover:text-navy transition-colors font-medium"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-outline mt-6">
          © {new Date().getFullYear()} FinTrust Financial Services. Secure access only.
        </p>
      </div>
    </div>
  );
}
