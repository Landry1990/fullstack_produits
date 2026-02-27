import { useState, useEffect } from 'react';

import { useConfirm } from '../hooks/useConfirm';
import { useSudo } from '../hooks/useSudo';
import SudoValidationModal from './common/SudoValidationModal';

import { useInventaireList } from '../hooks/inventaire/useInventaireList';
import { useInventaireEditor } from '../hooks/inventaire/useInventaireEditor';
import { useInventaireMerge } from '../hooks/inventaire/useInventaireMerge';

import { InventaireList } from './inventaire/editor/InventaireList';
import { InventaireEditor } from './inventaire/editor/InventaireEditor';
import { InventaireMergeModal } from './inventaire/modals/InventaireMergeModal';

export default function InventaireComponent() {

    const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');

    const { sudoState, requireSudo, closeSudo } = useSudo();
    const confirm = useConfirm();
    
    const listLogic = useInventaireList();
    const editorLogic = useInventaireEditor(listLogic.fetchInventaires, setViewMode, requireSudo, confirm);

    // Initial load
    useEffect(() => {
        listLogic.fetchInventaires();
    }, []);

    const mergeLogic = useInventaireMerge({
        viewMode,
        selectedInventaireIds: listLogic.selectedInventaireIds,
        inventaires: listLogic.inventaires,
        setSelectedInventaireIds: listLogic.setSelectedInventaireIds,
        fetchInventaires: listLogic.fetchInventaires,
        activeInventaire: editorLogic.activeInventaire,
        handleEdit: editorLogic.handleEdit
    });

    return (
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
            {viewMode === 'LIST' ? (
                <InventaireList 
                    listLogic={listLogic}
                    editorLogic={editorLogic}
                    onEdit={editorLogic.handleEdit}
                    onCreate={editorLogic.handleCreate}
                    onOpenMergeModal={() => mergeLogic.setShowMergeModal(true)}
                    canMerge={mergeLogic.canMergeSelectedInventaires()}
                />
            ) : (
                <InventaireEditor 
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    activeInventaire={editorLogic.activeInventaire}
                    editorLogic={editorLogic}
                />
            )}
            
            <InventaireMergeModal 
                showMergeModal={mergeLogic.showMergeModal}
                setShowMergeModal={mergeLogic.setShowMergeModal}
                viewMode={viewMode}
                selectedMergeSource={mergeLogic.selectedMergeSource}
                setSelectedMergeSource={mergeLogic.setSelectedMergeSource}
                mergeCandidates={mergeLogic.mergeCandidates}
                loadingMergeCandidates={mergeLogic.loadingMergeCandidates}
                merging={mergeLogic.merging}
                handleMerge={mergeLogic.handleMerge}
                selectedInventaireIds={listLogic.selectedInventaireIds}
                inventaires={listLogic.inventaires}
            />

            {sudoState.isOpen && <SudoValidationModal 
                isOpen={sudoState.isOpen}
                onClose={closeSudo}
                onValidate={sudoState.onValidate}
                saving={false}
                title={sudoState.title || "Validation Requiée"}
                message={sudoState.message || "Veuillez confirmer cette action."}
            />}
        </div>
    );
}
