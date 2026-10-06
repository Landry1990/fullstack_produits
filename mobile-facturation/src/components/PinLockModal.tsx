import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useLockStore } from '../stores/useLockStore';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type View_ = 'menu' | 'define' | 'verify';
type VerifyTarget = 'change' | 'disable';

const PIN_RE = /^\d{4,6}$/;
const DELAY_SECS = [0, 60, 300];
const DELAY_KEYS = ['pin.delay_now', 'pin.delay_1min', 'pin.delay_5min'] as const;

// Réglage du verrouillage PIN : définition/changement/désactivation du
// code + délai avant verrouillage quand l'app repasse au premier plan.
export function PinLockModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { pinSet, delaySec, setPin, checkPin, setDelaySec, lock } = useLockStore();

  const [view, setView] = useState<View_>('menu');
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget>('change');
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setView('menu');
      setPinValue('');
      setConfirm('');
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const handleDefine = async () => {
    if (busy) return;
    if (!PIN_RE.test(pin)) {
      setError(t('pin.error_format'));
      return;
    }
    if (pin !== confirm) {
      setError(t('pin.error_mismatch'));
      setConfirm('');
      return;
    }
    setBusy(true);
    await setPin(pin);
    setBusy(false);
    setView('menu');
    setPinValue('');
    setConfirm('');
  };

  const handleVerify = async () => {
    if (!pin || busy) return;
    setBusy(true);
    const ok = await checkPin(pin);
    setBusy(false);
    if (!ok) {
      setPinValue('');
      setError(t('pin.error_wrong'));
      return;
    }
    setPinValue('');
    setError(null);
    if (verifyTarget === 'disable') {
      await setPin(null);
      setView('menu');
    } else {
      setView('define');
    }
  };

  const PinInput = ({ value, onChange, placeholder, onSubmit }: {
    value: string; onChange: (t: string) => void;
    placeholder: string; onSubmit?: () => void;
  }) => (
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      placeholder={placeholder}
      placeholderTextColor={theme.textMuted}
      value={value}
      onChangeText={(t) => { onChange(t.replace(/\D/g, '')); setError(null); }}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      autoFocus
      onSubmitEditing={onSubmit}
      returnKeyType={onSubmit ? 'go' : 'next'}
    />
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }]}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Lock size={ms(18)} color={pinSet ? theme.primary : theme.textMuted} />
            <Text style={styles.title}>{t('pin.title')}</Text>
          </View>

          {view === 'menu' && (
            <>
              <Text style={styles.subtitle}>
                {pinSet ? t('pin.subtitle_set') : t('pin.subtitle_unset')}
              </Text>

              {pinSet && (
                <View style={styles.delayRow}>
                  <Text style={styles.delayLabel}>{t('pin.lock_after')}</Text>
                  {DELAY_SECS.map((sec, i) => (
                    <TouchableOpacity
                      key={sec}
                      style={[styles.chip, delaySec === sec && styles.chipActive]}
                      onPress={() => setDelaySec(sec)}
                    >
                      <Text style={[styles.chipText, delaySec === sec && styles.chipTextActive]}>
                        {t(DELAY_KEYS[i])}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.actions}>
                {pinSet ? (
                  <>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => { lock(); onClose(); }}
                    >
                      <Text style={styles.primaryText}>{t('pin.lock_now')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => { setVerifyTarget('change'); setView('verify'); }}
                    >
                      <Text style={styles.secondaryText}>{t('pin.change')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setVerifyTarget('disable'); setView('verify'); }}
                    >
                      <Text style={styles.dangerText}>{t('pin.disable')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setView('define')}>
                    <Text style={styles.primaryText}>{t('pin.define_btn')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={styles.closeLink}>
                  <Text style={styles.closeText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {view === 'define' && (
            <>
              <Text style={styles.subtitle}>
                {pinSet ? t('pin.define_title_set') : t('pin.define_title_unset')}
              </Text>
              <PinInput value={pin} onChange={setPinValue} placeholder={t('pin.pin_placeholder')} />
              <PinInput value={confirm} onChange={setConfirm} placeholder={t('pin.confirm_placeholder')} onSubmit={handleDefine} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.primaryBtn, (!pin || !confirm || busy) && styles.btnDisabled]}
                  onPress={handleDefine}
                  disabled={!pin || !confirm || busy}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.primaryText}>{t('pin.save')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setView('menu'); setError(null); setPinValue(''); setConfirm(''); }} style={styles.closeLink}>
                  <Text style={styles.closeText}>{t('common.back')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {view === 'verify' && (
            <>
              <Text style={styles.subtitle}>
                {verifyTarget === 'disable' ? t('pin.verify_disable') : t('pin.verify_change')}
              </Text>
              <PinInput value={pin} onChange={setPinValue} placeholder={t('pin.current_placeholder')} onSubmit={handleVerify} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.primaryBtn, (!pin || busy) && styles.btnDisabled]}
                  onPress={handleVerify}
                  disabled={!pin || busy}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.primaryText}>{t('common.validate')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setView('menu'); setError(null); setPinValue(''); }} style={styles.closeLink}>
                  <Text style={styles.closeText}>{t('common.back')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
    padding: ms(20),
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  title: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  subtitle: { fontSize: ms(12), color: theme.textMuted, marginTop: ms(8), lineHeight: ms(17) },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    marginTop: ms(14),
    flexWrap: 'wrap',
  },
  delayLabel: { fontSize: ms(12), color: theme.textSecondary, marginRight: ms(2) },
  chip: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderRadius: ms(14),
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.primaryWash, borderColor: theme.primary },
  chipText: { fontSize: ms(12), fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: theme.primaryDark },
  input: {
    backgroundColor: theme.bg,
    borderRadius: ms(8),
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    color: theme.text,
    fontSize: ms(16),
    textAlign: 'center',
    letterSpacing: ms(4),
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: ms(12),
  },
  inputError: { borderColor: theme.danger },
  error: { color: theme.danger, fontSize: ms(12), marginTop: ms(6) },
  actions: { marginTop: ms(18), gap: ms(8), alignItems: 'stretch' },
  primaryBtn: {
    backgroundColor: theme.primary,
    borderRadius: ms(8),
    paddingVertical: ms(11),
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },
  secondaryBtn: {
    backgroundColor: theme.bgMuted,
    borderRadius: ms(8),
    paddingVertical: ms(11),
    alignItems: 'center',
  },
  secondaryText: { color: theme.text, fontWeight: '600', fontSize: ms(14) },
  dangerText: { color: theme.danger, fontSize: ms(13), fontWeight: '600', textAlign: 'center', paddingVertical: ms(4) },
  closeLink: { paddingVertical: ms(4), alignItems: 'center' },
  closeText: { color: theme.textMuted, fontSize: ms(13), fontWeight: '600' },
});
