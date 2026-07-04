import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Send, ToggleLeft, ToggleRight, AlertTriangle, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { triggerIntervention } from '../api/interventions';
import { useAuth } from '../context/AuthContext';
import { useRequireRole } from '../hooks/useRequireRole';
import { getTierFromProb, getTierConfig, formatProb } from '../utils/tiers';
import TierBadge from '../components/ui/TierBadge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Spinner from '../components/ui/Spinner';

export default function InterventionNewPage() {
  useRequireRole(['admin', 'relationship_manager']);
  const location = useLocation();
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { customerId, prediction } = location.state || {};

  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  if (!customerId || !prediction) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center animate-fade-in">
        <AlertTriangle className="w-12 h-12 text-tier-moderate mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-on-surface mb-2">Missing Customer Data</h2>
        <p className="text-sm text-on-surface-variant mb-6">Navigate from a customer detail page to trigger an intervention.</p>
        <Link to="/dashboard" className="px-4 py-2 text-sm font-medium text-navy border border-outline-variant rounded-lg hover:bg-surface-container transition-colors">Back to Dashboard</Link>
      </div>
    );
  }

  const prob = prediction.probabilities?.delinquency || 0;
  const tier = getTierFromProb(prob);
  const topReasons = prediction.explanation?.top_3_reasons || [];

  const buildPayload = (isDry) => ({
    customer_id: customerId,
    delinquency_prob: prob,
    top_3_shap_reasons: topReasons.slice(0, 3),
    customer_features: { emi_to_income_ratio: 0.5, customer_segment: 'salaried', geography: 'urban' },
    model_version: 'v1.0.0',
    dry_run: isDry,
  });

  const handleDryRun = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await triggerIntervention(buildPayload(true));
      setResult(res);
      toast.success('Dry run complete — preview below');
    } catch (err) {
      const d = err.response?.data?.detail || err.response?.data?.error || 'Dry run failed';
      setError(d); toast.error(d);
    } finally { setLoading(false); }
  };

  const handleLiveTrigger = () => { if (!dryRun) setConfirmOpen(true); };

  const handleConfirmedLive = async () => {
    setConfirmLoading(true);
    try {
      const res = await triggerIntervention(buildPayload(false));
      setResult(res); setConfirmOpen(false);
      toast.success('Intervention sent successfully!');
    } catch (err) {
      const d = err.response?.data?.detail || err.response?.data?.error || 'Intervention failed';
      toast.error(d);
    } finally { setConfirmLoading(false); }
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6">
        <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link><span>/</span>
        <Link to={`/customer/${customerId}`} className="hover:text-navy transition-colors">{customerId}</Link><span>/</span>
        <span className="text-on-surface font-medium">Trigger Intervention</span>
      </div>
      <h1 className="text-2xl font-semibold text-on-surface tracking-tight mb-6">Trigger Intervention</h1>

      {/* Customer Summary */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-5 mb-6 flex items-center gap-6">
        <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Customer</p><p className="text-sm font-semibold text-on-surface">{customerId}</p></div>
        <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Probability</p><p className="text-sm font-semibold text-on-surface">{formatProb(prob)}</p></div>
        <TierBadge tier={tier} />
      </div>

      {/* Dry Run Toggle */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-card p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">Dry Run Mode</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{dryRun ? 'Preview only — no email will be sent, no DB record created' : 'LIVE MODE — email will be sent and intervention logged'}</p>
          </div>
          <button onClick={() => setDryRun(!dryRun)} className="shrink-0">
            {dryRun ? <ToggleLeft className="w-10 h-10 text-tier-stable" /> : <ToggleRight className="w-10 h-10 text-tier-critical" />}
          </button>
        </div>
        {!dryRun && <div className="mt-3 p-2.5 rounded-lg bg-tier-critical-bg text-tier-critical-text text-xs font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Live mode active — intervention will be sent to the customer</div>}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button onClick={handleDryRun} disabled={loading} className="px-5 py-2.5 bg-white border border-outline-variant text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container transition-colors flex items-center gap-2 disabled:opacity-50">
          {loading ? <Spinner size="sm" /> : <Send className="w-4 h-4" />}Run Dry Test
        </button>
        <button onClick={handleLiveTrigger} disabled={loading || dryRun} className="px-5 py-2.5 bg-navy hover:bg-navy-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40">
          <Send className="w-4 h-4" />Send Live Intervention
        </button>
      </div>

      {/* Error */}
      {error && <div className="p-4 rounded-lg bg-error-container text-on-error-container text-sm mb-6">{error}</div>}

      {/* Result Preview */}
      {result && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Intervention Response</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Tier</p><TierBadge tier={result.risk_tier} /></div>
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Offer</p><p className="text-sm font-medium text-on-surface mt-0.5">{result.offer?.offer_type}</p></div>
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Channel</p><p className="text-sm font-medium text-on-surface mt-0.5">{result.channel?.channel}</p></div>
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Dry Run</p><p className="text-sm font-medium text-on-surface mt-0.5">{result.dry_run ? 'Yes' : 'No'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Email Sent</p><p className="text-sm text-on-surface mt-0.5">{result.email_sent ? 'Yes' : 'No'}</p></div>
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Email Delivered</p><p className="text-sm text-on-surface mt-0.5">{result.email_delivered ? 'Yes' : 'No'}</p></div>
            </div>
          </div>

          {/* Email Preview */}
          {result.message && (
            <div className="bg-white rounded-xl border border-outline-variant shadow-card p-6">
              <div className="flex items-center gap-2 mb-4"><Mail className="w-4 h-4 text-accent" /><h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Email Preview</h3></div>
              <div className="border border-outline-variant rounded-lg overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant">
                  <p className="text-xs text-on-surface-variant">Subject</p>
                  <p className="text-sm font-medium text-on-surface">{result.message.subject}</p>
                </div>
                <div className="p-4"><p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{result.message.body}</p></div>
                <div className="bg-surface-container-low px-4 py-2 border-t border-outline-variant flex gap-4 text-xs text-on-surface-variant">
                  <span>Words: {result.message.word_count}</span><span>Tone: {result.message.tone}</span><span>Type: {result.message.email_type}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Send Live Intervention?"
        description={`This will send a real email to customer ${customerId} and log the intervention. This action cannot be undone.`}
        confirmLabel="Yes, Send Now"
        variant="warning"
        onConfirm={handleConfirmedLive}
        onCancel={() => setConfirmOpen(false)}
        loading={confirmLoading}
      />
    </div>
  );
}
