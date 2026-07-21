export default function ConfirmDialog({ open, title, description, confirmLabel = 'Ya', danger = false, onConfirm, onCancel }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <p className="font-display font-semibold text-lg mb-1.5">{title}</p>
        {description && <p className="text-sm text-black/50 mb-5">{description}</p>}
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onCancel}>Batal</button>
          <button
            className={danger ? 'btn-danger px-4 py-2.5' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
