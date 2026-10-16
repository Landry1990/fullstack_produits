import React from 'react';
import type { ProduitModel, Facture, Rayon, Fournisseur, Forme } from '../../types';
import type { Groupe } from '../../types/catalog';
import type { AdjustForm } from '../../hooks/useProduitPage';
import ProduitCreateModal from '../ProduitFormModal';
import PasswordConfirmModal from '../PasswordConfirmModal';
import { StockAdjustmentModal } from './modals/StockAdjustmentModal';
import ImportProductsModal from './ImportProductsModal';
import { ProductDetailsModal as SalesDetailsModal } from '../sales/modals/ProductDetailsModal';
import { AvoirDetailsModal } from './modals/AvoirDetailsModal';

interface ProduitPageModalsProps {
  /* Édition */
  isEditOpen: boolean;
  editForm: Record<string, unknown>;
  onEditClose: () => void;
  onEditSuccess: (p: ProduitModel) => void;
  /* Ajustement stock */
  isAdjustOpen: boolean;
  onAdjustClose: () => void;
  selectedProduit: ProduitModel | null;
  adjustForm: AdjustForm;
  setAdjustForm: React.Dispatch<React.SetStateAction<AdjustForm>>;
  onAdjustSubmit: (e: React.FormEvent) => void;
  isAdjusting: boolean;
  /* Confirmation mot de passe */
  isPasswordOpen: boolean;
  onPasswordClose: () => void;
  onPasswordConfirm: () => void;
  passwordTitle: string;
  passwordMessage: string;
  /* Création */
  isCreateOpen: boolean;
  createInitialData: Record<string, unknown>;
  onCreateClose: () => void;
  onCreated: (p: ProduitModel) => void;
  /* Import */
  isImportOpen: boolean;
  onImportClose: () => void;
  onImportSuccess: () => void;
  /* Facture / avoir depuis l'onglet MVMTS */
  showSalesModal: boolean;
  onSalesClose: () => void;
  selectedFacture: Facture | null;
  loadingFacture: boolean;
  showAvoirModal: boolean;
  onAvoirClose: () => void;
  selectedAvoirId: number | null;
  /* Référentiels partagés */
  rayons: Rayon[];
  fournisseurs: Fournisseur[];
  formes: Forme[];
  groupes: Groupe[];
}

export const ProduitPageModals: React.FC<ProduitPageModalsProps> = ({
  isEditOpen, editForm, onEditClose, onEditSuccess,
  isAdjustOpen, onAdjustClose, selectedProduit, adjustForm, setAdjustForm, onAdjustSubmit, isAdjusting,
  isPasswordOpen, onPasswordClose, onPasswordConfirm, passwordTitle, passwordMessage,
  isCreateOpen, createInitialData, onCreateClose, onCreated,
  isImportOpen, onImportClose, onImportSuccess,
  showSalesModal, onSalesClose, selectedFacture, loadingFacture,
  showAvoirModal, onAvoirClose, selectedAvoirId,
  rayons, fournisseurs, formes, groupes,
}) => (
  <>
    <ProduitCreateModal
      open={isEditOpen}
      onClose={onEditClose}
      onSuccess={onEditSuccess}
      produitsEndpoint="produits/"
      initialData={editForm}
      rayons={rayons}
      fournisseurs={fournisseurs}
      formes={formes}
      groupes={groupes}
    />
    <StockAdjustmentModal
      isOpen={isAdjustOpen} onClose={onAdjustClose}
      selectedProduit={selectedProduit} form={adjustForm} setForm={setAdjustForm}
      onSubmit={onAdjustSubmit}
      isSubmitting={isAdjusting}
    />
    <PasswordConfirmModal
      isOpen={isPasswordOpen}
      onClose={onPasswordClose}
      onConfirm={onPasswordConfirm}
      title={passwordTitle}
      message={passwordMessage}
    />
    <ProduitCreateModal
      open={isCreateOpen}
      onClose={onCreateClose}
      onCreated={onCreated}
      produitsEndpoint={'produits/'}
      initialData={createInitialData}
      rayons={rayons}
      fournisseurs={fournisseurs}
      formes={formes}
      groupes={groupes}
    />
    {isImportOpen && (
      <ImportProductsModal
        onClose={onImportClose}
        onSuccess={onImportSuccess}
      />
    )}
    <SalesDetailsModal
      isOpen={showSalesModal}
      onClose={onSalesClose}
      facture={selectedFacture}
      loading={loadingFacture}
    />
    <AvoirDetailsModal
      isOpen={showAvoirModal}
      onClose={onAvoirClose}
      avoirId={selectedAvoirId}
    />
  </>
);
