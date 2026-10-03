import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Activity, Mail, Target, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getInterventionStats } from '../api/interventions';
import { useRequireRole } from '../hooks/useRequireRole';
import Spinner from '../components/ui/Spinner';

const TIER_COLORS = { critical: '#b42318', moderate: '#b54708', watch: '#a38200', stable: '#067647' };

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '12.5px',
  boxShadow: '0 4px 12px rgba(16,24,40,.08)',
};

export default function StatsPage() {
  useRequireRole(['admin', 'risk_analyst']);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const data = await getInterventionStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) { const d = err.response?.data?.detail || 'Failed to load statistics.'; setError(d); toast.error(d); }
      } finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-28">
        <Spinner size="lg" />
        <p className="text-[13.5px] text-slate-500">Loading statistics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-amber-600" />
        </div>
        <p className="text-[13.5px] text-slate-500">{error}</p>
      </div>
    );
  }

  const tierDist = stats?.tier_distribution || {};
  const pieData = Object.entries(tierDist).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: TIER_COLORS[k] || '#64748b' }));
  const acceptByTier = Object.entries(stats?.offer_acceptance_rate?.by_tier || {}).map(([k, v]) => ({ tier: k.charAt(0).toUpperCase() + k.slice(1), rate: +(v * 100).toFixed(1), fill: TIER_COLORS[k] || '#1b365d' }));
  const acceptByOffer = Object.entries(stats?.offer_acceptance_rate?.by_offer_type || {}).map(([k, v]) => ({ type: k, rate: +(v * 100).toFixed(1) }));
  const recoveryByOffer = Object.entries(stats?.recovery_rate?.by_offer_type || {}).map(([k, v]) => ({ type: k, rate: +(v * 100).toFixed(1) }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">Statistics</h1>
        <p className="text-[13.5px] text-slate-500 mt-1">Intervention performance over the last 7 days</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<Activity size={18} />} label="Total interventions" value={stats?.total_interventions_this_week ?? 0} />
        <KPICard icon={<Mail size={18} />} label="Email delivery" value={`${((stats?.email_delivery_rate || 0) * 100).toFixed(1)}%`} />
        <KPICard icon={<Target size={18} />} label="Recovery rate" value="—" />
        <KPICard icon={<AlertTriangle size={18} />} label="False positive rate" value={`${((stats?.false_positive_rate || 0) * 100).toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Tier distribution">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={92} dataKey="value" stroke="#fff" strokeWidth={2}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Count']} />
                <Legend wrapperStyle={{ fontSize: '12.5px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>

        <ChartCard title="Acceptance rate by tier">
          {acceptByTier.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={acceptByTier} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="tier" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Rate']} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="rate" radius={[5, 5, 0, 0]}>{acceptByTier.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>

        <ChartCard title="Acceptance by offer type">
          {acceptByOffer.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={acceptByOffer} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11.5, fill: '#475569' }} width={130} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Rate']} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="rate" fill="#1b365d" radius={[0, 5, 5, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>

        <ChartCard title="Recovery by offer type">
          {recoveryByOffer.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={recoveryByOffer} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11.5, fill: '#475569' }} width={130} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Rate']} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="rate" fill="#067647" radius={[0, 5, 5, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="card p-5">
      <p className="section-title mb-4">{title}</p>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-[13px] text-slate-400 py-10 text-center">No data available for this period.</p>;
}

function KPICard({ icon, label, value }) {
  return (
    <div className="card p-5">
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 mb-3.5">
        {icon}
      </div>
      <p className="text-[24px] font-semibold text-slate-900 tracking-tight tabular-nums leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-1.5">{label}</p>
    </div>
  );
}
