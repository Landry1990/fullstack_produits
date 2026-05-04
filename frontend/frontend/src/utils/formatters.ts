import { formatDate as _formatDate } from './dateUtils';

export const normalizeNumberInput = (value: string | number, options?: { min?: number; max?: number }) => {
    let parsedValue: number

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
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(price);
}

export const formatCurrency = (amount: number, locale: string = 'fr-FR', symbol: string = 'F') => {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount) + '\u00a0' + symbol;
}

export const formatNumber = (value: number, decimals: number = 0, locale: string = 'fr-FR') => {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

export const safeFormatNumber = (value: any) => {
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
