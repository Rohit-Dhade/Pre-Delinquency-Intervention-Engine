import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Send, AlertTriangle, Mail, FlaskConical, CheckCircle2, Sparkles, RotateCcw, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { previewIntervention, sendIntervention } from '../api/interventions';
import { predictCustomer } from '../api/predictions';
import { useRequireRole } from '../hooks/useRequireRole';
import { getTierFromProb, formatProb } from '../utils/tiers';
import TierBadge from '../components/ui/TierBadge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Spinner from '../components/ui/Spinner';

export default function InterventionNewPage() {
  useRequireRole(['admin', 'relationship_manager']);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const customerId = location.state?.customerId || searchParams.get('customerId');

  const [prediction, setPrediction] = useState(location.state?.prediction || null);
  const [fetchingPred, setFetchingPred] = useState(false);
  const [fetchPredError, setFetchPredError] = useState('');

  const [step, setStep] = useState('initial');       // 'initial' | 'preview' | 'sent'
  const [loading, setLoading] = useState(false);      // generating preview
  const [sending, setSending] = useState(false);       // sending intervention
  const [preview, setPreview] = useState(null);        // preview API response
  const [result, setResult] = useState(null);          // send API response
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (customerId && !prediction) {
      setFetchingPred(true);
      setFetchPredError('');
      predictCustomer(customerId)
        .then((data) => {
          setPrediction(data);
        })
        .catch((err) => {
          setFetchPredError(err.response?.data?.detail || 'Failed to fetch customer risk prediction.');
        })
        .finally(() => {
          setFetchingPred(false);
        });
    }
  }, [customerId, prediction]);

  if (!customerId) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-amber-600" />
        </div>
        <h2 className="text-[17px] font-semibold text-slate-900">No customer selected</h2>
        <p className="text-[13.5px] text-slate-500 mt-1.5 mb-6">Select a customer from the At-Risk list or search to trigger an intervention.</p>
        <div className="flex justify-center gap-3">
          <Link to="/at-risk" className="btn-primary">View At-Risk Customers</Link>
          <Link to="/dashboard" className="btn-secondary">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (fetchingPred) {
    return (
      <div className="grid place-items-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-[13.5px] text-slate-500">Loading risk assessment for <span className="font-mono font-medium text-slate-700">{customerId}</span>…</p>
        </div>
      </div>
    );
  }

  if (fetchPredError) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-600" />
        </div>
        <h2 className="text-[17px] font-semibold text-slate-900">Unable to load prediction</h2>
        <p className="text-[13.5px] text-slate-500 mt-1.5 mb-6">{fetchPredError}</p>
        <div className="flex justify-center gap-3">
          <Link to="/at-risk" className="btn-primary">View At-Risk Customers</Link>
          <Link to="/dashboard" className="btn-secondary">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return null;
  }

  const prob = prediction.probabilities?.delinquency || 0;
  const tier = getTierFromProb(prob);
  const topReasons = (prediction.all_feature_contributions || []).slice(0, 3);

  const buildPreviewPayload = () => ({
    customer_id: customerId,
    delinquency_prob: prob,
    top_3_shap_reasons: topReasons,
    customer_features: { emi_to_income_ratio: 0.5, customer_segment: 'salaried', geography: 'urban' },
    model_version: 'v1.0.0',
  });

  const handleGeneratePreview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await previewIntervention(buildPreviewPayload());
      if (res.status === 'no_action_required') {
        setError(`No intervention needed — customer is in the "${res.tier}" tier.`);
        setStep('initial');
        setPreview(null);
        return;
      }
      setPreview(res);
      setEditedSubject(res.message.subject);
      setEditedBody(res.message.body);
      setIsEditing(false);
      toast.success(step === 'initial' ? 'AI preview generated — review and edit below' : 'Preview regenerated');
      setStep('preview');
    } catch (err) {
      const d = err.response?.data?.detail || err.response?.data?.error || 'Preview generation failed';
      setError(d);
      toast.error(d);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const payload = {
        customer_id: customerId,
        delinquency_prob: prob,
        risk_tier: preview.risk_tier,
        offer: preview.offer,
        channel: preview.channel,
        subject: editedSubject,
        body: editedBody,
        model_version: 'v1.0.0',
        dry_run: dryRun,
      };
      const res = await sendIntervention(payload);
      setResult(res);
      setStep('sent');
      setConfirmOpen(false);
      toast.success(dryRun ? 'Dry run sent to your inbox' : 'Intervention sent successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const wordCount = editedBody.split(/\s+/).filter(Boolean).length;

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-slate-500">
        <Link to="/dashboard" className="hover:text-slate-900">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <Link to={`/customer/${customerId}`} className="hover:text-slate-900 font-mono text-[12.5px]">{customerId}</Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-medium">New intervention</span>
      </nav>

      {/* Title */}
      <div>
        <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">Trigger intervention</h1>
        <p className="text-[13.5px] text-slate-500 mt-1">
          {step === 'initial' && 'Generate an AI preview, review the email, then send.'}
          {step === 'preview' && 'Review and edit the email content before sending.'}
          {step === 'sent' && 'Intervention has been processed.'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-[12.5px]">
        <StepDot active={step === 'initial'} done={step !== 'initial'} label="1. Generate" />
        <div className={`flex-1 h-px ${step !== 'initial' ? 'bg-navy' : 'bg-slate-200'}`} />
        <StepDot active={step === 'preview'} done={step === 'sent'} label="2. Review & Edit" />
        <div className={`flex-1 h-px ${step === 'sent' ? 'bg-navy' : 'bg-slate-200'}`} />
        <StepDot active={step === 'sent'} done={false} label="3. Sent" />
      </div>

      {/* Customer summary — always visible */}
      <div className="card px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-slate-500">Customer</p>
          <p className="text-[13.5px] font-medium text-slate-900 font-mono mt-0.5">{customerId}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Delinquency probability</p>
          <p className="text-[13.5px] font-medium text-slate-900 mt-0.5 tabular-nums">{formatProb(prob)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Risk tier</p>
          <TierBadge tier={tier} />
        </div>
        {preview && (
          <>
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-[13.5px] font-medium text-slate-900 mt-0.5">{preview.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-[13.5px] font-medium text-slate-900 mt-0.5">{preview.customer_email}</p>
            </div>
          </>
        )}
      </div>

      {/* ── Step 1: Generate ── */}
      {step === 'initial' && (
        <>
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-[14px] font-medium text-slate-900">Generate AI preview</p>
                <p className="text-[12.5px] text-slate-500 mt-0.5">
                  The system will analyse the customer&apos;s risk profile and generate a personalised
                  intervention email using Mistral AI. You can review and edit it before sending.
                </p>
              </div>
            </div>
          </div>

          <button onClick={handleGeneratePreview} disabled={loading} className="btn-primary">
            {loading ? <Spinner size="sm" /> : <Sparkles size={16} />}
            {loading ? 'Generating preview\u2026' : 'Generate AI preview'}
          </button>
        </>
      )}

      {/* ── Step 2: Preview & Edit ── */}
      {step === 'preview' && preview && (
        <>
          {/* Pipeline result */}
          <div className="card p-5">
            <p className="section-title mb-4">Pipeline result</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Tier</p>
                <TierBadge tier={preview.risk_tier} />
              </div>
              <Meta label="Offer" value={preview.offer?.offer_type} />
              <Meta label="Channel" value={preview.channel?.channel} />
              <Meta label="Urgency" value={preview.urgency_score?.toFixed(2)} />
            </div>
            {preview.offer?.offer_description && (
              <p className="text-[12.5px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
                {preview.offer.offer_description}
              </p>
            )}
          </div>

          {/* Editable email */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-slate-400" />
                <p className="section-title !mb-0">Email content</p>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-navy hover:text-navy-dark transition-colors"
              >
                <Pencil size={13} />
                {isEditing ? 'Done editing' : 'Edit content'}
              </button>
            </div>

            <div className="mx-5 mb-5 border border-slate-200 rounded-lg overflow-hidden">
              {/* Subject */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1">Subject</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="input !bg-white !text-[13.5px] !font-medium"
                  />
                ) : (
                  <p className="text-[13.5px] font-medium text-slate-900">{editedSubject}</p>
                )}
              </div>

              {/* Body */}
              <div className="p-4">
                {isEditing ? (
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={12}
                    className="input !text-[13.5px] !leading-relaxed resize-y"
                    style={{ minHeight: '200px' }}
                  />
                ) : (
                  <p className="text-[13.5px] text-slate-700 whitespace-pre-wrap leading-relaxed">{editedBody}</p>
                )}
              </div>

              {/* Metadata */}
              <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Words: {wordCount}</span>
                <span>Tone: {preview.message?.tone}</span>
                <span>Type: {preview.message?.email_type}</span>
              </div>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dryRun ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}>
                  {dryRun ? <FlaskConical size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div>
                  <p className="text-[14px] font-medium text-slate-900">{dryRun ? 'Dry run \u2014 sends to your inbox' : 'Live mode \u2014 sends to customer'}</p>
                  <p className="text-[12.5px] text-slate-500 mt-0.5">
                    {dryRun
                      ? 'Email will be sent to your Gmail with a [DRY RUN] prefix. Nothing is logged.'
                      : `Email will be sent to ${preview.customer_email} and the intervention will be permanently logged.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDryRun(!dryRun)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${dryRun ? 'bg-slate-200' : 'bg-red-600'}`}
                aria-label="Toggle live mode"
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${dryRun ? 'left-0.5' : 'left-[22px]'}`} />
              </button>
            </div>
            {!dryRun && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-800">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>Live mode is on. This will send a real email to <strong>{preview.customer_email}</strong> and create a permanent record.</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2.5">
            <button onClick={handleGeneratePreview} disabled={loading} className="btn-secondary">
              {loading ? <Spinner size="sm" /> : <RotateCcw size={15} />}
              Regenerate
            </button>
            <button
              onClick={() => { if (dryRun) handleSend(); else setConfirmOpen(true); }}
              disabled={sending || loading || !editedSubject.trim() || !editedBody.trim()}
              className="btn-primary"
            >
              {sending ? <Spinner size="sm" /> : <Send size={15} />}
              {dryRun ? 'Send dry run' : 'Send live intervention'}
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: Sent ── */}
      {step === 'sent' && result && (
        <>
          <div className="card p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-[14px] font-medium text-slate-900">
                  {result.dry_run ? 'Dry run complete' : 'Intervention sent'}
                </p>
                <p className="text-[12.5px] text-slate-500 mt-0.5">
                  {result.dry_run
                    ? 'A preview email was sent to your inbox.'
                    : `Email sent to ${preview?.customer_email || customerId}.`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Tier</p>
                <TierBadge tier={result.risk_tier} />
              </div>
              <Meta label="Offer" value={result.offer?.offer_type} />
              <Meta label="Mode" value={result.dry_run ? 'Dry run' : 'Live'} />
              <Meta
                label="Email"
                value={result.email_delivered ? 'Delivered' : result.email_sent ? 'Sent' : 'Not delivered'}
                icon={result.email_delivered ? <CheckCircle2 size={14} className="text-green-600" /> : null}
              />
            </div>
            {!result.email_delivered && !result.dry_run && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12.5px] text-amber-800">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>Email delivery failed &mdash; the customer&apos;s email address (<strong>{preview?.customer_email}</strong>) may be invalid or unreachable. The intervention has been logged.</span>
              </div>
            )}
          </div>

          {/* Final email */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <Mail size={15} className="text-slate-400" />
              <p className="section-title !mb-0">Email {result.dry_run ? 'preview' : 'sent'}</p>
            </div>
            <div className="mx-5 mb-5 border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Subject</p>
                <p className="text-[13.5px] font-medium text-slate-900 mt-0.5">{result.message?.subject}</p>
              </div>
              <div className="p-4">
                <p className="text-[13.5px] text-slate-700 whitespace-pre-wrap leading-relaxed">{result.message?.body}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[13.5px] text-red-800">{error}</div>
      )}

      {/* Back button */}
      <div className="flex gap-2.5">
        <button onClick={() => navigate(`/customer/${customerId}`)} className="btn-secondary !text-[13px]">
          Back to customer
        </button>
        {step === 'sent' && (
          <button
            onClick={() => { setStep('initial'); setResult(null); setPreview(null); setError(''); }}
            className="btn-secondary !text-[13px]"
          >
            New intervention
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Send live intervention?"
        description={`This will send a real email to ${preview?.customer_email || customerId} and log the intervention permanently. This cannot be undone.`}
        confirmLabel="Yes, send now"
        variant="warning"
        onConfirm={handleSend}
        onCancel={() => setConfirmOpen(false)}
        loading={sending}
      />
    </div>
  );
}

function StepDot({ active, done, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full transition-colors ${
        active ? 'bg-navy' : done ? 'bg-navy' : 'bg-slate-300'
      }`} />
      <span className={`whitespace-nowrap ${active ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}

function Meta({ label, value, icon }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-[13.5px] font-medium text-slate-900 flex items-center gap-1.5">{icon}{value || '\u2014'}</p>
    </div>
  );
}
