import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Promis, ProduitModel, Client } from '../types'

export default function PromisPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [promisList, setPromisList] = useState<Promis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ATT' | 'DEL' | 'ANN'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form states for new promis
  const [showForm, setShowForm] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [formData, setFormData] = useState({
    client: null as number | null,
    client_name: '',
    client_phone: '',
    produit: null as number | null,
    quantite: 1,
    notes: ''
  })
  const [productSearch, setProductSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [saving, setSaving] = useState(false)
  
  // SMS Modal State
  const [smsModal, setSmsModal] = useState({ 
    isOpen: false, 
    promis: null as Promis | null, 
    message: '' 
  })
  const [sendingSms, setSendingSms] = useState(false)

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)


  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const promisEndpoint = `${apiBaseUrl}/api/promis/`

  // Fetch promis list
  const fetchPromis = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(promisEndpoint)
      const results = Array.isArray(data) ? data : (data.results || [])
      setPromisList(results)
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des promis')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [promisEndpoint])

  // Fetch clients and products for the form
  const fetchFormData = useCallback(async () => {
    try {
      const [clientsRes, produitsRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/api/clients/`),
        axios.get(`${apiBaseUrl}/api/produits/`)
      ])
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : (clientsRes.data.results || []))
      setProduits(Array.isArray(produitsRes.data) ? produitsRes.data : (produitsRes.data.results || []))
    } catch (err) {
      console.error('Erreur chargement données formulaire', err)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    fetchPromis()
    fetchFormData()
  }, [fetchPromis, fetchFormData])

  // Filter and search
  const filteredPromis = useMemo(() => {
    let filtered = [...promisList]
    
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(p => p.status === filterStatus)
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        (p.client_display || '').toLowerCase().includes(q) ||
        (p.client_phone_display || '').toLowerCase().includes(q) ||
        (p.produit_name || '').toLowerCase().includes(q) ||
        (p.produit_cip || '').toLowerCase().includes(q)
      )
    }
    
    return filtered
  }, [promisList, filterStatus, searchQuery])

  // Stats
  const stats = useMemo(() => ({
    total: promisList.length,
    enAttente: promisList.filter(p => p.status === 'ATT').length,
    delivres: promisList.filter(p => p.status === 'DEL').length,
    annules: promisList.filter(p => p.status === 'ANN').length
  }), [promisList])

  // Actions
  const handleDelivrer = async (id: number) => {
    const confirmed = await confirm({
      title: 'Marquer comme délivré',
      message: 'Marquer ce promis comme délivré ?',
      variant: 'success',
      confirmText: 'Délivrer'
    })
    if (!confirmed) return
    try {
      await axios.post(`${promisEndpoint}${id}/delivrer/`)
      fetchPromis()
    } catch (err) {
      toast.error('Erreur lors de la livraison')
      console.error(err)
    }
  }

  const handleAnnuler = async (id: number) => {
    const confirmed = await confirm({
      title: 'Annuler le promis',
      message: 'Annuler ce promis et réintégrer le stock ?\n\nCette action créera une entrée dans l\'historique du produit.',
      variant: 'warning',
      confirmText: 'Annuler'
    })
    if (!confirmed) return
    try {
      const { data } = await axios.post(`${promisEndpoint}${id}/annuler_et_reintegrer/`)
      toast.success(data.detail)
      fetchPromis()
    } catch (err) {
      toast.error('Erreur lors de l\'annulation')
      console.error(err)
    }
  }

  // Bulk actions
  const handleBulkDelivrer = async () => {
    if (selectedIds.size === 0) return
    const confirmed = await confirm({
      title: t('promis.modals.bulk_delivery_title'),
      message: t('promis.modals.bulk_delivery_message', { count: selectedIds.size }),
      variant: 'success',
      confirmText: t('promis.modals.bulk_delivery_confirm')
    })
    if (!confirmed) return
    
    setBulkLoading(true)
    try {
      const { data } = await axios.post(`${promisEndpoint}bulk_delivrer/`, {
        ids: Array.from(selectedIds)
      })
      toast.success(data.detail)
      setSelectedIds(new Set())
      fetchPromis()
    } catch (err) {
      toast.error(t('promis.messages.bulk_delivery_error'))
      console.error(err)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkAnnuler = async () => {
    if (selectedIds.size === 0) return
    const confirmed = await confirm({
      title: t('promis.modals.bulk_cancel_title'),
      message: t('promis.modals.bulk_cancel_message', { count: selectedIds.size }),
      variant: 'warning',
      confirmText: t('promis.modals.bulk_cancel_confirm')
    })
    if (!confirmed) return
    
    setBulkLoading(true)
    try {
      const { data } = await axios.post(`${promisEndpoint}bulk_annuler/`, {
        ids: Array.from(selectedIds)
      })
      toast.success(data.detail)
      setSelectedIds(new Set())
      fetchPromis()
    } catch (err) {
      toast.error(t('promis.messages.bulk_cancel_error'))
      console.error(err)
    } finally {
      setBulkLoading(false)
    }
  }

  // Selection helpers
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    const attPromis = filteredPromis.filter(p => p.status === 'ATT')
    if (selectedIds.size === attPromis.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(attPromis.map(p => p.id)))
    }
  }

  const handlePrintTicket = async (id: number) => {
    try {
      const response = await axios.get(`${promisEndpoint}${id}/imprimer_ticket/`, {
        responseType: 'blob'
      })
      // Create a blob URL and open in new window
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Revoke the URL after a delay to free memory
      setTimeout(() => window.URL.revokeObjectURL(url), 10000)
    } catch (err) {
      console.error('Erreur impression ticket:', err)
      toast.error(t('promis.messages.print_ticket_error'))
    }
  }

  // Form handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.produit) {
      toast(t('promis.validation.product_required'), { icon: '⚠️' })
      return
    }
    if (!formData.client && !formData.client_name.trim()) {
      toast(t('promis.validation.client_required'), { icon: '⚠️' })
      return
    }

    setSaving(true)
    try {
      const { data: newPromis } = await axios.post(promisEndpoint, {
        ...formData,
        client: formData.client || null
      })
      setShowForm(false)
      setFormData({
        client: null,
        client_name: '',
        client_phone: '',
        produit: null,
        quantite: 1,
        notes: ''
      })
      setProductSearch('')
      setClientSearch('')
      setSearchQuery('') // Reset global search to ensure visibility
      
      // Update list immediately with new promis at the top
      setPromisList(prev => [newPromis, ...prev])
      
      // Still fetch to be sure (background sync)
      fetchPromis()
    } catch (err) {
      toast.error(t('promis.validation.create_error'))
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const selectProduct = (p: ProduitModel) => {
    setFormData(prev => ({ ...prev, produit: p.id }))
    setProductSearch(p.name)
  }

  const selectClient = (c: Client) => {
    setFormData(prev => ({ 
      ...prev, 
      client: c.id, 
      client_name: c.name,
      client_phone: c.phone 
    }))
    setClientSearch(c.name)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATT': return 'badge badge-warning'
      case 'DEL': return 'badge badge-success'
      case 'ANN': return 'badge badge-error'
      default: return 'badge badge-ghost'
    }
  }

  const openSmsModal = (p: Promis) => {
    // Message par défaut
    const msg = `Bonjour ${p.client_display}, votre produit ${p.produit_name} est disponible à la pharmacie PHARMA STOCK.`
    setSmsModal({ isOpen: true, promis: p, message: msg })
  }

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!smsModal.promis || !smsModal.message) return
    
    setSendingSms(true)
    try {
        await axios.post(`${apiBaseUrl}/api/sms/send/`, {
            recipient: smsModal.promis.client_phone_display,
            message: smsModal.message,
            context_type: 'PROMIS',
            context_id: smsModal.promis.id
        })
        toast.success(t('promis.messages.sms_success'))
        setSmsModal({ isOpen: false, promis: null, message: '' })
    } catch (err: any) {
        toast.error(t('promis.messages.sms_error'))
        console.error(err)
    } finally {
        setSendingSms(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('promis.title')}</h1>
      
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="stats stats-vertical md:stats-horizontal shadow mb-6 w-full">
        <div className="stat">
          <div className="stat-title">{t('promis.status_all')}</div>
          <div className="stat-value text-primary">{stats.total}</div>
        </div>
        <div className="stat cursor-pointer hover:bg-base-200" onClick={() => setFilterStatus('ATT')}>
          <div className="stat-title">{t('promis.status_att')}</div>
          <div className="stat-value text-warning">{stats.enAttente}</div>
        </div>
        <div className="stat cursor-pointer hover:bg-base-200" onClick={() => setFilterStatus('DEL')}>
          <div className="stat-title">{t('promis.status_del')}</div>
          <div className="stat-value text-success">{stats.delivres}</div>
        </div>
        <div className="stat cursor-pointer hover:bg-base-200" onClick={() => setFilterStatus('ANN')}>
          <div className="stat-title">{t('promis.status_ann')}</div>
          <div className="stat-value text-error">{stats.annules}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Rechercher..."
            className="input input-bordered input-sm w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select 
            className="select select-bordered select-sm"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="ALL">{t('promis.status_all')}</option>
            <option value="ATT">{t('promis.status_att')}</option>
            <option value="DEL">{t('promis.status_del')}</option>
            <option value="ANN">{t('promis.status_ann')}</option>
          </select>
        </div>
        <button 
          className="btn btn-ghost btn-sm"
          onClick={fetchPromis}
          title={t('common.refresh', 'Actualiser')}
        >
          🔄
        </button>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowForm(true)}
        >
          {t('promis.new_btn')}
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="alert alert-info flex justify-between items-center mb-4">
          <span className="font-semibold">{selectedIds.size} promis sélectionné(s)</span>
          <div className="flex gap-2">
            <button 
              className="btn btn-success btn-sm"
              onClick={handleBulkDelivrer}
              disabled={bulkLoading}
            >
              {bulkLoading && <span className="loading loading-spinner loading-xs" />}
              ✓ Livrer tous
            </button>
            <button 
              className="btn btn-error btn-sm"
              onClick={handleBulkAnnuler}
              disabled={bulkLoading}
            >
              {bulkLoading && <span className="loading loading-spinner loading-xs" />}
              ✕ Annuler tous
            </button>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">{t('promis.modal.title_new')}</h3>
            <form onSubmit={handleSubmit}>
              {/* Client search */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">{t('promis.modal.client_label')}</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder={t('promis.modal.client_placeholder')}
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value)
                    setFormData(prev => ({ ...prev, client: null, client_name: e.target.value }))
                  }}
                />
                {clientSearch && clients.filter(c => 
                  c.name.toLowerCase().includes(clientSearch.toLowerCase())
                ).slice(0, 5).map(c => (
                  <div 
                    key={c.id} 
                    className="p-2 hover:bg-base-200 cursor-pointer border-b"
                    onClick={() => selectClient(c)}
                  >
                    {c.name} - {c.phone}
                  </div>
                ))}
              </div>

              {/* Phone */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">{t('promis.modal.phone_label')}</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder={t('promis.modal.phone_placeholder')}
                  value={formData.client_phone}
                  onChange={e => setFormData(prev => ({ ...prev, client_phone: e.target.value }))}
                />
              </div>

              {/* Product search */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">{t('promis.modal.product_label')}</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder={t('promis.modal.product_placeholder')}
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value)
                    setFormData(prev => ({ ...prev, produit: null }))
                  }}
                />
                {productSearch && !formData.produit && produits.filter(p => 
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                  (p.cip1 && p.cip1.includes(productSearch))
                ).slice(0, 5).map(p => (
                  <div 
                    key={p.id} 
                    className="p-2 hover:bg-base-200 cursor-pointer border-b"
                    onClick={() => selectProduct(p)}
                  >
                    {p.name} {p.cip1 && `(${p.cip1})`} - Stock: {p.stock}
                  </div>
                ))}
              </div>

              {/* Quantity */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">{t('promis.modal.qty_label')}</span></label>
                <input
                  type="number"
                  min="1"
                  className="input input-bordered"
                  value={formData.quantite}
                  onChange={e => setFormData(prev => ({ ...prev, quantite: parseInt(e.target.value) || 1 }))}
                />
              </div>

              {/* Notes */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">{t('promis.modal.notes_label')}</span></label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder={t('promis.modal.notes_placeholder')}
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setShowForm(false)}>
                  {t('promis.modal.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving && <span className="loading loading-spinner loading-sm" />}
                  {t('promis.modal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : filteredPromis.length === 0 ? (
            <div className="text-center text-base-content/60 py-8">
              {t('promis.messages.empty')}
            </div>
          ) : (
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>
                    <input 
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredPromis.filter(p => p.status === 'ATT').length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>{t('promis.table.date')}</th>
                  <th>{t('promis.table.client')}</th>
                  <th>{t('promis.table.phone')}</th>
                  <th>{t('promis.table.product')}</th>
                  <th>{t('promis.table.qty')}</th>
                  <th>{t('promis.table.status')}</th>
                  <th>{t('promis.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromis.map(p => (
                  <tr key={p.id} className={selectedIds.has(p.id) ? 'bg-primary/10' : ''}>
                    <td>
                      {p.status === 'ATT' && (
                        <input 
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelection(p.id)}
                        />
                      )}
                    </td>
                    <td>{format(new Date(p.date_promis), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                    <td>{p.client_display}</td>
                    <td>{p.client_phone_display}</td>
                    <td>
                      <div>{p.produit_name}</div>
                      {p.produit_cip && <div className="text-xs text-base-content/60">{p.produit_cip}</div>}
                    </td>
                    <td className="font-bold">{p.quantite}</td>
                    <td>
                      <span className={`${getStatusBadge(p.status)} whitespace-nowrap`}>{p.status_display}</span>
                    </td>
                    <td>
                      {p.status === 'ATT' && (
                        <div className="flex gap-2 flex-nowrap items-center">
                          <button 
                            className="btn btn-success btn-xs whitespace-nowrap"
                            onClick={() => handleDelivrer(p.id)}
                            title={t('promis.actions.deliver')}
                          >
                            ✓ {t('promis.actions.deliver')}
                          </button>
                          <button 
                            className="btn btn-error btn-xs whitespace-nowrap"
                            onClick={() => handleAnnuler(p.id)}
                            title={t('promis.actions.cancel')}
                          >
                            ✕ {t('promis.actions.cancel')}
                          </button>
                          <button 
                            className="btn btn-info btn-xs"
                            onClick={() => handlePrintTicket(p.id)}
                            title={t('promis.actions.print')}
                          >
                            🖨️
                          </button>
                          {p.client_phone_display && (
                            <button 
                                className="btn btn-ghost btn-xs"
                                onClick={() => openSmsModal(p)}
                                title={t('promis.actions.sms')}
                            >
                                📱
                            </button>
                          )}

                        </div>
                      )}
                      {p.status === 'DEL' && p.date_livraison && (
                        <span className="text-xs text-success">
                          Livré le {format(new Date(p.date_livraison), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      )}
                      {p.status === 'ANN' && (
                        <span className="text-xs text-error">Annulé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SMS Modal */}
      {smsModal.isOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">{t('promis.modal.title_sms', { name: smsModal.promis?.client_display })}</h3>
            <form onSubmit={handleSendSms}>
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">{t('promis.modal.sms_number')}</span></label>
                <input 
                    type="text" 
                    className="input input-bordered"
                    value={smsModal.promis?.client_phone_display}
                    readOnly
                />
              </div>
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">{t('promis.modal.sms_message')}</span></label>
                <textarea 
                    className="textarea textarea-bordered h-24"
                    value={smsModal.message}
                    onChange={e => setSmsModal(prev => ({...prev, message: e.target.value}))}
                />
              </div>
              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setSmsModal(prev => ({...prev, isOpen: false}))}>{t('promis.modal.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={sendingSms}>
                    {sendingSms ? <span className="loading loading-spinner loading-sm"/> : t('promis.actions.sms_send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
