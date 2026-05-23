import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export function HistoriqueScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.title}>Historique</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>
          Historique des ventes envoyées à la caisse.
          {'\n\n'}(À implémenter avec stockage local SQLite)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { padding: 6, marginRight: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  placeholder: { textAlign: 'center', color: '#64748b', fontSize: 14, lineHeight: 20 },
});
