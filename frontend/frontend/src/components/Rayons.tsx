import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { safeStorage } from '../utils/storage';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../hooks/useConfirm';

interface Rayon {
  id: number;
  name: string;
  parent: number | null;
  parent_name: string | null;
}

export default function Rayons() {
  const { t } = useTranslation();
  const confirm = useConfirm()
  const [rayons, setRayons] = useState<Rayon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRayon, setEditingRayon] = useState<Rayon | null>(null);
  const [formData, setFormData] = useState({ name: '', parent: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
    []
  );

  const fetchRayons = async () => {
    try {
      setLoading(true);
      const token = safeStorage.getItem('authToken');
      const res = await axios.get(`${apiBaseUrl}/api/categories/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setRayons(res.data.results || res.data);
    } catch (err) {
      console.error("Error fetching rayons:", err);
      toast.error(t('rayons.messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRayons();
  }, [apiBaseUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = safeStorage.getItem('authToken');
    
    // Prepare payload
    const payload: any = {
      name: formData.name,
      parent: formData.parent ? parseInt(formData.parent) : null
    };

    try {
      if (editingRayon) {
        await axios.put(`${apiBaseUrl}/api/categories/${editingRayon.id}/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success(t('rayons.messages.save_success_edit'));
      } else {
        await axios.post(`${apiBaseUrl}/api/categories/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success(t('rayons.messages.save_success_create'));
      }
      closeModal();
      fetchRayons();
    } catch (err) {
      console.error("Error saving rayon:", err);
      toast.error(t('rayons.messages.save_error'));
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t('rayons.messages.delete_confirm_title'),
      message: t('rayons.messages.delete_confirm_message'),
      variant: 'danger',
      confirmText: t('rayons.messages.delete_btn')
    })
    if (!confirmed) return;
    
    const token = safeStorage.getItem('authToken');
    try {
      await axios.delete(`${apiBaseUrl}/api/categories/${id}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      toast.success(t('rayons.messages.delete_success'));
      fetchRayons();
    } catch (err) {
      console.error("Error deleting rayon:", err);
      toast.error(t('rayons.messages.delete_error'));
    }
  };

  const openModal = (rayon?: Rayon) => {
    if (rayon) {
      setEditingRayon(rayon);
      setFormData({ 
        name: rayon.name, 
        parent: rayon.parent ? rayon.parent.toString() : '' 
      });
    } else {
      setEditingRayon(null);
      setFormData({ name: '', parent: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRayon(null);
    setFormData({ name: '', parent: '' });
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Adjust as needed

  // Organize rayons into hierarchy
  const hierarchy = useMemo(() => {
    const parents = rayons.filter(r => !r.parent);
    const children = rayons.filter(r => r.parent);
    
    return parents.map(parent => ({
      ...parent,
      subRayons: children.filter(c => c.parent === parent.id)
    }));
  }, [rayons]);

  // Paginate hierarchy
  const totalPages = Math.ceil(hierarchy.length / itemsPerPage);
  const paginatedHierarchy = hierarchy.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const availableParents = rayons.filter(r => !editingRayon || r.id !== editingRayon.id);

  // Print Modal State
  const [printTarget, setPrintTarget] = useState<Rayon | null>(null);
  const [excludeZeroStock, setExcludeZeroStock] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handlePrintRayonStock = (rayonId: number) => {
      const r = rayons.find(x => x.id === rayonId);
      if (r) {
          setPrintTarget(r);
          setExcludeZeroStock(false);
          setIsPrintModalOpen(true);
      }
  };

  const openPrintSansRayon = () => {
      // Sentinel object for "No Rayon"
      setPrintTarget({ id: -1, name: t('rayons.no_rayon'), parent: null, parent_name: null }); 
      setExcludeZeroStock(false);
      setIsPrintModalOpen(true);
  };

  const handleConfirmPrint = () => {
      if (!printTarget) return;
      let url = "";
      if (printTarget.id === -1) {
           url = `${apiBaseUrl}/api/categories/imprimer_sans_rayon/?exclude_zero=${excludeZeroStock}`;
      } else {
           url = `${apiBaseUrl}/api/categories/${printTarget.id}/imprimer_etat_stock/?exclude_zero=${excludeZeroStock}`;
      }
      window.open(url, '_blank');
      setIsPrintModalOpen(false);
  };

  if (loading) return <div className="p-8 text-center"><span className="loading loading-spinner loading-lg"></span></div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('rayons.title')}</h1>
        <div className="flex gap-2">
            <button onClick={openPrintSansRayon} className="btn btn-secondary btn-outline gap-2">
              🖨️ {t('rayons.no_rayon')}
            </button>
            <button onClick={() => openModal()} className="btn btn-primary gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              {t('rayons.new_main')}
            </button>
        </div>
      </div>

      <div className="bg-base-100 rounded-lg shadow overflow-hidden flex flex-col h-[600px]">
        <div className="flex-1 overflow-auto">
          <table className="table w-full relative">
            <thead className="sticky top-0 bg-base-200 z-10">
              <tr>
                <th className="w-20">{t('rayons.table.id')}</th>
                <th>{t('rayons.table.name')}</th>
                <th>{t('rayons.table.type')}</th>
                <th className="text-right">{t('rayons.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {hierarchy.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-base-content/60">{t('rayons.table.no_rayon_found')}</td>
                </tr>
              ) : (
                paginatedHierarchy.map((parent) => (
                  <>
                    {/* Parent Row */}
                    <tr key={parent.id} className="bg-base-100 font-bold hover:bg-base-50">
                      <td>{parent.id}</td>
                      <td className="text-lg text-primary">{parent.name}</td>
                      <td><span className="badge badge-primary badge-outline">{t('rayons.table.main_rayon')}</span></td>
                      <td className="text-right">
                        <button 
                          onClick={() => {
                            setEditingRayon(null);
                            setFormData({ name: '', parent: parent.id.toString() });
                            setIsModalOpen(true);
                          }} 
                          className="btn btn-xs btn-outline btn-success mr-2 gap-1"
                        >

                           {t('rayons.table.add_sub')}
                        </button>
                        <button onClick={() => handlePrintRayonStock(parent.id)} className="btn btn-info btn-outline btn-xs mr-2" title={t('rayons.print_stock')}>🖨️ {t('rayons.table.stock')}</button>
                        <button onClick={() => openModal(parent)} className="btn btn-ghost btn-xs mr-2">{t('rayons.table.modify')}</button>
                        <button onClick={() => handleDelete(parent.id)} className="btn btn-ghost btn-xs text-error">{t('rayons.table.delete')}</button>
                      </td>
                    </tr>
                    
                    {/* Children Rows */}
                    {parent.subRayons.map(child => (
                      <tr key={child.id} className="hover:bg-base-50">
                        <td className="opacity-50 text-right pr-4">↳ {child.id}</td>
                        <td className="pl-8">
                           <span className="border-l-2 border-base-300 pl-3">{child.name}</span>
                        </td>
                        <td><span className="badge badge-ghost badge-sm">{t('rayons.table.sub_rayon')}</span></td>
                        <td className="text-right">
                          <button onClick={() => handlePrintRayonStock(child.id)} className="btn btn-info btn-outline btn-xs mr-2" title={t('rayons.print_stock')}>🖨️ {t('rayons.table.stock')}</button>
                          <button onClick={() => openModal(child)} className="btn btn-ghost btn-xs mr-2">{t('rayons.table.modify')}</button>
                          <button onClick={() => handleDelete(child.id)} className="btn btn-ghost btn-xs text-error">{t('rayons.table.delete')}</button>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Empty State for Parent with no children */}
                    {parent.subRayons.length === 0 && (
                      <tr className="text-xs text-base-content/40 italic">
                        <td></td>
                        <td className="pl-8">{t('rayons.table.no_sub_rayon')}</td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {hierarchy.length > itemsPerPage && (
          <div className="p-4 border-t border-base-200 flex justify-center sticky bottom-0 bg-base-100">
            <div className="join">
              <button 
                className="join-item btn btn-sm" 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                «
              </button>
              <button className="join-item btn btn-sm no-animation cursor-default">
                Page {currentPage} / {totalPages}
              </button>
              <button 
                className="join-item btn btn-sm" 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">{editingRayon ? t('rayons.modal.title_edit') : t('rayons.modal.title_new')}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-control w-full mb-4">
                <label className="label"><span className="label-text">{t('rayons.modal.name')}</span></label>
                <input 
                  type="text" 
                  className="input input-bordered w-full" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-control w-full mb-6">
                <label className="label"><span className="label-text">{t('rayons.modal.parent')}</span></label>
                <select 
                  className="select select-bordered w-full"
                  value={formData.parent}
                  onChange={e => setFormData({...formData, parent: e.target.value})}
                >
                  <option value="">{t('rayons.modal.none')}</option>
                  {availableParents.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>{t('rayons.modal.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('rayons.modal.save')}</button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={closeModal}></div>
        </div>
      )}

      {/* Print Options Modal */}
      {isPrintModalOpen && printTarget && (
        <div className="modal modal-open">
          <div className="modal-box">
             <h3 className="font-bold text-lg mb-4">{t('rayons.print_modal.title')}</h3>
             <p className="mb-4">
               {t('rayons.print_modal.rayon')} : <span className="font-bold text-primary">{printTarget.name}</span>
             </p>

             <div className="form-control">
               <label className="label cursor-pointer justify-start gap-4">
                 <input 
                   type="checkbox" 
                   className="checkbox checkbox-primary"
                   checked={excludeZeroStock}
                   onChange={e => setExcludeZeroStock(e.target.checked)}
                 />
                 <span className="label-text">{t('rayons.print_modal.exclude_zero')}</span>
               </label>
             </div>

             <div className="modal-action">
               <button className="btn btn-ghost" onClick={() => setIsPrintModalOpen(false)}>{t('rayons.modal.cancel')}</button>
               <button className="btn btn-primary" onClick={handleConfirmPrint}>
                 <span className="mr-2">🖨️</span> {t('rayons.print_modal.validate')}
               </button>
             </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsPrintModalOpen(false)}></div>
        </div>
      )}
    </div>
  );
}
