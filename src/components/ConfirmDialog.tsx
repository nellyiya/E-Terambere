import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
// "Are you sure?" step used before saving, changing or deleting. Focus starts on Cancel, and Escape cancels, so a stray Enter can't confirm.
export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', danger = false, busy = false, confirmDisabled = false, error, onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; confirmDisabled?: boolean; error?: string; onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [busy, onCancel])
  return (<div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
    <div className="rise w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${danger ? 'bg-red-100 text-red-700' : 'bg-brand/10 text-brand'}`}>{danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}</span>
        <div><h2 id="confirm-title" className="text-lg font-semibold">{title}</h2><div className="mt-1 text-sm text-slate-600">{children}</div></div></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button ref={cancelRef} disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{cancelLabel}</button>
        <button disabled={busy || confirmDisabled} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${danger ? 'bg-red-600' : 'bg-brand'}`}>{busy ? 'Please wait…' : confirmLabel}</button></div></div></div>)
}
