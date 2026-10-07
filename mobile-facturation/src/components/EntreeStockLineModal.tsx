import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { applyLinkedField, type EntreeEditableField } from '../stores/useEntreeStockStore';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import type { EntreeStockLine } from '../types';

// Saisie expiration MM/AA — port de normalizeExpiryMMYY /
// finalizeExpiryMMYY du web (productTableUtils.ts).
const normalizeExpiryMMYY = (raw: string) => {
  const cleaned = String(raw ?? '').replace(/\s/g, '').replace(/[^0-9/]/g, '');
  if (cleaned === '') return '';
  const digits = cleaned.replace(/\//g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const finalizeExpiryMMYY = (raw: string) => {
  const normalized = normalizeExpiryMMYY(raw);
  const match = normalized.match(/^(\d{1,2})(?:\/(\d{0,2}))?$/);
  if (!match) return '';
  const mmRaw = match[1] || '';
  const yyRaw = match[2] || '';
  if (mmRaw.length === 0) return '';
  const mmNum = Number(mmRaw);
  if (!Number.isFinite(mmNum) || mmNum < 1 || mmNum > 12) return '';
  if (yyRaw.length !== 2) return `${String(mmNum).padStart(2, '0')}${yyRaw ? `/${yyRaw}` : ''}`;
  return `${String(mmNum).padStart(2, '0')}/${yyRaw}`;
};

export const isValidExpiryMMYY = (v: string) =>
  v === '' || /^(0[1-9]|1[0-2])\/\d{2}$/.test(v);

interface Props {
  visible: boolean;
  // Copie de travail éditée par l'écran parent (recalculs liés via
  // applyLinkedField). null = modal fermée.
  line: EntreeStockLine | null;
  isNew: boolean;
  // Taux de TVA actifs configurés en pharmacie (menu déroulant).
  tvaOptions: string[];
  onChange: (field: EntreeEditableField, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EntreeStockLineModal({ visible, line, isNew, tvaOptions, onChange, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [expDraft, setExpDraft] = useState('');
  const [tvaOpen, setTvaOpen] = useState(false);

  // Resynchronise le brouillon d'expiration à l'ouverture d'une ligne.
  useEffect(() => {
    if (line) {
      setExpDraft(line.date_expiration);
      setTvaOpen(false);
    }
  }, [line?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!line) return null;

  const p = line.product;
  const expInvalid = expDraft !== '' && !isValidExpiryMMYY(expDraft);

  const numericField = (
    field: EntreeEditableField,
    label: string,
    opts?: { decimal?: boolean; accent?: boolean }
  ) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, opts?.accent && styles.inputAccent]}
        value={String(line[field] ?? '')}
        onChangeText={(v) => {
          const cleaned = opts?.decimal ? v.replace(/[^0-9.,]/g, '') : v.replace(/[^0-9]/g, '');
          onChange(field, cleaned);
        }}
        keyboardType={opts?.decimal ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {isNew ? t('entree.line_add') : t('entree.line_edit')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={ms(20)} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.productCard}>
            <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
            <Text style={styles.productMeta}>
              {t('entree.line_meta', {
                stock: p.stock,
                cost: p.cost_price ?? '-',
              })}
            </Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.row}>
              {numericField('quantity', t('entree.field_qty'))}
              {numericField('unites_gratuites', t('entree.field_ug'))}
            </View>
            <View style={styles.row}>
              {numericField('price', t('entree.field_price'), { decimal: true, accent: true })}
              {/* TVA en menu déroulant (taux configurés en pharmacie) —
                  déclenche le recalcul lié comme une saisie manuelle. */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('entree.field_tva')}</Text>
                <TouchableOpacity
                  style={styles.select}
                  onPress={() => setTvaOpen((v) => !v)}
                >
                  <Text style={styles.selectText}>{line.tva || '0'} %</Text>
                  <ChevronDown size={ms(14)} color={theme.textMuted} />
                </TouchableOpacity>
                {tvaOpen && (
                  <View style={styles.selectList}>
                    {tvaOptions.map((rate) => (
                      <TouchableOpacity
                        key={rate}
                        style={[styles.selectItem, rate === line.tva && styles.selectItemActive]}
                        onPress={() => {
                          onChange('tva', rate);
                          setTvaOpen(false);
                        }}
                      >
                        <Text
                          style={[styles.selectItemText, rate === line.tva && { color: theme.primary }]}
                        >
                          {rate} %
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
            <View style={styles.row}>
              {numericField('marge', t('entree.field_marge'), { decimal: true })}
              {numericField('selling_price', t('entree.field_selling'), { decimal: true, accent: true })}
            </View>
            <Text style={styles.linkedHint}>{t('entree.linked_hint')}</Text>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('entree.field_lot')}</Text>
                <TextInput
                  style={styles.input}
                  value={line.lot}
                  onChangeText={(v) => onChange('lot', v)}
                  autoCapitalize="characters"
                  maxLength={20}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('entree.field_exp')}</Text>
                <TextInput
                  style={[styles.input, expInvalid && styles.inputError]}
                  value={expDraft}
                  onChangeText={(v) => setExpDraft(normalizeExpiryMMYY(v))}
                  onBlur={() => {
                    const finalized = finalizeExpiryMMYY(expDraft);
                    setExpDraft(finalized);
                    onChange('date_expiration', finalized);
                  }}
                  placeholder={t('entree.exp_placeholder')}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
            {p.use_lot_management && (
              <Text style={styles.lotHint}>{t('entree.lot_managed_hint')}</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, expInvalid && { opacity: 0.4 }]}
            disabled={expInvalid}
            onPress={onSave}
          >
            <Text style={styles.saveText}>{t('common.validate')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.bgOverlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: ms(theme.radiusXl),
    borderTopRightRadius: ms(theme.radiusXl),
    padding: ms(16),
    maxHeight: '92%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ms(10),
  },
  sheetTitle: { fontSize: ms(17), fontWeight: '700', color: theme.text, flex: 1 },
  closeBtn: { padding: ms(6) },
  productCard: {
    backgroundColor: theme.infoWash,
    borderRadius: ms(theme.radiusMd),
    borderWidth: 1,
    borderColor: theme.info,
    padding: ms(12),
    marginBottom: ms(12),
  },
  productName: { fontSize: ms(15), fontWeight: '700', color: theme.text },
  productMeta: { fontSize: ms(12), color: theme.textSecondary, marginTop: ms(3) },
  row: { flexDirection: 'row', gap: ms(10), marginBottom: ms(10) },
  field: { flex: 1 },
  fieldLabel: { fontSize: ms(12), fontWeight: '600', color: theme.textMuted, marginBottom: ms(4) },
  input: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: ms(theme.radiusSm),
    paddingVertical: ms(8),
    paddingHorizontal: ms(10),
    fontSize: ms(15),
    fontWeight: '600',
    color: theme.text,
    backgroundColor: theme.bgElevated,
    textAlign: 'right',
  },
  inputAccent: { borderColor: theme.info },
  inputError: { borderColor: theme.danger },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: ms(theme.radiusSm),
    paddingVertical: ms(8),
    paddingHorizontal: ms(10),
    backgroundColor: theme.bgElevated,
  },
  selectText: { fontSize: ms(15), fontWeight: '600', color: theme.text },
  selectList: {
    marginTop: ms(4),
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: ms(theme.radiusSm),
    backgroundColor: theme.bgElevated,
    overflow: 'hidden',
  },
  selectItem: {
    paddingVertical: ms(9),
    paddingHorizontal: ms(10),
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectItemActive: { backgroundColor: theme.primaryWash },
  selectItemText: { fontSize: ms(14), fontWeight: '600', color: theme.text, textAlign: 'right' },
  linkedHint: {
    fontSize: ms(11),
    color: theme.textMuted,
    fontStyle: 'italic',
    marginBottom: ms(12),
    marginTop: ms(-4),
  },
  lotHint: {
    fontSize: ms(11),
    color: theme.warning,
    marginBottom: ms(8),
    marginTop: ms(-4),
  },
  saveBtn: {
    backgroundColor: theme.primary,
    borderRadius: ms(theme.radiusMd),
    paddingVertical: ms(13),
    alignItems: 'center',
    marginTop: ms(6),
  },
  saveText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
});
