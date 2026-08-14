import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Client, AyantDroit } from '../../types'
import { Button } from '../shadcn/button'
import { X, UserPlus } from 'lucide-react'
import AyantDroitSection from './AyantDroitSection'
import ClientInfoBadges from './ClientInfoBadges'

interface ClientSectionProps {
  clients: Client[]
  filteredClients: Client[]

  useManualClient: boolean
  setUseManualClient: (v: boolean) => void
  manualClientName: string
  setManualClientName: (v: string) => void

  selectedClient: number | null
  setSelectedClient: (id: number | null) => void

  clientSearch: string
  setClientSearch: (v: string) => void

  showClientDropdown: boolean
  setShowClientDropdown: (v: boolean) => void

  onOpenCreateClient: (initialName: string) => void
  onEnter?: () => void

  // Ayant Droit
  ayantsDroitList: AyantDroit[]
  selectedAyantDroit: number | null
  setSelectedAyantDroit: (id: number | null) => void
  showNewAyantDroit: boolean
  setShowNewAyantDroit: (v: boolean) => void

  ayantDroitNom: string
  setAyantDroitNom: (v: string) => void
  ayantDroitMatricule: string
  setAyantDroitMatricule: (v: string) => void
  ayantDroitSociete: string
  setAyantDroitSociete: (v: string) => void
  inputRef?: React.Ref<HTMLInputElement>
  onApplyReward?: () => void
}

export default function ClientSection({
  clients,
  filteredClients,
  useManualClient,
  setUseManualClient,
  manualClientName,
  setManualClientName,
  selectedClient,
  setSelectedClient,
  clientSearch,
  setClientSearch,
  showClientDropdown,
  setShowClientDropdown,
  onOpenCreateClient,
  onEnter,
  ayantsDroitList,
  selectedAyantDroit,
  setSelectedAyantDroit,
  showNewAyantDroit,
  setShowNewAyantDroit,
  ayantDroitNom,
  setAyantDroitNom,
  ayantDroitMatricule,
  setAyantDroitMatricule,
  ayantDroitSociete,
  setAyantDroitSociete,
  inputRef,
  onApplyReward
}: ClientSectionProps) {
  const { t } = useTranslation(['facturation', 'common'])

  const [highlightedClientIndex, setHighlightedClientIndex] = useState(-1)
  const clientSearchRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown client au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setShowClientDropdown])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showClientDropdown) {
        if (e.key === 'Enter') {
            e.preventDefault()
            onEnter?.()
        }
        return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedClientIndex(prev =>
          prev < filteredClients.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedClientIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedClientIndex >= 0 && highlightedClientIndex < filteredClients.length) {
          const client = filteredClients[highlightedClientIndex]
          setSelectedClient(client.id)
          setClientSearch('')
          setShowClientDropdown(false)
          setHighlightedClientIndex(-1)
          setTimeout(() => onEnter?.(), 0)
        } else if (filteredClients.length === 0 && clientSearch) {
          onOpenCreateClient(clientSearch)
          setShowClientDropdown(false)
        } else {
             if (selectedClient) {
                 onEnter?.()
             }
        }
        break
      case 'Escape':
        setShowClientDropdown(false)
        setHighlightedClientIndex(-1)
        break
    }
  }

  const selectedClientData = clients.find(c => c.id === selectedClient)

  return (
    <div className="w-full md:w-64 lg:w-80 shrink-0 p-3 md:p-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider py-0">{t('facturation:client.label')}</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setUseManualClient(!useManualClient)
            if (!useManualClient) {
              setSelectedClient(null)
              setManualClientName('')
            }
          }}
          className="h-7 text-xs font-medium"
          title={useManualClient ? t('facturation:client.select_list_tooltip') : t('facturation:client.manual_input_tooltip')}
        >
          {useManualClient ? t('facturation:client.list_button') : t('facturation:client.manual_button')}
        </Button>
      </div>
      {useManualClient ? (
        <input
          type="text"
          value={manualClientName}
          onChange={(e) => setManualClientName(e.target.value)}
          onKeyDown={(e) => {
              if (e.key === 'Enter') {
                  e.preventDefault()
                  onEnter?.()
              }
          }}
          placeholder={t('facturation:client.manual_placeholder')}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
        />
      ) : (
        <div ref={clientSearchRef} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={clientSearch || (selectedClientData ? selectedClientData.name : '')}
            onChange={(e) => {
              setClientSearch(e.target.value)
              setSelectedClient(null)
              setShowClientDropdown(true)
              setHighlightedClientIndex(-1)
            }}
            onFocus={() => {
              setShowClientDropdown(true)
              setHighlightedClientIndex(-1)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('facturation:client.search_placeholder')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all pr-8"
          />
          {selectedClient && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedClient(null)
                setClientSearch('')
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 size-6 text-slate-400 hover:text-red-500 hover:bg-red-50"
              title={t('facturation:client.clear_tooltip')}
            >
              <X className="size-3.5" />
            </Button>
          )}

          {/* Dropdown des résultats */}
          {showClientDropdown && (clientSearch || !selectedClient) && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 max-h-60 overflow-auto">
              {filteredClients.length > 0 ? (
                <>
                  {filteredClients.map((client, index) => (
                    <div
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client.id)
                        setClientSearch('')
                        setShowClientDropdown(false)
                        setHighlightedClientIndex(-1)
                      }}
                      onMouseEnter={() => setHighlightedClientIndex(index)}
                      className={`px-3 py-2.5 cursor-pointer flex justify-between items-center text-sm transition-colors ${
                        index === highlightedClientIndex
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium text-slate-800">{client.name}</span>
                      <span className="text-xs text-slate-400">{client.phone}</span>
                    </div>
                  ))}
                  {clientSearch && filteredClients.length < clients.length && (
                    <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
                      {t('facturation:client.results_count', { count: filteredClients.length, total: clients.length })}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-3 py-4 text-center">
                  <div className="text-sm text-slate-400 mb-3">{t('facturation:client.no_results')}</div>
                  <Button
                    type="button"
                    onClick={() => {
                      onOpenCreateClient(clientSearch)
                      setShowClientDropdown(false)
                    }}
                    className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
                  >
                    <UserPlus className="size-3.5" />
                    {t('facturation:client.create_button')} "{clientSearch}"
                  </Button>
                </div>
              )}
            </div>
          )}
          {selectedClient && selectedClientData && (
            <ClientInfoBadges client={selectedClientData} onApplyReward={onApplyReward} />
          )}
        </div>
      )}

      {/* Ayant Droit Section */}
      {!useManualClient && selectedClient && selectedClientData?.client_type === 'PROFESSIONNEL' && (
        <AyantDroitSection
          ayantsDroitList={ayantsDroitList}
          selectedAyantDroit={selectedAyantDroit}
          setSelectedAyantDroit={setSelectedAyantDroit}
          showNewAyantDroit={showNewAyantDroit}
          setShowNewAyantDroit={setShowNewAyantDroit}
          ayantDroitNom={ayantDroitNom}
          setAyantDroitNom={setAyantDroitNom}
          ayantDroitMatricule={ayantDroitMatricule}
          setAyantDroitMatricule={setAyantDroitMatricule}
          ayantDroitSociete={ayantDroitSociete}
          setAyantDroitSociete={setAyantDroitSociete}
        />
      )}
    </div>
  )
}
