import { Alert, Platform } from 'react-native';
import type { TFunction } from 'i18next';

// Alert.alert ne supporte pas les boutons sur web → window.confirm en fallback.
export function confirmDialog(
  t: TFunction,
  title: string,
  message: string
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('common.continue'), style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
