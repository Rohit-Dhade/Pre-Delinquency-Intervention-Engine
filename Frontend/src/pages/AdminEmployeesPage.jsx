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

const ROLE_PILL = {
  admin: 'bg-slate-900 text-white',
  risk_analyst: 'bg-slate-100 text-slate-700 border border-slate-200',
  relationship_manager: 'bg-slate-100 text-slate-700 border border-slate-200',
};
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
    catch (err) { setError(err.response?.data?.detail || 'Failed to load employees.'); }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-28">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">Employees</h1>
          <p className="text-[13.5px] text-slate-500 mt-1">{employees.length} team member{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary ml-auto">
          <UserPlus size={16} />New employee
        </button>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[13.5px] text-red-800">{error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="table-head"><tr>
              {['Name', 'Role', 'Department', 'Status', 'Created', ''].map((h) => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.employee_id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[12px] font-semibold text-slate-700 shrink-0">
                        {emp.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{emp.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.email} · <span className="font-mono">{emp.employee_id}</span></p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[11.5px] font-medium px-2 py-1 rounded-md whitespace-nowrap ${ROLE_PILL[emp.role] || 'bg-slate-100 text-slate-700'}`}>
                      {ROLE_LABELS[emp.role] || emp.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{emp.department || '—'}</td>
                  <td className="py-3 px-4">
                    {emp.is_active
                      ? <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-green-800"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
                      : <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Inactive</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap tabular-nums">{emp.created_at ? format(new Date(emp.created_at), 'MMM d, yyyy') : '—'}</td>
                  <td className="py-3 px-4 text-right">
                    {emp.is_active && (
                      <button onClick={() => setDeactivateTarget(emp)} className="text-[12.5px] font-medium text-slate-500 hover:text-red-600 transition-colors">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-[13.5px] text-slate-500">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateEmployeeModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchEmployees(); }} />}

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate employee?"
        description={`${deactivateTarget?.full_name} (${deactivateTarget?.employee_id}) will lose access immediately.`}
        confirmLabel="Deactivate"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivateLoading}
      />
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
      toast.success('Employee created');
      onCreated();
    } catch (err) { setApiError(err.response?.data?.detail || 'Creation failed.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl max-w-[460px] w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900 tracking-tight">New employee</h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">They can sign in immediately.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {apiError && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-800 mb-4"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{apiError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div>
            <label htmlFor="emp-name" className="label">Full name</label>
            <input id="emp-name" className="input" placeholder="Jane Cooper" {...register('full_name')} />
            {errors.full_name && <p className="text-red-600 text-xs mt-1.5">{errors.full_name.message}</p>}
          </div>
          <div>
            <label htmlFor="emp-email" className="label">Email</label>
            <input id="emp-email" type="email" className="input" placeholder="jane@fintrust.com" {...register('email')} />
            {errors.email && <p className="text-red-600 text-xs mt-1.5">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="emp-role" className="label">Role</label>
              <select id="emp-role" className="input" {...register('role')} defaultValue="">
                <option value="" disabled>Select</option>
                <option value="admin">Administrator</option>
                <option value="risk_analyst">Risk Analyst</option>
                <option value="relationship_manager">Relationship Manager</option>
              </select>
              {errors.role && <p className="text-red-600 text-xs mt-1.5">{errors.role.message}</p>}
            </div>
            <div>
              <label htmlFor="emp-dept" className="label">Department</label>
              <input id="emp-dept" className="input" placeholder="Credit Risk" {...register('department')} />
              {errors.department && <p className="text-red-600 text-xs mt-1.5">{errors.department.message}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="emp-pw" className="label">Password</label>
            <div className="relative">
              <input id="emp-pw" type={showPw ? 'text' : 'password'} className="input pr-10" placeholder="Min 8 chars" {...register('password')} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" tabIndex={-1}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-600 text-xs mt-1.5">{errors.password.message}</p>}
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting && <Spinner size="sm" className="!border-white/30 !border-t-white" />}Create employee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
