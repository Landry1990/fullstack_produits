import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import { searchClients, createClient } from '../services/api';
import { drfError } from '../utils/drfError';
import type { Client } from '../types';

const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/;

interface Props {
  visible: boolean;
  onClose: () => void;
  // client = null → « Client de passage » (déselection).
  onSelect: (client: Client | null) => void;
}

// Modal de sélection/création de client — entièrement autonome : recherche
// débouncée, formulaire « + Nouveau client », état réinitialisé à la
// fermeture. L'écran ne reçoit que le client choisi (ou null).
export function ClientModal({ visible, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.length >= 2) {
        setSearching(true);
        try {
          setResults(await searchClients(search));
        } catch {}
        setSearching(false);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Réinitialise tout à la fermeture.
  useEffect(() => {
    if (!visible) {
      setSearch('');
      setResults([]);
      setName('');
      setPhone('');
      setFormVisible(false);
      setFormError(null);
    }
  }, [visible]);

  const handleCreate = async () => {
    const n = name.trim();
    const p = phone.trim();
    if (n.length < 2) {
      setFormError(t('clientModal.error_name'));
      return;
    }
    if (p && (!PHONE_REGEX.test(p) || p.replace(/\D/g, '').length < 8)) {
      setFormError(t('clientModal.error_phone'));
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      onSelect(await createClient({ name: n, phone: p || null }));
    } catch (err: unknown) {
      setFormError(drfError((err as { response?: { data?: unknown } })?.response?.data, t('clientModal.create_error')));
    } finally {
      setCreating(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('clientModal.title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {formVisible ? (
          <View>
            <Text style={styles.formLabel}>{t('clientModal.name_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('clientModal.name_placeholder')}
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={(t) => { setName(t); setFormError(null); }}
              autoFocus
            />
            <Text style={styles.formLabel}>{t('clientModal.phone_label')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('clientModal.phone_placeholder')}
              placeholderTextColor={theme.textMuted}
              value={phone}
              onChangeText={(t) => { setPhone(t); setFormError(null); }}
              keyboardType="phone-pad"
            />
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.formBackBtn}
                onPress={() => { setFormVisible(false); setFormError(null); }}
                disabled={creating}
              >
                <Text style={styles.formBackText}>{t('common.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formCreateBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.formCreateText}>{t('common.create')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <TextInput
              style={styles.input}
              placeholder={t('clientModal.search_placeholder')}
              placeholderTextColor={theme.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            <TouchableOpacity
              style={styles.newClientBtn}
              onPress={() => setFormVisible(true)}
            >
              <Text style={styles.newClientText}>{t('clientModal.new_client')}</Text>
            </TouchableOpacity>
            {searching ? (
              <ActivityIndicator color={theme.primary} style={{ marginVertical: ms(20) }} />
            ) : (
              <FlatList
                data={[{ id: 0, name: t('common.walk_in') } as Client, ...results]}
                keyExtractor={(c) => String(c.id)}
                renderItem={({ item }) => (
                  item.id === 0 ? (
                    <TouchableOpacity
                      style={styles.clientItem}
                      onPress={() => onSelect(null)}
                    >
                      <Text style={styles.clientItemName}>{t('common.walk_in')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.clientItem}
                      onPress={() => onSelect(item)}
                    >
                      <View style={styles.clientItemRow}>
                        <Text style={styles.clientItemName}>{item.name}</Text>
                        {item.client_type === 'PROFESSIONNEL' && (
                          <Text style={styles.proBadge}>{t('facturation.pro_badge')}</Text>
                        )}
                      </View>
                      {item.phone ? <Text style={styles.clientItemPhone}>{item.phone}</Text> : null}
                    </TouchableOpacity>
                  )
                )}
                contentContainerStyle={styles.list}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.bgOverlay, justifyContent: 'center', alignItems: 'center', padding: ms(24), zIndex: 30, elevation: 30 },
  sheet: { backgroundColor: theme.bgElevated, borderRadius: ms(16), width: '100%', maxWidth: ms(400), maxHeight: '80%', padding: ms(20) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ms(16) },
  title: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  close: { fontSize: ms(18), color: theme.textMuted },
  input: { backgroundColor: theme.bg, borderRadius: ms(8), paddingHorizontal: ms(12), paddingVertical: ms(10), color: theme.text, fontSize: ms(14), borderWidth: 1, borderColor: theme.border, marginBottom: ms(12) },
  list: { maxHeight: ms(300) },
  clientItem: { padding: ms(12), backgroundColor: theme.bgMuted, borderRadius: ms(8), marginBottom: ms(4) },
  clientItemRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  clientItemName: { fontSize: ms(14), fontWeight: '600', color: theme.text, flexShrink: 1 },
  proBadge: {
    fontSize: ms(9),
    fontWeight: '800',
    color: theme.primary,
    backgroundColor: theme.primaryWash,
    borderRadius: ms(4),
    paddingHorizontal: ms(5),
    paddingVertical: ms(1),
    overflow: 'hidden',
  },
  clientItemPhone: { fontSize: ms(12), color: theme.textMuted, marginTop: ms(2) },
  newClientBtn: { marginBottom: ms(10) },
  newClientText: { fontSize: ms(13), color: theme.primary, fontWeight: '700' },
  formLabel: { fontSize: ms(11), fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: ms(6) },
  formError: { color: theme.danger, fontSize: ms(12), marginBottom: ms(8) },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: ms(10), marginTop: ms(4) },
  formBackBtn: { paddingHorizontal: ms(18), paddingVertical: ms(10), borderRadius: ms(8), backgroundColor: theme.bgMuted },
  formBackText: { color: theme.text, fontWeight: '600', fontSize: ms(14) },
  formCreateBtn: { paddingHorizontal: ms(22), paddingVertical: ms(10), borderRadius: ms(8), backgroundColor: theme.primary, minWidth: ms(90), alignItems: 'center' },
  formCreateText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },
});
