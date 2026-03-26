import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'

interface ConfigurationOption {
  id: number
  code: string
  label: string
  type: 'STOCK_ADJ' | 'SUPPLIER_RET' | 'MONEY_DENOM'
  value?: string
  is_active: boolean
  order: number
}

const TABS = [
  { id: 'STOCK_ADJ', labelKey: 'tabs.STOCK_ADJ' },
  { id: 'SUPPLIER_RET', labelKey: 'tabs.SUPPLIER_RET' },
  { id: 'MONEY_DENOM', labelKey: 'tabs.MONEY_DENOM' }
]

function SortableItem({ option, onEdit, onDelete }: { option: ConfigurationOption, onEdit: (o: ConfigurationOption) => void, onDelete: (o: ConfigurationOption) => void }) {
  const { t } = useTranslation('config')
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: option.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-base-100 p-3 mb-2 rounded border flex items-center gap-3">
      <div {...attributes} {...listeners} className="cursor-grab text-base-content/40 hover:text-base-content/80">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold">{option.label}</span>
          {!option.is_active && <span className="badge badge-warning badge-xs">{t('inactive')}</span>}
        </div>
        <div className="text-xs text-base-content/60 flex gap-2">
          <span className="font-mono bg-base-200 px-1 rounded">{option.code}</span>
          {option.value && <span>{t('value_label', { value: option.value })}</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => onEdit(option)} className="btn btn-sm btn-ghost btn-square">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button onClick={() => onDelete(option)} className="btn btn-sm btn-ghost btn-square text-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  )
}

export default function ConfigurationOptions() {
  const { t } = useTranslation(['config', 'common'])
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const [items, setItems] = useState<ConfigurationOption[]>([])
  const [loading, setLoading] = useState(false)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ConfigurationOption | null>(null)
  
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    value: '',
    is_active: true
  })

  // load data
  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/configuration-options/')
      setItems(res.data.results || res.data)
    } catch (err) {
      console.error(err)
      toast.error(t('errors.load'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const filteredItems = items
    .filter(i => i.type === activeTab)
    .sort((a, b) => a.order - b.order)

  const handleEdit = (item: ConfigurationOption) => {
    setEditingItem(item)
    setFormData({
      code: item.code,
      label: item.label,
      value: item.value || '',
      is_active: item.is_active
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (item: ConfigurationOption) => {
    if (!confirm(t('delete_confirm', { label: item.label }))) return
    try {
      await axios.delete(`/api/configuration-options/${item.id}/`)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success(t('success.deleted'))
    } catch (err) {
      toast.error(t('errors.delete'))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = { ...formData, type: activeTab }
      
      if (editingItem) {
        const res = await axios.patch(`/api/configuration-options/${editingItem.id}/`, payload)
        setItems(prev => prev.map(i => i.id === editingItem.id ? res.data : i))
        toast.success(t('success.updated'))
      } else {
        const res = await axios.post('/api/configuration-options/', { 
          ...payload,
          order: filteredItems.length 
        })
        setItems(prev => [...prev, res.data])
        toast.success(t('success.created'))
      }
      setIsModalOpen(false)
      setEditingItem(null)
      setFormData({ code: '', label: '', value: '', is_active: true })
    } catch (err) {
      toast.error(t('errors.save'))
    }
  }

  const handleCreate = () => {
    setEditingItem(null)
    setFormData({ code: '', label: '', value: '', is_active: true })
    setIsModalOpen(true)
  }

  // Drag and Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
        const oldIndex = filteredItems.findIndex(i => i.id === active.id);
        const newIndex = filteredItems.findIndex(i => i.id === over.id);
        
        const newItems = [...filteredItems]
        const [moved] = newItems.splice(oldIndex, 1)
        newItems.splice(newIndex, 0, moved)
        
        const allOtherItems = items.filter(i => i.type !== activeTab)
        setItems([...allOtherItems, ...newItems.map((item, idx) => ({ ...item, order: idx }))])
    }
  };


  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button onClick={handleCreate} className="btn btn-primary gap-2">
          + {t('add_option')}
        </button>
      </div>

      <div className="tabs tabs-boxed mb-4">
        {TABS.map(tab => (
          <a 
            key={tab.id} 
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {t(tab.labelKey)}
          </a>
        ))}
      </div>

      <div className="flex-1 bg-base-200 rounded-box p-4 overflow-y-auto">
        {loading ? (
             <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
        ) : (
            <div className="max-w-3xl mx-auto">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={filteredItems.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredItems.map(item => (
                      <SortableItem 
                        key={item.id} 
                        option={item} 
                        onEdit={handleEdit} 
                        onDelete={handleDelete} 
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {filteredItems.length === 0 && (
                    <div className="text-center text-base-content/60 mt-10">{t('empty')}</div>
                )}
            </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
             <h3 className="font-bold text-lg mb-4">{editingItem ? t('modal.edit_title') : t('modal.new_title')}</h3>
             
             <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="form-control">
                    <label className="label">{t('modal.label')}</label>
                    <input 
                        className="input input-bordered" 
                        value={formData.label}
                        onChange={e => setFormData({...formData, label: e.target.value})}
                        required
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                        <label className="label">{t('modal.code')}</label>
                        <input 
                            className="input input-bordered" 
                            value={formData.code}
                            onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                            required
                        />
                    </div>
                    <div className="form-control">
                         <label className="label">{t('modal.value')}</label>
                         <input 
                            className="input input-bordered" 
                            value={formData.value}
                            onChange={e => setFormData({...formData, value: e.target.value})}
                            placeholder={activeTab === 'MONEY_DENOM' ? t('modal.value_hint') : ''}
                         />
                    </div>
                </div>

                <div className="form-control">
                    <label className="cursor-pointer label justify-start gap-4">
                        <span className="label-text">{t('modal.active')}</span> 
                        <input 
                            type="checkbox" 
                            className="toggle toggle-success" 
                            checked={formData.is_active}
                            onChange={e => setFormData({...formData, is_active: e.target.checked})}
                        />
                    </label>
                </div>

                <div className="modal-action">
                    <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>{t('modal.cancel')}</button>
                    <button type="submit" className="btn btn-primary">{editingItem ? t('modal.save') : t('modal.create')}</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  )
}
