import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Client, AyantDroit } from '../../types'
import { safeStorage } from '../../utils/storage'
import { Button } from '../shadcn/button'
import { X, UserPlus, Loader2 } from 'lucide-react'
import AyantDroitSection from './AyantDroitSection'
import ClientInfoBadges from './ClientInfoBadges'

type RecentItem =
  | { type: 'client'; id: number; name: string; phone?: string }
  | { type: 'ayant_droit'; id: number; nom: string; matricule?: string; societe?: string; client_name?: string }

const HISTORY_KEY = 'facturation_recent_client_ayantdroit'

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${safeQuery})`, 'i')
  const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = regex.test(part)
        return isMatch
          ? <strong key={`m-${part}`} className="font-bold text-emerald-700">{part}</strong>
          : <span key={`p-${part}`}>{part}</span>
      })}
    </span>
  )
}

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
  ayantDroitSearchLoading: boolean

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
  ayantDroitSearchLoading,
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
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const clientSearchRef = useRef<HTMLDivElement>(null)

  type MixedItem =
    | { type: 'client'; data: Client }
    | { type: 'ayant_droit'; data: AyantDroit }

  const mixedItems: MixedItem[] = useMemo(() => {
    const clientsPart = filteredClients.slice(0, 5).map(c => ({ type: 'client' as const, data: c }))
    const ayantsPart = ayantDroitSearchResults.slice(0, 5).map(ad => ({ type: 'ayant_droit' as const, data: ad }))
    return [...clientsPart, ...ayantsPart]
  }, [filteredClients, ayantDroitSearchResults])

  // Chargement historique
  useEffect(() => {
    try {
      const raw = safeStorage.getItem(HISTORY_KEY, 'session')
      if (raw) setRecentItems(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const saveRecentItem = (item: RecentItem) => {
    setRecentItems(prev =>
      [item, ...prev.filter(r => !(r.type === item.type && r.id === item.id))].slice(0, 5)
    )
  }

  useEffect(() => {
    safeStorage.setItem(HISTORY_KEY, JSON.stringify(recentItems), 'session')
  }, [recentItems])

  const focusSearchInput = () => {
    clientSearchRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }

  // Raccourci F3 focus client
  useEffect(() => {
    const handleDocKey = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault()
        setShowClientDropdown(true)
        setClientSearch('')
        setHighlightedIndex(-1)
        setTimeout(focusSearchInput, 0)
      }
    }
    document.addEventListener('keydown', handleDocKey)
    return () => document.removeEventListener('keydown', handleDocKey)
  }, [setShowClientDropdown, setClientSearch])

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

  // Scroller l'élément highlighted dans la vue
  useEffect(() => {
    if (highlightedIndex >= 0) {
      const el = document.getElementById(`client-option-${highlightedIndex}`)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [highlightedIndex])

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client.id)
    setClientSearch('')
    setShowClientDropdown(false)
    setHighlightedIndex(-1)
    saveRecentItem({ type: 'client', id: client.id, name: client.name, phone: client.phone })
  }

  const handleSelectAyantDroitResult = async (ad: AyantDroit) => {
    setShowClientDropdown(false)
    setHighlightedIndex(-1)
    saveRecentItem({
      type: 'ayant_droit',
      id: ad.id ?? 0,
      nom: ad.nom,
      matricule: ad.matricule,
      societe: ad.societe,
      client_name: ad.client_name
    })
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
            placeholder={`${t('facturation:client.search_placeholder')} (F3)`}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all pr-8"
          />
          {ayantDroitSearchLoading && !selectedClient && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 animate-spin" />
          )}
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
              {clientSearch.trim().length === 0 && recentItems.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 border-y border-slate-200">
                    {t('facturation:client.recent_label')}
                  </div>
                  {recentItems.map((r, idx) => (
                    <div
                      key={`recent-${r.type}-${r.id}`}
                      onClick={() => {
                        if (r.type === 'client') {
                          const client = clients.find(c => c.id === r.id)
                          if (client) handleSelectClient(client)
                        } else {
                          const ad = ayantsDroitList.find(a => a.id === r.id)
                          if (ad) handleSelectAyantDroitResult(ad)
                        }
                      }}
                      className="px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 transition-colors"
                    >
                      {r.type === 'client' ? (
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-800">{r.name}</span>
                          <span className="text-xs text-slate-400">{r.phone}</span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-800 uppercase">{r.nom}</span>
                            <span className="text-xs text-slate-400 uppercase">{r.matricule}</span>
                          </div>
                          <div className="flex justify-between items-center mt-0.5">
                            <span className="text-[10px] text-slate-500 uppercase">{r.societe || '—'}</span>
                            <span className="text-[10px] text-emerald-600 font-medium uppercase">{r.client_name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              {mixedItems.length > 0 ? (
                <>
                  {mixedItems.map((item, index) => {
                    const isFirstAyant = item.type === 'ayant_droit' && (index === 0 || mixedItems[index - 1].type === 'client')
                    return (
                      <React.Fragment key={item.type === 'client' ? `client-${item.data.id}` : `ad-${item.data.id ?? item.data.nom}`}>
                        {isFirstAyant && (
                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border-y border-slate-100">
                            {t('facturation:client.ayant_droit.label')}
                          </div>
                        )}
                        <div
                          id={`client-option-${index}`}
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
                              <span className="font-medium text-slate-800"><HighlightText text={item.data.name} query={clientSearch} /></span>
                              <span className="text-xs text-slate-400"><HighlightText text={item.data.phone || ''} query={clientSearch} /></span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-800 uppercase"><HighlightText text={item.data.nom} query={clientSearch} /></span>
                                <span className="text-xs text-slate-400 uppercase"><HighlightText text={item.data.matricule || ''} query={clientSearch} /></span>
                              </div>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-[10px] text-slate-500 uppercase"><HighlightText text={item.data.societe || '—'} query={clientSearch} /></span>
                                <span className="text-[10px] text-emerald-600 font-medium uppercase"><HighlightText text={item.data.client_name || ''} query={clientSearch} /></span>
                              </div>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    )
                  })}
                  {ayantDroitSearchLoading && (
                    <>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border-y border-slate-100">
                        {t('facturation:client.ayant_droit.label')}
                      </div>
                      {[1, 2, 3].map((n) => (
                        <div key={`skel-${n}`} className="px-3 py-2.5 animate-pulse">
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="h-3.5 w-1/2 bg-slate-200 rounded" />
                            <div className="h-3 w-1/4 bg-slate-200 rounded" />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="h-2.5 w-1/3 bg-slate-200 rounded" />
                            <div className="h-2.5 w-1/4 bg-slate-200 rounded" />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : ayantDroitSearchLoading ? (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border-y border-slate-100">
                    {t('facturation:client.ayant_droit.label')}
                  </div>
                  {[1, 2, 3].map((n) => (
                    <div key={`skel-empty-${n}`} className="px-3 py-2.5 animate-pulse">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="h-3.5 w-1/2 bg-slate-200 rounded" />
                        <div className="h-3 w-1/4 bg-slate-200 rounded" />
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="h-2.5 w-1/3 bg-slate-200 rounded" />
                        <div className="h-2.5 w-1/4 bg-slate-200 rounded" />
                      </div>
                    </div>
                  ))}
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
