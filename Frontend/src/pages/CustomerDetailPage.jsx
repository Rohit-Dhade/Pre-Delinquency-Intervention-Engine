import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, Send, Clock, CheckCircle2, XCircle, Minus } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { predictCustomer } from '../api/predictions';
import { getInterventionHistory } from '../api/interventions';
import { useAuth } from '../context/AuthContext';
import { getTierFromProb, getTierConfig, formatProb } from '../utils/tiers';
import TierBadge from '../components/ui/TierBadge';
import Spinner from '../components/ui/Spinner';

const TIER_BAR = { critical: '#b42318', moderate: '#b54708', watch: '#a38200', stable: '#067647' };

export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const canTrigger = employee?.role === 'relationship_manager' || employee?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true); setError('');
      try {
        const [pred, hist] = await Promise.all([predictCustomer(customerId), getInterventionHistory(customerId)]);
        if (!cancelled) { setPrediction(pred); setHistory(hist); }
      } catch (err) {
        if (!cancelled) { const d = err.response?.data?.detail || 'Failed to load customer data.'; setError(d); toast.error(d); }
      } finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <div className="grid place-items-center min-h-[70vh] px-4">
        <div className="flex flex-col items-center text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-[13.5px] text-slate-500">Loading risk assessment…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-amber-600" />
        </div>
        <h2 className="text-[17px] font-semibold text-slate-900">Unable to load customer</h2>
        <p className="text-[13.5px] text-slate-500 mt-1.5 mb-6">{error}</p>
        <Link to="/dashboard" className="btn-secondary">
          <ArrowLeft size={16} />Back to dashboard
        </Link>
      </div>
    );
  }

  const prob = prediction?.probabilities?.delinquency || 0;
  const tier = getTierFromProb(prob);
  const tierCfg = getTierConfig(tier);
  const topReasons = prediction?.explanation?.top_3_reasons || [];
  const allContribs = prediction?.all_feature_contributions || [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-slate-500">
        <Link to="/dashboard" className="hover:text-slate-900">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-medium font-mono text-[12.5px]">{customerId}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight font-mono">{customerId}</h1>
        <TierBadge tier={tier} />
        <div className="ml-auto">
          {canTrigger && prob > 0.20 && (
            <button
              onClick={() => navigate('/intervention/new', { state: { customerId, prediction } })}
              className="btn-primary"
            >
              <Send size={15} />Trigger intervention
            </button>
          )}
        </div>
      </div>

      {/* Risk */}
      <div className="card p-5 sm:p-6">
        <p className="section-title mb-4">Risk assessment</p>
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
          <div className="flex items-center gap-5 shrink-0">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#eef2f7" strokeWidth="9" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={tierCfg.color} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${Math.min(prob, 1) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[19px] font-semibold text-slate-900 tabular-nums tracking-tight">{formatProb(prob)}</span>
              </div>
            </div>
            <div>
              <p className="text-[14px] font-medium text-slate-900">{tierCfg.fullLabel}</p>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                {prediction?.label === 'delinquency' ? 'Model flags this account as at risk.' : 'Model flags this account as low risk.'}
              </p>
            </div>
          </div>
          <dl className="flex-1 grid grid-cols-2 gap-x-6 gap-y-4 content-center">
            <div>
              <dt className="text-xs text-slate-500">Prediction</dt>
              <dd className="text-[13.5px] font-medium text-slate-900 mt-0.5">{prediction?.label === 'delinquency' ? 'At risk' : 'Low risk'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Method</dt>
              <dd className="text-[13.5px] font-medium text-slate-900 mt-0.5">SHAP + Mistral AI</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">P(no delinquency)</dt>
              <dd className="text-[13.5px] font-medium text-slate-900 mt-0.5 tabular-nums">{formatProb(prediction?.probabilities?.no_delinquency || 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">P(delinquency)</dt>
              <dd className="text-[13.5px] font-medium text-slate-900 mt-0.5 tabular-nums">{formatProb(prob)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Top factors */}
      <div className="card p-5 sm:p-6">
        <p className="section-title mb-4">Top risk factors</p>
        {topReasons.length > 0 ? (
          <div className="space-y-2.5">
            {topReasons.map((r, i) => {
              const isRisk = r.direction === 'increases risk';
              return (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isRisk ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {isRisk ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-medium text-slate-900">{r.feature_label || r.feature}</p>
                      <span className={`text-[11px] font-medium ${isRisk ? 'text-red-700' : 'text-green-700'}`}>· {r.direction}</span>
                    </div>
                    <p className="text-[12.5px] text-slate-500 mt-0.5">
                      Value {typeof r.feature_value === 'number' ? r.feature_value.toFixed(4) : r.feature_value}
                      {r.explanation ? ` — ${r.explanation}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 tabular-nums">0{i + 1}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="text-[13.5px] text-slate-500">No explanations available.</p>}
      </div>

      {/* All features */}
      <div className="card p-5 sm:p-6">
        <button onClick={() => setShowAllFeatures(!showAllFeatures)} className="flex items-center justify-between w-full text-left group">
          <p className="section-title !mb-0">All feature contributions ({allContribs.length})</p>
          <span className="p-1 rounded-md text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-700">
            <ChevronDown size={17} className={`transition-transform ${showAllFeatures ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {showAllFeatures && (
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
            {[...allContribs].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value)).map((item, i) => {
              const maxAbs = Math.max(...allContribs.map((c) => Math.abs(c.shap_value)), 0.001);
              const w = (Math.abs(item.shap_value) / maxAbs) * 100;
              const isR = item.direction === 'increases risk';
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-44 truncate shrink-0">{item.feature_label || item.feature}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(w, 2)}%`, backgroundColor: isR ? TIER_BAR.critical : TIER_BAR.stable }} />
                  </div>
                  <span className="text-xs font-mono text-slate-500 w-16 text-right shrink-0 tabular-nums">{item.shap_value?.toFixed(4)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <p className="section-title px-5 sm:px-6 pt-5 pb-3">Intervention history</p>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="table-head"><tr>
                {['Date', 'Tier', 'Offer', 'Channel', 'Email', 'Outcome'].map((h) => <th key={h}>{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item, i) => (
                  <tr key={item.id || i} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap tabular-nums">{item.triggered_at ? format(new Date(item.triggered_at), 'MMM d, yyyy HH:mm') : '—'}</td>
                    <td className="py-3 px-4"><TierBadge tier={item.risk_tier} /></td>
                    <td className="py-3 px-4 text-slate-700">{item.offer_type || '—'}</td>
                    <td className="py-3 px-4 text-slate-700">{item.channel || '—'}</td>
                    <td className="py-3 px-4">{item.email_delivered === true ? <CheckCircle2 size={16} className="text-green-600" /> : item.email_delivered === false ? <XCircle size={16} className="text-red-500" /> : <Minus size={16} className="text-slate-300" />}</td>
                    <td className="py-3 px-4">{item.offer_accepted === true ? <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">Accepted</span> : item.offer_accepted === false ? <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200">Ignored</span> : <span className="text-xs text-slate-400">Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Clock size={17} className="text-slate-300" />
            <p className="text-[13.5px]">No interventions recorded for this customer.</p>
          </div>
        )}
      </div>
    </div>
  );
}
