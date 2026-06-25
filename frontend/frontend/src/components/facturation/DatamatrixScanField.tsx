import React, { useRef, useEffect } from 'react';
import { ScanLine, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { ScanStatus } from '../../hooks/useDatamatrixScan';

interface DatamatrixScanFieldProps {
    value: string;
    onChange: (v: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    status: ScanStatus;
    lastScanned: string | null;
    autoFocus?: boolean;
}

const statusConfig: Record<ScanStatus, { border: string; icon: React.ReactNode; bg: string }> = {
    idle:    { border: 'border-slate-300',   icon: <ScanLine className="size-4 text-slate-400" />,         bg: 'bg-white' },
    loading: { border: 'border-blue-400',    icon: <Loader2 className="size-4 text-blue-500 animate-spin" />, bg: 'bg-blue-50' },
    success: { border: 'border-emerald-400', icon: <CheckCircle className="size-4 text-emerald-500" />,    bg: 'bg-emerald-50' },
    error:   { border: 'border-red-400',     icon: <XCircle className="size-4 text-red-500" />,            bg: 'bg-red-50' },
};

export default function DatamatrixScanField({
    value,
    onChange,
    onKeyDown,
    status,
    lastScanned,
    autoFocus = false,
}: DatamatrixScanFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    const { border, icon, bg } = statusConfig[status];

    return (
        <div className="flex flex-col gap-1">
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {icon}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    className={`w-full pl-10 pr-4 text-sm h-11 rounded-xl border outline-none transition-all font-mono placeholder:text-slate-400 text-slate-700 ${border} ${bg}`}
                    placeholder="Scanner le datamatrix de la boîte…"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    autoComplete="off"
                    spellCheck={false}
                />
                {status === 'idle' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hidden sm:block whitespace-nowrap pointer-events-none">
                        Entrée pour valider
                    </span>
                )}
            </div>
            {status === 'success' && lastScanned && (
                <p className="text-[11px] text-emerald-600 font-medium pl-1 truncate">
                    ✓ {lastScanned}
                </p>
            )}
            {status === 'error' && (
                <p className="text-[11px] text-red-500 pl-1">
                    Produit ou lot introuvable — vérifiez le code-barres
                </p>
            )}
        </div>
    );
}
