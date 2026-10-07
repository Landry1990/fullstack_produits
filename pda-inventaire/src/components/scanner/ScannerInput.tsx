import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../config/theme';

interface ScannerInputProps {
  scanInputRef: React.RefObject<TextInput | null>;
  scanInput: string;
  setScanInput: (value: string) => void;
  searching: boolean;
  onSubmit: (code: string) => void;
  isKeyboardEnabled: boolean;
  onFocus?: () => void;
}

export default function ScannerInput({
  scanInputRef,
  scanInput,
  setScanInput,
  searching,
  onSubmit,
  isKeyboardEnabled,
  onFocus,
}: ScannerInputProps) {
  const { t } = useTranslation();
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timeout intelligent :
  // - min 50ms sans caractère et longueur stable
  // - max 800ms après avoir atteint au moins 3 caractères
  useEffect(() => {
    const current = scanInput.trim();

    // Reset du timer max si l'input est vide ou trop court
    if (!current || current.length < 3) {
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
      return;
    }

    // Démarrer le timer max une seule fois par séquence de scan
    if (!maxTimerRef.current) {
      maxTimerRef.current = setTimeout(() => {
        const final = scanInput.trim();
        if (final.length >= 3) onSubmit(final);
        maxTimerRef.current = null;
      }, 800);
    }

    // Timer de stabilité : submit si aucun caractère n'est arrivé dans les 50ms
    const stabilityTimer = setTimeout(() => {
      const stable = scanInput.trim();
      if (stable === current && stable.length >= 3) {
        onSubmit(stable);
      }
    }, 50);

    return () => {
      clearTimeout(stabilityTimer);
    };
  }, [scanInput, onSubmit]);

  const handleManualSubmit = () => {
    Keyboard.dismiss();
    const code = scanInput.trim();
    if (code && !searching) {
      onSubmit(code);
    }
  };

  return (
    <View style={styles.scannerContainer}>
      <Text style={styles.scanTitle}>{t('scanner.ready_title')}</Text>
      <Text style={styles.scanSubtitle}>{t('scanner.ready_subtitle')}</Text>

      <TextInput
        ref={scanInputRef}
        style={styles.scanInput}
        value={scanInput}
        onChangeText={setScanInput}
        onSubmitEditing={handleManualSubmit}
        onFocus={onFocus}
        placeholder={t('scanner.barcode_placeholder')}
        placeholderTextColor={theme.textMuted}
        autoFocus
        blurOnSubmit={false}
        returnKeyType="search"
        keyboardType="default"
        autoCapitalize="none"
        autoCorrect={false}
        showSoftInputOnFocus={isKeyboardEnabled}
      />

      {searching && (
        <View style={styles.searchingIndicator}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={styles.searchingText}>{t('scanner.searching')}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.searchBtn, (!scanInput.trim() || searching) && styles.btnDisabled]}
        onPress={handleManualSubmit}
        disabled={!scanInput.trim() || searching}
      >
        <Text style={styles.searchBtnText}>{t('common.search')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scannerContainer: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  scanTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  scanSubtitle: {
    color: theme.textMuted,
    fontSize: 15,
    marginBottom: 32,
    textAlign: 'center',
  },
  scanInput: {
    width: '100%',
    backgroundColor: theme.bgElevated,
    borderRadius: 12,
    padding: 16,
    color: theme.text,
    fontSize: 20,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    marginBottom: 16,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingText: {
    color: theme.primary,
    fontSize: 16,
    marginLeft: 12,
  },
  searchBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  searchBtnText: {
    color: theme.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
