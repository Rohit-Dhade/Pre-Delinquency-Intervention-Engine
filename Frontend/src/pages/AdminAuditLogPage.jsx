import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Filter, CheckCircle2, XCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuditLog } from '../api/auth';
import { useRequireRole } from '../hooks/useRequireRole';
import Spinner from '../components/ui/Spinner';

const ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESH',
  'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE',
  'ADMIN_CREATE_EMPLOYEE', 'ADMIN_DEACTIVATE_EMPLOYEE', 'PREDICT_ACCESS',
  'ADMIN_RELOAD_MODEL',
];

export default function AdminAuditLogPage() {
  useRequireRole(['admin']);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ employee_id: '', action: '', from_date: '', to_date: '' });

  const fetchLogs = async (params = {}) => {
    setLoading(true); setError('');
    try {
      const clean = {};
      Object.entries(params).forEach(([k, v]) => { if (v) clean[k] = v; });
      const data = await getAuditLog(clean);
      setLogs(data);
    } catch (err) {
      const d = err.response?.data?.detail || 'Failed to load audit log.';
      setError(d); toast.error(d);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleFilter = (e) => { e.preventDefault(); fetchLogs(filters); };
  const clearFilters = () => {
    const empty = { employee_id: '', action: '', from_date: '', to_date: '' };
    setFilters(empty);
    fetchLogs(empty);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">Audit log</h1>
        <p className="text-[13.5px] text-slate-500 mt-1">Security and activity events across the system</p>
      </div>

      <div className="card p-4">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[150px]">
            <label className="label">Employee ID</label>
            <input value={filters.employee_id} onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))} placeholder="EMP_001" className="input !py-2" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="label">Action</label>
            <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} className="input !py-2 bg-white">
              <option value="">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="label">From</label>
            <input type="datetime-local" value={filters.from_date} onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))} className="input !py-2" />
          </div>
          <div className="min-w-[150px]">
            <label className="label">To</label>
            <input type="datetime-local" value={filters.to_date} onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))} className="input !py-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary !py-2 !text-[13px]">
              <Filter size={15} />Apply
            </button>
            <button type="button" onClick={clearFilters} className="btn-secondary !py-2 !text-[13px]">Clear</button>
          </div>
        </form>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[13.5px] text-red-800">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="table-head"><tr>
                {['Timestamp', 'Employee', 'Action', 'Resource', 'IP', 'Status'].map((h) => <th key={h}>{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Search size={20} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-[13.5px] text-slate-500">No audit entries match these filters.</p>
                    </td>
                  </tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap tabular-nums text-xs">{log.timestamp ? format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss') : '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{log.employee_id || '—'}</td>
                    <td className="py-2.5 px-4">
                      <code className="text-[11.5px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{log.action}</code>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 max-w-[180px] truncate">{log.resource || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 font-mono">{log.ip_address || '—'}</td>
                    <td className="py-2.5 px-4">
                      {log.success
                        ? <span className="inline-flex items-center gap-1 text-[12px] text-green-700 font-medium"><CheckCircle2 size={14} />OK</span>
                        : <span className="inline-flex items-center gap-1 text-[12px] text-red-600 font-medium"><XCircle size={14} />Fail</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length > 0 && <div className="px-4 py-2.5 border-t border-slate-200 text-xs text-slate-400 bg-slate-50/60">{logs.length} entr{logs.length !== 1 ? 'ies' : 'y'}</div>}
        </div>
      )}
    </div>
  );
}
