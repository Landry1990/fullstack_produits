import React from 'react';
import { Wifi, WifiOff } from 'lucide-react-native';
import { useStockStore } from '../stores/useStockStore';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

// Indicateur du flux stock temps réel (ws/stock/) — affiché dans
// l'en-tête de chaque écran : vert connecté, ambre coupé. Quand le
// flux est down, l'affichage du stock peut être périmé (la relecture
// à l'envoi et le resync au reconnect couvrent ce cas).
export function StockLiveIndicator() {
  const connected = useStockStore((s) => s.connected);
  return connected
    ? <Wifi size={ms(16)} color={theme.primary} style={{ marginLeft: ms(6) }} />
    : <WifiOff size={ms(16)} color={theme.warning} style={{ marginLeft: ms(6) }} />;
}
