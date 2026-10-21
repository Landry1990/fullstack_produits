import { formatDate as _formatDate } from './dateUtils';

const DEFAULT_CURRENCY_FORMATTER = new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
});

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (locale: string, options: Intl.NumberFormatOptions) => {
    // Optimization for the most common case
    if (locale === 'fr-FR' && options.minimumFractionDigits === 0 && options.maximumFractionDigits === 0 && Object.keys(options).length === 2) {
        return DEFAULT_CURRENCY_FORMATTER;
    }

    const key = `${locale}-${JSON.stringify(options)}`;
    let formatter = formatterCache.get(key);
    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, options);
        formatterCache.set(key, formatter);
    }
    return formatter;
};

// Intl fr-FR groupe avec espace fine insécable (U+202F) — rendu aléatoire
// selon la fonte de fallback. Convention : point en fr, virgule en en.
const GROUP_SEPARATORS = /[\u00A0\u202F\u2000-\u200F]/g;
const formatNumberString = (value: number, locale: string, options: Intl.NumberFormatOptions) => {
    const formatted = getFormatter(locale, options).format(value);
    return locale.toLowerCase().startsWith('fr')
        ? formatted.replace(GROUP_SEPARATORS, '.')
        : formatted.replace(GROUP_SEPARATORS, ' ');
};

export const normalizeNumberInput = (value: string | number | null | undefined, options?: { min?: number; max?: number }) => {
    let parsedValue: number

    if (value == null) {
        return 0
    }

    if (typeof value === 'number') {
        parsedValue = value
    } else {
        // Remplacer la virgule par un point pour le format décimal
        parsedValue = Number(value.toString().replace(',', '.'))
    }

    if (!Number.isFinite(parsedValue)) {
        parsedValue = 0
    }

    if (options?.min !== undefined) {
        parsedValue = Math.max(options.min, parsedValue)
    }

    if (options?.max !== undefined) {
        parsedValue = Math.min(options.max, parsedValue)
    }

    return parsedValue
}

export const formatPrice = (price: number, decimals: number = 0, locale: string = 'fr-FR') => {
    return formatNumberString(price, locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export const formatCurrency = (amount: number, locale: string = 'fr-FR', symbol: string = 'F') => {
    return formatNumberString(amount, locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }) + '\u00a0' + symbol;
}

export const formatCompact = (value: number, locale: string = 'fr-FR') => {
    return formatNumberString(value, locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
    });
}

export const formatNumber = (value: number, decimals: number = 0, locale: string = 'fr-FR') => {
    return formatNumberString(value, locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export const safeFormatNumber = (value: unknown) => {
    if (value === undefined || value === null) return formatCurrency(0);
    const num = Number(value);
    return isNaN(num) ? formatCurrency(0) : formatCurrency(num);
}

export const formatDateFr = (dateString: string | Date) => {
    if (!dateString) return '--/--/----';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--/--/----';
    return _formatDate(date);
}
