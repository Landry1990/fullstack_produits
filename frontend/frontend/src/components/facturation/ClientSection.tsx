import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Client, AyantDroit } from '../../types'

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
  inputRef
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
        // If dropdown is closed and Enter is pressed, trigger global enter if exists
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
          // Trigger callbacks after state updates/rendering probably settled? 
          // React state updates are batched, so calling focus immediately is fine usually.
          setTimeout(() => onEnter?.(), 0)
        } else if (filteredClients.length === 0 && clientSearch) {
          // Ouvrir modal création si aucun résultat
          onOpenCreateClient(clientSearch)
          setShowClientDropdown(false)
        } else {
             // Just Enter pressed with text entered but no highlight? Try finding exact match or just move focus?
             // If manual entry was allowed via search, we'd handle it. 
             // Here we assume search selects existing clients.
             // If we want to just move focus if something is selected or just typed?
             // Let's assume selection is primary.
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
    <div className="bg-base-100 rounded-xl p-3 md:p-4 shadow-sm border border-base-200 w-full md:w-64 lg:w-80 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0">{t('facturation:client.label')}</label>
        <button
          type="button"
          onClick={() => {
            setUseManualClient(!useManualClient)
            if (!useManualClient) {
              setSelectedClient(null)
              setManualClientName('')
            }
          }}
          className="btn btn-xs btn-ghost"
          title={useManualClient ? t('facturation:client.select_list_tooltip') : t('facturation:client.manual_input_tooltip')}
        >
          {useManualClient ? t('facturation:client.list_button') : t('facturation:client.manual_button')}
        </button>
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
          className="input input-bordered w-full input-sm bg-base-50 focus:bg-base-100 transition-colors"
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
            className="input input-bordered w-full input-sm bg-base-50 focus:bg-base-100 transition-colors pr-8"
          />
          {selectedClient && (
            <button
              type="button"
              onClick={() => {
                setSelectedClient(null)
                setClientSearch('')
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-error"
              title={t('facturation:client.clear_tooltip')}
            >
              ✕
            </button>
          )}
          
          {/* Dropdown des résultats */}
          {showClientDropdown && (clientSearch || !selectedClient) && (
            <div className="absolute z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-auto">
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
                      className={`px-3 py-2 cursor-pointer flex justify-between items-center text-sm transition-colors ${
                        index === highlightedClientIndex 
                          ? 'bg-primary/20 text-primary-content' 
                          : 'hover:bg-base-200'
                      }`}
                    >
                      <span className="font-medium">{client.name}</span>
                      <span className="text-xs text-base-content/50">{client.phone}</span>
                    </div>
                  ))}
                  {clientSearch && filteredClients.length < clients.length && (
                    <div className="px-3 py-2 text-xs text-base-content/50 border-t">
                      {t('facturation:client.results_count', { count: filteredClients.length, total: clients.length })}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-3 py-3 text-center">
                  <div className="text-sm text-base-content/50 mb-2">{t('facturation:client.no_results')}</div>
                  <button 
                    type="button"
                    onClick={() => {
                      onOpenCreateClient(clientSearch)
                      setShowClientDropdown(false)
                    }}
                    className="btn btn-primary btn-sm gap-1"
                  >
                    {t('facturation:client.create_button')} "{clientSearch}"
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ayant Droit Section */}
      {!useManualClient && selectedClient && selectedClientData?.client_type === 'PROFESSIONNEL' && (
        <div className="mt-3 pt-3 border-t border-base-200">
          <div className="flex items-center justify-between mb-2">
            <label className="label text-xs font-bold text-base-content/50 uppercase tracking-wider py-0">
              {t('facturation:client.ayant_droit.label')} <span className="text-error">*</span>
            </label>
            {ayantsDroitList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowNewAyantDroit(!showNewAyantDroit)
                  if (!showNewAyantDroit) {
                    setSelectedAyantDroit(null)
                    setAyantDroitNom('')
                    setAyantDroitMatricule('')
                    setAyantDroitSociete('')
                  }
                }}
                className="btn btn-xs btn-ghost"
                title={showNewAyantDroit ? t('facturation:client.ayant_droit.select_existing_tooltip') : t('facturation:client.ayant_droit.new_tooltip')}
              >
                {showNewAyantDroit ? t('facturation:client.ayant_droit.existing_button') : t('facturation:client.ayant_droit.new_button')}
              </button>
            )}
          </div>
          
          {showNewAyantDroit || ayantsDroitList.length === 0 ? (
            <div className="space-y-2">
              <input
                type="text"
                value={ayantDroitNom}
                onChange={(e) => setAyantDroitNom(e.target.value)}
                placeholder={t('facturation:client.ayant_droit.name_placeholder')}
                className="input input-bordered w-full input-xs bg-base-50 focus:bg-base-100 transition-colors"
              />
              <input
                type="text"
                value={ayantDroitMatricule}
                onChange={(e) => setAyantDroitMatricule(e.target.value)}
                placeholder={t('facturation:client.ayant_droit.matricule_placeholder')}
                className="input input-bordered w-full input-xs bg-base-50 focus:bg-base-100 transition-colors"
              />
              <input
                type="text"
                value={ayantDroitSociete}
                onChange={(e) => setAyantDroitSociete(e.target.value)}
                placeholder={t('facturation:client.ayant_droit.societe_placeholder')}
                className="input input-bordered w-full input-xs bg-base-50 focus:bg-base-100 transition-colors"
                />
            </div>
          ) : (
            <select
              value={selectedAyantDroit !== null ? String(selectedAyantDroit) : ''}
              onChange={(e) => setSelectedAyantDroit(e.target.value ? Number(e.target.value) : null)}
              className="select select-bordered w-full select-xs bg-base-50 focus:bg-base-100 transition-colors"
            >
              <option value="">{t('facturation:client.ayant_droit.select_placeholder')}</option>
              {Array.isArray(ayantsDroitList) && ayantsDroitList.map((ad) => (
                <option key={ad?.id || Math.random()} value={ad?.id || ''}>
                  {ad?.nom || 'N/A'} ({ad?.matricule || 'N/A'}){ad?.societe ? ` - ${ad.societe}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}
