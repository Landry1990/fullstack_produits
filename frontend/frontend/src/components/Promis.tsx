import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, PackageOpen } from 'lucide-react';
import { usePromisData } from '../hooks/usePromisData';
import { Button } from './shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './shadcn/card';

// Components
import { PromisQuickStats } from './promis/PromisQuickStats';
import { PromisFilters } from './promis/PromisFilters';
import { PromisTable } from './promis/PromisTable';
import { SmsModal } from './promis/modals/SmsModal';
import { PromisDetailModal } from './promis/modals/PromisDetailModal';
import PasswordConfirmModal from './PasswordConfirmModal';
import type { Promis } from '../types';

const Promis: React.FC = () => {
    const { t } = useTranslation(['stock', 'common']);

    // UI State for Modals
    const [smsModalState, setSmsModalState] = useState<{isOpen: boolean, promis: Promis | null}>({ isOpen: false, promis: null });
    const [detailModalState, setDetailModalState] = useState<{isOpen: boolean, promis: Promis | null}>({ isOpen: false, promis: null });
    const [headerCollapsed, setHeaderCollapsed] = useState(false);

    // Business Logic Hook
    const {
        filteredPromis,
        loading,
        stats,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        refresh,
        handleDelivrer,
        handleAnnuler,
        handlePrintTicket,
        handleWhatsAppReminder,
        selectedIds,
        toggleSelection,
        toggleSelectAll,
        bulkLoading,
        handleBulkDelivrer,
        handleBulkAnnuler,
        clearSelection,
        sudoModal,
        setSudoModal,
        handleSudoConfirm
    } = usePromisData();

    const openDetail = (promis: Promis) => setDetailModalState({ isOpen: true, promis });

    return (
        <div className="h-screen overflow-hidden bg-slate-50 p-2 sm:p-3 lg:p-4">
            <div className="h-full max-w-[1600px] mx-auto space-y-3 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                            <PackageOpen className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                                {t('stock:promis.title', 'Promised Products Management')}
                            </h1>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                                {t('stock:promis.subtitle', 'Manage promised products, deliveries and stock returns')}
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHeaderCollapsed(!headerCollapsed)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 h-8 px-2 self-start sm:self-auto"
                        title={headerCollapsed ? t('common:show_header', 'Afficher') : t('common:hide_header', 'Masquer')}
                    >
                        {headerCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                        {headerCollapsed ? t('common:show_header', 'Afficher') : t('common:hide_header', 'Masquer')}
                    </Button>
                </div>

                {!headerCollapsed && (
                    <div className="space-y-3 shrink-0">
                        {/* Filters Card */}
                        <Card className="py-3">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">{t('stock:promis.title', 'Promis')}</CardTitle>
                                <CardDescription className="text-xs">
                                    {t('stock:promis.subtitle', 'Manage promised products, deliveries and stock returns')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-2">
                                <PromisFilters
                                    filterStatus={filterStatus}
                                    setFilterStatus={setFilterStatus}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    onRefresh={refresh}
                                />
                            </CardContent>
                        </Card>

                        {/* Quick Stats Dashboard */}
                        <PromisQuickStats stats={stats} />
                    </div>
                )}

                {/* Table Card */}
                <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                        <PromisTable
                            promisList={filteredPromis}
                            loading={loading}
                            selectedIds={selectedIds}
                            onToggleSelection={toggleSelection}
                            onToggleSelectAll={toggleSelectAll}
                            onDeliver={handleDelivrer}
                            onCancel={handleAnnuler}
                            onPrint={handlePrintTicket}
                            onSms={(promis) => setSmsModalState({ isOpen: true, promis })}
                            onWhatsApp={handleWhatsAppReminder}
                            onBulkDeliver={handleBulkDelivrer}
                            onBulkCancel={handleBulkAnnuler}
                            onClearSelection={clearSelection}
                            onView={openDetail}
                            bulkLoading={bulkLoading}
                        />
                    </div>
                </Card>

                {/* Modals */}
                <SmsModal
                    isOpen={smsModalState.isOpen}
                    onClose={() => setSmsModalState({ isOpen: false, promis: null })}
                    promis={smsModalState.promis}
                />

                <PromisDetailModal
                    isOpen={detailModalState.isOpen}
                    onClose={() => setDetailModalState({ isOpen: false, promis: null })}
                    promis={detailModalState.promis}
                    onDeliver={handleDelivrer}
                    onCancel={handleAnnuler}
                    onPrint={handlePrintTicket}
                    onSms={(promis) => {
                        setDetailModalState({ isOpen: false, promis: null });
                        setSmsModalState({ isOpen: true, promis });
                    }}
                    onWhatsApp={handleWhatsAppReminder}
                />

                <PasswordConfirmModal
                    isOpen={sudoModal.isOpen}
                    onClose={() => setSudoModal({ isOpen: false, action: null, targetId: null })}
                    onConfirm={handleSudoConfirm}
                    title={t('stock:promis.modals.sudo_confirm_title', 'Confirmation Requise (Zone Sensible)')}
                    message={t('stock:promis.modals.sudo_confirm_message', 'Cette action va modifier le stock (réintégration). Veuillez confirmer votre mot de passe pour continuer.')}
                />
            </div>
        </div>
    );
};

export default Promis;
