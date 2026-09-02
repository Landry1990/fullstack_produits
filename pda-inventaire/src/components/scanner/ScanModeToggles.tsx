import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ScanModeTogglesProps {
  continuousScanMode: boolean;
  rapidCountMode: boolean;
  onToggleContinuous: () => void;
  onToggleRapid: () => void;
}

export default function ScanModeToggles({
  continuousScanMode,
  rapidCountMode,
  onToggleContinuous,
  onToggleRapid,
}: ScanModeTogglesProps) {
  const handleManual = () => {
    if (continuousScanMode) onToggleContinuous();
    if (rapidCountMode) onToggleRapid();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onToggleContinuous}
        style={[
          styles.modeBtn,
          continuousScanMode && styles.modeBtnActive,
          rapidCountMode && styles.modeBtnDisabled,
        ]}
        disabled={rapidCountMode}
        activeOpacity={0.7}
      >
        <Text style={[styles.modeBtnText, continuousScanMode && styles.modeBtnTextActive]}>
          Scan continu
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onToggleRapid}
        style={[
          styles.modeBtn,
          rapidCountMode && styles.modeBtnActive,
          continuousScanMode && styles.modeBtnDisabled,
        ]}
        disabled={continuousScanMode}
        activeOpacity={0.7}
      >
        <Text style={[styles.modeBtnText, rapidCountMode && styles.modeBtnTextActive]}>
          +1 rapide
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleManual}
        style={[
          styles.modeBtn,
          !continuousScanMode && !rapidCountMode && styles.modeBtnActive,
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.modeBtnText,
            !continuousScanMode && !rapidCountMode && styles.modeBtnTextActive,
          ]}
        >
          Manuel
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  modeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b4b6a',
    minWidth: 90,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  modeBtnDisabled: {
    opacity: 0.5,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  modeBtnTextActive: {
    color: '#fff',
  },
});
