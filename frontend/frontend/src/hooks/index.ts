/**
 * Centralized exports for all custom hooks
 */

// Data fetching hooks
export { useAuditLogs, useAuditStats, useUsers } from './useAudit';
export { useCart } from './useCart';
export { useClinicalCheck } from './useClinicalCheck';
export { useCommandeActions } from './useCommandeActions';
export { useCommandes } from './useCommandes';
export { useDashboardStats, useRevenueChart, useLowStock, useUgStats, usePromisDisponibles, useExpiringLots } from './useDashboard';
export { useFacturationClients } from './useFacturationClients';
export { usePendingSales } from './usePendingSales';
export { usePharmacySettings } from './usePharmacySettings';
export { useProductSearch } from './useProductSearch';
export { useProduits } from './useProduits';
export { useStockLots } from './useStockLots';
export { usePeakHours, useDailyComparison, useSeasonality } from './useTemporalAnalysis';

// UI hooks
export { useConfirm } from './useConfirm';
export { useKeyboardNavigation } from './useKeyboardNavigation';
export { useSearchNavigation } from './useSearchNavigation';

// Printing hook
export {
    usePrint,
    formatMoney,
    formatDateFr,
    printRow,
    printDivider,
    printTotal,
    type PrintOptions,
    type PrintTemplateConfig,
    type PrintDocumentType,
    type UsePrintReturn
} from './usePrint';

// Sale completion hook
export {
    useSaleCompletion
} from './useSaleCompletion';

export type {
    UseSaleCompletionReturn
} from './useSaleCompletion';

export type { PaymentDetails, TotalsData, AyantDroit as AyantDroitData, SaleCompletionParams, SaleCompletionResult } from '../types';
