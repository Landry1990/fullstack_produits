import { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../lib/motion';
import { useTranslation } from 'react-i18next';
import { Wrench, AlertTriangle, Database } from 'lucide-react';
import { PageContainer } from './ui/PageContainer';
import { TableSelectionCard } from './maintenance/TableSelectionCard';
import { CleanupTab } from './maintenance/CleanupTab';
import { BackupsTab } from './maintenance/BackupsTab';
import { PreviewResultsCard } from './maintenance/PreviewResultsCard';
import { PurgeResultsCard } from './maintenance/PurgeResultsCard';
import { PurgeConfirmDialog } from './maintenance/PurgeConfirmDialog';
import { RestoreConfirmDialog } from './maintenance/RestoreConfirmDialog';
import { ProductPurgeDialog } from './maintenance/ProductPurgeDialog';
import { ManualUpdateDialog } from './maintenance/ManualUpdateDialog';
import { RetentionPurgeDialog } from './maintenance/RetentionPurgeDialog';
import { usePurgeTables } from './maintenance/usePurgeTables';
import { usePharmacySettings } from './maintenance/usePharmacySettings';
import { useRetention } from './maintenance/useRetention';
import { useStockLevelsRecalc } from './maintenance/useStockLevelsRecalc';
import { useProductsMaintenance } from './maintenance/useProductsMaintenance';
import { useBackupRestore } from './maintenance/useBackupRestore';
import { useManualUpdate } from './maintenance/useManualUpdate';
import type { MaintenanceRightTab } from './maintenance/types';

export default function Maintenance() {
  const { t } = useTranslation(['maintenance', 'common']);
  const purge = usePurgeTables();
  const settings = usePharmacySettings();
  const retention = useRetention(settings);
  const stockLevels = useStockLevelsRecalc();
  const products = useProductsMaintenance();
  const update = useManualUpdate();
  const backup = useBackupRestore(settings);
  const [activeRightTab, setActiveRightTab] = useState<MaintenanceRightTab>('nettoyage');

  return (
    <PageContainer variant="dense" className="p-4 md:p-6">
      {/* Header */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show" className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20">
          <Wrench className="size-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
      </motion.div>

      {/* Warning Banner */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show" className="flex items-center gap-3 mb-6 shadow-lg bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle className="size-5 text-amber-600 shrink-0" />
        <div>
          <h3 className="font-bold text-amber-800">{t('irreversible')}</h3>
          <p className="text-sm text-amber-700">{t('warning_msg')}</p>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Table Selection */}
        <div className="lg:col-span-2">
          <TableSelectionCard
            tableCategories={purge.tableCategories}
            tableMap={purge.tableMap}
            selectedTables={purge.selectedTables}
            expandedCategories={purge.expandedCategories}
            onToggleTable={purge.toggleTable}
            onToggleCategory={purge.toggleCategory}
            onToggleExpandCategory={purge.toggleExpandCategory}
            onSelectAll={purge.selectAll}
            onDeselectAll={purge.deselectAll}
          />
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              onClick={() => setActiveRightTab('nettoyage')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeRightTab === 'nettoyage'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Wrench className="size-4" />
              {t('tabs.cleanup')}
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('sauvegardes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeRightTab === 'sauvegardes'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Database className="size-4" />
              {t('tabs.backups')}
            </button>
          </div>

          {activeRightTab === 'nettoyage' && (
            <CleanupTab purge={purge} products={products} retention={retention} recalc={stockLevels} />
          )}

          {activeRightTab === 'sauvegardes' && (
            <BackupsTab backup={backup} update={update} />
          )}
        </div>
      </motion.div>

      {/* Preview Results */}
      {purge.preview && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <PreviewResultsCard preview={purge.preview} totalCount={purge.totalPreviewCount} />
        </motion.div>
      )}

      {/* Purge Results */}
      {purge.purgeResults && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <PurgeResultsCard results={purge.purgeResults} />
        </motion.div>
      )}

      {/* Confirmation Modal */}
      <PurgeConfirmDialog
        open={purge.showConfirmModal}
        onClose={purge.closeConfirmModal}
        password={purge.password}
        onPasswordChange={purge.setPassword}
        purging={purge.purging}
        selectedTables={purge.selectedTables}
        tableMap={purge.tableMap}
        dateFrom={purge.dateFrom}
        dateTo={purge.dateTo}
        onConfirm={purge.handlePurge}
      />

      {/* Restore Confirmation Modal */}
      <RestoreConfirmDialog
        open={backup.showRestoreConfirm}
        onClose={backup.closeRestoreConfirm}
        fileName={backup.restoreFile?.name}
        password={backup.restorePassword}
        onPasswordChange={backup.setRestorePassword}
        restoring={backup.restoring}
        onConfirm={backup.handleRestore}
      />

      {/* Modal Purge Produits */}
      <ProductPurgeDialog
        open={products.showPurgeModal}
        onClose={products.closePurgeModal}
        purgeSansVentes={products.purgeSansVentes}
        password={products.purgePassword}
        onPasswordChange={products.setPurgePassword}
        purging={products.purging2}
        onConfirm={products.handlePurgeProduits}
      />

      {/* Modal Mise à jour manuelle */}
      <ManualUpdateDialog
        open={update.showUpdateConfirm}
        onClose={update.closeUpdateConfirm}
        password={update.updatePassword}
        onPasswordChange={update.setUpdatePassword}
        onConfirm={update.handleRunUpdate}
      />

      {/* Modal Purge Rétention */}
      <RetentionPurgeDialog
        open={retention.showRetentionModal}
        onClose={retention.closeRetentionModal}
        password={retention.retentionPassword}
        onPasswordChange={retention.setRetentionPassword}
        running={retention.retentionRunning}
        onConfirm={retention.handleRetentionRun}
      />
    </PageContainer>
  );
}
