import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ScrollView, useWindowDimensions } from 'react-native';
import { ShoppingCart, PackagePlus, PackageX, PackageCheck, BarChart3, LogOut, Store } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/useAuthStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import i18n from '../i18n';

interface Props {
  navigation?: { navigate: (screen: string) => void };
}

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { username, posteVente, logout } = useAuthStore();
  // Écran suffisamment large → menu en 2 colonnes (PDA portrait 605dp
  // compris) ; téléphone portrait (~390-420dp) reste en 1 colonne.
  const { width } = useWindowDimensions();
  const twoCols = width >= 560;

  const handleLogout = () => {
    Alert.alert(t('home.logout_title'), t('home.logout_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('home.logout_confirm'), style: 'destructive', onPress: logout },
    ]);
  };

  const menu = [
    {
      key: 'vente',
      icon: ShoppingCart,
      label: t('home.menu_vente'),
      desc: t('home.menu_vente_desc'),
      screen: 'Facturation',
      accent: theme.primary,
      bg: theme.primaryWash,
    },
    {
      key: 'ajustement',
      icon: PackagePlus,
      label: t('home.menu_ajustement'),
      desc: t('home.menu_ajustement_desc'),
      screen: 'Ajustement',
      accent: theme.warning,
      bg: theme.warningWash,
    },
    {
      key: 'entree',
      icon: PackageCheck,
      label: t('home.menu_entree'),
      desc: t('home.menu_entree_desc'),
      screen: 'EntreeStock',
      accent: theme.info,
      bg: theme.infoWash,
    },
    {
      key: 'signalement',
      icon: PackageX,
      label: t('home.menu_signalement'),
      desc: t('home.menu_signalement_desc'),
      screen: 'Signalement',
      accent: theme.danger,
      bg: theme.dangerWash,
    },
    {
      key: 'dashboard',
      icon: BarChart3,
      label: t('home.menu_dashboard'),
      desc: t('home.menu_dashboard_desc'),
      screen: 'Dashboard',
      accent: theme.textSecondary,
      bg: theme.bgMuted,
    },
  ];

  return (
    <View style={[styles.container, {
      paddingTop: 16 + (Platform.OS === 'web' ? 0 : insets.top),
      paddingBottom: Math.min(insets.bottom, 24),
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      {/* En-tête : identité + poste + langue + déconnexion */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{username}</Text>
          <View style={styles.posteRow}>
            <Store size={ms(12)} color={posteVente ? theme.primary : theme.textMuted} />
            <Text style={[styles.posteText, !posteVente && { color: theme.textMuted }]} numberOfLines={1}>
              {posteVente?.nom ?? t('poste.none')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => useSettingsStore.getState().setLanguage(i18n.language === 'en' ? 'fr' : 'en')}
          style={styles.iconBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.langText}>{i18n.language === 'en' ? 'EN' : 'FR'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
          <LogOut size={ms(20)} color={theme.danger} />
        </TouchableOpacity>
      </View>

      {/* Menu principal — ScrollView : centré quand tout tient,
          scrollable sur petit écran (scrollbar persistante Android). */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.menu, twoCols && styles.menuGrid]}
        persistentScrollbar
      >
        {menu.map((m) => {
          const Icon = m.icon;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.card, twoCols && styles.cardHalf]}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate(m.screen)}
            >
              <View style={[styles.iconBox, { backgroundColor: m.bg }]}>
                <Icon size={ms(26)} color={m.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>{m.label}</Text>
                <Text style={styles.cardDesc}>{m.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    paddingHorizontal: ms(16),
    paddingVertical: ms(14),
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  greeting: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  posteRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(2) },
  posteText: { fontSize: ms(12), color: theme.textSecondary },
  iconBtn: { padding: ms(8) },
  langText: { fontSize: ms(13), fontWeight: '700', color: theme.textMuted },
  // contentContainerStyle du ScrollView : flexGrow + centrage =
  // contenu centré s'il tient, scrollable sinon.
  menu: { flexGrow: 1, padding: ms(16), gap: ms(12), justifyContent: 'center' },
  // Grille paysage : lignes wrap centrées verticalement, 2 colonnes.
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(14),
    backgroundColor: theme.bgElevated,
    borderRadius: ms(theme.radiusLg),
    borderWidth: 1,
    borderColor: theme.border,
    padding: ms(18),
  },
  cardHalf: { width: '48%' },
  iconBox: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(theme.radiusMd),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: { fontSize: ms(16), fontWeight: '700', color: theme.text },
  cardDesc: { fontSize: ms(12), color: theme.textMuted, marginTop: ms(2) },
});
