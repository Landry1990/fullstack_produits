/**
 * ScannerScreen - Écran de scan pour l'inventaire PDA
 * Scan continu, mode rapide, feedback audio/vibration
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Inventaire } from '../services/inventaire';

import { useTranslation } from 'react-i18next';
import { useScannerController } from '../components/scanner/useScannerController';
import Header from '../components/scanner/Header';
import ScannerInput from '../components/scanner/ScannerInput';
import ScanModeToggles from '../components/scanner/ScanModeToggles';
import ProductCard from '../components/scanner/ProductCard';
import EditLineModal from '../components/scanner/EditLineModal';
import RecentScans from '../components/scanner/RecentScans';
import RestantsSheet from '../components/scanner/RestantsSheet';
import SyncBanner from '../components/scanner/SyncBanner';
import { theme } from '../config/theme';

interface ScannerScreenProps {
  inventaire: Inventaire;
  onBack: () => void;
}

export default function ScannerScreen({ inventaire, onBack }: ScannerScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    scanInputRef,
    scannedProduct,
    quantity,
    lignes,
    loading,
    searching,
    scanInput,
    editingLine,
    editQuantity,
    lotQuantities,
    newLotNumber,
    newLotExpiration,
    continuousScanMode,
    rapidCountMode,
    lastSavedProduct,
    isKeyboardEnabled,
    isOnline,
    offlineCount,
    syncing,
    syncProgress,
    preloadProgress,
    uncountedLignes,
    restantsOpen,
    scopeWarning,
    zeroing,
    setQuantity,
    setScanInput,
    setEditQuantity,
    setLotQuantities,
    setNewLotNumber,
    setNewLotExpiration,
    setRestantsOpen,
    sendZeroUncounted,
    handleScanSubmit,
    handleValidate,
    handleCancel,
    handleEditLine,
    handleRemoveLine,
    handleUpdateLine,
    toggleKeyboard,
    handleUpload,
    handleFinishAndSync,
    handleBack,
    toggleContinuousMode,
    toggleRapidMode,
  } = useScannerController(inventaire, onBack);

  return (
    <View style={[styles.container, { paddingBottom: Math.min(insets.bottom, 24) }]}>
      <Header
        reference={inventaire.reference || inventaire.description || t('home.inventory_fallback', { id: inventaire.id })}
        isOnline={isOnline}
        offlineCount={offlineCount}
        onBack={handleBack}
        onUpload={handleUpload}
        syncing={syncing}
        keyboardEnabled={isKeyboardEnabled}
        onToggleKeyboard={toggleKeyboard}
        count={lignes.length}
        progress={preloadProgress}
        onPressProgress={() => setRestantsOpen(true)}
      />

      {scopeWarning && (
        <View style={styles.scopeWarningBanner}>
          <Text style={styles.scopeWarningText}>
            {t('scanner.out_of_scope', { name: scopeWarning })}
          </Text>
        </View>
      )}

      {lastSavedProduct && (
        <View style={styles.savedFeedbackBanner}>
          <Text style={styles.savedFeedbackText}>{lastSavedProduct}</Text>
        </View>
      )}

      {(continuousScanMode || rapidCountMode) && (
        <View style={styles.modesIndicator}>
          {continuousScanMode && <Text style={styles.modeIndicatorText}>{t('scanner.continuous')}</Text>}
          {rapidCountMode && <Text style={styles.modeIndicatorText}>{t('scanner.rapid')}</Text>}
        </View>
      )}

      <SyncBanner
        offlineCount={offlineCount}
        isOnline={isOnline}
        syncing={syncing}
        syncProgress={syncProgress}
        onSync={handleFinishAndSync}
      />

      {scannedProduct ? (
        <ProductCard
          product={scannedProduct}
          inventoryType={inventaire.inventory_type}
          quantity={quantity}
          setQuantity={setQuantity}
          lotQuantities={lotQuantities}
          setLotQuantities={setLotQuantities}
          newLotNumber={newLotNumber}
          setNewLotNumber={setNewLotNumber}
          newLotExpiration={newLotExpiration}
          setNewLotExpiration={setNewLotExpiration}
          onValidate={handleValidate}
          onCancel={handleCancel}
          loading={loading}
        />
      ) : (
        <ScannerInput
          scanInputRef={scanInputRef}
          scanInput={scanInput}
          setScanInput={setScanInput}
          searching={searching}
          onSubmit={handleScanSubmit}
          isKeyboardEnabled={isKeyboardEnabled}
        />
      )}

      <ScanModeToggles
        continuousScanMode={continuousScanMode}
        rapidCountMode={rapidCountMode}
        onToggleContinuous={toggleContinuousMode}
        onToggleRapid={toggleRapidMode}
      />

      {editingLine && (
        <EditLineModal
          line={editingLine}
          quantity={editQuantity}
          setQuantity={setEditQuantity}
          onSave={handleUpdateLine}
          onCancel={handleCancel}
          loading={loading}
        />
      )}

      <RecentScans
        lignes={lignes}
        editingLine={editingLine}
        onEdit={(ligne) => handleEditLine(ligne as Parameters<typeof handleEditLine>[0])}
        onRemove={handleRemoveLine}
      />

      <RestantsSheet
        visible={restantsOpen}
        lignes={uncountedLignes}
        isOnline={isOnline}
        zeroing={zeroing}
        onClose={() => setRestantsOpen(false)}
        onZeroAll={sendZeroUncounted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scopeWarningBanner: {
    backgroundColor: theme.warningWash,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.warning,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scopeWarningText: {
    color: theme.warning,
    fontWeight: 'bold',
    fontSize: 13,
  },
  savedFeedbackBanner: {
    backgroundColor: theme.primaryLight,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedFeedbackText: {
    color: theme.primaryDark,
    fontWeight: 'bold',
    fontSize: 14,
  },
  modesIndicator: {
    backgroundColor: theme.bgElevated,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modeIndicatorText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});
