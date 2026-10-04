import { useCallback, useRef, useState } from 'react';

export interface SudoOptions {
  title: string;
  message: string;
  permission: string;
  onCancel?: () => void;
}

export interface SudoState {
  requestId: number;
  visible: boolean;
  title: string;
  message: string;
  permission: string;
  onValidate: (validatorId: number, password: string) => Promise<void>;
}

const initial: SudoState = {
  requestId: 0,
  visible: false,
  title: '',
  message: '',
  permission: '',
  onValidate: async () => {},
};

export function useSudo() {
  const [sudoState, setSudoState] = useState<SudoState>(initial);
  const busyRef = useRef(false);
  const requestIdRef = useRef(0);
  const onCancelRef = useRef<(() => void) | undefined>(undefined);

  const requireSudo = useCallback((
    onSuccess: (validatorId: number, password: string) => void | Promise<void>,
    options: SudoOptions
  ) => {
    const requestId = ++requestIdRef.current;
    onCancelRef.current = options.onCancel;
    setSudoState({
      requestId,
      visible: true,
      title: options.title,
      message: options.message,
      permission: options.permission,
      onValidate: async (validatorId, password) => {
        if (busyRef.current) return;
        busyRef.current = true;
        try {
          await onSuccess(validatorId, password);
          // Ne ferme que si aucune requête plus récente n'a pris la main
          // (ex. prix validé → enchaînement sur le modal remise).
          if (requestIdRef.current === requestId) {
            onCancelRef.current = undefined;
            setSudoState({ ...initial });
          }
        } finally {
          busyRef.current = false;
        }
      },
    });
  }, []);

  const closeSudo = useCallback(() => {
    onCancelRef.current?.();
    onCancelRef.current = undefined;
    setSudoState({ ...initial });
  }, []);

  return { sudoState, requireSudo, closeSudo };
}
