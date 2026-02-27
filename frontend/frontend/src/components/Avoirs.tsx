
import { useTranslation } from 'react-i18next';
import { useAvoirsData } from '../hooks/useAvoirsData';

// Components
import { AvoirsQuickStats } from './avoirs/AvoirsQuickStats';
import { AvoirsFilters } from './avoirs/AvoirsFilters';
import { AvoirsTable } from './avoirs/AvoirsTable';
import { AvoirsForm } from './avoirs/AvoirsForm';
import { AvoirsDetails } from './avoirs/AvoirsDetails';
import { AvoirsLotModal } from './avoirs/modals/AvoirsLotModal';
import SudoValidationModal from './common/SudoValidationModal';

export default function Avoirs() {
    const { t } = useTranslation();
    const avoirsData = useAvoirsData();

    // Sudo Hook extracted values for Modal rendering
    const { sudoState, closeSudo } = avoirsData;

    // View routing
    if (avoirsData.viewMode === 'CREATE' || avoirsData.viewMode === 'EDIT') {
        return (
            <>
                <AvoirsForm data={avoirsData} />
                <AvoirsLotModal 
                    isOpen={avoirsData.lotModal.open}
                    onClose={() => avoirsData.setLotModal(prev => ({ ...prev, open: false }))}
                    availableLots={avoirsData.availableLots}
                    loadingLots={avoirsData.loadingLots}
                    onSelectLot={avoirsData.handleSelectLot}
                />
            </>
        );
    }

    if (avoirsData.viewMode === 'DETAILS') {
        return (
            <>
                <AvoirsDetails data={avoirsData} />
                <SudoValidationModal 
                    isOpen={sudoState.isOpen}
                    onClose={closeSudo}
                    onValidate={sudoState.onValidate}
                    saving={false}
                    title={sudoState.title}
                    message={sudoState.message}
                />
            </>
        );
    }

    // Default 'LIST' view
    return (
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
            
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                
                {/* Title & Filters */}
                <div className="w-full space-y-4">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
                        <div className="p-6 border-b border-base-200">
                            <h1 className="text-2xl font-bold text-base-content tracking-tight">
                                {t('avoirs.title', 'Gestion des Avoirs')}
                            </h1>
                            <p className="text-base-content/60 text-sm mt-1">
                                {t('avoirs.subtitle', 'Gérez les retours fournisseurs et les réintégrations de stock')}
                            </p>
                        </div>
                        
                        <AvoirsFilters 
                            searchQuery={avoirsData.listSearchQuery}
                            setSearchQuery={avoirsData.setListSearchQuery}
                            onRefresh={() => avoirsData.fetchAvoirs(avoirsData.listSearchQuery)}
                            onNew={avoirsData.handleCreateNew}
                        />
                    </div>
                    
                    {/* Quick Stats Dashboard */}
                    <AvoirsQuickStats avoirs={avoirsData.avoirs} />
                </div>
            </div>

            {/* Main Content: Table */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
                <AvoirsTable 
                    avoirs={avoirsData.avoirs}
                    loading={avoirsData.loading}
                    onView={(avoir) => {
                        avoirsData.setSelectedAvoir(avoir);
                        avoirsData.setViewMode('DETAILS');
                    }}
                    onEdit={avoirsData.handleEdit}
                    onValidate={avoirsData.handleValidate}
                    onDelete={avoirsData.handleDelete}
                />
            </div>

            {/* Validate Modal accessible from list view */}
            <SudoValidationModal 
                isOpen={sudoState.isOpen}
                onClose={closeSudo}
                onValidate={sudoState.onValidate}
                saving={false}
                title={sudoState.title || "Validation d'Avoir"}
                message={sudoState.message || "Confirmer cette action (réintégration de stock) ?"}
            />

        </div>
    );
}
