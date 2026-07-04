import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Filter, CheckCircle2, XCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuditLog } from '../api/auth';
import { useRequireRole } from '../hooks/useRequireRole';
import Spinner from '../components/ui/Spinner';

const ACTIONS = [
  'LOGIN_SUCCESS','LOGIN_FAILED','LOGOUT','TOKEN_REFRESH',
  'PASSWORD_RESET_REQUEST','PASSWORD_RESET_COMPLETE',
  'ADMIN_CREATE_EMPLOYEE','ADMIN_DEACTIVATE_EMPLOYEE','PREDICT_ACCESS',
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
      const d = err.response?.data?.detail || 'Failed to load audit log';
      setError(d); toast.error(d);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleFilter = (e) => { e.preventDefault(); fetchLogs(filters); };

  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Audit Log</h1>
        <p className="text-sm text-on-surface-variant mt-1">System activity and security events</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-5 mb-6">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Employee ID</label>
            <input value={filters.employee_id} onChange={(e) => setFilters(f => ({ ...f, employee_id: e.target.value }))} placeholder="EMP_001" className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Action</label>
            <select value={filters.action} onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 bg-white">
              <option value="">All actions</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">From</label>
            <input type="datetime-local" value={filters.from_date} onChange={(e) => setFilters(f => ({ ...f, from_date: e.target.value }))} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1" />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">To</label>
            <input type="datetime-local" value={filters.to_date} onChange={(e) => setFilters(f => ({ ...f, to_date: e.target.value }))} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1" />
          </div>
          <button type="submit" className="px-4 py-2 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />Apply
          </button>
        </form>
      </div>

      {/* Error */}
      {error && <div className="p-4 rounded-lg bg-error-container text-on-error-container text-sm mb-6">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-outline-variant shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-container-low border-b border-outline-variant">
                {['Timestamp','Employee','Action','Resource','IP','Success','Metadata'].map(h => <th key={h} className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider py-3 px-4">{h}</th>)}
              </tr></thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-on-surface-variant"><Search className="w-6 h-6 mx-auto mb-2 text-outline" />No audit log entries found</td></tr>
                ) : logs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-outline-variant/50 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-container-low'}`}>
                    <td className="py-3 px-4 text-xs text-on-surface whitespace-nowrap">{log.timestamp ? format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss') : '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-on-surface">{log.employee_id || '—'}</td>
                    <td className="py-3 px-4"><span className="text-xs font-medium px-2 py-0.5 rounded bg-surface-container text-on-surface">{log.action}</span></td>
                    <td className="py-3 px-4 text-xs text-on-surface-variant max-w-[160px] truncate">{log.resource || '—'}</td>
                    <td className="py-3 px-4 text-xs text-on-surface-variant font-mono">{log.ip_address || '—'}</td>
                    <td className="py-3 px-4">{log.success ? <CheckCircle2 className="w-4 h-4 text-tier-stable" /> : <XCircle className="w-4 h-4 text-error" />}</td>
                    <td className="py-3 px-4 text-xs text-on-surface-variant max-w-[200px] truncate">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length > 0 && <div className="px-4 py-3 border-t border-outline-variant text-xs text-on-surface-variant">Showing {logs.length} entries</div>}
        </div>
      )}
    </div>
  );
}
