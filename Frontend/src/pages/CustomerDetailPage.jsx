import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronUp, Send, Clock, CheckCircle2, XCircle, Minus } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { predictCustomer } from '../api/predictions';
import { getInterventionHistory } from '../api/interventions';
import { useAuth } from '../context/AuthContext';
import { getTierFromProb, getTierConfig, formatProb } from '../utils/tiers';
import TierBadge from '../components/ui/TierBadge';
import Spinner from '../components/ui/Spinner';

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

  if (loading) return <div className="flex min-h-screen items-center justify-center">
    <div className="flex flex-col items-center text-center">
      <Spinner size="lg" />
      <p className="mt-4 text-sm text-on-surface-variant">
        Loading risk assessment...
      </p>
    </div>
  </div>

  if (error) return (
    <div className="max-w-2xl mx-auto py-16 text-center animate-fade-in">
      <AlertTriangle className="w-12 h-12 text-tier-moderate mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-on-surface mb-2">Unable to Load Customer</h2>
      <p className="text-sm text-on-surface-variant mb-6">{error}</p>
      <Link to="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"><ArrowLeft className="w-4 h-4" />Back to Dashboard</Link>
    </div>
  );

  const prob = prediction?.probabilities?.delinquency || 0;
  const tier = getTierFromProb(prob);
  const tierCfg = getTierConfig(tier);
  const topReasons = prediction?.explanation?.top_3_reasons || [];
  const allContribs = prediction?.all_feature_contributions || [];

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6">
        <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link><span>/</span>
        <span className="text-on-surface font-medium">{customerId}</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">{customerId}</h1>
          <TierBadge tier={tier} />
        </div>
        {canTrigger && prob > 0.20 && (
          <button onClick={() => navigate('/intervention/new', { state: { customerId, prediction } })} className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded-lg transition-colors">
            <Send className="w-4 h-4" />Trigger Intervention
          </button>
        )}
      </div>

      {/* Risk Assessment */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6 mb-6">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Risk Assessment</h2>
        <div className="flex items-start gap-8">
          <div className="text-center shrink-0">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E2E8F0" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={tierCfg.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${prob * 264} 264`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-on-surface">{formatProb(prob)}</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-2 font-medium">{tierCfg.fullLabel}</p>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Prediction</p><p className="text-sm text-on-surface font-medium mt-0.5">{prediction?.label === 'delinquency' ? 'At Risk' : 'Low Risk'}</p></div>
            <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Method</p><p className="text-sm text-on-surface font-medium mt-0.5">SHAP + Mistral AI</p></div>
            <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">P(No Delinquency)</p><p className="text-sm text-on-surface font-medium mt-0.5">{formatProb(prediction?.probabilities?.no_delinquency || 0)}</p></div>
            <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">P(Delinquency)</p><p className="text-sm text-on-surface font-medium mt-0.5">{formatProb(prob)}</p></div>
          </div>
        </div>
      </div>

      {/* Top Risk Factors */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6 mb-6">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Top Risk Factors</h2>
        {topReasons.length > 0 ? (
          <div className="space-y-4">
            {topReasons.map((r, i) => {
              const isRisk = r.direction === 'increases risk';
              return (
                <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-surface-container-low">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isRisk ? 'bg-tier-critical-bg' : 'bg-tier-stable-bg'}`}>
                    {isRisk ? <TrendingUp className="w-4 h-4 text-tier-critical" /> : <TrendingDown className="w-4 h-4 text-tier-stable" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">{r.feature_label || r.feature}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">Reason :  {typeof r.feature_value === 'number' ? r.feature_value.toFixed(4) : r.feature_value} {r.explanation || ""} · <span className={isRisk ? 'text-tier-critical' : 'text-tier-stable'}>{r.direction}</span></p>
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">#{i + 1}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-on-surface-variant">No SHAP explanations available.</p>}
      </div>

      {/* All Feature Contributions */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6 mb-6">
        <button onClick={() => setShowAllFeatures(!showAllFeatures)} className="flex items-center justify-between w-full text-left">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">All Feature Contributions ({allContribs.length})</h2>
          {showAllFeatures ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
        </button>
        {showAllFeatures && (
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto animate-slide-down">
            {[...allContribs].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value)).map((item, i) => {
              const maxAbs = Math.max(...allContribs.map(c => Math.abs(c.shap_value)), 0.001);
              const w = (Math.abs(item.shap_value) / maxAbs) * 100;
              const isR = item.direction === 'increases risk';
              return (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <span className="text-xs text-on-surface-variant w-44 truncate shrink-0">{item.feature_label || item.feature}</span>
                  <div className="flex-1 h-4 bg-surface-container rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${Math.max(w, 2)}%`, backgroundColor: isR ? '#DC2626' : '#059669' }} />
                  </div>
                  <span className="text-xs font-mono text-on-surface-variant w-16 text-right shrink-0">{item.shap_value?.toFixed(4)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Intervention History */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Intervention History</h2>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-outline-variant">
                {['Date', 'Tier', 'Offer', 'Channel', 'Email', 'Outcome'].map(h => <th key={h} className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider py-3 px-3">{h}</th>)}
              </tr></thead>
              <tbody>
                {history.map((item, i) => (
                  <tr key={item.id || i} className={`border-b border-outline-variant/50 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-container-low'}`}>
                    <td className="py-3 px-3 text-on-surface">{item.triggered_at ? format(new Date(item.triggered_at), 'MMM d, yyyy HH:mm') : '—'}</td>
                    <td className="py-3 px-3"><TierBadge tier={item.risk_tier} /></td>
                    <td className="py-3 px-3 text-on-surface">{item.offer_type || '—'}</td>
                    <td className="py-3 px-3 text-on-surface">{item.channel || '—'}</td>
                    <td className="py-3 px-3">{item.email_delivered === true ? <CheckCircle2 className="w-4 h-4 text-tier-stable" /> : item.email_delivered === false ? <XCircle className="w-4 h-4 text-error" /> : <Minus className="w-4 h-4 text-outline" />}</td>
                    <td className="py-3 px-3">{item.offer_accepted === true ? <span className="text-xs font-medium px-2 py-0.5 rounded bg-tier-stable-bg text-tier-stable-text">Accepted</span> : item.offer_accepted === false ? <span className="text-xs font-medium px-2 py-0.5 rounded bg-tier-critical-bg text-tier-critical-text">Ignored</span> : <span className="text-xs text-outline">Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-6 justify-center"><Clock className="w-5 h-5 text-outline" /><p className="text-sm text-on-surface-variant">No intervention history.</p></div>
        )}
      </div>
    </div>
  );
}
