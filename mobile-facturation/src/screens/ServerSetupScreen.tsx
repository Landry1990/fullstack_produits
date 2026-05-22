/**
 * Écran — Configuration du serveur (premier lancement)
 * Scan QR Code ou saisie manuelle de l'URL du serveur LAN
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useServerDiscovery } from '../hooks';

interface ServerSetupScreenProps {
  onConfigured: () => void;
}

export function ServerSetupScreen({ onConfigured }: ServerSetupScreenProps) {
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');
  const [manualUrl, setManualUrl] = useState('http://');
  const [permission, requestPermission] = useCameraPermissions();
  const { error, isValidating, handleQRCode, setManualUrl: configureUrl } = useServerDiscovery();

  // ─── Scan QR ──────────────────────────────

  const onBarcodeScanned = async (result: { data: string }) => {
    const success = await handleQRCode(result.data);
    if (success) {
      Alert.alert('✅ Serveur configuré', 'Connexion au serveur réussie !', [
        { text: 'Continuer', onPress: onConfigured },
      ]);
    }
  };

  // ─── Saisie manuelle ──────────────────────

  const handleManualSubmit = async () => {
    if (!manualUrl || manualUrl === 'http://') {
      Alert.alert('Erreur', 'Veuillez saisir une URL valide');
      return;
    }
    const success = await configureUrl(manualUrl.trim());
    if (success) {
      Alert.alert('✅ Serveur configuré', 'Connexion au serveur réussie !', [
        { text: 'Continuer', onPress: onConfigured },
      ]);
    }
  };

  // ─── Permission caméra ─────────────────────

  if (mode === 'qr' && !permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.title}>📡 Configuration du Serveur</Text>
          <Text style={styles.subtitle}>
            L'application a besoin de la caméra pour scanner le QR Code du serveur.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => setMode('manual')}>
            <Text style={styles.linkButtonText}>Saisir l'URL manuellement</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>📡 Configuration du Serveur</Text>
        <Text style={styles.subtitle}>
          {mode === 'qr'
            ? 'Scannez le QR Code affiché sur le serveur'
            : 'Saisissez l\'adresse du serveur'}
        </Text>
      </View>

      {mode === 'qr' ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={isValidating ? undefined : onBarcodeScanned}
          />
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
          </View>
          {isValidating && (
            <View style={styles.validatingOverlay}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={styles.validatingText}>Vérification du serveur…</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.manualContainer}>
          <Text style={styles.label}>URL du serveur</Text>
          <TextInput
            style={styles.input}
            value={manualUrl}
            onChangeText={setManualUrl}
            placeholder="http://192.168.1.100:8000"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.primaryButton, isValidating && styles.disabled]}
            onPress={handleManualSubmit}
            disabled={isValidating}
          >
            {isValidating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Tester et configurer</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => setMode(mode === 'qr' ? 'manual' : 'qr')}
      >
        <Text style={styles.switchButtonText}>
          {mode === 'qr' ? '⌨️ Saisie manuelle' : '📷 Scanner QR Code'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#10b981',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  validatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 26, 0.85)',
    gap: 16,
  },
  validatingText: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  manualContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontFamily: 'monospace',
  },
  primaryButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  disabled: {
    opacity: 0.6,
  },
  errorContainer: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  switchButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 14,
    color: '#34d399',
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    color: '#34d399',
    fontWeight: '600',
  },
});
