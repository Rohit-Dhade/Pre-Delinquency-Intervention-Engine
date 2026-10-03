/**
 * ConfirmDialog — minimal centered dialog.
 */
import { X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // 'danger' | 'warning'
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  const confirmCls =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-slate-900 hover:bg-slate-800 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 max-w-[420px] w-full p-6 animate-fade-in">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight pr-8">{title}</h3>
        {description && (
          <p className="text-[13.5px] text-slate-600 mt-1.5 leading-relaxed">{description}</p>
        )}

        <div className="flex justify-end gap-2.5 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary !py-2 !text-[13.5px]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-[13.5px] font-medium rounded-lg transition-colors ${confirmCls}`}
          >
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
