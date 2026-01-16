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

export const formatPrice = (price: number) => {
    return price.toLocaleString('fr-FR')
}
