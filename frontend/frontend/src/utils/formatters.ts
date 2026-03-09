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

export const formatPrice = (price: number, decimals: number = 0) => {
    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(price).replace(/\u00a0/g, ' ').replace(/\s/g, ' ');
}

export const formatCurrency = formatPrice;

export const formatNumber = (value: number, decimals: number = 0) => {
    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value).replace(/\u00a0/g, ' ').replace(/\s/g, ' ');
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
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}
