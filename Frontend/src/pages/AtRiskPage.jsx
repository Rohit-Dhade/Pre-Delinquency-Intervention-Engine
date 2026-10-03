/**
 * At-Risk Customers — auto-detected delinquent customers.
 * Shows a batch-predicted list sorted by risk, with "Trigger Intervention" action.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Shield,
  Zap,
  Search,
  Filter,
} from 'lucide-react';
import { getAtRiskCustomers } from '../api/customers';
import { useRequireRole } from '../hooks/useRequireRole';
import { useAuth } from '../context/AuthContext';
import TierBadge from '../components/ui/TierBadge';
import Spinner from '../components/ui/Spinner';

const PAGE_SIZE = 20;
const TIER_FILTERS = ['all', 'critical', 'high', 'moderate', 'early_warning'];
const TIER_LABELS = {
  all: 'All tiers',
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  early_warning: 'Early Warning',
};

export default function AtRiskPage() {
  useRequireRole(['admin', 'risk_analyst', 'relationship_manager']);
  const { employee } = useAuth();
  const navigate = useNavigate();
  const canIntervene = employee?.role === 'admin' || employee?.role === 'relationship_manager';

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAtRiskCustomers({ limit: 500, offset: 0, minProb: 0.20 });
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load at-risk customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side filtering
  const filtered = customers.filter((c) => {
    if (tierFilter !== 'all' && c.risk_tier !== tierFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        c.customer_id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Summary stats
  const counts = { critical: 0, high: 0, moderate: 0, early_warning: 0 };
  customers.forEach((c) => { if (counts[c.risk_tier] !== undefined) counts[c.risk_tier]++; });

  const handleTrigger = (customer) => {
    navigate('/intervention/new', { state: { customerId: customer.customer_id } });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">At-risk customers</h1>
          <p className="text-[13.5px] text-slate-500 mt-1">
            Automatically detected customers with elevated delinquency risk.
            {lastRefreshed && (
              <span className="text-slate-400"> · Last scan: {lastRefreshed.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setPage(0); fetchData(); }}
          disabled={loading}
          className="btn-secondary text-[13px]! shrink-0 self-start sm:self-auto"
        >
          {loading ? <Spinner size="sm" /> : <RefreshCw size={15} />}
          Refresh scan
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Critical"
          count={counts.critical}
          color="bg-red-50 text-red-700 border-red-200"
          icon={<AlertTriangle size={16} />}
        />
        <StatCard
          label="High"
          count={counts.high}
          color="bg-orange-50 text-orange-700 border-orange-200"
          icon={<Zap size={16} />}
        />
        <StatCard
          label="Moderate"
          count={counts.moderate}
          color="bg-amber-50 text-amber-700 border-amber-200"
          icon={<Shield size={16} />}
        />
        <StatCard
          label="Early Warning"
          count={counts.early_warning}
          color="bg-blue-50 text-blue-700 border-blue-200"
          icon={<Shield size={16} />}
        />
      </div>

      {/* Filters */}
      <div className="card px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, name, or email…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            className="input pl-9! text-[13.5px]!"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter size={14} className="text-slate-400 shrink-0" />
          {TIER_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => { setTierFilter(t); setPage(0); }}
              className={`px-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                tierFilter === t
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[13.5px] text-red-800">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <Spinner />
          <span className="ml-3 text-[13.5px] text-slate-500">Running delinquency scan across all customers…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
            <Shield size={22} className="text-green-600" />
          </div>
          <p className="text-[14px] font-medium text-slate-900">No at-risk customers found</p>
          <p className="text-[13px] text-slate-500 mt-1">
            {searchTerm || tierFilter !== 'all' ? 'Try adjusting your filters.' : 'All customers are in the stable zone.'}
          </p>
        </div>
      ) : (
        <>
          {/* Cards — below 2xl, so nothing ever scrolls sideways */}
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:hidden gap-3">
            {pageData.map((c) => {
              const initials = c.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '··';
              return (
                <div key={c.customer_id} className="card p-4 sm:p-5 hover:shadow-elevated transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-semibold text-white tracking-wide">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/customer/${c.customer_id}`} className="group">
                        <p className="text-[14px] font-medium text-slate-900 group-hover:text-navy transition-colors truncate">{c.name}</p>
                      </Link>
                      <p className="text-[11.5px] text-slate-400 font-mono mt-0.5 truncate">{c.customer_id}</p>
                    </div>
                    <span className="shrink-0"><TierBadge tier={c.risk_tier} /></span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1.5">Delinquency risk</p>
                    <ProbBar prob={c.delinquency_prob} />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 truncate">Segment</p>
                      <p className="text-[12.5px] font-medium text-slate-800 capitalize truncate mt-0.5" title={c.segment?.replace('_', ' ')}>{c.segment?.replace('_', ' ')}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 truncate">Score</p>
                      <p className="mt-1"><CreditScorePill score={c.credit_score} /></p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 truncate">Last touch</p>
                      <p className="text-[12.5px] font-medium text-slate-800 truncate mt-0.5">
                        {c.last_intervention_at ? new Date(c.last_intervention_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
                    <Link
                      to={`/customer/${c.customer_id}`}
                      className="btn-secondary py-2! px-4! text-[12.5px]! inline-flex items-center gap-1.5"
                    >
                      <span>Profile</span>
                      <ChevronRight size={13} />
                    </Link>
                    {canIntervene && (
                      <button
                        onClick={() => handleTrigger(c)}
                        className="btn-primary py-2! px-4! text-[12.5px]! inline-flex items-center gap-1.5"
                      >
                        <Zap size={13} />
                        <span>Intervene</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table — 2xl and up, where all columns fit without scrolling.
              Segment stays in the cards / detail view to keep the table fittable. */}
          <div className="card overflow-hidden hidden 2xl:block">
            <table className="at-risk-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">Customer</th>
                  <th className="th">Risk</th>
                  <th className="th">Probability</th>
                  <th className="th">Credit Score</th>
                  <th className="th">Last Intervention</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageData.map((c) => (
                  <tr key={c.customer_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="td">
                      <Link
                        to={`/customer/${c.customer_id}`}
                        className="group block min-w-0"
                      >
                        <p className="text-[13.5px] font-medium text-slate-900 group-hover:text-navy transition-colors truncate max-w-[240px]">{c.name}</p>
                        <p className="text-[12px] text-slate-400 font-mono mt-0.5">{c.customer_id}</p>
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap">
                      <TierBadge tier={c.risk_tier} />
                    </td>
                    <td className="td whitespace-nowrap">
                      <ProbBar prob={c.delinquency_prob} />
                    </td>
                    <td className="td whitespace-nowrap">
                      <CreditScorePill score={c.credit_score} />
                    </td>
                    <td className="td whitespace-nowrap">
                      {c.last_intervention_at ? (
                        <div>
                          <p className="text-[12.5px] text-slate-600">
                            {new Date(c.last_intervention_at).toLocaleDateString()}
                          </p>
                          <p className="text-[11px] text-slate-400 capitalize">{c.last_risk_tier}</p>
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-slate-400">None</span>
                      )}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        {canIntervene && (
                          <button
                            onClick={() => handleTrigger(c)}
                            className="btn-primary py-1.5! px-2.5! text-[12px]! inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
                            title="Trigger Intervention"
                          >
                            <Zap size={13} />
                            <span>Intervene</span>
                          </button>
                        )}
                        <Link
                          to={`/customer/${c.customer_id}`}
                          className="btn-secondary py-1.5! px-2.5! text-[12px]! inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
                          title="View Profile"
                        >
                          <span>Profile</span>
                          <ChevronRight size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="card flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="text-[12.5px] text-slate-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} customers
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[12.5px] text-slate-600 px-2 tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function StatCard({ label, count, color, icon }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 min-w-0 ${color}`}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[20px] font-semibold leading-none tabular-nums">{count}</p>
        <p className="text-[11.5px] mt-1 opacity-80 truncate">{label}</p>
      </div>
    </div>
  );
}

function ProbBar({ prob }) {
  const pct = Math.round(prob * 100);
  const color = prob >= 0.75 ? 'bg-red-500' : prob >= 0.50 ? 'bg-orange-500' : prob >= 0.30 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px] whitespace-nowrap">
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12.5px] text-slate-600 tabular-nums font-medium w-[38px] text-right">{pct}%</span>
    </div>
  );
}

function CreditScorePill({ score }) {
  const style =
    score >= 750 ? 'text-green-700 bg-green-50' :
    score >= 650 ? 'text-amber-700 bg-amber-50' :
    score >= 550 ? 'text-orange-700 bg-orange-50' :
                   'text-red-700 bg-red-50';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[12.5px] font-medium tabular-nums ${style}`}>
      {score}
    </span>
  );
}
