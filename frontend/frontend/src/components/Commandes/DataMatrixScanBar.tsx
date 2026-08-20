import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanLine, X, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { ScanResult } from '../../hooks/useDataMatrixScanner';

type FeedbackState =
    | { type: 'idle' }
    | { type: 'success'; message: string }
    | { type: 'warning'; message: string }
    | { type: 'error'; message: string };

const SCAN_TIMEOUT_MS = 80;
const MIN_SCAN_LENGTH = 18;

const FEEDBACK_COLORS: Record<FeedbackState['type'], string> = {
    idle: 'bg-slate-800/90 border-slate-600',
    success: 'bg-emerald-800/90 border-emerald-500',
    warning: 'bg-amber-800/90 border-amber-500',
    error: 'bg-red-800/90 border-red-500',
};

const FEEDBACK_ICONS = {
    idle: <ScanLine className="size-4 text-slate-300 animate-pulse" />,
    success: <CheckCircle2 className="size-4 text-emerald-300" />,
    warning: <AlertTriangle className="size-4 text-amber-300" />,
    error: <XCircle className="size-4 text-red-300" />,
};

interface DataMatrixScanBarProps {
    onScan: (raw: string) => ScanResult;
    searchInputRef?: React.RefObject<HTMLInputElement>;
    onClearSearchInput?: () => void;
    active?: boolean;
}

export default function DataMatrixScanBar({
    onScan,
    searchInputRef,
    onClearSearchInput,
    active = true,
}: DataMatrixScanBarProps) {
    const { t } = useTranslation(['orders']);
    const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });
    const [isVisible, setIsVisible] = useState(true);
    const bufferRef = useRef('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showFeedback = useCallback((state: FeedbackState, autoClearMs = 4000) => {
        setFeedback(state);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        if (state.type !== 'idle') {
            feedbackTimerRef.current = setTimeout(() => setFeedback({ type: 'idle' }), autoClearMs);
        }
    }, []);

    const handleBuffer = useCallback(() => {
        const raw = bufferRef.current.trim();
        bufferRef.current = '';

        if (!raw || raw.length < 6) return;

        const result = onScan(raw);

        switch (result.status) {
            case 'filled':
                showFeedback({
                    type: 'success',
                    message: t('orders:data_matrix_scanner.filled', {
                        cip: result.cip,
                        lot: result.lot || '—',
                        date: result.date || '—',
                    }),
                });
                break;
            case 'already_filled':
                showFeedback({
                    type: 'warning',
                    message: t('orders:data_matrix_scanner.already_filled', { cip: result.cip }),
                }, 5000);
                break;
            case 'not_found':
                showFeedback({
                    type: 'error',
                    message: t('orders:data_matrix_scanner.not_found', { cip: result.cip ?? '—' }),
                });
                setTimeout(() => searchInputRef?.current?.focus(), 50);
                break;
            case 'parse_error':
                showFeedback({
                    type: 'error',
                    message: t('orders:data_matrix_scanner.parse_error'),
                });
                break;
        }
    }, [onScan, showFeedback, searchInputRef, t]);

    useEffect(() => {
        if (!active) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const tag = target.tagName;
            const isInInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;

            if (e.key === 'Enter') {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
                if (bufferRef.current.length >= MIN_SCAN_LENGTH) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isInInput) {
                        onClearSearchInput?.();
                    }
                    handleBuffer();
                } else {
                    bufferRef.current = '';
                }
                return;
            }

            if (e.key.length === 1 || e.key === 'GS' || e.charCode === 29) {
                bufferRef.current += e.key === 'GS' ? '\x1d' : e.key;

                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                    if (bufferRef.current.length >= MIN_SCAN_LENGTH) {
                        if (isInInput) {
                            onClearSearchInput?.();
                        }
                        handleBuffer();
                    } else {
                        bufferRef.current = '';
                    }
                }, SCAN_TIMEOUT_MS);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, handleBuffer]);

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="fixed top-2 right-2 z-50 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg hover:bg-indigo-700 transition-colors"
                title={t('orders:data_matrix_scanner.show_title')}
                aria-label={t('orders:data_matrix_scanner.show_title')}
            >
                <ScanLine className="size-4" />
            </button>
        );
    }

    return (
        <div
            className={`fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-sm transition-all duration-300 ${FEEDBACK_COLORS[feedback.type]}`}
        >
            {FEEDBACK_ICONS[feedback.type]}
            <span className="text-xs font-medium text-white max-w-[480px] truncate">
                {feedback.type === 'idle'
                    ? t('orders:data_matrix_scanner.active')
                    : feedback.message}
            </span>
            <button
                onClick={() => setIsVisible(false)}
                className="ml-1 text-white/60 hover:text-white transition-colors"
                title={t('orders:data_matrix_scanner.hide_title')}
                aria-label={t('orders:data_matrix_scanner.hide_title')}
            >
                <X className="size-3" />
            </button>
        </div>
    );
}
