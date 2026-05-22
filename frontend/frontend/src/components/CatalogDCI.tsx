import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubstances, useSubstanceProduits, type Substance } from '../hooks/useSubstances';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { ProduitModel } from '../types';
import CatalogDCIAddModal from './CatalogDCIAddModal';

// Lucide icons simulation (using SVG strings as per skill rules)
const Icons = {
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  Pill: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
  ),
  Box: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
  ),
  ArrowRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
  )
};

export default function CatalogDCI() {
  const { t } = useTranslation(['products', 'common']);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubstance, setSelectedSubstance] = useState<Substance | null>(null);
  const [page, setPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: substancesData, isLoading: loadingSubstances } = useSubstances({ 
    search: searchTerm, 
    page 
  });

  const { data: produitsData, isLoading: loadingProduits } = useSubstanceProduits(selectedSubstance?.id || null);

  // Recherche dans la table de référence (ANSM) pour cette substance
  const { data: refMedsData, isLoading: loadingRef } = useQuery({
    queryKey: ['med-ref', selectedSubstance?.nom],
    queryFn: async () => {
      if (!selectedSubstance) return { results: [] };
      // On demande 100 résultats pour éviter les problèmes de pagination sur les listes moyennes
      const response = await api.get(`med-ref/?search=${selectedSubstance.nom}&page_size=100`);
      return response.data;
    },
    enabled: !!selectedSubstance,
  });

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 overflow-hidden">
      {/* Sidebar - Liste des DCI */}
      <div className="w-96 flex flex-col bg-base-100 rounded-3xl shadow-xl border border-base-200 overflow-hidden">
        <div className="p-6 bg-primary/5 border-b border-base-200">
          <h2 className="text-xl font-bold flex items-center gap-3 text-primary mb-4">
            <Icons.Pill />
            Catalogue DCI
          </h2>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-base-content/50">
              <Icons.Search />
            </div>
            <input
              type="text"
              placeholder="Rechercher une DCI..."
              className="input input-bordered w-full pl-12 rounded-2xl bg-base-200/50 border-none focus:ring-2 ring-primary/20"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loadingSubstances ? (
            <div className="flex flex-col gap-4 p-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-16 w-full bg-base-200 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : substancesData?.results.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelectedSubstance(sub)}
              className={`w-full p-4 rounded-2xl transition-all flex items-center justify-between text-left group ${
                selectedSubstance?.id === sub.id 
                  ? 'bg-primary text-primary-content shadow-lg shadow-primary/20 scale-[1.02]' 
                  : 'hover:bg-base-200 cursor-pointer'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight">{sub.nom}</span>
                <span className={`text-[10px] uppercase tracking-wider font-semibold text-base-content/70 ${selectedSubstance?.id === sub.id ? 'text-primary-content' : 'text-primary'}`}>
                  {sub.produits_count} produits liés
                </span>
              </div>
              <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${selectedSubstance?.id === sub.id ? 'opacity-100' : ''}`}>
                <Icons.ArrowRight />
              </div>
            </button>
          ))}
          
          {!loadingSubstances && substancesData?.results.length === 0 && (
            <div className="p-8 text-center text-base-content/50">
              <p className="text-sm">Aucune substance trouvée</p>
            </div>
          )}
        </div>

        {substancesData && substancesData.count > 0 && (
          <div className="p-4 border-t border-base-200 bg-base-200/20 flex items-center justify-between">
            <button 
              className="btn btn-sm btn-ghost" 
              disabled={!substancesData.previous}
              onClick={() => setPage(p => p - 1)}
            >Précédent</button>
            <span className="text-xs font-bold text-base-content/50">Page {page}</span>
            <button 
              className="btn btn-sm btn-ghost" 
              disabled={!substancesData.next}
              onClick={() => setPage(p => p + 1)}
            >Suivant</button>
          </div>
        )}
      </div>

      {/* Main Content - Produits associés */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        {selectedSubstance ? (
          <>
            {/* Header Substance */}
            <div className="bg-base-100 p-8 rounded-3xl shadow-xl border border-base-200 flex justify-between items-center bg-gradient-to-r from-primary/5 to-transparent">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <Icons.Pill />
                  </div>
                  <h1 className="text-3xl font-black tracking-tight">{selectedSubstance.nom}</h1>
                </div>
                <p className="text-base-content/60 font-medium">Gestion du groupe générique et des substitutions</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="btn btn-primary rounded-2xl shadow-lg shadow-primary/20 px-8"
              >
                <Icons.Search />
                Rechercher et ajouter
              </button>
            </div>

            <div className={`flex-1 grid gap-6 overflow-hidden ${(refMedsData?.count || 0) > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Produits en Stock */}
              <div className="flex flex-col bg-base-100 rounded-3xl shadow-xl border border-base-200 overflow-hidden">
                <div className="p-6 border-b border-base-200 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2">
                    <Icons.Box />
                    Produits en pharmacie
                  </h3>
                  <span className="badge badge-primary font-bold">{produitsData?.count || 0}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {loadingProduits ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className="h-24 w-full bg-base-200 animate-pulse rounded-2xl" />)}
                    </div>
                  ) : produitsData?.results.map((p: ProduitModel) => (
                    <div key={p.id} className="p-4 rounded-2xl border border-base-200 hover:border-primary/30 transition-all bg-base-200/20 group relative">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm uppercase group-hover:text-primary transition-colors">{p.name}</h4>
                        <div className="flex items-center gap-2">
                          {p.stock > 0 && (
                            <span className="badge badge-sm font-bold badge-success">
                              {p.stock} en stock
                            </span>
                          )}
                          <button
                            title={t('products:actions.remove_dci')}
                            disabled={deletingProductId === p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(p.id, selectedSubstance?.id, queryClient, setDeletingProductId, searchTerm, page);
                            }}
                            className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {deletingProductId === p.id ? (
                              <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                              <Icons.Trash />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs opacity-60">
                        <span>{p.forme_name || 'Forme inconnue'}</span>
                        <span className="font-bold text-primary">{p.selling_price} F</span>
                      </div>
                    </div>
                  ))}
                  {produitsData?.results.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center text-base-content/30">
                      <Icons.Box />
                      <p className="mt-4 font-bold">Aucun produit associé à cette DCI dans votre stock</p>
                    </div>
                  )}
                </div>
              </div>

              {(refMedsData?.count || 0) > 0 && (
                /* Références ANSM */
                <div className="flex flex-col bg-base-100 rounded-3xl shadow-xl border border-base-200 overflow-hidden">
                  <div className="p-6 border-b border-base-200 flex items-center justify-between bg-secondary/5">
                    <h3 className="font-bold flex items-center gap-2 text-secondary">
                      <Icons.Search />
                      Références Base ANSM
                    </h3>
                    <span className="badge badge-secondary font-bold">{refMedsData?.count || 0}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {loadingRef ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 w-full bg-base-200 animate-pulse rounded-2xl" />)}
                      </div>
                    ) : refMedsData?.results.map((ref: any) => (
                      <div key={ref.cis} className="p-4 rounded-2xl border border-base-200 hover:border-secondary/30 transition-all bg-base-200/5 group">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-[11px] uppercase group-hover:text-secondary transition-colors leading-tight">{ref.nom}</h4>
                          <span className="text-[10px] font-mono bg-base-300 px-2 rounded-lg text-base-content/50">CIS: {ref.cis}</span>
                        </div>
                        <p className="text-[10px] opacity-60 mb-2">{ref.forme}</p>
                      </div>
                    ))}
                    {refMedsData?.results.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center text-base-content/30">
                        <Icons.Search />
                        <p className="mt-4 font-bold">Aucune référence trouvée dans la base nationale</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-base-100 rounded-3xl shadow-xl border border-base-200 text-base-content/20">
            <div className="scale-[3]">
              <Icons.Pill />
            </div>
            <p className="mt-12 text-xl font-black uppercase tracking-widest">Sélectionnez une DCI pour gérer ses produits</p>
          </div>
        )}
      </div>

      <CatalogDCIAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        substance={selectedSubstance}
        onProductsAdded={() => {
          if (selectedSubstance) {
            queryClient.invalidateQueries({ queryKey: ['substance-produits', selectedSubstance.id] });
            queryClient.invalidateQueries({ queryKey: ['substances', { search: searchTerm, page }] });
          }
        }}
      />
    </div>
  );
}

function handleDeleteProduct(produitId: number, substanceId: number | undefined, queryClient: ReturnType<typeof useQueryClient>, setDeletingProductId: (id: number | null) => void, searchTerm: string, page: number) {
  if (!substanceId) return;
  setDeletingProductId(produitId);
  api.patch(`produits/${produitId}/`, {
    dci_reference: null,
    substances: [],
  })
    .then(() => {
      queryClient.invalidateQueries({ queryKey: ['substance-produits', substanceId] });
      queryClient.invalidateQueries({ queryKey: ['substances', { search: searchTerm, page }] });
    })
    .catch((err) => console.error('Erreur suppression DCI:', err))
    .finally(() => setDeletingProductId(null));
}
