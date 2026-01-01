interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const getVariantClasses = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: '⚠️',
          alertClass: 'alert-error',
          btnClass: 'btn-error'
        }
      case 'warning':
        return {
          icon: '⚠️',
          alertClass: 'alert-warning',
          btnClass: 'btn-warning'
        }
      case 'info':
        return {
          icon: 'ℹ️',
          alertClass: 'alert-info',
          btnClass: 'btn-info'
        }
      case 'success':
        return {
          icon: '✓',
          alertClass: 'alert-success',
          btnClass: 'btn-success'
        }
    }
  }

  const { icon, alertClass, btnClass } = getVariantClasses()

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          {title}
        </h3>
        
        <div className={`alert ${alertClass} mt-4`}>
          <div className="whitespace-pre-line">{message}</div>
        </div>

        <div className="modal-action">
          <button 
            className="btn btn-ghost" 
            onClick={onCancel}
            autoFocus
          >
            {cancelText}
          </button>
          <button 
            className={`btn ${btnClass}`}
            onClick={() => {
              onConfirm()
              onCancel()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onCancel}></div>
    </div>
  )
}
