import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { AyantDroit, Client } from '../types';

interface Props {
  client: Client;
  compact?: boolean;
  selected: AyantDroit | null;
  formVisible: boolean;
  nom: string;
  matricule: string;
  onSelectExisting: (ad: AyantDroit) => void;
  onToggleNew: () => void;
  onNomChange: (s: string) => void;
  onMatriculeChange: (s: string) => void;
}

// Bloc « Ayant droit » (clients PRO uniquement) : chips existants +
// formulaire « + Nouveau ». Composant contrôlé — l'état vit dans l'écran
// car le flux d'envoi (useSendSale) lit nom/matricule pour la création.
export function AyantDroitSection({
  client, compact, selected, formVisible, nom, matricule,
  onSelectExisting, onToggleNew, onNomChange, onMatriculeChange,
}: Props) {
  const { t } = useTranslation();
  const ayantsDroit = client.ayants_droit ?? [];
  return (
    <View style={[styles.block, compact && styles.blockCompact]}>
      <Text style={styles.label}>{t('ayantDroit.label')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {ayantsDroit.map((ad) => {
            const sel = selected?.id === ad.id;
            return (
              <TouchableOpacity
                key={ad.id}
                style={[styles.chip, sel && styles.chipSelected]}
                onPress={() => onSelectExisting(ad)}
              >
                <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                  {ad.nom} — {ad.matricule}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.chip, formVisible && styles.chipSelected]}
            onPress={onToggleNew}
          >
            <Text style={[styles.chipText, formVisible && styles.chipTextSelected]}>{t('ayantDroit.new')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {formVisible && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('ayantDroit.name')}
            placeholderTextColor={theme.textMuted}
            value={nom}
            onChangeText={onNomChange}
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            placeholder={t('ayantDroit.matricule')}
            placeholderTextColor={theme.textMuted}
            value={matricule}
            onChangeText={onMatriculeChange}
            autoCapitalize="characters"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginHorizontal: ms(12), marginTop: ms(10) },
  blockCompact: { marginTop: ms(6) },
  label: { fontSize: ms(11), fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: ms(6) },
  chips: { flexDirection: 'row', gap: ms(6) },
  chip: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
    borderRadius: ms(16),
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  chipSelected: { backgroundColor: theme.primaryWash, borderColor: theme.primary },
  chipText: { fontSize: ms(12), color: theme.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: theme.primary },
  form: { flexDirection: 'row', gap: ms(8), marginTop: ms(8) },
  input: {
    flex: 1,
    backgroundColor: theme.bgElevated,
    borderRadius: ms(8),
    paddingHorizontal: ms(10),
    paddingVertical: ms(8),
    color: theme.text,
    fontSize: ms(13),
    borderWidth: 1,
    borderColor: theme.border,
  },
});
