/**
 * Dashboard Page — customer lookup with inline search results + quick stats.
 * Employees can search customers by ID, name, or account number.
 * Clicking a result navigates to /customer/:customerId.
 *
 * Implements high-end, premium styling with soft shadows, hover transitions,
 * glowing focus effects, and cohesive typography. Resolves Tailwind v4 theme key
 * conflicts by using explicit arbitrary max-width values.
 *
 * Added "View Details" button to allow inline viewing of all static customer profile
 * data from the database.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Activity,
  Mail,
  Target,
  AlertTriangle,
  CreditCard,
  MapPin,
  Phone,
  ChevronRight,
  AlertCircle,
  Loader2,
  X,
  UserRound,
  Sparkles,
  Calendar,
  Building,
  Clock,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { searchCustomers, getCustomerProfile } from '../api/customers';

/* ── Segment + Geography display helpers ─────────────────────────────────── */

const SEGMENT_STYLES = {
  salaried: { label: 'Salaried', bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6' },
  self_employed: { label: 'Self-Employed', bg: '#FDF4FF', text: '#86198F', dot: '#A855F7' },
};

const GEO_STYLES = {
  urban: { label: 'Urban', bg: '#F0FDF4', text: '#166534', dot: '#22C55E' },
  tier2: { label: 'Tier 2', bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' },
  rural: { label: 'Rural', bg: '#FFF7ED', text: '#9A3412', dot: '#F97316' },
};

function Badge({ config }) {
  if (!config) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border border-transparent shadow-xs transition-all duration-200"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  );
}

function getScoreConfig(score) {
  if (score >= 750) return { label: 'Excellent', text: 'text-tier-stable', bg: 'bg-tier-stable-bg/50', border: 'border-tier-stable/20' };
  if (score >= 650) return { label: 'Good', text: 'text-tier-watch', bg: 'bg-tier-watch-bg/50', border: 'border-tier-watch/20' };
  if (score >= 550) return { label: 'Fair', text: 'text-tier-moderate', bg: 'bg-tier-moderate-bg/50', border: 'border-tier-moderate/20' };
  return { label: 'Critical', text: 'text-tier-critical', bg: 'bg-tier-critical-bg/50', border: 'border-tier-critical/20' };
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Modal state
  const [detailsCustomerId, setDetailsCustomerId] = useState(null);

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
      if (!controller.signal.aborted) {
        setResults(data);
      }
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

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setError('');
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-fade-in">
      
      {/* ── Welcome Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-navy via-navy-light to-accent p-6 rounded-2xl text-white shadow-elevated border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(173,200,245,0.15),transparent_50%)]" />
        <div className="relative z-10 space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Welcome back, {employee?.full_name?.split(' ')[0]} <Sparkles className="w-5 h-5 text-accent-light" />
          </h1>
          <p className="text-white/80 text-sm max-w-[576px]">
            You are logged in as <span className="font-semibold text-white uppercase tracking-wider text-xs bg-white/15 px-2 py-0.5 rounded">{employee?.role?.replace('_', ' ')}</span>. Search for a customer to view their risk assessment.
          </p>
        </div>
      </div>

      {/* ── Customer Lookup Card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-outline-variant/60 shadow-elevated overflow-hidden transition-all duration-300">
        <div className="px-6 py-5 border-b border-outline-variant/35 bg-surface-lowest">
          <h2 className="text-xs font-bold text-navy uppercase tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4 text-accent" />
            Customer Lookup
          </h2>
        </div>

        <div className="p-6 bg-surface-lowest/40 space-y-4">
          {/* Search form */}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-outline group-focus-within:text-navy transition-colors duration-250" />
              <input
                ref={inputRef}
                id="customer-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Customer ID, Name, or Account Number…"
                className="w-full pl-11 pr-10 py-3.5 border border-outline-variant rounded-xl text-sm bg-white text-on-surface placeholder:text-outline/75 focus:outline-none focus:ring-2 focus:ring-navy/85 focus:border-transparent transition-all shadow-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-all duration-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="px-8 py-3.5 bg-navy hover:bg-navy-hover active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:scale-100 disabled:shadow-none shrink-0 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>

          {/* Quick-try hints */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <span className="text-[11px] font-medium text-on-surface-variant/70 uppercase tracking-wider mr-1">Suggested Searches:</span>
            {['CUST_0001', 'Priya', '52004890335'].map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => { setQuery(hint); doSearch(hint); }}
                className="text-xs px-3.5 py-1.5 rounded-full border border-outline-variant/65 text-on-surface-variant hover:bg-navy hover:border-transparent hover:text-white transition-all duration-250 active:scale-[0.96]"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Search Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-error-container/50 border border-error/25 rounded-2xl animate-fade-in shadow-xs">
          <AlertCircle className="w-5 h-5 text-error shrink-0" />
          <p className="text-sm text-on-error-container font-medium">{error}</p>
        </div>
      )}

      {/* ── Loading Skeletons ──────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-2xl border border-outline-variant shadow-elevated p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low/70">
              <div className="skeleton w-11 h-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-48 rounded" />
                <div className="skeleton h-3.5 w-32 rounded" />
              </div>
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* ── Search Results ─────────────────────────────────────────────── */}
      {!loading && results !== null && (
        <div className="bg-white rounded-2xl border border-outline-variant/65 shadow-elevated overflow-hidden animate-fade-in">
          {/* Results header */}
          <div className="px-6 py-4 border-b border-outline-variant/35 bg-surface-container-low/40 flex items-center justify-between">
            <h2 className="text-xs font-bold text-navy uppercase tracking-widest">
              {results.length === 0
                ? 'No Matches Found'
                : `${results.length} Match${results.length !== 1 ? 'es' : ''} Found`}
            </h2>
            {results.length >= 20 && (
              <span className="text-xs text-on-surface-variant font-medium bg-surface-container/60 px-2.5 py-1 rounded-md">Showing top 20 matches</span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 text-outline-variant">
                <UserRound className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-on-surface mb-1.5">No Customers Found</h3>
              <p className="text-sm text-on-surface-variant text-center max-w-[384px]">
                No matching customer records for "<span className="font-semibold text-navy">{query}</span>".
                Check the spelling or search using another value.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/30">
              {results.map((customer) => {
                const scoreConf = getScoreConfig(customer.credit_score);
                return (
                  <button
                    key={customer.customer_id}
                    onClick={() => navigate(`/customer/${customer.customer_id}`)}
                    className="w-full text-left px-6 py-4.5 flex items-center gap-5 hover:bg-surface-container-low/40 transition-all duration-200 group relative border-l-4 border-transparent hover:border-navy"
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-navy/8 flex items-center justify-center shrink-0 group-hover:bg-navy/15 transition-all duration-300">
                      <span className="text-xs font-bold text-navy">
                        {customer.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-on-surface truncate group-hover:text-navy transition-colors">{customer.name}</span>
                        <span className="text-[10px] font-mono font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/30">{customer.customer_id}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-on-surface-variant/85 flex-wrap">
                        {customer.account_number && (
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <CreditCard className="w-3.5 h-3.5 text-outline" />
                            {customer.account_number}
                          </span>
                        )}
                        {customer.email && (
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-outline" />
                            {customer.email}
                          </span>
                        )}
                        {customer.phone_number && (
                          <span className="inline-flex items-center gap-1.5 hidden sm:inline-flex">
                            <Phone className="w-3.5 h-3.5 text-outline" />
                            {customer.phone_number}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="hidden md:flex items-center gap-3 shrink-0">
                      <Badge config={SEGMENT_STYLES[customer.segment]} />
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-on-surface-variant/60" />
                        <Badge config={GEO_STYLES[customer.geography]} />
                      </span>
                    </div>

                    {/* Credit Score Pill */}
                    <div className="text-right shrink-0 min-w-[96px]">
                      <span className={`inline-flex flex-col items-end px-3 py-1 rounded-xl border ${scoreConf.bg} ${scoreConf.border} transition-all`}>
                        <span className={`text-base font-extrabold tracking-tight ${scoreConf.text}`}>
                          {customer.credit_score}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                          {scoreConf.label}
                        </span>
                      </span>
                    </div>

                    {/* Actions: View Details Button & Arrow */}
                    <div className="shrink-0 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailsCustomerId(customer.customer_id);
                        }}
                        className="px-3.5 py-1.5 bg-surface-container border border-outline-variant/60 hover:bg-navy hover:text-white hover:border-transparent text-[11px] font-bold text-navy rounded-lg transition-all active:scale-[0.96]"
                      >
                        View Details
                      </button>

                      <div className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-navy/5 text-outline group-hover:text-navy group-hover:translate-x-1.5 transition-all duration-300">
                        <ChevronRight className="w-5 h-5 shrink-0" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Stats Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Active Predictions"
          value="—"
          color="text-navy"
          bgColor="bg-accent-dim"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="Recovery Rate"
          value="—"
          color="text-tier-stable"
          bgColor="bg-tier-stable-bg"
        />
        <StatCard
          icon={<Mail className="w-5 h-5" />}
          label="Email Delivery"
          value="—"
          color="text-accent"
          bgColor="bg-accent-dim"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="False Positive Rate"
          value="—"
          color="text-tier-moderate"
          bgColor="bg-tier-moderate-bg"
        />
      </div>

      {/* ── Informational Quick Guide ────────────────────────────────────── */}
      <div className="p-5 bg-surface-container-low/75 rounded-2xl border border-outline-variant/40 shadow-xs">
        <p className="text-xs text-on-surface-variant/90 leading-relaxed">
          <strong className="text-navy font-bold uppercase tracking-wider text-[10px] bg-navy/5 px-2 py-0.5 rounded-md mr-1.5">Quick Guide:</strong>{' '}
          Enter a customer ID, name, or bank account number above. Click on any search result card to access the full risk dashboard containing detailed machine learning feature metrics, SHAP values, and risk tier assignments.
          {employee?.role === 'relationship_manager' || employee?.role === 'admin'
            ? ' Authorized roles can initiate custom pre-delinquency interventions directly from the customer details view.'
            : ''}
        </p>
      </div>

      {/* ── Customer Details Modal ──────────────────────────────────────── */}
      <CustomerDetailsModal
        customerId={detailsCustomerId}
        onClose={() => setDetailsCustomerId(null)}
      />
    </div>
  );
}

function StatCard({ icon, label, value, color, bgColor }) {
  return (
    <div className="bg-white rounded-2xl border border-outline-variant/60 shadow-elevated p-6 hover:shadow-elevated hover:-translate-y-1 hover:border-navy/35 transition-all duration-300 group">
      <div className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center ${color} mb-4 transition-transform duration-300 group-hover:scale-110`}>
        {icon}
      </div>
      <p className="text-3xl font-extrabold text-on-surface tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-on-surface-variant/75 mt-1.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ── Customer Details Modal Component ───────────────────────────────────── */

function CustomerDetailsModal({ customerId, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await getCustomerProfile(customerId);
        setData(res);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load customer profile details.');
      } finally {
        setLoading(false);
      }
    }
    if (customerId) {
      load();
    } else {
      setData(null);
    }
  }, [customerId]);

  if (!customerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-on-surface/45 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-elevated border border-outline-variant max-w-[540px] w-full mx-4 overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-outline-variant/35 bg-surface-lowest flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-navy flex items-center gap-2">
              <UserRound className="w-5 h-5 text-accent" />
              Customer Profile Details
            </h3>
            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">Static Database Record</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-navy animate-spin" />
              <p className="text-xs text-on-surface-variant font-semibold animate-pulse">Fetching profile details...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-error-container/50 border border-error/25 text-on-error-container text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Profile Card Header */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/30">
                <div className="w-14 h-14 rounded-full bg-navy flex items-center justify-center shrink-0 shadow-xs">
                  <span className="text-base font-extrabold text-white">
                    {data.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-on-surface truncate">{data.name}</h4>
                  <p className="text-xs font-mono font-bold text-on-surface-variant mt-0.5">{data.customer_id}</p>
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem
                  icon={<CreditCard className="w-4 h-4 text-navy" />}
                  label="Account Number"
                  value={data.account_number || '—'}
                />
                <DetailItem
                  icon={<Building className="w-4 h-4 text-navy" />}
                  label="IFSC Code"
                  value={data.ifsc_code || '—'}
                />
                <DetailItem
                  icon={<Briefcase className="w-4 h-4 text-navy" />}
                  label="Employment Segment"
                  value={data.segment === 'salaried' ? 'Salaried' : data.segment === 'self_employed' ? 'Self-Employed' : data.segment || '—'}
                />
                <DetailItem
                  icon={<MapPin className="w-4 h-4 text-navy" />}
                  label="Geography"
                  value={data.geography ? data.geography.charAt(0).toUpperCase() + data.geography.slice(1) : '—'}
                />
                <DetailItem
                  icon={<Mail className="w-4 h-4 text-navy" />}
                  label="Email Address"
                  value={data.email || '—'}
                />
                <DetailItem
                  icon={<Phone className="w-4 h-4 text-navy" />}
                  label="Phone Number"
                  value={data.phone_number || '—'}
                />
                <DetailItem
                  icon={<Calendar className="w-4 h-4 text-navy" />}
                  label="Date of Birth"
                  value={data.dob ? new Date(data.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                />
                <DetailItem
                  icon={<Clock className="w-4 h-4 text-navy" />}
                  label="Record Created"
                  value={data.created_at ? new Date(data.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                />
              </div>

              {/* Credit Score Banner */}
              <div className="p-4 rounded-xl bg-navy/5 border border-navy/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-navy" />
                  <div>
                    <span className="text-xs font-bold text-on-surface block">Bureau Credit Score</span>
                    <span className="text-[10px] font-semibold text-on-surface-variant">Validated via official bureau pull</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-navy tracking-tight">{data.credit_score}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/35 bg-surface-container-low/40 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-on-surface bg-white border border-outline-variant rounded-lg hover:bg-surface-container transition-all active:scale-[0.98]"
          >
            Close Profile
          </button>
          {!loading && !error && data && (
            <button
              onClick={() => {
                onClose();
                navigate(`/customer/${data.customer_id}`);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-navy hover:bg-navy-hover rounded-lg transition-all active:scale-[0.98] flex items-center gap-1"
            >
              View Risk Dashboard
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="p-3 rounded-xl bg-surface-container-low/45 border border-outline-variant/20 flex items-start gap-3">
      <div className="mt-0.5 p-1 rounded-md bg-navy/5">
        {icon}
      </div>
      <div className="min-w-0">
        <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
        <span className="text-xs font-semibold text-on-surface mt-0.5 block truncate">{value}</span>
      </div>
    </div>
  );
}
