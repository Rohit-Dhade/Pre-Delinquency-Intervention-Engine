/**
 * Dashboard Page — customer ID search bar + quick stats.
 * Routes to /customer/:customerId on search.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Activity, Mail, Target, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = searchId.trim();
    if (trimmed) {
      navigate(`/customer/${trimmed}`);
    }
  };

  return (
    <div className="max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Dashboard</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Welcome back, {employee?.full_name?.split(' ')[0]}. Search for a customer to view their risk assessment.
        </p>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6 mb-8">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-4">
          Customer Lookup
        </h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-outline" />
            <input
              id="customer-search"
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter Customer ID (e.g., CUST_001)"
              className="w-full pl-10 pr-4 py-3 border border-outline-variant rounded-lg text-sm bg-white text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-1 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!searchId.trim()}
            className="px-6 py-3 bg-navy hover:bg-navy-hover text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-40 shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Help text */}
      <div className="mt-8 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
        <p className="text-xs text-on-surface-variant">
          <strong className="text-on-surface">Quick guide:</strong>{' '}
          Enter a customer ID above to view their delinquency risk assessment, SHAP explanations, and intervention history.
          {employee?.role === 'relationship_manager' || employee?.role === 'admin'
            ? ' You can trigger interventions for at-risk customers (probability > 20%).'
            : ''}
          {employee?.role === 'risk_analyst' || employee?.role === 'admin'
            ? ' Visit Statistics for aggregated intervention metrics.'
            : ''}
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, bgColor }) {
  return (
    <div className="bg-white rounded-xl border border-outline-variant shadow-card p-5">
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center ${color} mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-on-surface">{value}</p>
      <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}
