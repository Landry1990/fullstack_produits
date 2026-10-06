import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Wallet } from 'lucide-react-native';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { PosteVente } from '../types';

interface Props {
  visible: boolean;
  caisses: PosteVente[];
  onPick: (poste: PosteVente) => void;
  onClose: () => void;
}

// Choix de la caisse destinataire — affiché à l'envoi quand plusieurs
// postes de caisse sont ouverts (sinon le backend routait tout vers la
// dernière caisse ouverte). Chaque ligne = le PosteVente ouvert rattaché
// à une caisse (caisse_nom + nom de la caissière).
export function CaissePickerModal({ visible, caisses, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('caissePicker.title')}</Text>
          <Text style={styles.subtitle}>{t('caissePicker.subtitle')}</Text>

          <FlatList
            data={caisses}
            keyExtractor={(p) => String(p.id)}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => onPick(item)}>
                <Wallet size={ms(18)} color={theme.primary} />
                <Text style={styles.rowText} numberOfLines={1}>
                  {item.caisse_nom || item.nom}
                </Text>
                {item.vendeur_name ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {t('caissePicker.cashier', { name: item.vendeur_name })}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.bgOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderRadius: ms(16),
    width: '100%',
    maxWidth: ms(400),
    maxHeight: '80%',
    padding: ms(20),
  },
  title: { fontSize: ms(18), fontWeight: '700', color: theme.text },
  subtitle: { fontSize: ms(13), color: theme.textMuted, marginTop: ms(4), marginBottom: ms(12) },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    padding: ms(14),
    backgroundColor: theme.bgMuted,
    borderRadius: ms(10),
    marginBottom: ms(6),
  },
  rowText: { flex: 1, fontSize: ms(15), fontWeight: '600', color: theme.text },
  rowMeta: { fontSize: ms(11), color: theme.textMuted },
  cancelBtn: { marginTop: ms(12), alignItems: 'center', paddingVertical: ms(10) },
  cancelText: { color: theme.textMuted, fontSize: ms(14), fontWeight: '600' },
});
