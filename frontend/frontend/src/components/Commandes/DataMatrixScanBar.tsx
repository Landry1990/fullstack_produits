import { useEffect, useRef, useState, useCallback } from 'react';
import { ScanLine, X, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { ScanResult } from '../../hooks/useDataMatrixScanner';

interface DataMatrixScanBarProps {
    onScan: (raw: string) => ScanResult;
    searchInputRef?: React.RefObject<HTMLInputElement>;
    onClearSearchInput?: () => void;
    active?: boolean;
}

type FeedbackState =
    | { type: 'idle' }
    | { type: 'success'; message: string }
    | { type: 'warning'; message: string }
    | { type: 'error'; message: string };

const SCAN_TIMEOUT_MS = 80; // ms : délai max entre caractères douchette
const MIN_SCAN_LENGTH = 18; // longueur minimale pour considérer comme un scan Data Matrix

export default function DataMatrixScanBar({
    onScan,
    searchInputRef,
    onClearSearchInput,
    active = true,
}: DataMatrixScanBarProps) {
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

        if (!raw || raw.length < 6) return; // trop court pour être un code valide

        const result = onScan(raw);

        switch (result.status) {
            case 'filled':
                showFeedback({
                    type: 'success',
                    message: `✓ ${result.cip} → Lot : ${result.lot || '—'}  Exp : ${result.date || '—'}`,
                });
                break;
            case 'already_filled':
                showFeedback({
                    type: 'warning',
                    message: `Ligne déjà remplie — CIP ${result.cip} (ligne surlignée)`,
                }, 5000);
                break;
            case 'not_found':
                showFeedback({
                    type: 'error',
                    message: `CIP ${result.cip ?? 'inconnu'} non trouvé dans la commande`,
                });
                // Rediriger vers la recherche manuelle
                setTimeout(() => searchInputRef?.current?.focus(), 50);
                break;
            case 'parse_error':
                showFeedback({
                    type: 'error',
                    message: `Code non reconnu`,
                });
                break;
        }
    }, [onScan, showFeedback, searchInputRef]);

    useEffect(() => {
        if (!active) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const tag = target.tagName;
            const isInInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;

            // La douchette envoie Enter à la fin
            if (e.key === 'Enter') {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
                if (bufferRef.current.length >= MIN_SCAN_LENGTH) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Nettoyer l'input si les chars du scan y ont quand même atterri
                    if (isInInput) {
                        onClearSearchInput?.();
                    }
                    handleBuffer();
                } else {
                    bufferRef.current = '';
                }
                return;
            }

            // Filtrer les touches de contrôle (mais garder les chars imprimables + GS)
            if (e.key.length === 1 || e.key === 'GS' || e.charCode === 29) {
                bufferRef.current += e.key === 'GS' ? '\x1d' : e.key;

                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                    // Timeout : si assez long c'est un scan sans Enter final
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
    }, [active, handleBuffer]);

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="fixed top-2 right-2 z-50 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg hover:bg-indigo-700 transition-colors"
                title="Afficher la barre de scan Data Matrix"
            >
                <ScanLine className="size-4" />
            </button>
        );
    }

    const feedbackColors: Record<FeedbackState['type'], string> = {
        idle: 'bg-slate-800/90 border-slate-600',
        success: 'bg-emerald-800/90 border-emerald-500',
        warning: 'bg-amber-800/90 border-amber-500',
        error: 'bg-red-800/90 border-red-500',
    };

    const feedbackIcons = {
        idle: <ScanLine className="size-4 text-slate-300 animate-pulse" />,
        success: <CheckCircle2 className="size-4 text-emerald-300" />,
        warning: <AlertTriangle className="size-4 text-amber-300" />,
        error: <XCircle className="size-4 text-red-300" />,
    };

    return (
        <div
            className={`fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-sm transition-all duration-300 ${feedbackColors[feedback.type]}`}
        >
            {feedbackIcons[feedback.type]}
            <span className="text-xs font-medium text-white max-w-[480px] truncate">
                {feedback.type === 'idle'
                    ? 'Scan Data Matrix actif — pointez la douchette sur un code'
                    : feedback.message}
            </span>
            <button
                onClick={() => setIsVisible(false)}
                className="ml-1 text-white/60 hover:text-white transition-colors"
                title="Masquer"
            >
                <X className="size-3" />
            </button>
        </div>
    );
}
