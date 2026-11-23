const XAF_DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 2, 1];
const MAX_ADDITIONAL_CASH = 2500;

export interface CashChangeSuggestion {
    originalChange: number;
    additional: number;
    newAmountReceived: number;
    newChange: number;
    originalPieces: number;
    newPieces: number;
}

function countPieces(amount: number): number {
    let remaining = amount;
    let count = 0;
    for (const denomination of XAF_DENOMINATIONS) {
        count += Math.floor(remaining / denomination);
        remaining %= denomination;
    }
    return count;
}

export function suggestCashChange(amountDue: number, amountReceived: number): CashChangeSuggestion | null {
    if (!Number.isSafeInteger(amountDue) || !Number.isSafeInteger(amountReceived) || amountDue <= 0 || amountReceived <= amountDue) return null;
    const originalChange = amountReceived - amountDue;
    if (originalChange % 25 !== 0) return null;
    const originalPieces = countPieces(originalChange);
    if (originalChange % 1000 === 0 && originalPieces <= 2) return null;
    const maxAdditional = Math.min(MAX_ADDITIONAL_CASH, amountReceived, Number.MAX_SAFE_INTEGER - amountReceived);
    const firstTarget = Math.ceil((originalChange + 1) / 500) * 500;
    let best: CashChangeSuggestion | null = null;
    for (let target = firstTarget; Number.isSafeInteger(target) && target <= originalChange + maxAdditional; target += 500) {
        const additional = target - originalChange;
        const newPieces = countPieces(target);
        if (countPieces(additional) > 3 || newPieces >= originalPieces || (best && newPieces >= best.newPieces)) continue;
        best = { originalChange, additional, newAmountReceived: amountReceived + additional, newChange: target, originalPieces, newPieces };
    }
    return best;
}
