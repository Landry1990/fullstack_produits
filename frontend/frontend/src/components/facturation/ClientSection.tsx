import React, { useState, useRef, useEffect, useMemo } from 'react'
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

  ayantDroitSearchResults: AyantDroit[]

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
  onSelectAyantDroit?: (ad: AyantDroit) => Promise<void>
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
  ayantDroitSearchResults,
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
  onSelectAyantDroit,
  inputRef,
  onApplyReward
}: ClientSectionProps) {
  const { t } = useTranslation(['facturation', 'common'])

  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const clientSearchRef = useRef<HTMLDivElement>(null)

  type MixedItem =
    | { type: 'client'; data: Client }
    | { type: 'ayant_droit'; data: AyantDroit }

  const mixedItems: MixedItem[] = useMemo(() => {
    const clientsPart = filteredClients.slice(0, 5).map(c => ({ type: 'client' as const, data: c }))
    const ayantsPart = ayantDroitSearchResults.slice(0, 5).map(ad => ({ type: 'ayant_droit' as const, data: ad }))
    return [...clientsPart, ...ayantsPart]
  }, [filteredClients, ayantDroitSearchResults])

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

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client.id)
    setClientSearch('')
    setShowClientDropdown(false)
    setHighlightedIndex(-1)
  }

  const handleSelectAyantDroitResult = async (ad: AyantDroit) => {
    setShowClientDropdown(false)
    setHighlightedIndex(-1)
    if (onSelectAyantDroit) {
      await onSelectAyantDroit(ad)
    }
  }

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
        setHighlightedIndex(prev =>
          prev < mixedItems.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < mixedItems.length) {
          const item = mixedItems[highlightedIndex]
          if (item.type === 'client') {
            handleSelectClient(item.data)
            setTimeout(() => onEnter?.(), 0)
          } else {
            handleSelectAyantDroitResult(item.data)
          }
        } else if (mixedItems.length === 0 && clientSearch) {
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
        setHighlightedIndex(-1)
        break
    }
  }

  const selectedClientData = clients.find(c => c.id === selectedClient)

  return (
    <div className="w-full p-3 md:p-4">
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
              setHighlightedIndex(-1)
            }}
            onFocus={() => {
              setShowClientDropdown(true)
              setHighlightedIndex(-1)
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
              {mixedItems.length > 0 ? (
                <>
                  {mixedItems.map((item, index) => {
                    const isFirstAyant = item.type === 'ayant_droit' && (index === 0 || mixedItems[index - 1].type === 'client')
                    return (
                      <React.Fragment key={item.type === 'client' ? `client-${item.data.id}` : `ad-${item.data.id ?? index}`}>
                        {isFirstAyant && (
                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border-y border-slate-100">
                            {t('facturation:client.ayant_droit.label')}
                          </div>
                        )}
                        <div
                          onClick={() => {
                            if (item.type === 'client') {
                              handleSelectClient(item.data)
                            } else {
                              handleSelectAyantDroitResult(item.data)
                            }
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={`px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                            index === highlightedIndex
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {item.type === 'client' ? (
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-800">{item.data.name}</span>
                              <span className="text-xs text-slate-400">{item.data.phone}</span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-800">{item.data.nom}</span>
                                <span className="text-xs text-slate-400">{item.data.matricule}</span>
                              </div>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-[10px] text-slate-500">{item.data.societe || '—'}</span>
                                <span className="text-[10px] text-emerald-600 font-medium">{item.data.client_name}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    )
                  })}
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
      {!useManualClient && (selectedClient === null || selectedClientData?.client_type === 'PROFESSIONNEL') && (
      <div className="mt-3 pt-3 border-t border-slate-200">
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
      </div>
      )}
    </div>
  )
}
