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
      <Text style={styles.scanTitle}>Prêt à scanner</Text>
      <Text style={styles.scanSubtitle}>Scannez un code-barres avec le laser</Text>

      <TextInput
        ref={scanInputRef}
        style={styles.scanInput}
        value={scanInput}
        onChangeText={setScanInput}
        onSubmitEditing={handleManualSubmit}
        onFocus={onFocus}
        placeholder="Code-barres..."
        placeholderTextColor="#666"
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
          <ActivityIndicator color="#4f46e5" size="large" />
          <Text style={styles.searchingText}>Recherche...</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.searchBtn, (!scanInput.trim() || searching) && styles.btnDisabled]}
        onPress={handleManualSubmit}
        disabled={!scanInput.trim() || searching}
      >
        <Text style={styles.searchBtnText}>Rechercher</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scannerContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 24 : 80,
    paddingHorizontal: 24,
  },
  scanTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  scanSubtitle: {
    color: '#666',
    fontSize: 15,
    marginBottom: 32,
    textAlign: 'center',
  },
  scanInput: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#4f46e5',
    marginBottom: 16,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingText: {
    color: '#4f46e5',
    fontSize: 16,
    marginLeft: 12,
  },
  searchBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
