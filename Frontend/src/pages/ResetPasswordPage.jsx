/**
 * ResetPasswordPage — dual mode:
 *   1. Request mode (default): email input → sends reset link
 *   2. Confirm mode (?token= in URL): new password with policy validation
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { resetRequestSchema, resetConfirmSchema } from '../utils/schemas';
import * as authApi from '../api/auth';
import Spinner from '../components/ui/Spinner';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return token ? <ConfirmMode token={token} /> : <RequestMode />;
}

// ── Request Mode ────────────────────────────────────────────────────────────
function RequestMode() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(resetRequestSchema),
  });

  const onSubmit = async (data) => {
    setApiError('');
    setSubmitting(true);
    try {
      await authApi.resetPasswordRequest(data);
      setSent(true);
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Failed to send reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard>
      <div className="flex flex-col items-center mb-6">
        <h2 className="text-lg font-semibold text-on-surface">Reset Password</h2>
        <p className="text-sm text-on-surface-variant mt-1 text-center">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center py-4 animate-fade-in">
          <CheckCircle2 className="w-12 h-12 text-tier-stable mb-3" />
          <p className="text-sm text-on-surface text-center font-medium">
            If that email exists, a reset link has been sent.
          </p>
          <p className="text-xs text-on-surface-variant mt-2 text-center">
            Check your inbox and follow the link to reset your password.
          </p>
        </div>
      ) : (
        <>
          {apiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-sm mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {apiError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@fintrust.com"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 ${
                  errors.email ? 'border-error' : 'border-outline-variant'
                }`}
                {...register('email')}
              />
              {errors.email && <p className="text-error text-xs mt-1">{errors.email.message}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-navy hover:bg-navy-hover text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              {submitting ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        </>
      )}

      <div className="text-center mt-5">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-navy font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}

// ── Confirm Mode ────────────────────────────────────────────────────────────
function ConfirmMode({ token }) {
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: zodResolver(resetConfirmSchema),
  });

  const password = watch('new_password', '');
  const rules = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const onSubmit = async (data) => {
    setApiError('');
    setSubmitting(true);
    try {
      await authApi.resetPasswordConfirm({ token, new_password: data.new_password });
      setSuccess(true);
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Reset failed. Token may be expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard>
      <div className="flex flex-col items-center mb-6">
        <h2 className="text-lg font-semibold text-on-surface">Set New Password</h2>
        <p className="text-sm text-on-surface-variant mt-1 text-center">
          Create a strong password for your account
        </p>
      </div>

      {success ? (
        <div className="flex flex-col items-center py-4 animate-fade-in">
          <CheckCircle2 className="w-12 h-12 text-tier-stable mb-3" />
          <p className="text-sm text-on-surface text-center font-medium">
            Password reset successful!
          </p>
          <Link
            to="/login"
            className="mt-4 px-6 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-hover transition-colors"
          >
            Go to Login
          </Link>
        </div>
      ) : (
        <>
          {apiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-sm mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {apiError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  className={`w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white text-on-surface pr-10 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 ${
                    errors.new_password ? 'border-error' : 'border-outline-variant'
                  }`}
                  {...register('new_password')}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface" tabIndex={-1}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.new_password && <p className="text-error text-xs mt-1">{errors.new_password.message}</p>}
            </div>

            {/* Password rules */}
            <div className="space-y-1.5">
              {rules.map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${r.met ? 'bg-tier-stable' : 'bg-outline-variant'}`}>
                    {r.met && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className={r.met ? 'text-tier-stable-text' : 'text-on-surface-variant'}>{r.label}</span>
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 ${
                  errors.confirm_password ? 'border-error' : 'border-outline-variant'
                }`}
                {...register('confirm_password')}
              />
              {errors.confirm_password && <p className="text-error text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-navy hover:bg-navy-hover text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        </>
      )}

      <div className="text-center mt-5">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-navy font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}

// ── Shared card wrapper ─────────────────────────────────────────────────────
function AuthCard({ children }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-navy/[0.03]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent/[0.03]" />
      </div>
      <div className="relative w-full max-w-[420px] animate-fade-in">
        <div className="bg-white rounded-xl shadow-elevated border border-outline-variant p-8">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          {children}
        </div>
        <p className="text-center text-xs text-outline mt-6">
          © {new Date().getFullYear()} FinTrust Financial Services
        </p>
      </div>
    </div>
  );
}
