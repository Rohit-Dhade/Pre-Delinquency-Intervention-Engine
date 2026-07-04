import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Activity, Mail, Target, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getInterventionStats } from '../api/interventions';
import { useRequireRole } from '../hooks/useRequireRole';
import { TIER_CONFIG } from '../utils/tiers';
import Spinner from '../components/ui/Spinner';

const TIER_COLORS = { critical: '#DC2626', moderate: '#D97706', watch: '#CA8A04', stable: '#059669' };

export default function StatsPage() {
  useRequireRole(['admin', 'risk_analyst']);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const data = await getInterventionStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) { const d = err.response?.data?.detail || 'Failed to load stats'; setError(d); toast.error(d); }
      } finally { if (!cancelled) setLoading(false); }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><Spinner size="lg" /><p className="text-on-surface-variant text-sm ml-4">Loading statistics…</p></div>;
  if (error) return <div className="max-w-2xl mx-auto py-16 text-center"><AlertTriangle className="w-12 h-12 text-tier-moderate mx-auto mb-4" /><p className="text-sm text-on-surface-variant">{error}</p></div>;

  const tierDist = stats?.tier_distribution || {};
  const pieData = Object.entries(tierDist).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: TIER_COLORS[k] }));
  const acceptByTier = Object.entries(stats?.offer_acceptance_rate?.by_tier || {}).map(([k, v]) => ({ tier: k.charAt(0).toUpperCase() + k.slice(1), rate: +(v * 100).toFixed(1), fill: TIER_COLORS[k] }));
  const acceptByOffer = Object.entries(stats?.offer_acceptance_rate?.by_offer_type || {}).map(([k, v]) => ({ type: k, rate: +(v * 100).toFixed(1) }));
  const recoveryByOffer = Object.entries(stats?.recovery_rate?.by_offer_type || {}).map(([k, v]) => ({ type: k, rate: +(v * 100).toFixed(1) }));

  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Intervention Statistics</h1>
        <p className="text-sm text-on-surface-variant mt-1">Last 7 days performance metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard icon={<Activity className="w-5 h-5" />} label="Total Interventions" value={stats?.total_interventions_this_week ?? 0} color="text-navy" bg="bg-accent-dim" />
        <KPICard icon={<Mail className="w-5 h-5" />} label="Email Delivery Rate" value={`${((stats?.email_delivery_rate || 0) * 100).toFixed(1)}%`} color="text-accent" bg="bg-accent-dim" />
        <KPICard icon={<Target className="w-5 h-5" />} label="Recovery Rate" value={`—`} color="text-tier-stable" bg="bg-tier-stable-bg" />
        <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="False Positive Rate" value={`${((stats?.false_positive_rate || 0) * 100).toFixed(1)}%`} color="text-tier-moderate" bg="bg-tier-moderate-bg" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Tier Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [v, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-on-surface-variant py-8 text-center">No data available</p>}
        </div>

        {/* Acceptance by Tier */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Acceptance Rate by Tier</h3>
          {acceptByTier.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={acceptByTier}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="tier" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} unit="%" /><Tooltip formatter={(v) => [`${v}%`, 'Rate']} /><Bar dataKey="rate" radius={[4, 4, 0, 0]}>{acceptByTier.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar></BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-on-surface-variant py-8 text-center">No data available</p>}
        </div>

        {/* Acceptance by Offer Type */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Acceptance by Offer Type</h3>
          {acceptByOffer.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={acceptByOffer} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis type="number" unit="%" tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={120} /><Tooltip formatter={(v) => [`${v}%`, 'Rate']} /><Bar dataKey="rate" fill="#1E3A5F" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-on-surface-variant py-8 text-center">No data available</p>}
        </div>

        {/* Recovery by Offer Type */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Recovery Rate by Offer Type</h3>
          {recoveryByOffer.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={recoveryByOffer} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis type="number" unit="%" tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={120} /><Tooltip formatter={(v) => [`${v}%`, 'Rate']} /><Bar dataKey="rate" fill="#059669" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-on-surface-variant py-8 text-center">No data available</p>}
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color, bg }) {
  return (
    <div className="bg-white rounded-xl border border-outline-variant shadow-card p-5">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ${color} mb-3`}>{icon}</div>
      <p className="text-2xl font-semibold text-on-surface">{value}</p>
      <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}
