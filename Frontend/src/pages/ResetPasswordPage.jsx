/**
 * ResetPasswordPage — dual mode, minimal styling.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { resetRequestSchema, resetConfirmSchema } from '../utils/schemas';
import * as authApi from '../api/auth';
import Spinner from '../components/ui/Spinner';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return token ? <ConfirmMode token={token} /> : <RequestMode />;
}

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
    <AuthCard title="Reset password" subtitle="Enter your email and we'll send you a reset link">
      {sent ? (
        <div className="flex flex-col items-center py-4">
          <div className="w-11 h-11 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-3">
            <CheckCircle2 size={22} className="text-green-600" />
          </div>
          <p className="text-[14px] text-slate-900 text-center font-medium">
            Check your inbox
          </p>
          <p className="text-[13px] text-slate-500 mt-1 text-center">
            If that email exists, a reset link has been sent.
          </p>
        </div>
      ) : (
        <>
          {apiError && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-800 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {apiError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="label">Email</label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@fintrust.com"
                className="input"
                {...register('email')}
              />
              {errors.email && <p className="text-red-600 text-xs mt-1.5">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full !py-2.5">
              {submitting ? <Spinner size="sm" className="!border-white/30 !border-t-white" /> : null}
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}

      <div className="text-center mt-5">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 font-medium">
          <ArrowLeft size={15} />
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}

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
    { label: 'At least 8 characters', met: password.length >= 8 },
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
    <AuthCard title="Set new password" subtitle="Create a strong password for your account">
      {success ? (
        <div className="flex flex-col items-center py-4">
          <div className="w-11 h-11 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-3">
            <CheckCircle2 size={22} className="text-green-600" />
          </div>
          <p className="text-[14px] text-slate-900 font-medium">Password reset successful</p>
          <Link to="/login" className="btn-primary mt-4 !py-2 !text-[13.5px]">
            Go to login
          </Link>
        </div>
      ) : (
        <>
          {apiError && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-800 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {apiError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="label">New password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Enter new password"
                  {...register('new_password')}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" tabIndex={-1}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.new_password && <p className="text-red-600 text-xs mt-1.5">{errors.new_password.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
              {rules.map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center ${r.met ? 'bg-green-600' : 'bg-slate-200'}`}>
                    {r.met && <Check size={11} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className={r.met ? 'text-slate-900' : 'text-slate-500'}>{r.label}</span>
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="confirm-password" className="label">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                className="input"
                placeholder="Repeat new password"
                {...register('confirm_password')}
              />
              {errors.confirm_password && <p className="text-red-600 text-xs mt-1.5">{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full !py-2.5">
              {submitting ? <Spinner size="sm" className="!border-white/30 !border-t-white" /> : null}
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        </>
      )}

      <div className="text-center mt-5">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 font-medium">
          <ArrowLeft size={15} />
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}

function AuthCard({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] animate-fade-in">
        <div className="flex flex-col items-center mb-7">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <h1 className="text-[20px] font-semibold text-slate-900 tracking-tight">FinTrust</h1>
          <p className="text-[13.5px] text-slate-500 mt-1">Pre-Delinquency Intervention Engine</p>
        </div>
        <div className="card p-6 sm:p-7">
          <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-[13px] text-slate-500 mt-0.5 mb-5">{subtitle}</p>
          {children}
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} FinTrust Financial Services
        </p>
      </div>
    </div>
  );
}
