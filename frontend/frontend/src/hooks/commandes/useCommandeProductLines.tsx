import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import type { TFunction } from 'react-i18next';
import { useCommandesStore } from '../../stores/useCommandesStore';
import { useConfirm } from '../useConfirm';
import { normalizeNumberInput } from '../../utils/formatters';
import type { Commande, CommandeProduit, ProduitModel } from '../../types';

interface UseCommandeProductLinesOptions {
  commandeType: 'LOC' | 'DIR' | 'DIV';
  tauxChange: string;
  fraisCoefficient: string;
  viewMode: string;
  selectedCommande: Commande | null;
  newCommandeFournisseurId: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  setSearchProduitQuery: (query: string) => void;
  produitsList: ProduitModel[];
  t: TFunction;
}

interface UseCommandeProductLinesReturn {
  commandeProduits: CommandeProduit[];
  selectedRows: Set<number>;
  pendingDuplicateProduct: ProduitModel | null;
  setPendingDuplicateProduct: (p: ProduitModel | null) => void;
  fieldsConfig: { name: string; editable: boolean }[];
  selectProduct: (product: ProduitModel) => Promise<void>;
  handleDuplicateAddNewLine: () => void;
  handleDuplicateIncrementExisting: (relativeIndex: number) => void;
  removeProductFromCommande: (index: number) => void;
  toggleRowSelection: (index: number) => void;
  toggleAllRows: () => void;
  deleteSelectedRows: () => void;
  openTransferModal: () => void;
  updateCommandeProduitField: (
    index: number,
    field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration' | 'prix_euro',
    value: string | number
  ) => void;
  handleSellingPriceBlur: (index: number) => void;
  handleTableFieldKeyDown: (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => void;
  handleSortProduits: (sortBy: 'chrono' | 'stock' | 'name' | 'qty') => void;
  handleTransferSuccess: () => void;
}

export function useCommandeProductLines(
  options: UseCommandeProductLinesOptions
): UseCommandeProductLinesReturn {
  const {
    commandeType,
    tauxChange,
    fraisCoefficient,
    viewMode,
    selectedCommande,
    newCommandeFournisseurId,
    searchInputRef,
    setSearchProduitQuery,
    produitsList,
    t,
  } = options;

  const confirm = useConfirm();

  const commandeProduits = useCommandesStore((s) => s.commandeProduits);
  const setCommandeProduits = useCommandesStore((s) => s.setCommandeProduits);
  const _commandeSortBy = useCommandesStore((s) => s.commandeSortBy);
  const setCommandeSortBy = useCommandesStore((s) => s.setCommandeSortBy);
  const selectedRows = useCommandesStore((s) => s.selectedRows);
  const setSelectedRows = useCommandesStore((s) => s.setSelectedRows);
  const setFocusedField = useCommandesStore((s) => s.setFocusedField);
  const setIsTransferModalOpen = useCommandesStore((s) => s.setIsTransferModalOpen);

  const [pendingDuplicateProduct, setPendingDuplicateProduct] = useState<ProduitModel | null>(null);

  const fieldsConfig = [
    { name: 'quantity', editable: true },
    { name: 'unites_gratuites', editable: true },
    ...(commandeType === 'DIR' ? [{ name: 'prix_euro', editable: true }] : []),
    { name: 'price', editable: true },
    { name: 'tva', editable: true },
    { name: 'marge', editable: true },
    { name: 'selling_price', editable: true },
    { name: 'lot', editable: true },
    { name: 'date_expiration', editable: true },
  ];

  function handleTableFieldKeyDown(e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) {
    const moveToNextField = () => {
      if (commandeType === 'DIR' && fieldIndex === 1) {
        setTimeout(() => {
          const euroInput = document.querySelector(`input[data-row="${rowIndex}"][data-field="prix_euro"]`) as HTMLInputElement;
          euroInput?.focus();
          euroInput?.select();
        }, 0);
        return;
      }

      let nextFieldIndex = fieldIndex + 1;
      while (nextFieldIndex < fieldsConfig.length && !fieldsConfig[nextFieldIndex].editable) nextFieldIndex++;

      if (nextFieldIndex < fieldsConfig.length) {
        setFocusedField({ row: rowIndex, field: nextFieldIndex });
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-row="${rowIndex}"][data-field="${fieldsConfig[nextFieldIndex].name}"]`) as HTMLInputElement;
          nextInput?.focus();
          nextInput?.select();
        }, 0);
      } else {
        setFocusedField(null);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 0);
      }
    };

    const moveToPreviousField = () => {
      let prevFieldIndex = fieldIndex - 1;
      while (prevFieldIndex >= 0 && !fieldsConfig[prevFieldIndex].editable) prevFieldIndex--;

      if (prevFieldIndex >= 0) {
        setFocusedField({ row: rowIndex, field: prevFieldIndex });
        setTimeout(() => {
          const prevInput = document.querySelector(`input[data-row="${rowIndex}"][data-field="${fieldsConfig[prevFieldIndex].name}"]`) as HTMLInputElement;
          prevInput?.focus();
          prevInput?.select();
        }, 0);
      }
    };

    switch (e.key) {
      case 'Enter': e.preventDefault(); moveToNextField(); break;
      case 'Tab': e.preventDefault(); if (e.shiftKey) moveToPreviousField(); else moveToNextField(); break;
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < commandeProduits.length - 1) {
          const nextRow = rowIndex + 1;
          const fieldName = fieldsConfig[fieldIndex]?.name;
          if (fieldName) {
            setFocusedField({ row: nextRow, field: fieldIndex });
            setTimeout(() => {
              const query = `input[data-row="${nextRow}"][data-field="${fieldName}"]`;
              const nextInput = document.querySelector(query) as HTMLInputElement;
              if (nextInput) {
                nextInput.focus();
                nextInput.select();
              }
            }, 10);
          }
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) {
          const prevRow = rowIndex - 1;
          const fieldName = fieldsConfig[fieldIndex]?.name;
          if (fieldName) {
            setFocusedField({ row: prevRow, field: fieldIndex });
            setTimeout(() => {
              const query = `input[data-row="${prevRow}"][data-field="${fieldName}"]`;
              const prevInput = document.querySelector(query) as HTMLInputElement;
              if (prevInput) {
                prevInput.focus();
                prevInput.select();
              }
            }, 10);
          }
        }
        break;
      case 'Delete': {
        const input = e.target as HTMLInputElement;
        const isFullySelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
        const isEmpty = input.value === '';

        if (e.ctrlKey || isFullySelected || isEmpty) {
          e.preventDefault();
          removeProductFromCommande(rowIndex);
          toast.success(t('orders:messages.product_removed'), { icon: <Trash2 className="h-4 w-4 text-emerald-600" />, duration: 1000 });

          setTimeout(() => {
            const nextRow = Math.min(rowIndex, commandeProduits.length - 1);
            if (nextRow >= 0) {
              const fieldName = fieldsConfig[fieldIndex]?.name;
              const nextInput = document.querySelector(`input[data-row="${nextRow}"][data-field="${fieldName}"]`) as HTMLInputElement;
              nextInput?.focus();
              nextInput?.select();
            } else {
              searchInputRef.current?.focus();
            }
          }, 50);
        }
        break;
      }
      case 'ArrowRight': if (e.ctrlKey) { e.preventDefault(); moveToNextField(); } break;
      case 'ArrowLeft': if (e.ctrlKey) { e.preventDefault(); moveToPreviousField(); } break;
    }
  }

  async function selectProduct(product: ProduitModel) {
    if (product.is_supplier_exclusive) {
      let currentSupplierId: number | null = null;
      if (viewMode === 'CREATE' && newCommandeFournisseurId) {
        currentSupplierId = normalizeNumberInput(newCommandeFournisseurId);
      } else if ((viewMode === 'EDIT' || viewMode === 'DETAILS') && selectedCommande?.fournisseur) {
        currentSupplierId = selectedCommande.fournisseur;
      }

      if (currentSupplierId && product.fournisseur && currentSupplierId !== product.fournisseur) {
        const confirmed = await confirm({
          title: t('orders:messages.exclusive_product_title'),
          message: t('orders:messages.exclusive_product_message', { supplier: product.fournisseur_name }),
          confirmText: t('orders:messages.exclusive_product_confirm'),
          cancelText: t('common:cancel'),
          variant: 'warning'
        });
        if (!confirmed) return;
      }
    }

    const existingIndexes = commandeProduits.reduce<number[]>((acc, p, i) => {
      if ((typeof p.produit === 'object' ? p.produit.id : p.produit) === product.id) acc.push(i);
      return acc;
    }, []);

    if (existingIndexes.length > 0) {
      setPendingDuplicateProduct(product);
      setSearchProduitQuery('');
      return;
    }

    const dirRate = normalizeNumberInput(tauxChange || '655.957');
    const dirCoeff = normalizeNumberInput(fraisCoefficient || '1.0');
    const baseCost = normalizeNumberInput(product.cost_price || '0');
    const dirPrice = commandeType === 'DIR' ? Math.round(baseCost).toString() : (product.cost_price || '0');
    const dirMarge = normalizeNumberInput(product.taux_marge || '1.3');
    const dirTva = normalizeNumberInput(product.tva || '0');
    const dirSelling = commandeType === 'DIR' ? Math.round(baseCost * dirCoeff * dirMarge * (1 + dirTva / 100)).toString() : (product.selling_price || '0');

    const newCommandeProduit: CommandeProduit = {
      id: Date.now(),
      produit: product,
      quantity: 1,
      unites_gratuites: 0,
      prix_euro: commandeType === 'DIR' ? (baseCost > 0 ? (baseCost / dirRate).toFixed(0) : '0') : undefined,
      price: dirPrice,
      price_cost: product.cost_price || '0',
      tva: product.tva || '0',
      marge: product.taux_marge || '1.3',
      selling_price: dirSelling,
      lot: '',
      date_expiration: '',
    };

    setCommandeProduits((prev) => [...prev, newCommandeProduit]);

    const newRowIndex = commandeProduits.length;
    setFocusedField({ row: newRowIndex, field: 0 });

    setTimeout(() => {
      const quantityInput = document.querySelector(`input[data-row="${newRowIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement;
      quantityInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      quantityInput?.focus();
      quantityInput?.select();
    }, 100);

    setSearchProduitQuery('');
  }

  function handleDuplicateAddNewLine() {
    if (!pendingDuplicateProduct) return;
    const product = pendingDuplicateProduct;
    setPendingDuplicateProduct(null);
    const dirRate2 = normalizeNumberInput(tauxChange || '655.957');
    const dirCoeff2 = normalizeNumberInput(fraisCoefficient || '1.0');
    const baseCost2 = normalizeNumberInput(product.cost_price || '0');
    const dirPrice2 = commandeType === 'DIR' ? Math.round(baseCost2).toString() : (product.cost_price || '0');
    const dirMarge2 = normalizeNumberInput(product.taux_marge || '1.3');
    const dirTva2 = normalizeNumberInput(product.tva || '0');
    const dirSelling2 = commandeType === 'DIR' ? Math.round(baseCost2 * dirCoeff2 * dirMarge2 * (1 + dirTva2 / 100)).toString() : (product.selling_price || '0');

    const newCommandeProduit: CommandeProduit = {
      id: Date.now(),
      produit: product,
      quantity: 1,
      unites_gratuites: 0,
      prix_euro: commandeType === 'DIR' ? (baseCost2 > 0 ? (baseCost2 / dirRate2).toFixed(0) : '0') : undefined,
      price: dirPrice2,
      price_cost: product.cost_price || '0',
      tva: product.tva || '0',
      marge: product.taux_marge || '1.3',
      selling_price: dirSelling2,
      lot: '',
      date_expiration: '',
    };
    setCommandeProduits((prev) => [...prev, newCommandeProduit]);
    const newRowIndex = commandeProduits.length;
    setFocusedField({ row: newRowIndex, field: 0 });
    setTimeout(() => {
      const quantityInput = document.querySelector(`input[data-row="${newRowIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement;
      quantityInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      quantityInput?.focus();
      quantityInput?.select();
    }, 100);
    setSearchProduitQuery('');
  }

  function handleDuplicateIncrementExisting(relativeIndex: number) {
    if (!pendingDuplicateProduct) return;
    const existingIndexes = commandeProduits.reduce<number[]>((acc, p, i) => {
      if ((typeof p.produit === 'object' ? p.produit.id : p.produit) === pendingDuplicateProduct.id) acc.push(i);
      return acc;
    }, []);
    const absoluteIndex = existingIndexes[relativeIndex];
    if (absoluteIndex === undefined) return;
    setPendingDuplicateProduct(null);
    const currentQty = normalizeNumberInput(String(commandeProduits[absoluteIndex].quantity || 0));
    updateCommandeProduitField(absoluteIndex, 'quantity', currentQty + 1);
    setFocusedField({ row: absoluteIndex, field: 0 });
    setTimeout(() => {
      const quantityInput = document.querySelector(`input[data-row="${absoluteIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement;
      quantityInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      quantityInput?.focus();
    }, 50);
    setSearchProduitQuery('');
  }

  function removeProductFromCommande(index: number) {
    setCommandeProduits((prev) => prev.filter((_, i) => i !== index));
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.delete(index);
      const adjusted = new Set<number>();
      next.forEach((idx) => {
        if (idx < index) adjusted.add(idx);
        else if (idx > index) adjusted.add(idx - 1);
      });
      return adjusted;
    });
  }

  function toggleRowSelection(index: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAllRows() {
    if (selectedRows.size === commandeProduits.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(commandeProduits.map((_, i) => i)));
  }

  function deleteSelectedRows() {
    setCommandeProduits((prev) => prev.filter((_, i) => !selectedRows.has(i)));
    setSelectedRows(new Set());
  }

  function openTransferModal() {
    if (selectedRows.size === 0) {
      toast.error(t('orders:messages.transfer_select_products'));
      return;
    }
    setIsTransferModalOpen(true);
  }

  function handleTransferSuccess() {
    setCommandeProduits((prev) => prev.filter((_, idx) => !selectedRows.has(idx)));
    setSelectedRows(new Set());
    setIsTransferModalOpen(false);
  }

  function updateCommandeProduitField(
    index: number,
    field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration' | 'prix_euro',
    value: string | number
  ) {
    setCommandeProduits((prev) => {
      const updatedList = prev.map((item, i) => {
        if (i === index) {
          const newItem = { ...item, [field]: value };

          if (commandeType === 'DIR' && field === 'prix_euro') {
            const pEuro = normalizeNumberInput(String(newItem.prix_euro || 0));
            const rate = normalizeNumberInput(tauxChange || '655.957');
            const coeff = normalizeNumberInput(fraisCoefficient || '1.0');

            if (!isNaN(pEuro) && !isNaN(rate)) {
              const priceFCFA = pEuro * rate;
              newItem.price = Math.round(priceFCFA).toString();
              const marge = normalizeNumberInput(String(newItem.marge || 1));
              const tva = normalizeNumberInput(String(newItem.tva || 0));
              if (priceFCFA > 0 && !isNaN(marge)) {
                const costWithFrais = priceFCFA * coeff;
                const sellingHT = costWithFrais * marge;
                const sellingTTC = sellingHT * (1 + tva / 100);
                newItem.selling_price = Math.round(sellingTTC).toString();
              }
            }
          }

          if (field === 'price' || field === 'marge' || field === 'tva') {
            const price = normalizeNumberInput(String(newItem.price || 0));
            const marge = normalizeNumberInput(String(newItem.marge || 1));
            const tva = normalizeNumberInput(String(newItem.tva || 0));
            if (!isNaN(price) && !isNaN(marge) && price > 0) {
              const effectiveCost = commandeType === 'DIR'
                ? price * normalizeNumberInput(fraisCoefficient || '1.0')
                : price;
              const sellingHT = effectiveCost * marge;
              const sellingTTC = sellingHT * (1 + tva / 100);
              newItem.selling_price = Math.round(sellingTTC).toString();
            }
          }
          if (field === 'selling_price') {
            const price = normalizeNumberInput(String(newItem.price || 0));
            const selling = normalizeNumberInput(String(newItem.selling_price || 0));
            const tva = normalizeNumberInput(String(newItem.tva || 0));
            if (!isNaN(price) && !isNaN(selling) && price > 0) {
              const sellingHT = selling / (1 + tva / 100);
              const divisor = commandeType === 'DIR'
                ? price * normalizeNumberInput(fraisCoefficient || '1.0')
                : price;
              newItem.marge = (sellingHT / divisor).toFixed(4);
            }
          }
          return newItem;
        }
        return item;
      });

      const currentItem = updatedList[index];
      const currentProduitId = typeof currentItem.produit === 'object' ? currentItem.produit.id : currentItem.produit;
      const currentLot = (currentItem.lot || '').trim();

      if (field === 'lot' && currentLot !== '') {
        const targetIndex = updatedList.findIndex((item, i) => {
          if (i === index) return false;
          const pId = typeof item.produit === 'object' ? item.produit.id : item.produit;
          return pId === currentProduitId && (item.lot || '').trim() === currentLot;
        });

        if (targetIndex !== -1) {
          const targetItem = updatedList[targetIndex];
          const mergedQty = (targetItem.quantity || 0) + (currentItem.quantity || 0);
          const mergedUG = (targetItem.unites_gratuites || 0) + (currentItem.unites_gratuites || 0);

          const newList = updatedList.filter((_, i) => i !== index);
          const finalIndex = targetIndex > index ? targetIndex - 1 : targetIndex;
          newList[finalIndex] = {
            ...newList[finalIndex],
            quantity: mergedQty,
            unites_gratuites: mergedUG,
          };

          toast.success(t('orders:messages.lots_merged', { product: typeof currentItem.produit === 'object' ? currentItem.produit.name : 'produit' }), { icon: <RefreshCw className="h-4 w-4 text-emerald-600" /> });

          setTimeout(() => {
            const targetInput = document.querySelector(`input[data-row="${finalIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement;
            targetInput?.focus();
          }, 50);

          return newList;
        }
      }
      return updatedList;
    });
  }

  function handleSellingPriceBlur(index: number) {
    const item = commandeProduits[index];
    if (!item) return;
    const price = normalizeNumberInput(String(item.price || 0));
    const selling = normalizeNumberInput(String(item.selling_price || 0));
    const tva = normalizeNumberInput(String(item.tva || 0));
    if (!isNaN(price) && !isNaN(selling) && price > 0 && selling > 0) {
      const sellingHT = selling / (1 + tva / 100);
      if (sellingHT < price) {
        const productName = typeof item.produit === 'object' ? item.produit?.name : '';
        toast(t('orders:messages.selling_below_cost', {
          selling: Math.round(selling),
          cost: Math.round(price),
          product: productName || `#${item.id || '?'}`,
        }), { icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, duration: 4000 });
      }
    }
  }

  const handleSortProduits = useCallback((sortBy: 'chrono' | 'stock' | 'name' | 'qty') => {
    setCommandeSortBy(sortBy);
    setCommandeProduits((prev) => {
      const sorted = prev.slice().sort((a, b) => {
        if (sortBy === 'chrono') return (a.id || 0) - (b.id || 0);

        const prodA = typeof a.produit === 'object' ? a.produit : produitsList.find((p) => p.id === a.produit);
        const prodB = typeof b.produit === 'object' ? b.produit : produitsList.find((p) => p.id === b.produit);

        if (sortBy === 'name') {
          const nameA = prodA?.name || a.produit_nom || '';
          const nameB = prodB?.name || b.produit_nom || '';
          return nameA.localeCompare(nameB);
        }
        if (sortBy === 'stock') {
          const stockA = prodA?.stock ?? a.produit_stock ?? 0;
          const stockB = prodB?.stock ?? b.produit_stock ?? 0;
          return stockB - stockA;
        }
        if (sortBy === 'qty') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
        return 0;
      });
      return sorted;
    });
    setSelectedRows(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitsList]);

  return {
    commandeProduits,
    selectedRows,
    pendingDuplicateProduct,
    setPendingDuplicateProduct,
    fieldsConfig,
    selectProduct,
    handleDuplicateAddNewLine,
    handleDuplicateIncrementExisting,
    removeProductFromCommande,
    toggleRowSelection,
    toggleAllRows,
    deleteSelectedRows,
    openTransferModal,
    updateCommandeProduitField,
    handleSellingPriceBlur,
    handleTableFieldKeyDown,
    handleSortProduits,
    handleTransferSuccess,
  };
}
