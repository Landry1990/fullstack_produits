import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Client, AyantDroit } from '../../types'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { X, UserPlus, Star, Wallet } from 'lucide-react'

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
          {selectedClient && selectedClientData && selectedClientData.client_type === 'PARTICULIER' && (selectedClientData.is_deposit_enabled || parseFloat(selectedClientData.solde_depot || '0') > 0) && (
            <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-lg flex justify-between items-center border border-emerald-100">
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                <Wallet className="size-3" />
                {t('facturation:client.solde_depot_label')}
              </span>
              <span className="text-sm font-bold text-emerald-700">{parseFloat(selectedClientData.solde_depot || '0')} F</span>
            </div>
          )}

          {/* Points de Fidélité */}
          {selectedClient && selectedClientData && selectedClientData.client_type === 'PARTICULIER' && selectedClientData.is_loyalty_member && (
            <div className="mt-2 px-3 py-2 bg-violet-50 rounded-lg flex justify-between items-center border border-violet-100">
              <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider flex items-center gap-1">
                <Star className="size-3" />
                {t('facturation:client.label')} Fidélité
              </span>
              <span className="text-sm font-bold text-violet-700">{t('facturation:client.points_balance', { points: selectedClientData.points_fidelite || 0 })}</span>
            </div>
          )}

          {/* Récompense disponible */}
          {selectedClient && selectedClientData && parseFloat(selectedClientData.pending_discount || '0') > 0 && (
            <div className="mt-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <Star className="size-3 fill-amber-500 text-amber-500" />
                  Récompense
                </span>
                <Badge variant="secondary" className="h-5 text-[10px] bg-amber-100 text-amber-700 border-amber-200 font-bold">-{selectedClientData.pending_discount}%</Badge>
              </div>
              <div className="text-[10px] text-amber-600/80 italic">
                {t('facturation:client.pending_reward', { discount: selectedClientData.pending_discount })}
              </div>
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onApplyReward?.();
                }}
                className="h-7 w-full gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Star className="size-3 fill-white" />
                {t('facturation:client.apply_reward_button', { defaultValue: 'Appliquer' })}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Ayant Droit Section */}
      {!useManualClient && selectedClient && selectedClientData?.client_type === 'PROFESSIONNEL' && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider py-0">
              {t('facturation:client.ayant_droit.label')} <span className="text-red-500">*</span>
            </label>
            {ayantsDroitList.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewAyantDroit(!showNewAyantDroit)
                  if (!showNewAyantDroit) {
                    setSelectedAyantDroit(null)
                    setAyantDroitNom('')
                    setAyantDroitMatricule('')
                    setAyantDroitSociete('')
                  }
                }}
                className="h-7 text-xs font-medium"
                title={showNewAyantDroit ? t('facturation:client.ayant_droit.select_existing_tooltip') : t('facturation:client.ayant_droit.new_tooltip')}
              >
                {showNewAyantDroit ? t('facturation:client.ayant_droit.existing_button') : t('facturation:client.ayant_droit.new_button')}
              </Button>
            )}
          </div>
          
          {showNewAyantDroit || ayantsDroitList.length === 0 ? (
            <div className="space-y-2">
              <input
                type="text"
                value={ayantDroitNom}
                onChange={(e) => setAyantDroitNom(e.target.value)}
                placeholder={t('facturation:client.ayant_droit.name_placeholder')}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
              />
              <input
                type="text"
                value={ayantDroitMatricule}
                onChange={(e) => setAyantDroitMatricule(e.target.value)}
                placeholder={t('facturation:client.ayant_droit.matricule_placeholder')}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
              />
              <input
                type="text"
                value={ayantDroitSociete}
                onChange={(e) => setAyantDroitSociete(e.target.value)}
                placeholder={t('facturation:client.ayant_droit.societe_placeholder')}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                />
            </div>
          ) : (
            <select
              value={selectedAyantDroit !== null ? String(selectedAyantDroit) : ''}
              onChange={(e) => setSelectedAyantDroit(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
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
