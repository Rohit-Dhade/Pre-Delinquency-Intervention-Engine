import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, X, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { listEmployees, createEmployee, deactivateEmployee } from '../api/auth';
import { useRequireRole } from '../hooks/useRequireRole';
import { createEmployeeSchema } from '../utils/schemas';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Spinner from '../components/ui/Spinner';

const ROLE_STYLES = { admin: 'bg-purple-100 text-purple-700', risk_analyst: 'bg-blue-100 text-blue-700', relationship_manager: 'bg-teal-100 text-teal-700' };
const ROLE_LABELS = { admin: 'Admin', risk_analyst: 'Risk Analyst', relationship_manager: 'Relationship Mgr' };

export default function AdminEmployeesPage() {
  useRequireRole(['admin']);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true); setError('');
    try { const data = await listEmployees(); setEmployees(data); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to load employees'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await deactivateEmployee({ employee_id: deactivateTarget.employee_id });
      toast.success(`${deactivateTarget.full_name} deactivated`);
      setDeactivateTarget(null); fetchEmployees();
    } catch (err) { toast.error(err.response?.data?.detail || 'Deactivation failed'); }
    finally { setDeactivateLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-semibold text-on-surface tracking-tight">Employee Management</h1><p className="text-sm text-on-surface-variant mt-1">{employees.length} employees</p></div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded-lg transition-colors"><UserPlus className="w-4 h-4" />Create Employee</button>
      </div>

      {error && <div className="p-4 rounded-lg bg-error-container text-on-error-container text-sm mb-6">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-container-low border-b border-outline-variant">
              {['Employee ID','Name','Email','Role','Department','Status','Created','Actions'].map(h => <th key={h} className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider py-3 px-4">{h}</th>)}
            </tr></thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr key={emp.employee_id} className={`border-b border-outline-variant/50 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-container-low'}`}>
                  <td className="py-3 px-4 font-mono text-xs text-on-surface">{emp.employee_id}</td>
                  <td className="py-3 px-4 font-medium text-on-surface">{emp.full_name}</td>
                  <td className="py-3 px-4 text-on-surface-variant">{emp.email}</td>
                  <td className="py-3 px-4"><span className={`text-xs font-medium px-2 py-0.5 rounded ${ROLE_STYLES[emp.role] || ''}`}>{ROLE_LABELS[emp.role] || emp.role}</span></td>
                  <td className="py-3 px-4 text-on-surface-variant">{emp.department || '—'}</td>
                  <td className="py-3 px-4">{emp.is_active ? <span className="text-xs font-medium px-2 py-0.5 rounded bg-tier-stable-bg text-tier-stable-text">Active</span> : <span className="text-xs font-medium px-2 py-0.5 rounded bg-tier-critical-bg text-tier-critical-text">Inactive</span>}</td>
                  <td className="py-3 px-4 text-on-surface-variant text-xs">{emp.created_at ? format(new Date(emp.created_at), 'MMM d, yyyy') : '—'}</td>
                  <td className="py-3 px-4">{emp.is_active && <button onClick={() => setDeactivateTarget(emp)} className="text-xs font-medium text-error hover:text-red-700 transition-colors">Deactivate</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && <CreateEmployeeModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchEmployees(); }} />}

      <ConfirmDialog open={!!deactivateTarget} title="Deactivate Employee?" description={`This will deactivate ${deactivateTarget?.full_name} (${deactivateTarget?.employee_id}). They will lose access immediately.`} confirmLabel="Deactivate" onConfirm={handleDeactivate} onCancel={() => setDeactivateTarget(null)} loading={deactivateLoading} />
    </div>
  );
}

function CreateEmployeeModal({ onClose, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(createEmployeeSchema) });

  const onSubmit = async (data) => {
    setApiError(''); setSubmitting(true);
    try {
      const payload = { ...data };
      if (!payload.department) delete payload.department;
      await createEmployee(payload);
      toast.success('Employee created successfully');
      onCreated();
    } catch (err) { setApiError(err.response?.data?.detail || 'Creation failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-on-surface/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-elevated border border-outline-variant max-w-[512px] w-full mx-4 p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-on-surface">Create New Employee</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface"><X className="w-5 h-5" /></button>
        </div>
        {apiError && <div className="flex items-center gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-sm mb-4"><AlertTriangle className="w-4 h-4" />{apiError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Full Name" id="emp-name" error={errors.full_name}>
            <input id="emp-name" className={inputCls(errors.full_name)} placeholder="John Doe" {...register('full_name')} />
          </Field>
          <Field label="Email" id="emp-email" error={errors.email}>
            <input id="emp-email" type="email" className={inputCls(errors.email)} placeholder="john@fintrust.com" {...register('email')} />
          </Field>
          <Field label="Role" id="emp-role" error={errors.role}>
            <select id="emp-role" className={inputCls(errors.role)} {...register('role')} defaultValue="">
              <option value="" disabled>Select role</option>
              <option value="admin">Administrator</option>
              <option value="risk_analyst">Risk Analyst</option>
              <option value="relationship_manager">Relationship Manager</option>
            </select>
          </Field>
          <Field label="Department (optional)" id="emp-dept" error={errors.department}>
            <input id="emp-dept" className={inputCls(errors.department)} placeholder="Credit Risk" {...register('department')} />
          </Field>
          <Field label="Password" id="emp-pw" error={errors.password}>
            <div className="relative">
              <input id="emp-pw" type={showPw ? 'text' : 'password'} className={`${inputCls(errors.password)} pr-10`} placeholder="Min 8 chars, mixed case, number, special" {...register('password')} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface" tabIndex={-1}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface border border-outline-variant rounded-lg hover:bg-surface-container transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium bg-navy hover:bg-navy-hover text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60">
              {submitting && <Spinner size="sm" className="border-white/30 border-t-white" />}Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, id, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {error && <p className="text-error text-xs mt-1">{error.message}</p>}
    </div>
  );
}

function inputCls(err) {
  return `w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 ${err ? 'border-error' : 'border-outline-variant'}`;
}
