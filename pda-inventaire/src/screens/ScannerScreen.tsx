/**
 * ScannerScreen - Écran de scan pour l'inventaire PDA
 * Scan continu, mode rapide, feedback audio/vibration
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Inventaire } from '../services/inventaire';

import { useScannerController } from '../components/scanner/useScannerController';
import Header from '../components/scanner/Header';
import ScannerInput from '../components/scanner/ScannerInput';
import ScanModeToggles from '../components/scanner/ScanModeToggles';
import ProductCard from '../components/scanner/ProductCard';
import EditLineModal from '../components/scanner/EditLineModal';
import RecentScans from '../components/scanner/RecentScans';
import SyncBanner from '../components/scanner/SyncBanner';

interface ScannerScreenProps {
  inventaire: Inventaire;
  onBack: () => void;
}

export default function ScannerScreen({ inventaire, onBack }: ScannerScreenProps) {
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
    setQuantity,
    setScanInput,
    setEditQuantity,
    setLotQuantities,
    setNewLotNumber,
    setNewLotExpiration,
    handleScanSubmit,
    handleValidate,
    handleCancel,
    handleEditLine,
    handleRemoveLine,
    handleUpdateLine,
    handleExport,
    toggleKeyboard,
    handleFinishAndSync,
    handleBack,
    toggleContinuousMode,
    toggleRapidMode,
  } = useScannerController(inventaire, onBack);

  return (
    <View style={styles.container}>
      <Header
        reference={inventaire.reference}
        isOnline={isOnline}
        offlineCount={offlineCount}
        onBack={handleBack}
        onExport={handleExport}
        onToggleContinuous={toggleContinuousMode}
        onToggleRapid={toggleRapidMode}
        continuousScanMode={continuousScanMode}
        rapidCountMode={rapidCountMode}
        keyboardEnabled={isKeyboardEnabled}
        onToggleKeyboard={toggleKeyboard}
        count={lignes.length}
      />

      {lastSavedProduct && (
        <View style={styles.savedFeedbackBanner}>
          <Text style={styles.savedFeedbackText}>{lastSavedProduct}</Text>
        </View>
      )}

      {(continuousScanMode || rapidCountMode) && (
        <View style={styles.modesIndicator}>
          {continuousScanMode && <Text style={styles.modeIndicatorText}>Scan continu</Text>}
          {rapidCountMode && <Text style={styles.modeIndicatorText}>Mode +1 rapide</Text>}
        </View>
      )}

      <SyncBanner
        offlineCount={offlineCount}
        isOnline={isOnline}
        syncing={syncing}
        onSync={handleFinishAndSync}
      />

      <ScanModeToggles
        continuousScanMode={continuousScanMode}
        rapidCountMode={rapidCountMode}
        onToggleContinuous={toggleContinuousMode}
        onToggleRapid={toggleRapidMode}
      />

      {scannedProduct ? (
        <ProductCard
          product={scannedProduct}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  savedFeedbackBanner: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#22c55e',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedFeedbackText: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modesIndicator: {
    backgroundColor: '#1e1e35',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  modeIndicatorText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '600',
  },
});
