import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../shadcn/card';

interface LoadingScreenProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    overlay?: boolean;
    className?: string;
}

const sizeClasses = {
    sm: 'size-6',
    md: 'size-10',
    lg: 'size-16',
};

export function LoadingScreen({
    message,
    size = 'md',
    overlay = true,
    className = '',
}: LoadingScreenProps) {
    const { t } = useTranslation('common');

    return (
        <div
            className={`flex items-center justify-center ${
                overlay
                    ? 'fixed inset-0 bg-slate-50/80 backdrop-blur-sm z-50'
                    : 'w-full h-full min-h-[160px]'
            } ${className}`}
        >
            <Card className="border-slate-200 shadow-lg">
                <CardContent className="flex flex-col items-center gap-4 p-8">
                    <Loader2 className={`${sizeClasses[size]} animate-spin text-emerald-600`} />
                    <p className="text-sm font-black uppercase tracking-widest text-slate-500 animate-pulse">
                        {message || t('loading')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
