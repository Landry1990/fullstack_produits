import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../shadcn/button'
import { Input } from '../../shadcn/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../shadcn/dialog'

interface QuantityInputDialogProps {
  open: boolean
  title: string
  description: string
  initialValue: number
  max?: number
  loading?: boolean
  onClose: () => void
  onConfirm: (quantity: number) => void
}

export function QuantityInputDialog({
  open, title, description, initialValue, max, loading = false, onClose, onConfirm,
}: QuantityInputDialogProps) {
  const { t } = useTranslation(['products', 'common'])
  const [value, setValue] = useState(String(initialValue))
  const quantity = Number(value)
  const isValid = Number.isInteger(quantity) && quantity > 0 && (max === undefined || quantity <= max)

  useEffect(() => {
    if (open) setValue(String(initialValue))
  }, [initialValue, open])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (isValid && !loading) onConfirm(quantity)
  }

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen && !loading) onClose() }}>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="product-action-quantity" className="text-sm font-medium text-slate-700">
              {t('products:quantity_dialog.label')}
            </label>
            <Input
              id="product-action-quantity"
              type="number"
              min={1}
              max={max}
              step={1}
              value={value}
              onChange={event => setValue(event.target.value)}
              autoFocus
              aria-invalid={value !== '' && !isValid}
            />
            {value !== '' && !isValid && (
              <p className="text-sm text-red-600">
                {max === undefined
                  ? t('products:messages.invalid_quantity')
                  : t('products:quantity_dialog.max_error', { max })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!isValid || loading}>
              {loading ? t('common:loading') : t('common:actions.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
