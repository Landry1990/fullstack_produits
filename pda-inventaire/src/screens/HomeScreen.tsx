import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { inventaireService } from '../services/inventaire';
import { produitService } from '../services/inventaire';
import { productCacheService } from '../services/productCache';
import { localStorageService } from '../services/localStorage';
import { confirmDialog } from '../utils/confirmDialog';
import type { Inventaire, InventaireScope, ScopeOption } from '../services/inventaire';
import { useAuthStore } from '../stores/useAuthStore';
import { theme } from '../config/theme';

interface HomeScreenProps {
  onSelectInventaire: (inventaire: Inventaire) => void;
  onLogout: () => void;
}

export default function HomeScreen({ onSelectInventaire, onLogout }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { username, logout } = useAuthStore();
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  
  // Filtre: Mes inventaires vs Tous
  const [filter, setFilter] = useState<'MINE' | 'ALL'>('MINE');
  
  // Modal création inventaire
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Périmètre de l'inventaire (Tout / Rayon / Forme) + listes de choix
  const [scopeKind, setScopeKind] = useState<'TOUT' | 'RAYON' | 'FORME'>('TOUT');
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState<number | null>(null);
  const [loadingScopeOptions, setLoadingScopeOptions] = useState(false);
  const [scopeMap, setScopeMap] = useState<Record<number, InventaireScope>>({});

  const loadData = async () => {
    try {
      const invData = await inventaireService.getInventaires();
      const enCours = invData.filter(i => i.status === 'EN_COURS');
      setInventaires(enCours);
      // Périmètres stockés localement (créés depuis ce PDA)
      const entries = await Promise.all(
        enCours.map(async i => [i.id, await localStorageService.getScope(i.id)] as const)
      );
      const map: Record<number, InventaireScope> = {};
      for (const [id, scope] of entries) {
        if (scope) map[id] = scope;
      }
      setScopeMap(map);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 401) {
        console.error('Erreur chargement:', error);
        showAlert(t('common.error'), t('home.inventories_error'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCatalogCount();
  }, []);

  const loadCatalogCount = async () => {
    const count = await productCacheService.getCount();
    setCatalogCount(count);
  };

  const handleDownloadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const { updated, total } = await produitService.syncCatalog();
      setCatalogCount(total);
      showAlert(t('home.catalog_downloaded'), t('home.catalog_downloaded_msg', { count: total, updated }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('home.catalog_download_error');
      showAlert(t('common.error'), message);
    } finally {
      setCatalogLoading(false);
    }
  };

  // Purge manuelle du cache + lignes offline : utile en cas de changement de
  // pharmacie à IP identique, ou pour repartir sur des données propres.
  const handlePurgeCache = async () => {
    const unsynced = await localStorageService.getUnsyncedCount();
    const ok = await confirmDialog(
      t,
      t('home.purge_title'),
      unsynced > 0
        ? t('home.purge_msg_unsynced', { count: unsynced })
        : t('home.purge_msg')
    );
    if (!ok) return;

    await Promise.all([
      productCacheService.clear(),
      localStorageService.clearAll(),
    ]);
    setCatalogCount(0);
    showAlert(t('home.purge_title'), t('home.purge_done'));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = () => {
    showAlert(
      t('home.logout_title'),
      t('home.logout_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('home.logout_confirm'), 
          style: 'destructive',
          onPress: async () => {
            logout();
            onLogout();
          }
        },
      ]
    );
  };

  // Charge la liste des options du périmètre choisi (rayons ou formes)
  const handleScopeKindChange = async (kind: 'TOUT' | 'RAYON' | 'FORME') => {
    setScopeKind(kind);
    setSelectedScopeId(null);
    if (kind === 'TOUT') {
      setScopeOptions([]);
      return;
    }
    setLoadingScopeOptions(true);
    try {
      const options = kind === 'RAYON'
        ? await inventaireService.getRayons()
        : await inventaireService.getFormes();
      setScopeOptions(options);
    } catch {
      showAlert(t('common.error'), t('home.scope_options_error'));
      setScopeKind('TOUT');
      setScopeOptions([]);
    } finally {
      setLoadingScopeOptions(false);
    }
  };

  // Créer un nouvel inventaire — la référence INV-YYYYMM-XXXX est générée
  // par le backend (numérotation harmonisée avec le web) ; le champ saisi
  // est un libellé libre optionnel stocké en `description`.
  const handleCreateInventaire = async () => {
    const selectedOption = scopeKind !== 'TOUT'
      ? scopeOptions.find(o => o.id === selectedScopeId)
      : undefined;
    if (scopeKind !== 'TOUT' && !selectedOption) {
      showAlert(t('common.error'), t('home.scope_required'));
      return;
    }

    setCreating(true);
    try {
      // Inventaire filtré → on compte le stock rayon (présent physique).
      const inventoryType = scopeKind === 'TOUT' ? undefined : 'RAYON';
      const newInv = await inventaireService.createInventaire(newName.trim() || undefined, { inventoryType });

      if (scopeKind !== 'TOUT' && selectedOption) {
        const scope: InventaireScope = {
          kind: scopeKind,
          id: selectedOption.id,
          name: selectedOption.name,
        };
        try {
          const { count } = await inventaireService.prePopulate(newInv.id, scope);
          await localStorageService.saveScope(newInv.id, scope);
          showAlert(
            t('home.preload_done_title'),
            t('home.preload_done_msg', { count, name: selectedOption.name })
          );
        } catch {
          // L'inventaire est créé mais vide : pas de périmètre mémorisé
          // (sinon le PDA enverrait en mode 'replace' et afficherait un
          // badge trompeur). Le pré-remplissage reste refaisable côté web —
          // les lignes créées là basculeront le PDA en mode pré-rempli.
          showAlert(t('common.error'), t('home.preload_error'));
        }
      }

      setShowCreateModal(false);
      setNewName('');
      setScopeKind('TOUT');
      setScopeOptions([]);
      setSelectedScopeId(null);
      // Aller directement au scanner
      onSelectInventaire(newInv);
    } catch (error: unknown) {
      console.error('Erreur création:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      showAlert(t('common.error'), axiosError.response?.data?.detail || t('home.create_inventory_error'));
    } finally {
      setCreating(false);
    }
  };

  // Champ nom vide : le backend génère la référence INV-YYYYMM-XXXX
  const openCreateModal = () => {
    setNewName('');
    setScopeKind('TOUT');
    setScopeOptions([]);
    setSelectedScopeId(null);
    setShowCreateModal(true);
  };

  // Suppression d'un inventaire (soft-delete serveur) + purge de ses lignes
  // offline locales — sinon elles seraient renvoyées vers un inventaire
  // supprimé.
  const handleDeleteInventaire = async (item: Inventaire) => {
    const title = item.reference || item.description?.trim() || t('home.inventory_fallback', { id: item.id });
    const localLines = await localStorageService.getLignesByInventaire(item.id);
    const unsynced = localLines.filter(l => !l.synced).length;

    const msg = unsynced > 0
      ? t('home.delete_msg_unsynced', { title, count: unsynced })
      : t('home.delete_msg', { title });
    const ok = await confirmDialog(t, t('home.delete_title'), msg);
    if (!ok) return;

    try {
      await inventaireService.deleteInventaire(item.id);
      await localStorageService.removeLignesByInventaire(item.id);
      await localStorageService.removeScope(item.id);
      setInventaires(prev => prev.filter(i => i.id !== item.id));
    } catch (error) {
      console.error('Erreur suppression inventaire:', error);
      showAlert(t('common.error'), t('home.delete_error'));
    }
  };

  const renderItem = ({ item }: { item: Inventaire }) => {
    const lignesCount = item.lignes_count ?? item.lignes?.length ?? 0;
    const ecart = item.lignes?.reduce((total, ligne) => total + Number(ligne.ecart ?? 0), 0) ?? 0;
    const createdAt = new Date(item.created_at || item.date);
    const title = item.reference || item.description?.trim() || t('home.inventory_fallback', { id: item.id });

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelectInventaire(item)}
        onLongPress={() => handleDeleteInventaire(item)}
        delayLongPress={500}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{t('home.status_in_progress')}</Text>
          </View>
        </View>
        {item.description?.trim() && item.description.trim() !== title && (
          <Text style={styles.cardDescription} numberOfLines={1}>{item.description.trim()}</Text>
        )}
        {scopeMap[item.id] && (
          <View style={styles.scopeBadge}>
            <Text style={styles.scopeBadgeText} numberOfLines={1}>
              {scopeMap[item.id].kind === 'RAYON'
                ? t('home.scope_badge_rayon', { name: scopeMap[item.id].name })
                : t('home.scope_badge_forme', { name: scopeMap[item.id].name })}
            </Text>
          </View>
        )}
        <View style={styles.cardMetrics}>
          <View>
            <Text style={styles.metricLabel}>{t('home.created_at')}</Text>
            <Text style={styles.metricValue}>
              {createdAt.toLocaleDateString('fr-FR')} à {createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.metricRight}>
            <Text style={styles.metricLabel}>{t('common.lines_count', { count: lignesCount })}</Text>
            <Text style={[styles.ecartValue, ecart === 0 ? styles.ecartNeutral : ecart > 0 ? styles.ecartPositive : styles.ecartNegative]}>
              {t('home.gap_label')} {ecart > 0 ? '+' : ''}{ecart}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredInventaires = inventaires.filter(i => {
    // Le filtre "Mes inventaires" n'est plus disponible faute de l'ID
    // utilisateur en mémoire ; tous les inventaires en cours sont affichés.
    if (filter === 'MINE') {
        return i.created_by_name === username;
    }
    return true;
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View>
          <Text style={styles.greeting}>{t('home.greeting')}</Text>
          <Text style={styles.username}>{username || t('home.user_fallback')}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t('home.logout_short')}</Text>
        </TouchableOpacity>
      </View>

      {/* Catalogue offline */}
      <View style={styles.catalogBar}>
        <View style={styles.catalogInfo}>
          <Text style={styles.catalogLabel}>{t('home.catalog_label')}</Text>
          <Text style={styles.catalogCount}>
            {catalogLoading ? t('home.catalog_loading') : catalogCount !== null ? t('home.catalog_count', { count: catalogCount }) : t('home.catalog_empty')}
          </Text>
        </View>
        <View style={styles.catalogActions}>
          <TouchableOpacity
            style={styles.purgeBtn}
            onPress={handlePurgeCache}
            disabled={catalogLoading}
          >
            <Text style={styles.purgeBtnText}>{t('home.purge')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.catalogBtn, catalogLoading && styles.btnDisabled]}
            onPress={handleDownloadCatalog}
            disabled={catalogLoading}
          >
            {catalogLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.catalogBtnText}>{t('common.download')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'MINE' && styles.tabActive]} 
          onPress={() => setFilter('MINE')}
        >
          <Text style={[styles.tabText, filter === 'MINE' && styles.tabTextActive]}>{t('home.tab_mine')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'ALL' && styles.tabActive]} 
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>{t('home.tab_all')}</Text>
        </TouchableOpacity>
      </View>

      {filteredInventaires.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {filter === 'MINE' ? t('home.empty_mine') : t('home.empty_all')}
          </Text>
          <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
            <Text style={styles.createBtnText}>{t('home.create_inventory')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredInventaires}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* FAB pour créer un inventaire */}
      {inventaires.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
      {/* Modal création */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('home.new_inventory_title')}</Text>
            
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('home.reference_placeholder')}
              placeholderTextColor={theme.textMuted}
              autoFocus
            />

            {/* Périmètre : tout le stock, un rayon ou une forme */}
            <Text style={styles.scopeLabel}>{t('home.scope_label')}</Text>
            <View style={styles.scopeRow}>
              {(['TOUT', 'RAYON', 'FORME'] as const).map(kind => (
                <TouchableOpacity
                  key={kind}
                  style={[styles.scopeChip, scopeKind === kind && styles.scopeChipActive]}
                  onPress={() => handleScopeKindChange(kind)}
                >
                  <Text style={[styles.scopeChipText, scopeKind === kind && styles.scopeChipTextActive]}>
                    {kind === 'TOUT' ? t('home.scope_all') : kind === 'RAYON' ? t('home.scope_rayon') : t('home.scope_forme')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {scopeKind !== 'TOUT' && (
              <View style={styles.scopeListWrap}>
                {loadingScopeOptions ? (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 16 }} />
                ) : (
                  <FlatList
                    style={styles.scopeList}
                    data={scopeOptions}
                    keyExtractor={o => String(o.id)}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item: opt }) => (
                      <TouchableOpacity
                        style={[styles.scopeOption, selectedScopeId === opt.id && styles.scopeOptionActive]}
                        onPress={() => setSelectedScopeId(opt.id)}
                      >
                        <Text
                          style={[styles.scopeOptionText, selectedScopeId === opt.id && styles.scopeOptionTextActive]}
                          numberOfLines={1}
                        >
                          {opt.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <Text style={styles.scopeEmpty}>{t('home.scope_empty')}</Text>
                    }
                  />
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalCreateBtn, creating && styles.btnDisabled]}
                onPress={handleCreateInventaire}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalCreateText}>{t('common.create')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.bg,
  },
  loadingText: {
    color: theme.textMuted,
    marginTop: 16,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: theme.bgElevated,
  },
  greeting: {
    color: theme.textMuted,
    fontSize: 14,
  },
  username: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.dangerWash,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.danger,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: theme.bgElevated,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
    marginRight: 12,
  },
  statusPill: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPillText: {
    color: theme.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  cardDescription: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  cardMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: theme.textMuted,
    fontSize: 11,
    marginBottom: 3,
  },
  metricValue: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  ecartValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  ecartNeutral: {
    color: theme.textMuted,
  },
  ecartPositive: {
    color: theme.primary,
  },
  ecartNegative: {
    color: theme.danger,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 16,
    marginBottom: 20,
  },
  createBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: theme.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: theme.bgElevated,
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: theme.bgMuted,
    borderRadius: 10,
    padding: 14,
    color: theme.text,
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  scopeLabel: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scopeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  scopeChipActive: {
    backgroundColor: theme.primaryLight,
    borderColor: theme.primary,
  },
  scopeChipText: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  scopeChipTextActive: {
    color: theme.primaryDark,
  },
  scopeListWrap: {
    marginBottom: 12,
  },
  scopeList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.bgMuted,
  },
  scopeOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  scopeOptionActive: {
    backgroundColor: theme.primaryLight,
  },
  scopeOptionText: {
    color: theme.text,
    fontSize: 14,
  },
  scopeOptionTextActive: {
    color: theme.primaryDark,
    fontWeight: '700',
  },
  scopeEmpty: {
    color: theme.textMuted,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
  scopeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  scopeBadgeText: {
    color: theme.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.bgMuted,
    alignItems: 'center',
  },
  modalCancelText: {
    color: theme.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  modalCreateBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  modalCreateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.primary,
  },
  tabText: {
    color: theme.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.primary,
  },
  catalogBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bgElevated,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  catalogInfo: {
    flex: 1,
  },
  catalogLabel: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: 2,
  },
  catalogCount: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  catalogActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  purgeBtn: {
    backgroundColor: theme.dangerWash,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  purgeBtnText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  catalogBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  catalogBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
