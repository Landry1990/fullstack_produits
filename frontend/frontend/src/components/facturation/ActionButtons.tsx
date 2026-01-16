import React from 'react'

interface ActionButtonsProps {
  onPayment: () => void
  onProforma: () => void
  onSuspend: () => void
  onCancel: () => void
  isValid: boolean
}

export default function ActionButtons({
  onPayment,
  onProforma,
  onSuspend,
  onCancel,
  isValid
}: ActionButtonsProps) {
  return (
    <div className="bg-white border-t border-base-200 p-3 md:p-4 shadow-sm shrink-0">
      <div className="flex flex-col-reverse md:flex-row gap-3 justify-between items-center">
        <button
          onClick={onCancel}
          className="btn btn-outline btn-error w-full md:w-auto gap-2"
          title="Réinitialiser la facture (Esc)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          Annuler
        </button>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={onSuspend}
            disabled={!isValid}
            className="btn btn-warning btn-outline w-full md:w-auto gap-2"
            title="Mettre en attente pour plus tard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="hidden md:inline">Mettre en attente</span>
            <span className="md:hidden">Attente</span>
          </button>

          <button
            onClick={onProforma}
            disabled={!isValid}
            className="btn btn-info btn-outline w-full md:w-auto gap-2"
            title="Générer une facture proforma"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Proforma
          </button>

          <button
            onClick={onPayment}
            disabled={!isValid}
            className="btn btn-primary w-full md:w-auto gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow"
            title="Valider et encaisser (F1)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
            <span className="font-bold">Encaisser (F1)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
