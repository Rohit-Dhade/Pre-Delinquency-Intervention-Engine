/**
 * Dashboard — minimal customer lookup.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  CreditCard,
  Mail,
  Phone,
  ChevronRight,
  AlertCircle,
  Loader2,
  X,
  UserRound,
  Calendar,
  MapPin,
  Copy,
  Check,
  Building2,
  Briefcase,
  ArrowRight,
  Zap,
  AlertTriangle,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { searchCustomers, getCustomerProfile, getAtRiskCustomers } from '../api/customers';
import TierBadge from '../components/ui/TierBadge';
import Spinner from '../components/ui/Spinner';

const SEGMENT_LABEL = { salaried: 'Salaried', self_employed: 'Self-Employed' };
const GEO_LABEL = { urban: 'Urban', tier2: 'Tier 2', rural: 'Rural' };

function scoreStyle(score) {
  if (score >= 750) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 650) return 'text-amber-800 bg-amber-50 border-amber-200';
  if (score >= 550) return 'text-orange-800 bg-orange-50 border-orange-200';
  return 'text-red-800 bg-red-50 border-red-200';
}

export default function DashboardPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [detailsCustomer, setDetailsCustomer] = useState(null);

  const [atRiskList, setAtRiskList] = useState([]);
  const [atRiskTotal, setAtRiskTotal] = useState(0);
  const [atRiskLoading, setAtRiskLoading] = useState(true);
  const [atRiskCounts, setAtRiskCounts] = useState({ critical: 0, high: 0, moderate: 0, early_warning: 0 });

  const canIntervene = employee?.role === 'admin' || employee?.role === 'relationship_manager';

  const fetchAtRisk = useCallback(async () => {
    setAtRiskLoading(true);
    try {
      const data = await getAtRiskCustomers({ limit: 50, offset: 0, minProb: 0.20 });
      const list = data.customers || [];
      setAtRiskList(list);
      setAtRiskTotal(data.total || 0);

      const counts = { critical: 0, high: 0, moderate: 0, early_warning: 0 };
      list.forEach((c) => {
        if (counts[c.risk_tier] !== undefined) counts[c.risk_tier]++;
      });
      setAtRiskCounts(counts);
    } catch (err) {
      console.error('Failed to load at-risk customers on dashboard:', err);
    } finally {
      setAtRiskLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAtRisk();
  }, [fetchAtRisk]);

  const doSearch = useCallback(async (searchTerm) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await searchCustomers(trimmed);
      if (!controller.signal.aborted) setResults(data);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.response?.data?.detail || 'Search failed. Please try again.');
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    doSearch(query);
  };

  const firstName = employee?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">
          Good day, {firstName}
        </h1>
        <p className="text-[13.5px] text-slate-500 mt-1">
          Search for a customer to view their risk assessment and history.
        </p>
      </div>

      {/* Search */}
      <div className="card p-5">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by customer ID, name, or account number…"
              className="input !pl-9 pr-9 !py-2.5"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults(null); setError(''); inputRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 text-slate-400"
                aria-label="Clear"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="btn-primary !py-2.5 sm:px-6"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          <span className="text-xs text-slate-400 mr-1">Try:</span>
          {['CUST_0001', 'Priya', '52004890335'].map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => { setQuery(hint); doSearch(hint); }}
              className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-[13.5px] text-red-800">
          <AlertCircle size={17} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading && (
        <div className="card p-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 p-3 rounded-lg">
              <div className="skeleton w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-44" />
                <div className="skeleton h-3 w-28" />
              </div>
              <div className="skeleton h-6 w-16 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {!loading && results !== null && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <p className="section-title !mb-0">
              {results.length === 0 ? 'No matches' : `${results.length} match${results.length !== 1 ? 'es' : ''}`}
            </p>
            {results.length >= 20 && (
              <span className="text-xs text-slate-500">Showing top 20</span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="flex flex-col items-center py-14 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <UserRound size={22} className="text-slate-400" />
              </div>
              <p className="text-[14px] font-medium text-slate-900">No customers found</p>
              <p className="text-[13px] text-slate-500 mt-1 max-w-sm">
                No matches for “{query}”. Check spelling or try another ID, name, or account number.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((c) => (
                <li key={c.customer_id}>
                  <div
                    onClick={() => navigate(`/customer/${c.customer_id}`)}
                    className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-slate-700">
                        {c.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-slate-900 truncate">{c.name}</span>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{c.customer_id}</span>
                      </div>
                      <div className="flex items-center gap-3.5 text-xs text-slate-500 mt-1 flex-wrap">
                        {c.account_number && (
                          <span className="inline-flex items-center gap-1"><CreditCard size={13} />{c.account_number}</span>
                        )}
                        {c.email && (
                          <span className="inline-flex items-center gap-1 truncate"><Mail size={13} />{c.email}</span>
                        )}
                        {c.phone_number && (
                          <span className="hidden sm:inline-flex items-center gap-1"><Phone size={13} />{c.phone_number}</span>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 shrink-0">
                      {c.segment && (
                        <span className="text-[11.5px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                          {SEGMENT_LABEL[c.segment] || c.segment}
                        </span>
                      )}
                      {c.geography && (
                        <span className="text-[11.5px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                          {GEO_LABEL[c.geography] || c.geography}
                        </span>
                      )}
                    </div>
                    <span className={`text-[13px] font-semibold px-2.5 py-1 rounded-md border tabular-nums shrink-0 ${scoreStyle(c.credit_score)}`}>
                      {c.credit_score}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDetailsCustomer(c); }}
                      className="hidden sm:inline-flex text-[12.5px] font-medium text-slate-600 border border-slate-200 bg-white hover:border-slate-300 hover:text-slate-900 px-2.5 py-1.5 rounded-md transition-colors shrink-0"
                    >
                      Details
                    </button>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && results === null && (
        <div className="space-y-5">
          {/* Delinquency Alert Banner / Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">
                  Auto-Detected Delinquency Queue
                </h2>
              </div>
              <p className="text-[13px] text-slate-500 mt-0.5">
                AI model automatically surfaces customers with high default risk for proactive employee intervention.
              </p>
            </div>
            <Link
              to="/at-risk"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-900 hover:text-navy hover:underline shrink-0"
            >
              <span>View all {atRiskTotal} at-risk accounts</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Quick stats pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 flex items-center gap-3 text-red-700">
              <AlertTriangle size={17} className="shrink-0" />
              <div>
                <p className="text-[19px] font-semibold tabular-nums leading-none">{atRiskCounts.critical}</p>
                <p className="text-[11.5px] mt-1 opacity-85 font-medium">Critical Risk</p>
              </div>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3 flex items-center gap-3 text-orange-700">
              <Zap size={17} className="shrink-0" />
              <div>
                <p className="text-[19px] font-semibold tabular-nums leading-none">{atRiskCounts.high}</p>
                <p className="text-[11.5px] mt-1 opacity-85 font-medium">High Risk</p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-center gap-3 text-amber-700">
              <Shield size={17} className="shrink-0" />
              <div>
                <p className="text-[19px] font-semibold tabular-nums leading-none">{atRiskCounts.moderate}</p>
                <p className="text-[11.5px] mt-1 opacity-85 font-medium">Moderate Risk</p>
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 flex items-center gap-3 text-blue-700">
              <Shield size={17} className="shrink-0" />
              <div>
                <p className="text-[19px] font-semibold tabular-nums leading-none">{atRiskCounts.early_warning}</p>
                <p className="text-[11.5px] mt-1 opacity-85 font-medium">Early Warning</p>
              </div>
            </div>
          </div>

          {/* Table of top delinquent accounts */}
          {atRiskLoading ? (
            <div className="card p-10 flex items-center justify-center">
              <Spinner size="md" />
              <span className="ml-3 text-[13.5px] text-slate-500">Scanning for delinquent customers…</span>
            </div>
          ) : atRiskList.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-2.5">
                <Shield size={20} className="text-green-600" />
              </div>
              <p className="text-[14px] font-medium text-slate-900">No delinquent customers detected</p>
              <p className="text-[13px] text-slate-500 mt-1">All monitored customer accounts are currently within safe thresholds.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800">Priority Intervention Queue</span>
                  <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                    Ranked by Risk
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchAtRisk}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
                  title="Refresh scan"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/40 border-b border-slate-200">
                      <th className="th">Customer</th>
                      <th className="th">Risk Tier</th>
                      <th className="th">Delinquency Probability</th>
                      <th className="th hidden sm:table-cell">Credit Score</th>
                      <th className="th hidden md:table-cell">Segment</th>
                      <th className="th text-right">Intervention Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {atRiskList.slice(0, 8).map((c) => {
                      const pct = Math.round(c.delinquency_prob * 100);
                      const barColor =
                        c.delinquency_prob >= 0.75 ? 'bg-red-500' :
                        c.delinquency_prob >= 0.50 ? 'bg-orange-500' :
                        c.delinquency_prob >= 0.30 ? 'bg-amber-500' : 'bg-blue-500';

                      return (
                        <tr key={c.customer_id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="td">
                            <Link to={`/customer/${c.customer_id}`} className="group block">
                              <p className="text-[13.5px] font-medium text-slate-900 group-hover:text-navy transition-colors">
                                {c.name}
                              </p>
                              <p className="text-[11.5px] text-slate-400 font-mono mt-0.5">
                                {c.customer_id}
                              </p>
                            </Link>
                          </td>
                          <td className="td">
                            <TierBadge tier={c.risk_tier} />
                          </td>
                          <td className="td">
                            <div className="flex items-center gap-2 min-w-[110px]">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[12px] font-semibold text-slate-700 tabular-nums w-9 text-right">
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td className="td hidden sm:table-cell">
                            <span className={`inline-block px-2 py-0.5 rounded text-[12px] font-semibold tabular-nums border ${scoreStyle(c.credit_score)}`}>
                              {c.credit_score}
                            </span>
                          </td>
                          <td className="td hidden md:table-cell">
                            <span className="text-[12.5px] text-slate-600 capitalize">
                              {c.segment?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="td text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canIntervene && (
                                <button
                                  type="button"
                                  onClick={() => navigate('/intervention/new', { state: { customerId: c.customer_id } })}
                                  className="btn-primary !py-1 !px-2.5 !text-[12px] inline-flex items-center gap-1 shrink-0"
                                  title="Trigger Intervention"
                                >
                                  <Zap size={13} />
                                  <span>Intervene</span>
                                </button>
                              )}
                              <Link
                                to={`/customer/${c.customer_id}`}
                                className="btn-secondary !py-1 !px-2.5 !text-[12px] inline-flex items-center gap-1 shrink-0"
                                title="View Customer Profile"
                              >
                                <span>Profile</span>
                                <ChevronRight size={13} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {atRiskList.length > 8 && (
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <p className="text-[12.5px] text-slate-500">
                    Showing top 8 priority accounts of {atRiskTotal} auto-detected
                  </p>
                  <Link
                    to="/at-risk"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-900 hover:text-navy hover:underline"
                  >
                    <span>View all in Delinquency Queue</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <CustomerDetailsModal customer={detailsCustomer} onClose={() => setDetailsCustomer(null)} />
    </div>
  );
}

function CustomerDetailsModal({ customer, onClose }) {
  const navigate = useNavigate();
  const customerId = customer?.customer_id ?? null;
  // Seed with the search-row data so details show instantly, then enrich
  // with the full profile.
  const [data, setData] = useState(customer);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    setData(customer);
    setError('');
    setCopied('');
    if (!customer?.customer_id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getCustomerProfile(customer.customer_id);
        if (!cancelled) setData((prev) => ({ ...prev, ...res }));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer]);

  // Close on Escape + lock body scroll
  useEffect(() => {
    if (!customerId) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [customerId, onClose]);

  if (!customerId) return null;

  const copy = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(key);
      setTimeout(() => setCopied(''), 1400);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  const initials = data?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '··';

  const segmentLabel = data?.segment === 'salaried'
    ? 'Salaried'
    : data?.segment === 'self_employed'
      ? 'Self-Employed'
      : data?.segment || '—';

  const geoLabel = data?.geography
    ? data.geography.charAt(0).toUpperCase() + data.geography.slice(1)
    : '—';

  // Portal keeps `fixed` positioning viewport-based even inside the
  // animated page root. The scrollable `min-h-full` + `m-auto` pattern
  // guarantees breathing room on all sides — a tall dialog scrolls
  // instead of touching the viewport edges.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Customer details">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex h-full items-center justify-center p-4 sm:p-8" onClick={onClose}>
        <div
          className="w-full max-w-[500px] max-h-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-fade-in flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="px-5 pt-4 pb-3.5 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
              <span className="text-[13px] font-semibold text-white tracking-wide">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight truncate">
                    {data?.name || (loading ? 'Loading…' : 'Customer profile')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => copy('id', customerId)}
                    title="Copy customer ID"
                    className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-mono text-slate-500 bg-slate-100 hover:bg-slate-200/70 hover:text-slate-700 px-2 py-0.5 rounded-md transition-colors"
                  >
                    {customerId}
                    {copied === 'id' ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 -mr-1 -mt-0.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                  aria-label="Close details"
                >
                  <X size={18} />
                </button>
              </div>
              {data && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                    <Briefcase size={12} />{segmentLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                    <MapPin size={12} />{geoLabel}
                  </span>
                  <span className={`inline-flex items-center text-[11.5px] font-semibold px-2 py-1 rounded-md border tabular-nums ${scoreStyle(data.credit_score)}`}>
                    Score {data.credit_score ?? '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body — the only scrollable layer: flex-1 + min-h-0 lets it
            shrink inside the capped dialog, overscroll-contain stops
            scroll chaining so the backdrop never moves */}
        <div className="px-5 py-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {loading && !data && <ModalSkeleton />}

          {error && !data && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Couldn’t load this profile</p>
                <p className="mt-0.5 text-red-700/90">{error}</p>
              </div>
            </div>
          )}

          {error && data && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-[12.5px] text-amber-800">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <Section title="Contact">
                <Field
                  icon={<Mail size={15} />}
                  label="Email"
                  value={data.email}
                  copyKey="email"
                  copied={copied}
                  onCopy={() => copy('email', data.email)}
                />
                <Field
                  icon={<Phone size={15} />}
                  label="Phone"
                  value={data.phone_number}
                  mono
                  copyKey="phone"
                  copied={copied}
                  onCopy={() => copy('phone', data.phone_number)}
                />
              </Section>

              <Section title="Account">
                <Field
                  icon={<CreditCard size={15} />}
                  label="Account number"
                  value={data.account_number}
                  mono
                  copyKey="acct"
                  copied={copied}
                  onCopy={() => copy('acct', data.account_number)}
                />
                <Field
                  icon={<Building2 size={15} />}
                  label="IFSC"
                  value={data.ifsc_code}
                  mono
                  copyKey="ifsc"
                  copied={copied}
                  onCopy={() => copy('ifsc', data.ifsc_code)}
                />
              </Section>

              <Section title="Profile">
                <div className="grid grid-cols-2 gap-2.5">
                  <Mini label="Date of birth" value={data.dob ? new Date(data.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null} icon={<Calendar size={13} />} />
                  <Mini label="Onboarded" value={data.created_at ? new Date(data.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null} icon={<UserRound size={13} />} />
                </div>
              </Section>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
          <button onClick={onClose} className="btn-secondary !py-2 !text-[13px]">Close</button>
          <button
            onClick={() => { onClose(); navigate(`/customer/${customerId}`); }}
            disabled={loading && !data}
            className="btn-primary !py-2 !text-[13px] disabled:opacity-50"
          >
            Open risk view<ArrowRight size={15} />
          </button>
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-2">{title}</p>
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Field({ icon, label, value, mono, copyKey, copied, onCopy }) {
  const display = value || '—';
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
      <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] text-slate-500 leading-none">{label}</p>
        <p className={`text-[13.5px] font-medium text-slate-900 mt-1 truncate ${mono ? 'font-mono text-[13px]' : ''}`}>
          {display}
        </p>
      </div>
      {value && (
        <button
          type="button"
          onClick={onCopy}
          title={`Copy ${label.toLowerCase()}`}
          className="p-1.5 rounded-md text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        >
          {copied === copyKey ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
        </button>
      )}
    </div>
  );
}

function Mini({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3.5 py-3 bg-white">
      <p className="text-[11.5px] text-slate-500 flex items-center gap-1.5">{icon}{label}</p>
      <p className="text-[13.5px] font-medium text-slate-900 mt-1">{value || '—'}</p>
    </div>
  );
}

function ModalSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading profile">
      <div className="flex gap-1.5">
        <div className="skeleton h-7 w-24 rounded-md" />
        <div className="skeleton h-7 w-20 rounded-md" />
        <div className="skeleton h-7 w-24 rounded-md" />
      </div>
      {[0, 1, 2].map((s) => (
        <div key={s}>
          <div className="skeleton h-3 w-20 mb-2" />
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-3.5 py-3">
              <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-2.5 w-16" />
                <div className="skeleton h-3.5 w-40" />
              </div>
            </div>
            <div className="border-t border-slate-100 flex items-center gap-3 px-3.5 py-3">
              <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-2.5 w-16" />
                <div className="skeleton h-3.5 w-32" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
