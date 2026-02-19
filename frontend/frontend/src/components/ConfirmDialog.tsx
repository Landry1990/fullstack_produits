import PremiumModal from './common/PremiumModal';

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

  const getVariantConfig = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: '⚠️',
          alertClass: 'alert-error',
          btnClass: 'btn-error shadow-lg shadow-error/20',
          gradientFrom: 'error/10',
          gradientTo: 'error/10'
        }
      case 'warning':
        return {
          icon: '⚠️',
          alertClass: 'alert-warning',
          btnClass: 'btn-warning shadow-lg shadow-warning/20',
          gradientFrom: 'warning/10',
          gradientTo: 'warning/10'
        }
      case 'info':
        return {
          icon: 'ℹ️',
          alertClass: 'alert-info',
          btnClass: 'btn-info shadow-lg shadow-info/20',
          gradientFrom: 'info/10',
          gradientTo: 'info/10'
        }
      case 'success':
        return {
          icon: '✓',
          alertClass: 'alert-success',
          btnClass: 'btn-success shadow-lg shadow-success/20',
          gradientFrom: 'success/10',
          gradientTo: 'success/10'
        }
    }
  }

  const { icon, alertClass, btnClass, gradientFrom, gradientTo } = getVariantConfig()

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={<span className="text-2xl">{icon}</span>}
      gradientFrom={gradientFrom}
      gradientTo={gradientTo}
    >
      <div className="p-6 space-y-5">
        <div className={`alert ${alertClass}`}>
          <div className="whitespace-pre-line">{message}</div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn btn-ghost px-6 rounded-xl" onClick={onCancel} autoFocus>
            {cancelText}
          </button>
          <button 
            className={`btn ${btnClass} px-8 rounded-xl`}
            onClick={() => {
              onConfirm()
              onCancel()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </PremiumModal>
  )
}

