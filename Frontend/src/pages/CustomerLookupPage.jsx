/**
 * CustomerLookupPage — search customers by ID, name, or account number.
 * Displays results in a rich data table with inline risk context and
 * click-through to the customer detail page.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  UserRound,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  AlertCircle,
  Loader2,
  X,
  Calendar,
  Briefcase,
  Building2,
  Hash,
  ExternalLink,
} from 'lucide-react';
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
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  );
}

function creditScoreColor(score) {
  if (score >= 750) return 'text-tier-stable';
  if (score >= 650) return 'text-tier-watch';
  if (score >= 550) return 'text-tier-moderate';
  return 'text-tier-critical';
}

/* ── Customer Details Modal ─────────────────────────────────────────────── */
function CustomerDetailsModal({ customerId, isOpen, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen || !customerId) return;

    async function fetchDetails() {
      setLoading(true);
      setError('');
      try {
        const data = await getCustomerProfile(customerId);
        setDetails(data);
      } catch (err) {
        const msg = err.response?.data?.detail || 'Failed to fetch customer details.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [customerId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-elevated border border-outline-variant max-w-2xl w-full overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-navy">
                {details?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CU'}
              </span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-on-surface">
                {details ? details.name : 'Loading Details...'}
              </h3>
              <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                {customerId}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-navy animate-spin mb-3" />
              <p className="text-sm text-on-surface-variant">Fetching customer profile...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-error-container/40 border border-error/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-error shrink-0" />
              <p className="text-sm text-on-error-container">{error}</p>
            </div>
          )}

          {!loading && !error && details && (
            <div className="space-y-6">
              {/* Demographics / Basic info */}
              <div>
                <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                  Demographic Profile
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <UserRound className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Full Name</p>
                      <p className="text-sm text-on-surface font-semibold">{details.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <Calendar className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Date of Birth</p>
                      <p className="text-sm text-on-surface font-semibold">
                        {details.dob ? new Date(details.dob).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <Briefcase className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Employment Segment</p>
                      <div className="mt-0.5">
                        <Badge config={SEGMENT_STYLES[details.segment]} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <MapPin className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Geography</p>
                      <div className="mt-0.5">
                        <Badge config={GEO_STYLES[details.geography]} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                  Contact Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <Mail className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Email Address</p>
                      <p className="text-sm text-on-surface font-semibold truncate">{details.email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <Phone className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Phone Number</p>
                      <p className="text-sm text-on-surface font-semibold">{details.phone_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account / Financial info */}
              <div>
                <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                  Account & Financial Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <CreditCard className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Account Number</p>
                      <p className="text-sm text-on-surface font-mono font-semibold">{details.account_number || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <Building2 className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">IFSC Code</p>
                      <p className="text-sm text-on-surface font-mono font-semibold">{details.ifsc_code || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <Hash className="w-4.5 h-4.5 text-outline" />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase font-medium">Credit Score</p>
                      <p className={`text-sm font-bold ${creditScoreColor(details.credit_score)}`}>
                        {details.credit_score}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Metadata */}
              <div className="flex justify-between items-center text-xs text-on-surface-variant bg-surface-container/30 px-4 py-3 rounded-xl border border-outline-variant/40">
                <span>Account Onboarded: <strong>{details.created_at ? new Date(details.created_at).toLocaleDateString() : 'N/A'}</strong></span>
                <span className="text-[10px] font-mono uppercase bg-surface-container px-2 py-0.5 rounded text-outline font-semibold">Active Profile</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-low/50">
          <button
            onClick={() => {
              onClose();
              navigate(`/customer/${customerId}`);
            }}
            className="px-4 py-2 bg-navy hover:bg-navy-hover text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            Go to Profile
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant text-on-surface hover:bg-surface-container text-sm font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function CustomerLookupPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);  // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const doSearch = useCallback(async (searchTerm) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    // Cancel any in-flight request
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
        const msg = err.response?.data?.detail || 'Search failed. Please try again.';
        setError(msg);
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
    <div className="max-w-6xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Customer Lookup</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Search by customer ID, name, or account number to view profiles and risk assessments.
        </p>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6 mb-6">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-outline" />
            <input
              ref={inputRef}
              id="customer-lookup-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Customer ID, Name, or Account Number…"
              className="w-full pl-10 pr-10 py-3 border border-outline-variant rounded-lg text-sm bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 transition-all"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-surface-container transition-colors"
              >
                <X className="w-4 h-4 text-outline" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-6 py-3 bg-navy hover:bg-navy-hover text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-40 shrink-0 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Search
          </button>
        </form>

        {/* Search hints */}
        <div className="flex flex-wrap gap-2 mt-3">
          {['CUST_0001', 'Priya', '52004890335'].map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => { setQuery(hint); doSearch(hint); }}
              className="text-xs px-2.5 py-1 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:border-navy/30 hover:text-navy transition-all"
            >
              Try "{hint}"
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-error-container/40 border border-error/20 rounded-xl animate-fade-in">
          <AlertCircle className="w-5 h-5 text-error shrink-0" />
          <p className="text-sm text-on-error-container">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-surface-container-low" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="skeleton w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-48 rounded" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && results !== null && (
        <div className="bg-white rounded-xl border border-outline-variant shadow-card overflow-hidden animate-fade-in">
          {/* Results header */}
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/50">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                {results.length === 0
                  ? 'No Results'
                  : `${results.length} Customer${results.length !== 1 ? 's' : ''} Found`}
              </h2>
              {results.length >= 20 && (
                <span className="text-xs text-on-surface-variant">Showing first 20 results — refine your search for more</span>
              )}
            </div>
          </div>

          {results.length === 0 ? (
            /* Empty state */
            <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
                <UserRound className="h-8 w-8 text-outline" />
              </div>

              <h3 className="text-lg font-semibold text-on-surface">
                No customers found
              </h3>

              <p className="mt-2 text-sm leading-6 text-on-surface-variant flex">
                No matches for{" "}
                <span className="font-medium text-on-surface">"{query}"</span>. Try a
                different customer ID, name, or account number.
              </p>
            </div>
          ) : (
            /* Results table */
            <div className="divide-y divide-outline-variant/50">
              {results.map((customer, idx) => (
                <div
                  key={customer.customer_id}
                  onClick={() => navigate(`/customer/${customer.customer_id}`)}
                  className="w-full text-left px-6 py-4 flex items-center gap-5 hover:bg-surface-container-low/60 transition-colors duration-150 group cursor-pointer"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-navy/10 flex items-center justify-center shrink-0 group-hover:bg-navy/15 transition-colors">
                    <span className="text-sm font-semibold text-navy">
                      {customer.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-on-surface truncate">{customer.name}</span>
                      <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">{customer.customer_id}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                      {customer.account_number && (
                        <span className="inline-flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {customer.account_number}
                        </span>
                      )}
                      {customer.email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </span>
                      )}
                      {customer.phone_number && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge config={SEGMENT_STYLES[customer.segment]} />
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-on-surface-variant" />
                      <Badge config={GEO_STYLES[customer.geography]} />
                    </span>
                  </div>

                  {/* Credit Score */}
                  <div className="text-right shrink-0 w-16">
                    <p className={`text-lg font-bold ${creditScoreColor(customer.credit_score)}`}>
                      {customer.credit_score}
                    </p>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">Score</p>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCustomerId(customer.customer_id);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-navy bg-navy/5 hover:bg-navy/10 border border-navy/10 rounded-lg transition-colors shrink-0"
                  >
                    View Details
                  </button>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-outline group-hover:text-navy transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial state — before any search */}
      {!loading && results === null && (
        <div className="bg-white rounded-xl border border-outline-variant shadow-card p-12 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-accent-dim/60 flex items-center justify-center mx-auto mb-5">
            <Search className="w-9 h-9 text-navy" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface mb-2">Search for a Customer</h3>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            Enter a customer ID (e.g. CUST_0001), name (e.g. Priya), or account number to find their profile and view risk assessments.
          </p>
        </div>
      )}

      {/* Customer Details Modal */}
      <CustomerDetailsModal
        customerId={selectedCustomerId}
        isOpen={selectedCustomerId !== null}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
}
