import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';
import { getTableCategories } from './utils';
import type { PurgeTable, PreviewResult, PurgeResult } from './types';

/**
 * État + handlers de la purge de tables (sélection, période, aperçu, export, purge).
 * La vue reste dans Maintenance.tsx et les sous-composants de components/maintenance/.
 */
export function usePurgeTables() {
  const { t } = useTranslation(['maintenance', 'common']);
  const tableCategories = getTableCategories(t);
  const [tables, setTables] = useState<PurgeTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preview, setPreview] = useState<PreviewResult[] | null>(null);
  const [purgeResults, setPurgeResults] = useState<PurgeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [password, setPassword] = useState('');
  const [purging, setPurging] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(tableCategories)));

  // Fetch available tables
  useEffect(() => {
    api.get('maintenance/tables/')
      .then(res => setTables(res.data))
      .catch(() => gooeyToast.error(t('common:error_loading_data')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTable = (key: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPreview(null);
    setPurgeResults(null);
  };

  const toggleCategory = (catKeys: string[]) => {
    const allSelected = catKeys.every(k => selectedTables.has(k));
    setSelectedTables(prev => {
      const next = new Set(prev);
      catKeys.forEach(k => {
        if (allSelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
    setPreview(null);
    setPurgeResults(null);
  };

  const toggleExpandCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTables(new Set(tables.map(tbl => tbl.key)));
    setPreview(null);
    setPurgeResults(null);
  };

  const deselectAll = () => {
    setSelectedTables(new Set());
    setPreview(null);
    setPurgeResults(null);
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setPreview(null);
    setPurgeResults(null);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setPreview(null);
    setPurgeResults(null);
  };

  const handlePreview = async () => {
    if (selectedTables.size === 0) {
      gooeyToast.error(t('toasts.select_table'));
      return;
    }
    setLoading(true);
    setPurgeResults(null);
    try {
      const res = await api.post('maintenance/preview/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setPreview(res.data);
    } catch {
      gooeyToast.error(t('toasts.preview_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (selectedTables.size === 0) {
      gooeyToast.error(t('toasts.select_table'));
      return;
    }
    setExporting(true);
    try {
      const res = await api.post('maintenance/export/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purge_backup_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      gooeyToast.success(t('toasts.export_success'));
    } catch {
      gooeyToast.error(t('toasts.export_error'));
    } finally {
      setExporting(false);
    }
  };

  const requestPurge = () => {
    if (selectedTables.size > 0) setShowConfirmModal(true);
    else gooeyToast.error(t('common:select_tables'));
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setPassword('');
  };

  const handlePurge = async () => {
    if (!password) {
      gooeyToast.error(t('toasts.password_required'));
      return;
    }
    setPurging(true);
    try {
      const res = await api.post('maintenance/purge/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
        password,
      });
      setPurgeResults(res.data.results);
      setPreview(null);
      setShowConfirmModal(false);
      setPassword('');
      gooeyToast.success(t('toasts.purge_success'));
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('toasts.purge_error')));
    } finally {
      setPurging(false);
    }
  };

  const totalPreviewCount = preview?.reduce((sum, p) => {
    const childTotal = p.children.reduce((cs, c) => cs + c.count, 0);
    return sum + p.count + childTotal;
  }, 0) ?? 0;

  const tableMap = new Map(tables.map(tbl => [tbl.key, tbl]));

  return {
    tableCategories,
    tables,
    tableMap,
    selectedTables,
    dateFrom,
    dateTo,
    preview,
    purgeResults,
    loading,
    exporting,
    showConfirmModal,
    password,
    purging,
    expandedCategories,
    totalPreviewCount,
    setPassword,
    toggleTable,
    toggleCategory,
    toggleExpandCategory,
    selectAll,
    deselectAll,
    handleDateFromChange,
    handleDateToChange,
    handlePreview,
    handleExport,
    handlePurge,
    requestPurge,
    closeConfirmModal,
  };
}

export type UsePurgeTablesReturn = ReturnType<typeof usePurgeTables>;
