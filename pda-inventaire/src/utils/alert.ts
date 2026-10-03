import { Alert, Platform } from 'react-native';

interface AlertButton {
    text?: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

/**
 * Alert.alert est un no-op sur le web (React Native).
 * Fallback : window.alert (simple) / window.confirm (avec boutons).
 */
export const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
    if (Platform.OS !== 'web') {
        Alert.alert(title, message, buttons);
        return;
    }
    if (!buttons || buttons.length <= 1) {
        window.alert(message ? `${title}\n\n${message}` : title);
        buttons?.[0]?.onPress?.();
        return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    const confirm = buttons.find((b) => b.style !== 'cancel') ?? buttons[0];
    const confirmed = window.confirm(message ? `${title}\n\n${message}` : title);
    (confirmed ? confirm : cancel)?.onPress?.();
};
